import { QuestionList } from '@/components/QuestionList';
import { useEntryActions } from '@/hooks/useEntryActions';

/** The blank first page: one sentence and the example questions printed as ruled lines. */
export function EmptyState({ examples }: { examples: readonly string[] }) {
  const { submit } = useEntryActions();

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
        <QuestionList questions={examples} onPick={submit} className="mt-6" />
      </div>
    </section>
  );
}
