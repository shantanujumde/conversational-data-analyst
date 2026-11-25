import Database from 'better-sqlite3';

export type Db = Database.Database;

/** The connection the query path uses. SQLite itself refuses any write on it. */
export function openReadOnly(path: string): Db {
  return new Database(path, { readonly: true, fileMustExist: true });
}

/** Only the seed script writes to the database. */
export function openWritable(path: string): Db {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  return db;
}
