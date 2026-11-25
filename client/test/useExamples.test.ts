import { describe, expect, it } from 'vitest';
import { examplesFrom, FALLBACK_EXAMPLES } from '../src/hooks/useExamples';
import { catalog } from './fixtures';

describe('examplesFrom', () => {
  it('keeps the first four catalog examples', () => {
    const examples = [...catalog.examples, 'A fifth question', 'A sixth question'];

    expect(examplesFrom({ ok: true, data: { ...catalog, examples } })).toEqual(catalog.examples);
  });

  it('falls back to the four bundled examples when the catalog fails', () => {
    const failed = { ok: false, error: { code: 'NETWORK_ERROR', message: 'offline' } } as const;

    expect(examplesFrom(failed)).toBe(FALLBACK_EXAMPLES);
    expect(FALLBACK_EXAMPLES).toHaveLength(4);
  });
});
