import { describe, expect, it } from 'vitest';
import { categoryAxisWidth, categoryLabel, toText } from '../lib/chartFormat';

describe('toText', () => {
  it('keeps strings and numbers and drops anything else', () => {
    expect(toText('North')).toBe('North');
    expect(toText(12)).toBe('12');
    expect(toText(null)).toBe('');
    expect(toText(undefined)).toBe('');
  });
});

describe('categoryLabel', () => {
  it('prints stored codes and months as words', () => {
    expect(categoryLabel('RETAIL')).toBe('Retail');
    expect(categoryLabel('2026-09')).toBe('Sep 2026');
    expect(categoryLabel('North Point')).toBe('North Point');
    expect(categoryLabel(3)).toBe('3');
  });
});

describe('categoryAxisWidth', () => {
  const width = (labels: string[]) =>
    categoryAxisWidth({ x: 'branch', data: labels.map((branch) => ({ branch })) });

  it('grows with the longest label', () => {
    expect(width(['North Point', 'Harbour Road'])).toBe(Math.round(12 * 8.4) + 16);
  });

  it('stays between 64 and 200 pixels', () => {
    expect(width(['A'])).toBe(64);
    expect(width([])).toBe(64);
    expect(width(['A very long branch name that would push the bars off the page'])).toBe(200);
  });
});
