import type { CellValue, ValueFormat } from '@cda/shared';
import type { Row } from '../query/runQuery';
import type { ValidatedPlan } from '../query/validatePlan';
import type { ShapedAnswer } from './chooseVisualization';

export const EMPTY_ANSWER = 'No data matched this question.';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatValue(value: CellValue, format: ValueFormat): string {
  if (value === null) return 'no value';
  if (typeof value === 'string') return value;
  if (format === 'currency') return inr.format(value);
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
  return plain.format(value);
}

const monthName = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Makes a stored category readable in a sentence: "2025-12" → "December 2025", "RETAIL" → "Retail", "SME" stays. */
export function displayLabel(value: CellValue): string {
  const text = String(value);
  const month = /^(\d{4})-(\d{2})$/.exec(text);
  if (month) return monthName.format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)));
  if (/^[A-Z_]{4,}$/.test(text))
    return text.charAt(0) + text.slice(1).toLowerCase().replaceAll('_', ' ');
  return text;
}

/** The row with the largest (or smallest) value for `key`. */
function extreme(rows: Row[], key: string, want: 'max' | 'min'): Row | undefined {
  let best: Row | undefined;
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== 'number') continue;
    const current = best?.[key];
    if (typeof current !== 'number' || (want === 'max' ? value > current : value < current)) {
      best = row;
    }
  }
  return best;
}

/** One sentence built from the rows by template. The AI never writes it, so it can't invent numbers. */
export function summarize(validated: ValidatedPlan, answer: ShapedAnswer): string {
  const { visualization: viz, rows, columns } = answer;
  if (rows.length === 0) return EMPTY_ANSWER;

  const formatOf = (key: string) => columns.find((c) => c.key === key)?.format ?? 'text';
  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

  switch (viz.type) {
    case 'kpi': {
      const value = rows[0]?.[viz.valueKey] ?? null;
      return `${validated.plan.title}: ${formatValue(value, viz.format)}.`;
    }
    case 'bar': {
      const lowest = validated.plan.sort?.by === viz.y && validated.plan.sort.direction === 'asc';
      const row = extreme(rows, viz.y, lowest ? 'min' : 'max');
      if (!row) break;
      const value = formatValue(row[viz.y] ?? null, formatOf(viz.y));
      return `${displayLabel(row[viz.x] ?? null)} has the ${lowest ? 'lowest' : 'highest'} ${labelOf(viz.y).toLowerCase()} at ${value}.`;
    }
    case 'line': {
      const row = extreme(rows, viz.y, 'max');
      if (!row) break;
      const value = formatValue(row[viz.y] ?? null, formatOf(viz.y));
      const series = viz.series ? ` for ${displayLabel(row[viz.series] ?? null)}` : '';
      return `${labelOf(viz.y)} peaked in ${displayLabel(row[viz.x] ?? null)}${series} at ${value}.`;
    }
    case 'table':
    case 'text':
      break;
  }
  return `Showing ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.`;
}
