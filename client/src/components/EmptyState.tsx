import { CornerDownLeft } from 'lucide-react';
import type { CSSProperties } from 'react';

interface EmptyStateProps {
  examples: readonly string[];
  onPick: (question: string) => void;
}

/** The blank first page: one sentence and the example questions printed as ruled lines. */
export function EmptyState({ examples, onPick }: EmptyStateProps) {
  return (
    <section
      aria-label="Example questions"
      className="grid grid-cols-1 gap-x-6 px-4 pt-8 pb-10 sm:grid-cols-[96px_1fr] sm:px-8 sm:pt-10"
    >
      <div aria-hidden="true" />
      <div>
        <p className="print-line max-w-[44ch] text-[22px] leading-snug font-medium text-pretty text-ink">
          Ask a question about this bank&rsquo;s branches, customers, onboarding and transactions.
        </p>
        <ul className="mt-6 border-t border-rule">
          {examples.map((q, i) => (
            <li
              key={q}
              className="print-line border-b border-rule"
              style={{ '--line': i + 1 } as CSSProperties}
            >
              <button
                type="button"
                onClick={() => onPick(q)}
                className="group/q flex w-full items-center justify-between gap-4 py-3.5 text-left text-[17px] text-ink hover:bg-cover-wash/50 focus-visible:bg-cover-wash/50"
              >
                <span>{q}</span>
                <CornerDownLeft
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="size-4 shrink-0 text-cover opacity-0 group-hover/q:opacity-100 group-focus-visible/q:opacity-100"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
