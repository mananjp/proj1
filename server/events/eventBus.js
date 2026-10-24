import { EventEmitter } from 'node:events';
import { EVENT_TYPES, ALL_EVENT_TOPICS } from './eventTypes.js';

const MAX_BUFFER_SIZE = 100;

/**
 * Application-wide event bus implementing the Event-Driven Architecture.
 *
 * - Every published event gets a monotonically increasing ID + ISO timestamp.
 * - A ring buffer of recent events powers SSE replay (Last-Event-ID support).
 * - Telemetry counters feed the "Telemetry & Stats" dashboard tab.
 * - Listeners count per topic powers the "listener bindings" display.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    // Many SSE clients + subscribers can bind at once; avoid Node's default
    // "MaxListenersExceededWarning" at 10.
    this.setMaxListeners(200);

    this.sequence = 0;
    this.buffer = [];
    this.telemetry = {
      totalEvents: 0,
      byTopic: {},
      notificationsSent: 0,
      deadLetterCount: 0,
      jobDurationsMs: []
    };
  }

  /**
   * Publish an event onto the bus.
   * @param {string} topic - One of EVENT_TYPES
   * @param {object} payload - Arbitrary JSON-serializable payload
   * @returns {{id: string, topic: string, timestamp: string, payload: object}}
   */
  emitEvent(topic, payload = {}) {
    this.sequence += 1;
    const event = {
      id: String(this.sequence),
      topic,
      timestamp: new Date().toISOString(),
      payload
    };

    this.telemetry.totalEvents += 1;
    this.telemetry.byTopic[topic] = (this.telemetry.byTopic[topic] || 0) + 1;
    if (topic === EVENT_TYPES.NOTIFICATION_SENT) {
      this.telemetry.notificationsSent += 1;
    }
    if (topic === EVENT_TYPES.JOB_DEAD_LETTERED) {
      this.telemetry.deadLetterCount += 1;
    }

    this.buffer.push(event);
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Topic-specific listeners and wildcard listeners (SSE stream)
    this.emit(topic, event);
    this.emit('*', event);

    return event;
  }

  /**
   * Record a completed job's duration (used for the "average duration" stat).
   */
  recordJobDuration(durationMs) {
    this.telemetry.jobDurationsMs.push(durationMs);
    if (this.telemetry.jobDurationsMs.length > MAX_BUFFER_SIZE) {
      this.telemetry.jobDurationsMs.shift();
    }
  }

  /**
   * Recent events, newest last. Optionally only those after a given event ID.
   */
  recentEvents(lastEventId = null) {
    if (lastEventId === null || lastEventId === undefined || lastEventId === '') {
      return [...this.buffer];
    }
    const last = Number(lastEventId);
    if (!Number.isFinite(last)) return [...this.buffer];
    return this.buffer.filter((event) => Number(event.id) > last);
  }

  /**
   * Telemetry snapshot for the dashboard.
   */
  getStats() {
    const durations = this.telemetry.jobDurationsMs;
    const avgJobDurationMs = durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;

    const listeners = {};
    for (const topic of ALL_EVENT_TOPICS) {
      listeners[topic] = this.listenerCount(topic);
    }

    return {
      totalEventsEmitted: this.telemetry.totalEvents,
      eventsByTopic: { ...this.telemetry.byTopic },
      notificationsSent: this.telemetry.notificationsSent,
      deadLetterCount: this.telemetry.deadLetterCount,
      avgJobDurationMs,
      bufferedEvents: this.buffer.length,
      listeners
    };
  }
}

export const eventBus = new EventBus();
export default eventBus;
