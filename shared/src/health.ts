import { z } from 'zod';

export const HealthSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type Health = z.infer<typeof HealthSchema>;
