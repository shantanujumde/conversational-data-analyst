import { isTimeDimension } from '../catalog/catalog';
import type { ValidatedPlan } from './validatePlan';

/** Most rows a query may return; also the limit when the plan sets none (docs/SPEC.md §6). */
export const MAX_LIMIT = 100;

export type SqlParam = string | number;

export interface BuiltQuery {
  /** Parameterised SQL with `?` placeholders. */
  sql: string;
  params: SqlParam[];
}

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

/**
 * Builds SQL from catalog fragments only (docs/SPEC.md §6, layer 3).
 * Ids in the plan are already checked, so they are safe as aliases. Every value is a `?` parameter.
 */
export function buildQuery(validated: ValidatedPlan): BuiltQuery {
  const { plan, dataset, metrics, groupBy, filters } = validated;
  const params: SqlParam[] = [];

  const select = [
    ...groupBy.map(({ id, dimension }) => `${dimension.sql} AS ${id}`),
    ...metrics.map(({ id, metric }) => `${metric.sql} AS ${id}`),
  ];
  let sql = `SELECT ${select.join(', ')} FROM ${dataset.from}`;

  const where: string[] = [];
  for (const { dimension, values } of filters) {
    where.push(`${dimension.sql} IN (${placeholders(values.length)})`);
    params.push(...values);
  }
  if (plan.dateRange) {
    where.push(`${dataset.dateColumn} BETWEEN ? AND ?`);
    params.push(plan.dateRange.from, plan.dateRange.to);
  }
  if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

  if (groupBy.length > 0) sql += ` GROUP BY ${groupBy.map((g) => g.dimension.sql).join(', ')}`;

  const orderBy = orderClause(validated);
  if (orderBy) sql += ` ORDER BY ${orderBy}`;

  sql += ' LIMIT ?';
  params.push(Math.min(Math.max(1, Math.trunc(plan.limit ?? MAX_LIMIT)), MAX_LIMIT));

  return { sql, params };
}

/** The plan's sort; otherwise months ascending, or the first metric descending. */
function orderClause({ plan, metrics, groupBy }: ValidatedPlan): string | undefined {
  if (plan.sort) return `${plan.sort.by} ${plan.sort.direction.toUpperCase()}`;
  if (groupBy.length === 0) return undefined;
  if (groupBy.some((g) => isTimeDimension(g.dimension))) {
    return groupBy.map((g) => `${g.id} ASC`).join(', ');
  }
  const first = metrics[0];
  return first ? `${first.id} DESC` : undefined;
}
