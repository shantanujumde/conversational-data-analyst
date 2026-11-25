import type { Health } from '@cda/shared';
import pkg from '../../package.json' with { type: 'json' };
import { type Db, isDatabaseReachable } from '../db/connection';

/** Liveness plus whether the database answers. A dead database is `degraded`, not an error. */
export function getHealth(db: Db): Health {
  return {
    status: isDatabaseReachable(db) ? 'ok' : 'degraded',
    service: 'cda-server',
    version: pkg.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
