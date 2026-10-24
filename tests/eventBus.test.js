import { test } from 'node:test';
import assert from 'node:assert/strict';
import eventBus from '../server/events/eventBus.js';
import { EVENT_TYPES, ALL_EVENT_TOPICS } from '../server/events/eventTypes.js';

test('emitEvent assigns incrementing ids and ISO timestamps', () => {
  const first = eventBus.emitEvent(EVENT_TYPES.TASK_CREATED, { title: 'A' });
  const second = eventBus.emitEvent(EVENT_TYPES.TASK_UPDATED, { title: 'B' });

  assert.ok(Number(second.id) > Number(first.id), 'ids must increase monotonically');
  assert.ok(!Number.isNaN(Date.parse(first.timestamp)), 'timestamp must be ISO-parseable');
  assert.equal(first.topic, EVENT_TYPES.TASK_CREATED);
  assert.deepEqual(first.payload, { title: 'A' });
});

test('topic listeners receive only their topic; wildcard listeners receive everything', () => {
  const topicEvents = [];
  const wildcardEvents = [];
  const onTopic = (e) => topicEvents.push(e);
  const onWildcard = (e) => wildcardEvents.push(e);

  eventBus.on(EVENT_TYPES.TASK_COMPLETED, onTopic);
  eventBus.on('*', onWildcard);
  try {
    eventBus.emitEvent(EVENT_TYPES.TASK_COMPLETED, { taskId: 't1' });
    eventBus.emitEvent(EVENT_TYPES.TASK_DELETED, { taskId: 't2' });
  } finally {
    eventBus.off(EVENT_TYPES.TASK_COMPLETED, onTopic);
    eventBus.off('*', onWildcard);
  }

  assert.equal(topicEvents.length, 1, 'topic listener should fire once');
  assert.equal(topicEvents[0].topic, EVENT_TYPES.TASK_COMPLETED);
  assert.equal(wildcardEvents.length, 2, 'wildcard listener should see both events');
});

test('telemetry counts total events, notifications and dead-letters', () => {
  const before = eventBus.getStats();
  eventBus.emitEvent(EVENT_TYPES.NOTIFICATION_SENT, { channel: 'email' });
  eventBus.emitEvent(EVENT_TYPES.JOB_DEAD_LETTERED, { jobId: 'j1' });
  const after = eventBus.getStats();

  assert.equal(after.totalEventsEmitted, before.totalEventsEmitted + 2);
  assert.equal(after.notificationsSent, before.notificationsSent + 1);
  assert.equal(after.deadLetterCount, before.deadLetterCount + 1);
  assert.equal(
    after.eventsByTopic[EVENT_TYPES.NOTIFICATION_SENT],
    (before.eventsByTopic[EVENT_TYPES.NOTIFICATION_SENT] || 0) + 1
  );
});

test('recordJobDuration maintains a bounded list and computes the average', () => {
  eventBus.recordJobDuration(100);
  eventBus.recordJobDuration(300);
  const stats = eventBus.getStats();
  assert.ok(stats.avgJobDurationMs > 0, 'average job duration should be positive');
  assert.ok(Number.isInteger(stats.avgJobDurationMs));
});

test('recentEvents replays only events after a given id', () => {
  const marker = eventBus.emitEvent(EVENT_TYPES.TASK_CREATED, { marker: true });
  eventBus.emitEvent(EVENT_TYPES.TASK_UPDATED, { after: 1 });
  eventBus.emitEvent(EVENT_TYPES.TASK_UPDATED, { after: 2 });

  const replayed = eventBus.recentEvents(marker.id);
  assert.ok(replayed.every((e) => Number(e.id) > Number(marker.id)));
  assert.equal(replayed.length, 2);
  assert.deepEqual(eventBus.recentEvents(null).length, Math.min(eventBus.telemetry.totalEvents, 100));
});

test('listener bindings are reported for every registered topic', () => {
  const stats = eventBus.getStats();
  for (const topic of ALL_EVENT_TOPICS) {
    assert.ok(topic in stats.listeners, `listeners map should include ${topic}`);
    assert.ok(Number.isInteger(stats.listeners[topic]));
  }
});
