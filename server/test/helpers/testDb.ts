import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Db, openReadOnly } from '../../src/db/connection';
import { createSeededDatabase } from '../../src/db/seed';

/** Fixed "today" so dates in the test data never move. */
export const TEST_TODAY = new Date('2026-11-25T00:00:00Z');

export interface TestDb {
  db: Db;
  path: string;
  cleanup: () => void;
}

/** Seeds a fresh SQLite file in a temp folder and opens it read-only, like the server does. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'cda-test-'));
  const path = join(dir, 'bank.db');
  createSeededDatabase(path, { today: TEST_TODAY });
  const db = openReadOnly(path);
  return {
    db,
    path,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
