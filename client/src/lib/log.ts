/** Logs to the console in development only; production builds stay quiet (SPEC §10.3). */
export function logError(message: string, detail?: unknown): void {
  if (import.meta.env.DEV) console.error(`[cda] ${message}`, detail);
}
