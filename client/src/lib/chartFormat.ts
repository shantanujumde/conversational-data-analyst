import type { ChartModel } from './chartModel';
import { formatValue } from './format';

/** A string or number as text; anything else as an empty string. */
export function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** Category labels print as words ("RETAIL" → "Retail", "2026-09" → "Sep 2026"). */
export function categoryLabel(value: unknown): string {
  return typeof value === 'string' ? formatValue(value, 'text') : toText(value);
}

/** Room in pixels for the longest category label on a bar chart, between 64 and 200. */
export function categoryAxisWidth(model: Pick<ChartModel, 'data' | 'x'>): number {
  const longest = Math.max(0, ...model.data.map((row) => categoryLabel(row[model.x]).length));
  return Math.min(200, Math.max(64, Math.round(longest * 8.4) + 16));
}
