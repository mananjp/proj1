import { z } from 'zod';

export const insightsSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Task title is required').max(300),
    description: z.string().max(4000).optional()
  })
});
