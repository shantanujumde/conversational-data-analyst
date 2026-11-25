import type { CellValue, Column, Visualization } from '@cda/shared';
import type { ValidatedPlan } from '../query/validatePlan';
import type { Row } from '../query/runQuery';

export interface ShapedAnswer {
  visualization: Visualization;
  /** Dimension columns first, then metrics, in plan order. */
  columns: Column[];
  rows: Row[];
}

/** Percent fractions are kept to 4 decimals (0.3405 → "34.1%" in the UI). */
function tidy(value: CellValue, format: Column['format']): CellValue {
  if (typeof value === 'number' && format === 'percent') return Math.round(value * 10_000) / 10_000;
  return value;
}

/**
 * A single aggregate row with nothing in it (COUNT = 0, or AVG/SUM of no rows = NULL)
 * means nothing matched, so it is shown as an empty result.
 */
function isEmptyAggregate(validated: ValidatedPlan, rows: Row[]): boolean {
  const [only] = rows;
  return (
    validated.groupBy.length === 0 &&
    rows.length === 1 &&
    only !== undefined &&
    validated.metrics.every(({ id }) => only[id] === null || only[id] === 0)
  );
}

/** Picks the visual from the plan shape (docs/SPEC.md §8). First match wins. */
function pick(validated: ValidatedPlan): Visualization {
  const { metrics, groupBy } = validated;
  const [metric] = metrics;
  if (!metric || metrics.length !== 1) return { type: 'table' };

  if (groupBy.length === 0) {
    return { type: 'kpi', valueKey: metric.id, format: metric.metric.format };
  }

  const time = groupBy.find((g) => g.dimension.kind === 'time');
  if (time) {
    const series = groupBy.find((g) => g !== time);
    return { type: 'line', x: time.id, y: metric.id, ...(series ? { series: series.id } : {}) };
  }

  const [only] = groupBy;
  if (only && groupBy.length === 1) return { type: 'bar', x: only.id, y: metric.id };

  return { type: 'table' };
}

/** Chooses the visual and shapes columns and rows to match it. */
export function chooseVisualization(validated: ValidatedPlan, rawRows: Row[]): ShapedAnswer {
  const columns: Column[] = [
    ...validated.groupBy.map(({ id, dimension }) => ({
      key: id,
      label: dimension.label,
      format: 'text' as const,
    })),
    ...validated.metrics.map(({ id, metric }) => ({
      key: id,
      label: metric.label,
      format: metric.format,
    })),
  ];

  if (rawRows.length === 0 || isEmptyAggregate(validated, rawRows)) {
    return { visualization: { type: 'text' }, columns, rows: [] };
  }

  const rows = rawRows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.key, tidy(row[c.key] ?? null, c.format)])),
  );
  const visualization = pick(validated);

  if (visualization.type === 'line') {
    const { x, series } = visualization;
    const key = (row: Row) => `${String(row[x])}\u0000${series ? String(row[series]) : ''}`;
    rows.sort((a, b) => key(a).localeCompare(key(b)));
  }

  return { visualization, columns, rows };
}
