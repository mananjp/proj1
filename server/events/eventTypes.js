// Central registry of event topics used across the Event-Driven Architecture.
// Subscribers (SSE stream, telemetry, notifications, job workers) bind to these.
export const EVENT_TYPES = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_COMPLETED: 'task:completed',
  TASK_DELETED: 'task:deleted',

  JOB_ACCEPTED: 'job:accepted',
  JOB_STARTED: 'job:started',
  JOB_PROGRESS: 'job:progress',
  JOB_RETRY: 'job:retry',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_DEAD_LETTERED: 'job:dead-lettered',

  NOTIFICATION_SENT: 'notification:sent',
  AI_INSIGHT_GENERATED: 'ai:insight-generated'
};

// Ordered list used for telemetry "listener bindings" display.
export const ALL_EVENT_TOPICS = Object.values(EVENT_TYPES);
