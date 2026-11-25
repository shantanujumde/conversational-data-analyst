import type { QueryPlanQuery } from '@cda/shared';
import { describe, expect, it } from 'vitest';
import { SUGGESTIONS } from '../src/catalog/examples';
import { AppError } from '../src/errors';
import { validatePlan } from '../src/query/validatePlan';

const base: QueryPlanQuery = {
  kind: 'query',
  dataset: 'applications',
  metrics: ['rejection_rate'],
  groupBy: ['branch'],
  filters: [],
  sort: { by: 'rejection_rate', direction: 'desc' },
  limit: 10,
  title: 'Rejection rate by branch',
};

/** Builds a plan from the valid base. Casts let tests send what a misbehaving AI might send. */
const plan = (overrides: Record<string, unknown>) => ({ ...base, ...overrides }) as QueryPlanQuery;

function expectRejected(p: QueryPlanQuery) {
  let caught: unknown;
  try {
    validatePlan(p);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(AppError);
  const appError = caught as AppError;
  expect(appError.code).toBe('UNSUPPORTED_QUESTION');
  expect(appError.status).toBe(422);
  expect(appError.extra.suggestions).toEqual(SUGGESTIONS);
  // The broken rule is kept for the log only, never in the user message.
  expect(appError.message).not.toMatch(/plan|rejected|metric|dimension/i);
  expect(appError.cause).toBeInstanceOf(Error);
}

describe('validatePlan', () => {
  it('accepts a plan that uses only catalog ids', () => {
    const result = validatePlan(base);

    expect(result.dataset.label).toBe('Onboarding applications');
    expect(result.metrics.map((m) => m.id)).toEqual(['rejection_rate']);
    expect(result.groupBy.map((g) => g.id)).toEqual(['branch']);
    expect(result.limit).toBe(10);
  });

  it('normalises the case of category filter values to the stored spelling', () => {
    const result = validatePlan(plan({ filters: [{ dimension: 'segment', values: ['retail'] }] }));

    expect(result.filters[0]?.values).toEqual(['RETAIL']);
    expect(result.plan.filters).toEqual([{ dimension: 'segment', values: ['RETAIL'] }]);
  });

  it('allows grouping by customer', () => {
    const result = validatePlan(
      plan({
        dataset: 'transactions',
        metrics: ['total_value'],
        groupBy: ['customer'],
        sort: undefined,
      }),
    );

    expect(result.groupBy.map((g) => g.id)).toEqual(['customer']);
  });

  it('defaults the limit to 100 and caps larger values', () => {
    expect(validatePlan(plan({ limit: undefined })).limit).toBe(100);
    expect(validatePlan(plan({ limit: 5000 })).limit).toBe(100);
  });

  it.each([
    ['an unknown dataset', { dataset: 'loans' }],
    ['an unknown metric', { metrics: ['profit'], sort: undefined }],
    ['a metric from another dataset', { metrics: ['total_value'], sort: undefined }],
    ['an unknown groupBy dimension', { groupBy: ['city'] }],
    ['a dimension from another dataset', { groupBy: ['customer'] }],
    ['a prototype key as metric', { metrics: ['constructor'], sort: undefined }],
    ['a filter value not in the list', { filters: [{ dimension: 'segment', values: ['VIP'] }] }],
    ['a filter with no values', { filters: [{ dimension: 'segment', values: [] }] }],
    ['a malformed month filter', { filters: [{ dimension: 'month', values: ['last month'] }] }],
    [
      'an injection attempt in a filter dimension',
      { filters: [{ dimension: 'segment; DROP TABLE customers', values: ['RETAIL'] }] },
    ],
    [
      'an injection attempt in a filter value',
      { filters: [{ dimension: 'segment', values: ["RETAIL'; DROP TABLE customers; --"] }] },
    ],
    ['an injection attempt in groupBy', { groupBy: ['segment; DROP TABLE customers'] }],
    ['sort by something not selected', { sort: { by: 'approval_rate', direction: 'desc' } }],
    ['a repeated metric', { metrics: ['rejection_rate', 'rejection_rate'] }],
    ['an impossible date', { dateRange: { from: '2026-02-30', to: '2026-03-31' } }],
    ['from after to', { dateRange: { from: '2026-06-01', to: '2026-01-01' } }],
    ['a zero limit', { limit: 0 }],
    [
      'a filter on customer, which has no allowed-value list',
      {
        dataset: 'transactions',
        metrics: ['total_value'],
        groupBy: ['customer'],
        sort: undefined,
        filters: [{ dimension: 'customer', values: ['Aarav Sharma'] }],
      },
    ],
  ])('rejects %s', (_case, overrides) => {
    expectRejected(plan(overrides));
  });
});
