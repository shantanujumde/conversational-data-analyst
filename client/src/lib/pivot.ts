import type { CellValue } from '@cda/shared';

type Row = Record<string, CellValue>;

export interface Series {
  /** Safe data key for the chart (`s0`, `s1`, …); series values can contain spaces. */
  key: string;
  /** The series value as stored, e.g. "RETAIL". */
  value: string;
  /** Sum of the series' numbers, used to keep the largest ones. */
  total: number;
}

export interface Pivoted {
  /** One row per x value, in first-seen order: `{ [x]: '2026-09', s0: 18, s1: 84 }`. */
  data: Row[];
  /** Series in first-seen order. */
  series: Series[];
}

/**
 * Turns long rows (one per x and series value) into one row per x value with a
 * column per series. A series with no row for an x value gets `null`, never 0.
 */
export function pivot(rows: readonly Row[], x: string, y: string, seriesKey: string): Pivoted {
  const series = new Map<string, Series>();
  const byX = new Map<string, Row>();

  for (const row of rows) {
    const xValue = row[x] ?? null;
    const seriesValue = String(row[seriesKey] ?? '');
    const yValue = row[y] ?? null;

    let s = series.get(seriesValue);
    if (!s) {
      s = { key: `s${series.size}`, value: seriesValue, total: 0 };
      series.set(seriesValue, s);
    }
    if (typeof yValue === 'number') s.total += yValue;

    const xId = String(xValue);
    let out = byX.get(xId);
    if (!out) {
      out = { [x]: xValue };
      byX.set(xId, out);
    }
    out[s.key] = yValue;
  }

  const allSeries = [...series.values()];
  const data = [...byX.values()].map((row) => {
    const filled: Row = { ...row };
    for (const s of allSeries) filled[s.key] ??= null;
    return filled;
  });

  return { data, series: allSeries };
}

/** The `max` series with the largest totals, kept in their original order. */
export function largestSeries(series: readonly Series[], max: number): Series[] {
  if (series.length <= max) return [...series];
  const keep = new Set(
    [...series]
      .sort((a, b) => b.total - a.total)
      .slice(0, max)
      .map((s) => s.key),
  );
  return series.filter((s) => keep.has(s.key));
}
