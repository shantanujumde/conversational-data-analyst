import type { CatalogResponse } from '@cda/shared';
import { useEffect, useState } from 'react';
import { type ApiResult, getCatalog } from '@/api/client';

/** The empty state prints at most this many example questions. */
export const MAX_EXAMPLES = 4;

/** The four example questions from the brief, used if the catalog can't be loaded. */
export const FALLBACK_EXAMPLES = [
  'Show monthly onboarding applications by customer segment',
  'Which branches have the highest rejection rate?',
  'Compare retail and SME onboarding volumes',
  'Show the top five customers by transaction value',
] as const;

/** The first four catalog examples, or the bundled ones when the catalog request failed. */
export function examplesFrom(result: ApiResult<CatalogResponse>): readonly string[] {
  return result.ok ? result.data.examples.slice(0, MAX_EXAMPLES) : FALLBACK_EXAMPLES;
}

/** Example questions from GET /api/v1/catalog. Falls back silently to the bundled ones. */
export function useExamples(): readonly string[] {
  const [examples, setExamples] = useState<readonly string[]>(FALLBACK_EXAMPLES);

  useEffect(() => {
    let ignore = false;
    void getCatalog().then((result) => {
      if (!ignore) setExamples(examplesFrom(result));
    });
    return () => {
      ignore = true;
    };
  }, []);

  return examples;
}
