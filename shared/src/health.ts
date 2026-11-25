import { z } from 'zod';

export const HealthSchema = z.object({
  // 'degraded' is for when a dependency check fails (the database check arrives with the DB step).
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type Health = z.infer<typeof HealthSchema>;
