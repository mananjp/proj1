import dotenv from 'dotenv';
import { z } from 'zod';
import eventBus from '../events/eventBus.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 15000;

// Schema every AI suggestion must satisfy before it reaches the frontend.
export const insightSchema = z.object({
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
  description: z.string().min(1),
  actionSteps: z.array(z.string().min(1)).min(1),
  reasoning: z.string().min(1)
});

const SYSTEM_PROMPT = `You are a task-planning assistant inside a Kanban task management app.
Given a task title (and optional description), respond with STRICT JSON only — no markdown fences, no prose — using exactly this shape:
{
  "priority": "low" | "medium" | "high",
  "dueDate": "YYYY-MM-DD",
  "description": "an improved 1-3 sentence task description",
  "actionSteps": ["step 1", "step 2", "step 3"],
  "reasoning": "1-2 sentences explaining your choices"
}
Rules:
- dueDate must be a realistic target date (today or later).
- priority reflects urgency/impact inferred from the text.
- Never include secrets, credentials, or personal data in the suggestion.`;

const HIGH_PRIORITY_SIGNALS = [
  'urgent', 'asap', 'as soon as possible', 'critical', 'blocker', 'blocking',
  'production', 'outage', 'incident', 'security', 'vulnerability', 'deadline',
  'immediately', 'emergency', 'p0', 'p1', 'today', 'tonight'
];
const LOW_PRIORITY_SIGNALS = [
  'nice to have', 'when possible', 'someday', 'backlog', 'minor', 'cosmetic',
  'typo', 'later', 'low priority', 'optional', 'refactor later'
];

const HIGH_DUE_DAYS = 2;
const MEDIUM_DUE_DAYS = 5;
const LOW_DUE_DAYS = 10;

/**
 * Rule-based suggestion generator. Used when the external AI service is
 * unavailable (no API key, timeout, rate limit, bad response) so the feature
 * degrades gracefully instead of breaking the app.
 */
export function fallbackInsights(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();

  let priority = 'medium';
  if (HIGH_PRIORITY_SIGNALS.some((signal) => text.includes(signal))) {
    priority = 'high';
  } else if (LOW_PRIORITY_SIGNALS.some((signal) => text.includes(signal))) {
    priority = 'low';
  }

  const dueDays = priority === 'high' ? HIGH_DUE_DAYS : priority === 'low' ? LOW_DUE_DAYS : MEDIUM_DUE_DAYS;
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const dueDate = due.toISOString().slice(0, 10);

  const safeTitle = title.trim() || 'Untitled task';
  const generatedDescription =
    description.trim() ||
    `Plan and deliver "${safeTitle}" with clear acceptance criteria and a verified hand-off.`;

  const actionSteps = [
    'Clarify scope and acceptance criteria for the task',
    priority === 'high'
      ? 'Break the work into the smallest shippable increments and start immediately'
      : 'Break the work into increments and schedule them on the board',
    'Implement, then self-review against the acceptance criteria',
    'Share the result with the team and mark the task complete'
  ];

  const reasoning =
    `Rule-based fallback (AI service not used): priority set to "${priority}" from keyword heuristics, ` +
    `target due date in ${dueDays} day(s) based on that priority.`;

  return { priority, dueDate, description: generatedDescription, actionSteps, reasoning };
}

/**
 * Parse and validate the raw text the LLM returned.
 * Throws on anything that does not satisfy insightSchema.
 */
export function parseInsightResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty AI response');
  }
  // Tolerate accidental markdown fences around the JSON.
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI response was not valid JSON');
  }
  return insightSchema.parse(parsed);
}

function buildUserPrompt(title, description) {
  return `Task title: ${title}\nTask description: ${description || '(none provided)'}\nRespond with the JSON object only.`;
}

async function callGroq({ title, description }) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('GROQ_API_KEY is not configured');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(title, description) }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Groq API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    return parseInsightResponse(rawText);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Main entry point: generate task insights with graceful degradation.
 * The API key lives only on the backend (.env) — never exposed to React.
 *
 * @returns {Promise<{priority, dueDate, description, actionSteps, reasoning, source, fallbackReason?}>}
 */
export async function generateTaskInsights({ title, description = '' }) {
  let insights;
  let source = 'groq';
  let fallbackReason;

  try {
    insights = await callGroq({ title, description });
  } catch (error) {
    fallbackReason = error.code === 'MISSING_API_KEY'
      ? 'GROQ_API_KEY not configured — using rule-based suggestions'
      : `AI service unavailable (${error.message}) — using rule-based suggestions`;
    console.warn(`[AIService] ${fallbackReason}`);
    insights = fallbackInsights(title, description);
    source = 'fallback';
  }

  const result = { ...insights, source, ...(fallbackReason && { fallbackReason }) };

  eventBus.emitEvent(EVENT_TYPES.AI_INSIGHT_GENERATED, {
    source,
    priority: result.priority,
    titlePreview: String(title).slice(0, 80)
  });

  return result;
}
