import { useEffect, useState } from 'react';
import { getCatalog } from '@/api/client';

/** The four example questions from the brief, used if the catalog can't be loaded. */
export const FALLBACK_EXAMPLES = [
  'Show monthly onboarding applications by customer segment',
  'Which branches have the highest rejection rate?',
  'Compare retail and SME onboarding volumes',
  'Show the top five customers by transaction value',
] as const;

/** Example questions from GET /api/v1/catalog. Falls back silently to the bundled ones. */
export function useExamples(): readonly string[] {
  const [examples, setExamples] = useState<readonly string[]>(FALLBACK_EXAMPLES);

  useEffect(() => {
    let ignore = false;
    void getCatalog().then((result) => {
      if (!ignore && result.ok) setExamples(result.data.examples);
    });
    return () => {
      ignore = true;
    };
  }, []);

  return examples;
}
