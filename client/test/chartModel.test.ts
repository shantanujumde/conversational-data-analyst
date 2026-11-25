import { describe, expect, it } from 'vitest';
import { chartModel } from '../src/lib/chartModel';
import { barAnswer, emptyAnswer, kpiAnswer, lineAnswer, tableAnswer } from './fixtures';

describe('chartModel', () => {
  it('is null for answers that are not charts', () => {
    expect(chartModel(kpiAnswer)).toBeNull();
    expect(chartModel(tableAnswer)).toBeNull();
    expect(chartModel(emptyAnswer)).toBeNull();
  });

  it('draws a bar answer as one series in the first colour', () => {
    const model = chartModel(barAnswer);

    expect(model).toMatchObject({
      type: 'bar',
      x: 'branch',
      y: { key: 'rejection_rate', format: 'percent' },
      series: [{ key: 'rejection_rate', label: 'Rejection rate', color: 'var(--chart-1)' }],
      hiddenSeries: 0,
    });
    expect(model?.data).toBe(barAnswer.rows);
  });

  it('pivots a line answer with series and labels each series as a word', () => {
    const model = chartModel(lineAnswer);

    expect(model?.series.map((s) => [s.label, s.color, s.dash])).toEqual([
      ['Corporate', 'var(--chart-1)', undefined],
      ['Retail', 'var(--chart-2)', '6 4'],
      ['SME', 'var(--chart-3)', undefined],
    ]);
    expect(model?.data).toHaveLength(2);
  });

  it('keeps at most three series and counts the rest', () => {
    const regions = ['North', 'South', 'East', 'West'];
    const rows = regions.map((region, i) => ({ month: '2026-09', region, application_count: i }));
    const model = chartModel({
      ...lineAnswer,
      visualization: { type: 'line', x: 'month', y: 'application_count', series: 'region' },
      rows,
    });

    expect(model?.series.map((s) => s.label)).toEqual(['South', 'East', 'West']);
    expect(model?.hiddenSeries).toBe(1);
  });
});
