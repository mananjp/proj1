import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import eventBus from '../events/eventBus.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import Task from '../models/Task.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CSV artifacts produced by the csv-export job land here (mounted as a
// volume in docker-compose.yml).
export const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;

const STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// In-memory store: jobs Map + dead-letter queue
const jobs = new Map();
const deadLetterQueue = [];

// ── Job handlers ────────────────────────────────────────────────────────────
// Each handler receives the job record and a reportProgress(0-100) callback.

async function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function runCsvExport(job, reportProgress) {
  reportProgress(10, 'Fetching tasks');
  const tasks = await Task.find({})
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  reportProgress(50, `Encoding ${tasks.length} tasks`);

  const headers = ['id', 'title', 'description', 'status', 'priority', 'dueDate', 'assignee', 'createdAt'];
  const rows = [headers.join(',')];
  for (const task of tasks) {
    rows.push([
      await csvEscape(task._id),
      await csvEscape(task.title),
      await csvEscape(task.description),
      await csvEscape(task.status),
      await csvEscape(task.priority),
      await csvEscape(task.dueDate ? new Date(task.dueDate).toISOString() : ''),
      await csvEscape(task.assignedTo?.name || task.assignedTo?.email || ''),
      await csvEscape(task.createdAt ? new Date(task.createdAt).toISOString() : '')
    ].join(','));
  }

  reportProgress(80, 'Writing CSV file');
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  const filename = `tasks-export-${job.id.slice(0, 8)}.csv`;
  const filePath = path.join(EXPORTS_DIR, filename);
  await fs.writeFile(filePath, rows.join('\n'), 'utf8');

  reportProgress(100, 'Export complete');
  return { artifact: { filename, path: filePath, rowCount: tasks.length } };
}

async function runSimulateFailure(_job, reportProgress) {
  reportProgress(20, 'Processing batch A');
  await sleep(150);
  reportProgress(55, 'Processing batch B');
  await sleep(150);
  // Deliberate, deterministic failure — demonstrates retries landing in the DLQ.
  throw new Error('Simulated downstream service failure (DEMO_DOWNSTREAM_ERROR)');
}

async function runSimulateRetry(job, reportProgress) {
  reportProgress(30, 'First attempt warming up');
  await sleep(100);
  if (job.attempts === 0) {
    // Fail exactly once so the queue emits job:retry, then succeed.
    throw new Error('Simulated transient failure (will succeed on retry)');
  }
  reportProgress(100, 'Recovered on retry');
  return { result: `Recovered after ${job.attempts} retry attempt(s)` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const JOB_TYPES = {
  'csv-export': {
    handler: runCsvExport,
    description: 'Export tasks to a downloadable CSV artifact'
  },
  'simulate-failure': {
    handler: runSimulateFailure,
    description: 'Always fails; retries then dead-letters (DLQ demo)'
  },
  'simulate-retry': {
    handler: runSimulateRetry,
    description: 'Fails once, succeeds on retry (job:retry demo)'
  }
};

// ── Execution engine ────────────────────────────────────────────────────────

function toPublicJob(job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    progressMessage: job.progressMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    durationMs: job.durationMs,
    error: job.error,
    artifact: job.artifact,
    result: job.result,
    requestedBy: job.requestedBy
  };
}

async function executeJob(job) {
  job.status = STATUS.RUNNING;
  job.startedAt = new Date().toISOString();
  eventBus.emitEvent(EVENT_TYPES.JOB_STARTED, {
    jobId: job.id,
    type: job.type,
    attempt: job.attempts + 1
  });

  const startedAt = Date.now();
  let lastProgressAt = 0;
  const reportProgress = (percent, message) => {
    job.progress = Math.max(0, Math.min(100, Math.round(percent)));
    if (message) job.progressMessage = message;
    const now = Date.now();
    // Throttle progress events to at most one every 100ms
    if (now - lastProgressAt >= 100 || job.progress === 100) {
      lastProgressAt = now;
      eventBus.emitEvent(EVENT_TYPES.JOB_PROGRESS, {
        jobId: job.id,
        type: job.type,
        progress: job.progress,
        message: job.progressMessage
      });
    }
  };

  try {
    const outcome = await JOB_TYPES[job.type].handler(job, reportProgress);
    const durationMs = Date.now() - startedAt;

    job.status = STATUS.COMPLETED;
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.durationMs = durationMs;
    job.artifact = outcome?.artifact || null;
    job.result = outcome?.result || null;

    eventBus.recordJobDuration(durationMs);
    eventBus.emitEvent(EVENT_TYPES.JOB_COMPLETED, {
      jobId: job.id,
      type: job.type,
      durationMs,
      attempts: job.attempts + 1,
      artifact: job.artifact
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    job.attempts += 1;
    job.lastError = error.message;

    if (job.attempts < job.maxAttempts) {
      eventBus.emitEvent(EVENT_TYPES.JOB_RETRY, {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        error: error.message
      });
      const delay = BASE_RETRY_DELAY_MS * 2 ** (job.attempts - 1);
      setTimeout(() => executeJob(job), delay);
      return;
    }

    job.status = STATUS.FAILED;
    job.completedAt = new Date().toISOString();
    job.durationMs = durationMs;
    job.error = error.message;

    eventBus.recordJobDuration(durationMs);
    eventBus.emitEvent(EVENT_TYPES.JOB_FAILED, {
      jobId: job.id,
      type: job.type,
      error: error.message,
      attempts: job.attempts,
      durationMs
    });

    deadLetterQueue.push({
      jobId: job.id,
      type: job.type,
      error: error.message,
      attempts: job.attempts,
      deadLetteredAt: new Date().toISOString(),
      job: toPublicJob(job)
    });
    eventBus.emitEvent(EVENT_TYPES.JOB_DEAD_LETTERED, {
      jobId: job.id,
      type: job.type,
      error: error.message
    });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Accept a job (HTTP 202 semantics). Work runs asynchronously.
 */
export function submitJob({ type, params = {}, user }) {
  const jobType = JOB_TYPES[type];
  if (!jobType) {
    const error = new Error(`Unknown job type "${type}". Valid types: ${Object.keys(JOB_TYPES).join(', ')}`);
    error.code = 'UNKNOWN_JOB_TYPE';
    throw error;
  }

  const job = {
    id: randomUUID(),
    type,
    params,
    status: STATUS.QUEUED,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    progress: 0,
    progressMessage: 'Accepted and queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    error: null,
    artifact: null,
    result: null,
    requestedBy: user ? { id: String(user._id), email: user.email, name: user.name } : null
  };

  jobs.set(job.id, job);
  eventBus.emitEvent(EVENT_TYPES.JOB_ACCEPTED, {
    jobId: job.id,
    type: job.type,
    requestedBy: job.requestedBy?.email || null
  });

  // Run on the next tick so the HTTP 202 response is non-blocking.
  setTimeout(() => executeJob(job), 0);

  return toPublicJob(job);
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  return job ? toPublicJob(job) : null;
}

export function listJobs({ userId, isAdmin = false } = {}) {
  const all = [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = isAdmin ? all : all.filter((job) => job.requestedBy?.id === String(userId));
  return visible.map(toPublicJob);
}

export function getDeadLetterQueue() {
  return [...deadLetterQueue];
}

export function getQueueStats() {
  const all = [...jobs.values()];
  return {
    total: all.length,
    queued: all.filter((j) => j.status === STATUS.QUEUED).length,
    running: all.filter((j) => j.status === STATUS.RUNNING).length,
    completed: all.filter((j) => j.status === STATUS.COMPLETED).length,
    failed: all.filter((j) => j.status === STATUS.FAILED).length,
    deadLettered: deadLetterQueue.length,
    registeredTypes: Object.entries(JOB_TYPES).map(([type, def]) => ({ type, description: def.description }))
  };
}

/**
 * Start the background job worker. Jobs execute inline via the queue engine;
 * this hook exists for lifecycle logging and future worker-pool scaling.
 */
export function startJobWorker() {
  console.log(`[JobWorker] Started. Registered job types: ${Object.keys(JOB_TYPES).join(', ')}`);
}
