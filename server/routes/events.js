import express from 'express';
import { protect } from '../middleware/auth.js';
import eventBus from '../events/eventBus.js';
import { getDeadLetterQueue, getQueueStats } from '../jobs/jobQueue.js';

const router = express.Router();

router.use(protect);

/**
 * GET /api/events/stream — Server-Sent Events live stream.
 * Supports Last-Event-ID for replay after a reconnect.
 * Uses fetch-based SSE on the client so the Bearer token can be attached.
 */
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');

  const lastEventId = req.headers['last-event-id'];
  const replay = eventBus.recentEvents(lastEventId);
  for (const event of replay) {
    res.write(formatSseEvent(event));
  }
  res.write(
    `event: stream:ready\ndata: ${JSON.stringify({
      topic: 'stream:ready',
      buffered: replay.length,
      lastEventId: lastEventId || null
    })}\n\n`
  );

  const onEvent = (event) => {
    res.write(formatSseEvent(event));
  };

  eventBus.on('*', onEvent);

  // Keep proxies and clients from dropping the idle connection.
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('*', onEvent);
  });
});

function formatSseEvent(event) {
  return `id: ${event.id}\nevent: ${event.topic}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * GET /api/events/stats — Telemetry & Stats for the dashboard tab.
 */
router.get('/stats', (req, res) => {
  const stats = eventBus.getStats();
  res.json({
    success: true,
    data: {
      ...stats,
      queue: getQueueStats()
    }
  });
});

/**
 * GET /api/events/dlq — Dead-letter queue inspection.
 */
router.get('/dlq', (req, res) => {
  res.json({
    success: true,
    count: getDeadLetterQueue().length,
    data: getDeadLetterQueue()
  });
});

export default router;
