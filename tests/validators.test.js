import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaskSchema, updateTaskSchema, getTaskSchema, deleteTaskSchema } from '../server/validators/task.js';
import { registerSchema, loginSchema } from '../server/validators/auth.js';
import { createJobSchema, getJobSchema } from '../server/validators/job.js';
import { insightsSchema } from '../server/validators/ai.js';

const validObjectId = '507f1f77bcf86cd799439011';

test('createTaskSchema accepts a title-only body', () => {
  const result = createTaskSchema.safeParse({ body: { title: 'Write tests' } });
  assert.equal(result.success, true);
});

test('createTaskSchema rejects an empty body', () => {
  const result = createTaskSchema.safeParse({ body: {} });
  assert.equal(result.success, false);
});

test('updateTaskSchema rejects an invalid task id', () => {
  const result = updateTaskSchema.safeParse({
    params: { id: 'not-an-objectid' },
    body: { title: 'x' }
  });
  assert.equal(result.success, false);
});

test('getTaskSchema accepts a valid object id', () => {
  const result = getTaskSchema.safeParse({ params: { id: validObjectId } });
  assert.equal(result.success, true);
});

test('deleteTaskSchema accepts a valid object id', () => {
  const result = deleteTaskSchema.safeParse({ params: { id: validObjectId } });
  assert.equal(result.success, true);
});

test('registerSchema requires a password of at least 6 characters', () => {
  const result = registerSchema.safeParse({
    body: { name: 'Test', email: 'a@b.com', password: '123' }
  });
  assert.equal(result.success, false);
});

test('loginSchema rejects a malformed email', () => {
  const result = loginSchema.safeParse({ body: { email: 'nope', password: 'secret' } });
  assert.equal(result.success, false);
});

test('createJobSchema accepts csv-export', () => {
  const result = createJobSchema.safeParse({ body: { type: 'csv-export' } });
  assert.equal(result.success, true);
});

test('createJobSchema rejects an unknown job type', () => {
  const result = createJobSchema.safeParse({ body: { type: 'mine-bitcoin' } });
  assert.equal(result.success, false);
});

test('getJobSchema requires a job id', () => {
  assert.equal(getJobSchema.safeParse({ params: { id: '' } }).success, false);
  assert.equal(getJobSchema.safeParse({ params: { id: 'abc-123' } }).success, true);
});

test('insightsSchema requires a non-empty title', () => {
  assert.equal(insightsSchema.safeParse({ body: { title: '' } }).success, false);
  assert.equal(insightsSchema.safeParse({ body: { title: 'Ship the feature' } }).success, true);
});
