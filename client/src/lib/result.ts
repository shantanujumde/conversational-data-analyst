import type { AskResult, Column } from '@cda/shared';

/** Whether the answer has any rows to draw or copy. */
export function hasRows(result: Pick<AskResult, 'rows'>): boolean {
  return result.rows.length > 0;
}

/** The column with this catalog id, if the answer has one. */
export function findColumn(columns: readonly Column[], key: string): Column | undefined {
  return columns.find((c) => c.key === key);
}
