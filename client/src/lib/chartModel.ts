import type { AskResult, Column, Row, Visualization } from '@cda/shared';
import { MAX_SERIES, type SeriesStyle, seriesStyle } from './chartSeries';
import { formatLabel } from './format';
import { largestSeries, pivot } from './pivot';
import { findColumn, hasRows } from './result';

/** The chart kinds an answer can have. */
export type ChartType = Extract<Visualization, { type: 'bar' | 'line' }>['type'];

export interface ChartSeries extends SeriesStyle {
  /** Data key in `data` rows. */
  key: string;
  label: string;
}

export interface ChartModel {
  type: ChartType;
  data: Row[];
  /** Dimension key on the category / time axis. */
  x: string;
  /** The metric column (label and format for ticks, labels and tooltips). */
  y: Column;
  series: ChartSeries[];
  /** Series left out to stay within three colours (they are still in the table view). */
  hiddenSeries: number;
}

/** What to draw for a bar or line answer, or `null` when the answer isn't a chart. */
export function chartModel(result: AskResult): ChartModel | null {
  const vis = result.visualization;
  if (vis.type !== 'bar' && vis.type !== 'line') return null;
  if (!hasRows(result)) return null;

  const y = findColumn(result.columns, vis.y) ?? {
    key: vis.y,
    label: vis.y,
    format: 'number' as const,
  };

  if (vis.series) {
    const pivoted = pivot(result.rows, vis.x, vis.y, vis.series);
    const shown = largestSeries(pivoted.series, MAX_SERIES);
    return {
      type: vis.type,
      data: pivoted.data,
      x: vis.x,
      y,
      series: shown.map((s, i) => ({ key: s.key, label: formatLabel(s.value), ...seriesStyle(i) })),
      hiddenSeries: pivoted.series.length - shown.length,
    };
  }

  return {
    type: vis.type,
    data: result.rows,
    x: vis.x,
    y,
    series: [{ key: vis.y, label: y.label, ...seriesStyle(0) }],
    hiddenSeries: 0,
  };
}
