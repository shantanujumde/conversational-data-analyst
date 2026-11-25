import { describe, expect, it } from 'vitest';
import { findColumn, hasRows } from '../lib/result';
import { barAnswer, emptyAnswer } from './fixtures';

describe('hasRows', () => {
  it('is true only when the answer has rows', () => {
    expect(hasRows(barAnswer)).toBe(true);
    expect(hasRows(emptyAnswer)).toBe(false);
  });
});

describe('findColumn', () => {
  it('finds a column by its key', () => {
    expect(findColumn(barAnswer.columns, 'rejection_rate')).toEqual({
      key: 'rejection_rate',
      label: 'Rejection rate',
      format: 'percent',
    });
    expect(findColumn(barAnswer.columns, 'missing')).toBeUndefined();
  });
});
