import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createJobSchema, getJobSchema } from '../validators/job.js';
import { submitJob, getJob, listJobs, getQueueStats, EXPORTS_DIR } from '../jobs/jobQueue.js';

const router = express.Router();

router.use(protect);

/**
 * POST /api/jobs — Accept a job. Responds 202 Accepted; work runs in background.
 */
router.post('/', validate(createJobSchema), (req, res) => {
  try {
    const { type, params } = req.body;
    const job = submitJob({ type, params, user: req.user });

    console.log(`[JobQueue] ACCEPTED ${type} (${job.id}) for ${req.user.email}`);

    res.status(202).json({
      success: true,
      message: 'Job accepted and queued for background processing',
      data: job
    });
  } catch (error) {
    if (error.code === 'UNKNOWN_JOB_TYPE') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('[JobQueue] Error accepting job:', error);
    res.status(500).json({ success: false, message: 'Failed to accept job' });
  }
});

/**
 * GET /api/jobs — List jobs (admin sees all; users see their own).
 */
router.get('/', (req, res) => {
  const jobs = listJobs({
    userId: req.user._id,
    isAdmin: req.user.role === 'admin'
  });
  res.json({
    success: true,
    count: jobs.length,
    queue: getQueueStats(),
    data: jobs
  });
});

/**
 * GET /api/jobs/:id — Poll a single job's status.
 */
router.get('/:id', validate(getJobSchema), (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && job.requestedBy?.id !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this job' });
  }
  res.json({ success: true, data: job });
});

/**
 * GET /api/jobs/:id/artifact — Download the CSV artifact of a completed job.
 */
router.get('/:id/artifact', validate(getJobSchema), async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  if (job.status !== 'completed' || !job.artifact?.path) {
    return res.status(404).json({
      success: false,
      message: `Job has no artifact (status: ${job.status})`
    });
  }

  // Path-traversal guard: artifact must live inside the exports directory.
  const resolved = path.resolve(job.artifact.path);
  const exportsRoot = path.resolve(EXPORTS_DIR);
  if (!resolved.startsWith(exportsRoot + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ success: false, message: 'Artifact file not found on disk' });
  }

  res.download(resolved, job.artifact.filename);
});

export default router;
