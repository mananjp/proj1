import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitJob, getJob, listJobs, getQueueStats, getDeadLetterQueue } from '../server/jobs/jobQueue.js';
import eventBus from '../server/events/eventBus.js';
import { EVENT_TYPES } from '../server/events/eventTypes.js';

const fakeUser = { _id: 'user-1', email: 'tester@example.com', name: 'Tester' };

async function waitForJob(jobId, predicate, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = getJob(jobId);
    if (job && predicate(job)) return job;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

test('submitJob rejects an unknown job type', () => {
  assert.throws(
    () => submitJob({ type: 'mine-bitcoin', user: fakeUser }),
    /Unknown job type/
  );
});

test('submitJob accepts a job, emits job:accepted and returns a 202-style payload', () => {
  const before = eventBus.telemetry.byTopic[EVENT_TYPES.JOB_ACCEPTED] || 0;
  const job = submitJob({ type: 'simulate-retry', user: fakeUser });

  assert.equal(job.type, 'simulate-retry');
  assert.ok(['queued', 'running', 'completed'].includes(job.status));
  assert.equal(job.maxAttempts, 3);
  assert.equal(job.requestedBy.email, 'tester@example.com');

  const after = eventBus.telemetry.byTopic[EVENT_TYPES.JOB_ACCEPTED] || 0;
  assert.equal(after, before + 1, 'job:accepted should be emitted once');
});

test('simulate-retry succeeds after emitting a job:retry event', async () => {
  const retriesBefore = eventBus.telemetry.byTopic[EVENT_TYPES.JOB_RETRY] || 0;
  const job = submitJob({ type: 'simulate-retry', user: fakeUser });
  const finished = await waitForJob(job.id, (j) => j.status === 'completed');

  assert.equal(finished.status, 'completed');
  assert.equal(finished.attempts, 1, 'should have retried exactly once');
  assert.ok(finished.result, 'completed retry job should carry a result');

  const retriesAfter = eventBus.telemetry.byTopic[EVENT_TYPES.JOB_RETRY] || 0;
  assert.ok(retriesAfter > retriesBefore, 'job:retry should have been emitted');
});

test('simulate-failure exhausts retries and lands in the dead-letter queue', async () => {
  const dlqBefore = getDeadLetterQueue().length;
  const job = submitJob({ type: 'simulate-failure', user: fakeUser });
  const finished = await waitForJob(job.id, (j) => j.status === 'failed');

  assert.equal(finished.status, 'failed');
  assert.equal(finished.attempts, 3, 'should attempt until max retries');
  assert.match(finished.error, /Simulated downstream service failure/);

  const dlq = getDeadLetterQueue();
  assert.equal(dlq.length, dlqBefore + 1);
  assert.equal(dlq.at(-1).jobId, job.id);
});

test('listJobs scopes results to the requesting user', async () => {
  const job = submitJob({ type: 'simulate-retry', user: fakeUser });
  await waitForJob(job.id, (j) => j.status === 'completed');

  const own = listJobs({ userId: 'user-1', isAdmin: false });
  assert.ok(own.some((j) => j.id === job.id));

  const other = listJobs({ userId: 'someone-else', isAdmin: false });
  assert.ok(!other.some((j) => j.id === job.id));

  const asAdmin = listJobs({ userId: 'someone-else', isAdmin: true });
  assert.ok(asAdmin.some((j) => j.id === job.id));
});

test('getQueueStats reports registered job types', () => {
  const stats = getQueueStats();
  const types = stats.registeredTypes.map((t) => t.type);
  assert.ok(types.includes('csv-export'));
  assert.ok(types.includes('simulate-failure'));
  assert.ok(types.includes('simulate-retry'));
  assert.ok(stats.total >= 3);
});
