import type { QueryPlanQuery } from '@cda/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/errors';
import { buildQuery } from '../src/query/buildQuery';
import { runQuery } from '../src/query/runQuery';
import { validatePlan } from '../src/query/validatePlan';
import { createTestDb } from './helpers/testDb';

const rejectionByBranch: QueryPlanQuery = {
  kind: 'query',
  dataset: 'applications',
  metrics: ['rejection_rate'],
  groupBy: ['branch'],
  filters: [],
  sort: { by: 'rejection_rate', direction: 'desc' },
  limit: 10,
  title: 'Rejection rate by branch',
};

const build = (plan: QueryPlanQuery) => buildQuery(validatePlan(plan));

describe('buildQuery', () => {
  it('builds the SPEC example for rejection rate by branch', () => {
    expect(build(rejectionByBranch)).toEqual({
      sql:
        "SELECT b.name AS branch, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate " +
        'FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id ' +
        'GROUP BY b.name ORDER BY rejection_rate DESC LIMIT ?',
      params: [10],
    });
  });

  it('puts every filter value and date in parameters, never in the SQL', () => {
    const { sql, params } = build({
      ...rejectionByBranch,
      metrics: ['application_count'],
      groupBy: [],
      sort: undefined,
      limit: undefined,
      filters: [
        { dimension: 'segment', values: ['RETAIL', 'SME'] },
        { dimension: 'branch', values: ['Lake View'] },
      ],
      dateRange: { from: '2026-01-01', to: '2026-01-31' },
    });

    expect(sql).toBe(
      'SELECT COUNT(*) AS application_count ' +
        'FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id ' +
        'WHERE a.segment IN (?, ?) AND b.name IN (?) AND a.submitted_at BETWEEN ? AND ? LIMIT ?',
    );
    expect(params).toEqual(['RETAIL', 'SME', 'Lake View', '2026-01-01', '2026-01-31', 100]);
    expect(sql).not.toMatch(/RETAIL|Lake View|2026/);
  });

  it('orders months ascending when the plan has no sort', () => {
    const { sql } = build({
      ...rejectionByBranch,
      metrics: ['application_count'],
      groupBy: ['month', 'segment'],
      sort: undefined,
    });

    expect(sql).toContain(
      "SELECT strftime('%Y-%m', a.submitted_at) AS month, a.segment AS segment, COUNT(*) AS application_count",
    );
    expect(sql).toContain(
      "GROUP BY strftime('%Y-%m', a.submitted_at), a.segment ORDER BY month ASC, segment ASC LIMIT ?",
    );
  });

  it.each([
    ['missing', undefined, 100],
    ['over the cap', 1000, 100],
    ['within range', 5, 5],
  ])('always ends with LIMIT ? (limit %s)', (_case, limit, expected) => {
    const { sql, params } = build({ ...rejectionByBranch, limit });

    expect(sql).toMatch(/ LIMIT \?$/);
    expect(params.at(-1)).toBe(expected);
  });
});

describe('runQuery on the seeded data', () => {
  const testDb = createTestDb();
  afterAll(() => testDb.cleanup());

  it('returns branches sorted by rejection rate, highest first', () => {
    const rows = runQuery(testDb.db, build(rejectionByBranch));

    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ branch: 'North Point' });
    const rates = rows.map((r) => r.rejection_rate as number);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(rates.every((r) => r >= 0.1 && r <= 0.35)).toBe(true);
  });

  it('turns a SQLite error into QUERY_ERROR', () => {
    expect(() => runQuery(testDb.db, { sql: 'SELECT * FROM missing_table', params: [] })).toThrow(
      expect.objectContaining({ code: 'QUERY_ERROR' }),
    );
  });

  it('cannot write through the read-only connection', () => {
    expect(() => runQuery(testDb.db, { sql: 'DELETE FROM customers', params: [] })).toThrow(
      AppError,
    );
    expect(testDb.db.prepare('SELECT COUNT(*) AS n FROM customers').get()).toEqual({ n: 200 });
  });
});
