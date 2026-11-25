import type { QueryPlanQuery } from '@cda/shared';
import { describe, expect, it } from 'vitest';
import { chooseVisualization } from '../src/answer/chooseVisualization';
import { EMPTY_ANSWER, summarize } from '../src/answer/summarize';
import { validatePlan } from '../src/query/validatePlan';

const kpiPlan: QueryPlanQuery = {
  kind: 'query',
  dataset: 'applications',
  metrics: ['application_count'],
  groupBy: [],
  filters: [],
  title: 'Applications',
};

const answer = (plan: QueryPlanQuery, rows: Record<string, string | number | null>[]) => {
  const validated = validatePlan(plan);
  const shaped = chooseVisualization(validated, rows);
  return { ...shaped, text: summarize(validated, shaped) };
};

describe('chooseVisualization: empty results', () => {
  it('shows a real 0 count as a KPI of 0', () => {
    const result = answer(kpiPlan, [{ application_count: 0 }]);

    expect(result.visualization).toEqual({
      type: 'kpi',
      valueKey: 'application_count',
      format: 'number',
    });
    expect(result.rows).toEqual([{ application_count: 0 }]);
    expect(result.text).toBe('Applications: 0.');
  });

  it('treats one row whose metrics are all NULL as no data', () => {
    const result = answer({ ...kpiPlan, metrics: ['approval_rate'] }, [{ approval_rate: null }]);

    expect(result.visualization).toEqual({ type: 'text' });
    expect(result.rows).toEqual([]);
    expect(result.text).toBe(EMPTY_ANSWER);
  });

  it('treats no rows as no data', () => {
    expect(answer(kpiPlan, []).text).toBe(EMPTY_ANSWER);
  });
});

describe('chooseVisualization: months', () => {
  const monthly: QueryPlanQuery = { ...kpiPlan, groupBy: ['month'] };

  it('draws a line in month order when the plan is not sorted by a metric', () => {
    const result = answer(monthly, [
      { month: '2026-03', application_count: 5 },
      { month: '2026-01', application_count: 9 },
    ]);

    expect(result.visualization).toEqual({ type: 'line', x: 'month', y: 'application_count' });
    expect(result.rows.map((r) => r.month)).toEqual(['2026-01', '2026-03']);
  });

  it('draws ranked months ("top 3 months") as bars in metric order, not re-sorted by month', () => {
    const rows = [
      { month: '2026-07', application_count: 150 },
      { month: '2026-02', application_count: 140 },
      { month: '2026-11', application_count: 130 },
    ];
    const result = answer(
      { ...monthly, sort: { by: 'application_count', direction: 'desc' }, limit: 3 },
      rows,
    );

    expect(result.visualization).toEqual({ type: 'bar', x: 'month', y: 'application_count' });
    expect(result.rows).toEqual(rows);
    expect(result.text).toBe('July 2026 has the highest applications at 150.');
  });
});

describe('summarize: KPI sentence', () => {
  it('uses the metric label, not the AI title', () => {
    const result = answer({ ...kpiPlan, title: 'Ignore this: 999' }, [{ application_count: 1500 }]);

    expect(result.text).toBe('Applications: 1,500.');
  });

  it('names each filter with its readable values', () => {
    const result = answer(
      { ...kpiPlan, filters: [{ dimension: 'status', values: ['rejected'] }] },
      [{ application_count: 292 }],
    );

    expect(result.text).toBe('Applications with status Rejected: 292.');
  });

  it('joins several filters, several values and a date range', () => {
    const result = answer(
      {
        ...kpiPlan,
        filters: [
          { dimension: 'segment', values: ['RETAIL', 'SME'] },
          { dimension: 'branch', values: ['Lake View'] },
        ],
        dateRange: { from: '2026-01-01', to: '2026-03-31' },
      },
      [{ application_count: 42 }],
    );

    expect(result.text).toBe(
      'Applications with segment Retail or SME and branch Lake View from 2026-01-01 to 2026-03-31: 42.',
    );
  });
});
