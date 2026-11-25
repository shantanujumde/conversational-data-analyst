import { describe, expect, it } from 'vitest';
import { displayLabel } from '../src/answer/summarize';

describe('displayLabel', () => {
  it.each([
    ['2025-12', 'December 2025'],
    ['RETAIL', 'Retail'],
    ['CORPORATE', 'Corporate'],
    ['SME', 'SME'],
    ['North Point', 'North Point'],
    [42, '42'],
  ])('%s → %s', (input, expected) => {
    expect(displayLabel(input)).toBe(expected);
  });
});
