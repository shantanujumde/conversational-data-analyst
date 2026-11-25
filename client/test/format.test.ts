import { describe, expect, it } from 'vitest';
import {
  formatAxis,
  formatCurrency,
  formatEntryDate,
  formatEntryNumber,
  formatLabel,
  formatMonth,
  formatNumber,
  formatPercent,
  formatValue,
} from '../src/lib/format';

describe('format', () => {
  it('formats INR with Indian digit grouping', () => {
    expect(formatCurrency(1234567.5)).toBe('₹12,34,567.50');
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('formats percent fractions to one decimal place', () => {
    expect(formatPercent(0.342)).toBe('34.2%');
    expect(formatPercent(0.1)).toBe('10.0%');
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('formats plain numbers with Indian grouping', () => {
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatNumber(1234567)).toBe('12,34,567');
    expect(formatNumber(2.456)).toBe('2.46');
  });

  it('turns YYYY-MM into a readable month', () => {
    expect(formatMonth('2026-09')).toBe('Sep 2026');
    expect(formatMonth('2026-12')).toBe('Dec 2026');
    expect(formatMonth('2026-13')).toBe('2026-13');
    expect(formatMonth('North Point')).toBe('North Point');
  });

  it('reads stored codes as words but keeps names and acronyms', () => {
    expect(formatLabel('REJECTED')).toBe('Rejected');
    expect(formatLabel('SME')).toBe('SME');
    expect(formatLabel('North Point')).toBe('North Point');
  });

  it('formats a cell by its column format', () => {
    expect(formatValue(0.342, 'percent')).toBe('34.2%');
    expect(formatValue(1234567.5, 'currency')).toBe('₹12,34,567.50');
    expect(formatValue(312, 'number')).toBe('312');
    expect(formatValue('2026-10', 'text')).toBe('Oct 2026');
    expect(formatValue('RETAIL', 'text')).toBe('Retail');
    expect(formatValue(null, 'number')).toBe('—');
  });

  it('shortens axis ticks', () => {
    expect(formatAxis(0.25, 'percent')).toBe('25%');
    expect(formatAxis(1500, 'number')).toBe('1.5K');
    expect(formatAxis(1250000, 'currency')).toBe('₹12.5L');
  });

  it('prints entry numbers and dates like a passbook', () => {
    expect(formatEntryNumber(14)).toBe('No. 014');
    expect(formatEntryNumber(1200)).toBe('No. 1200');
    expect(formatEntryDate(new Date(2026, 10, 5))).toBe('05 Nov 2026');
  });
});
