import type { CellValue, ValueFormat } from '@cda/shared';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const plainCompact = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

/** Upper-case words kept as is when turning stored codes into labels. */
const ACRONYMS = new Set(['SME']);

/** 1234567.5 → "₹12,34,567.50" */
export function formatCurrency(value: number): string {
  return inr.format(value);
}

/** A fraction: 0.342 → "34.2%" */
export function formatPercent(value: number): string {
  return percent.format(value);
}

/** 1234567 → "12,34,567" */
export function formatNumber(value: number): string {
  return plain.format(value);
}

/** "2026-09" → "Sep 2026". Anything else comes back unchanged. */
export function formatMonth(value: string): string {
  const match = MONTH_KEY.exec(value);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1]}` : value;
}

/** Stored codes read as words: "REJECTED" → "Rejected", "SME" stays "SME". Names pass through. */
export function formatLabel(value: string): string {
  if (!/^[A-Z][A-Z_]*$/.test(value) || ACRONYMS.has(value)) return value;
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/** One cell, shown the way its column says. `null` shows as an em dash. */
export function formatValue(value: CellValue, format: ValueFormat): string {
  if (value === null) return '—';
  if (typeof value === 'string') return format === 'text' ? formatLabel(formatMonth(value)) : value;
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'number':
    case 'text':
      return formatNumber(value);
  }
}

/** Short form for chart axis ticks: "₹12.3L", "34%", "1.2K". */
export function formatAxis(value: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return inrCompact.format(value);
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'number':
    case 'text':
      return plainCompact.format(value);
  }
}

/** 14 → "No. 014" */
export function formatEntryNumber(n: number): string {
  return `No. ${String(n).padStart(3, '0')}`;
}

/** A passbook date: "25 Nov 2026". */
export function formatEntryDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}
