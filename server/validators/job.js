import { z } from 'zod';

export const createJobSchema = z.object({
  body: z.object({
    type: z.enum(['csv-export', 'simulate-failure', 'simulate-retry']),
    params: z.record(z.string(), z.unknown()).optional()
  })
});

export const getJobSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Job ID is required')
  })
});
