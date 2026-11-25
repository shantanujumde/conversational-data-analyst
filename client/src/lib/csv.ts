import type { CellValue, Column, Row } from '@cda/shared';

/** Characters a spreadsheet may read as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CellValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  // Stop spreadsheets from running text as a formula (CSV injection).
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows as CSV (RFC 4180: comma separated, CRLF line ends, quotes doubled).
 * The header uses column labels; numbers stay raw so spreadsheets can sum them
 * (percent values are fractions, currency values are rupees).
 */
export function toCsv(columns: readonly Column[], rows: readonly Row[]) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(row[c.key] ?? null)).join(','));
  return [header, ...lines].join('\r\n');
}
