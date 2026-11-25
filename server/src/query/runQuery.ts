import type { CellValue } from '@cda/shared';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import type { BuiltQuery } from './buildQuery';

export type Row = Record<string, CellValue>;

/** Runs a built query on the read-only connection. Any SQLite error becomes QUERY_ERROR. */
export function runQuery(db: Db, { sql, params }: BuiltQuery): Row[] {
  try {
    return db.prepare(sql).all(...params) as Row[];
  } catch (err) {
    throw new AppError('QUERY_ERROR', undefined, {}, { cause: err });
  }
}
