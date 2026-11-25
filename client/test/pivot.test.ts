import { describe, expect, it } from 'vitest';
import { largestSeries, pivot } from '../src/lib/pivot';
import { lineAnswer } from './fixtures';

describe('pivot', () => {
  it('turns long rows into one row per month with a column per series', () => {
    const { data, series } = pivot(lineAnswer.rows, 'month', 'application_count', 'segment');

    expect(series).toEqual([
      { key: 's0', value: 'CORPORATE', total: 40 },
      { key: 's1', value: 'RETAIL', total: 176 },
      { key: 's2', value: 'SME', total: 68 },
    ]);
    expect(data).toEqual([
      { month: '2026-09', s0: 18, s1: 84, s2: 31 },
      { month: '2026-10', s0: 22, s1: 92, s2: 37 },
    ]);
  });

  it('fills a missing series value with null, not zero', () => {
    const rows = [
      { month: '2026-09', segment: 'RETAIL', application_count: 84 },
      { month: '2026-10', segment: 'RETAIL', application_count: 92 },
      { month: '2026-10', segment: 'SME', application_count: 37 },
    ];

    expect(pivot(rows, 'month', 'application_count', 'segment').data).toEqual([
      { month: '2026-09', s0: 84, s1: null },
      { month: '2026-10', s0: 92, s1: 37 },
    ]);
  });

  it('uses safe keys for series values with spaces', () => {
    const rows = [{ month: '2026-09', branch: 'North Point', application_count: 5 }];

    const { data, series } = pivot(rows, 'month', 'application_count', 'branch');
    expect(series[0]).toMatchObject({ key: 's0', value: 'North Point' });
    expect(data[0]).toEqual({ month: '2026-09', s0: 5 });
  });

  it('returns nothing for no rows', () => {
    expect(pivot([], 'month', 'application_count', 'segment')).toEqual({ data: [], series: [] });
  });
});

describe('largestSeries', () => {
  it('keeps the largest series in their original order', () => {
    const series = [
      { key: 's0', value: 'North', total: 10 },
      { key: 's1', value: 'South', total: 40 },
      { key: 's2', value: 'East', total: 5 },
      { key: 's3', value: 'West', total: 20 },
    ];

    expect(largestSeries(series, 3).map((s) => s.value)).toEqual(['North', 'South', 'West']);
    expect(largestSeries(series.slice(0, 2), 3)).toHaveLength(2);
  });
});
