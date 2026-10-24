import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackInsights,
  parseInsightResponse,
  generateTaskInsights,
  insightSchema
} from '../server/services/aiService.js';
import eventBus from '../server/events/eventBus.js';
import { EVENT_TYPES } from '../server/events/eventTypes.js';

// ── fallbackInsights (rule-based graceful degradation) ──────────────────────

test('fallbackInsights returns a schema-valid suggestion object', () => {
  const result = fallbackInsights('Implement login page', 'Add form validation');
  const parsed = insightSchema.safeParse(result);
  assert.equal(parsed.success, true);
  assert.equal(result.source, undefined); // raw fallback has no source; generateTaskInsights adds it
});

test('fallbackInsights flags urgent keywords as high priority', () => {
  const result = fallbackInsights('URGENT: production outage in payments API');
  assert.equal(result.priority, 'high');
});

test('fallbackInsights flags nice-to-have work as low priority', () => {
  const result = fallbackInsights('Nice to have: tidy up the CSS typo when possible');
  assert.equal(result.priority, 'low');
});

test('fallbackInsights defaults to medium and generates a future due date', () => {
  const result = fallbackInsights('Refactor the settings route');
  assert.equal(result.priority, 'medium');
  const due = new Date(result.dueDate);
  assert.ok(due.getTime() > Date.now(), 'due date should be in the future');
});

// ── parseInsightResponse (LLM output validation) ────────────────────────────

test('parseInsightResponse accepts clean JSON', () => {
  const raw = JSON.stringify({
    priority: 'high',
    dueDate: '2026-11-01',
    description: 'Do the thing',
    actionSteps: ['step one'],
    reasoning: 'because urgency'
  });
  const parsed = parseInsightResponse(raw);
  assert.equal(parsed.priority, 'high');
});

test('parseInsightResponse tolerates markdown code fences', () => {
  const raw = '```json\n{"priority":"low","dueDate":"2026-12-01","description":"d","actionSteps":["a"],"reasoning":"r"}\n```';
  const parsed = parseInsightResponse(raw);
  assert.equal(parsed.priority, 'low');
});

test('parseInsightResponse throws on non-JSON output', () => {
  assert.throws(() => parseInsightResponse('Sorry, I cannot help with that.'), /not valid JSON/);
});

test('parseInsightResponse throws when fields violate the schema', () => {
  const raw = JSON.stringify({ priority: 'urgent', dueDate: 'soon', description: '', actionSteps: [], reasoning: '' });
  assert.throws(() => parseInsightResponse(raw));
});

// ── generateTaskInsights (graceful degradation end-to-end) ──────────────────

test('generateTaskInsights falls back cleanly without an API key and emits an event', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  const before = eventBus.telemetry.byTopic[EVENT_TYPES.AI_INSIGHT_GENERATED] || 0;
  const result = await generateTaskInsights({ title: 'Fix login bug', description: 'Form rejects valid emails' });

  assert.equal(result.source, 'fallback');
  assert.ok(result.fallbackReason, 'fallbackReason should explain why AI was skipped');
  const parsed = insightSchema.safeParse(result);
  assert.equal(parsed.success, true);

  const after = eventBus.telemetry.byTopic[EVENT_TYPES.AI_INSIGHT_GENERATED] || 0;
  assert.equal(after, before + 1, 'ai:insight-generated event should be emitted');

  if (previousKey !== undefined) process.env.GROQ_API_KEY = previousKey;
});
