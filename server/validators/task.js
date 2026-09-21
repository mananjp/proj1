import { z } from 'zod';

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Task title is required').optional(), // Wait, schema says body or title
    body: z.string().min(1, 'Task body is required').optional(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in-progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().datetime().optional().or(z.date().optional()),
  }).refine(data => data.title || data.body, {
    message: "Task title (or body) is required and must be a non-empty string",
    path: ["title"],
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Task ID format'),
  }),
  body: z.object({
    title: z.string().min(1, 'Title cannot be an empty string').optional(),
    body: z.string().min(1, 'Body cannot be an empty string').optional(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in-progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().datetime().optional().or(z.date().optional()).nullable(),
  }),
});

export const getTaskSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Task ID format'),
  }),
});

export const deleteTaskSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Task ID format'),
  }),
});
