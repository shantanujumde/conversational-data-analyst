import type { QueryPlanQuery } from '@cda/shared';
import {
  CATALOG,
  type Dataset,
  type Dimension,
  getDimension,
  getMetric,
  type Metric,
} from '../catalog/catalog';
import { SUGGESTIONS } from '../catalog/examples';
import { AppError } from '../errors';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_LIMIT = 100;

export interface ValidatedPlan {
  readonly plan: QueryPlanQuery;
  readonly dataset: Dataset;
  readonly metrics: readonly { id: string; metric: Metric }[];
  readonly groupBy: readonly { id: string; dimension: Dimension }[];
  readonly filters: readonly { id: string; dimension: Dimension; values: string[] }[];
  /** Always set, 1–100. */
  readonly limit: number;
}

/** A plan that breaks a catalog rule. The rule goes to the log as the cause; the user sees suggestions. */
function reject(rule: string): never {
  throw new AppError(
    'UNSUPPORTED_QUESTION',
    undefined,
    { suggestions: [...SUGGESTIONS] },
    { cause: new Error(`Plan rejected: ${rule}`) },
  );
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Checks a filter value against the dimension and returns its stored spelling. */
function normalizeValue(id: string, dimension: Dimension, value: string): string {
  if (dimension.kind === 'time') {
    if (!MONTH.test(value)) reject(`filter ${id}: "${value}" is not a YYYY-MM month`);
    return value;
  }
  const match = dimension.values?.find((allowed) => allowed.toLowerCase() === value.toLowerCase());
  if (match === undefined) reject(`filter ${id}: "${value}" is not an allowed value`);
  return match;
}

/** Checks a plan against the catalog allow-list (docs/SPEC.md §6, layer 2). */
export function validatePlan(plan: QueryPlanQuery): ValidatedPlan {
  if (!Object.hasOwn(CATALOG, plan.dataset)) reject(`unknown dataset "${plan.dataset}"`);
  const dataset = CATALOG[plan.dataset];

  if (plan.metrics.length === 0) reject('no metrics');
  const metrics = plan.metrics.map((id) => {
    const metric = getMetric(dataset, id);
    if (!metric) reject(`metric "${id}" is not in dataset ${plan.dataset}`);
    return { id, metric };
  });

  const groupBy = plan.groupBy.map((id) => {
    const dimension = getDimension(dataset, id);
    if (!dimension) reject(`dimension "${id}" is not in dataset ${plan.dataset}`);
    return { id, dimension };
  });

  const selected = [...plan.metrics, ...plan.groupBy];
  if (new Set(selected).size !== selected.length) reject('a metric or dimension is repeated');

  const filters = plan.filters.map((filter) => {
    const dimension = getDimension(dataset, filter.dimension);
    if (!dimension) reject(`filter dimension "${filter.dimension}" is not in ${plan.dataset}`);
    if (dimension.filterable === false) reject(`dimension "${filter.dimension}" can't be filtered`);
    if (filter.values.length === 0) reject(`filter ${filter.dimension} has no values`);
    const values = filter.values.map((v) => normalizeValue(filter.dimension, dimension, v));
    return { id: filter.dimension, dimension, values };
  });

  if (plan.sort && !selected.includes(plan.sort.by)) {
    reject(`sort.by "${plan.sort.by}" is not a selected metric or groupBy dimension`);
  }

  if (plan.dateRange) {
    const { from, to } = plan.dateRange;
    if (!isRealDate(from) || !isRealDate(to)) reject('dateRange has an invalid date');
    if (from > to) reject('dateRange.from is after dateRange.to');
  }

  const limit = plan.limit ?? MAX_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) reject('limit must be a positive integer');

  return {
    plan: { ...plan, filters: filters.map((f) => ({ dimension: f.id, values: f.values })) },
    dataset,
    metrics,
    groupBy,
    filters,
    limit: Math.min(limit, MAX_LIMIT),
  };
}
