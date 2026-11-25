import { type AskResult, type DatasetId, DatasetIdSchema } from '@cda/shared';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const DATASET_LABELS: Record<DatasetId, string> = {
  applications: 'Onboarding applications',
  transactions: 'Transactions',
  customers: 'Customers',
};

/** The dataset's name; an id this build doesn't know prints as is. */
function datasetLabel(dataset: string): string {
  const id = DatasetIdSchema.safeParse(dataset);
  return id.success ? DATASET_LABELS[id.data] : dataset;
}

/** Where the answer came from: dataset and the checked SQL. Closed by default. */
export function HowIGotThis({ result }: { result: AskResult }) {
  return (
    <Collapsible className="group/how">
      <CollapsibleTrigger className="-ml-1 inline-flex items-center gap-1 px-1 py-0.5 text-[13px] text-ink-soft hover:text-ink">
        <ChevronRight
          strokeWidth={1.5}
          className="size-3.5 transition-transform duration-150 group-data-[state=open]/how:rotate-90"
          aria-hidden="true"
        />
        How I got this
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="mt-2 grid gap-x-4 gap-y-2 border-t border-dashed border-rule pt-3 text-[13px] sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-soft">Dataset</dt>
          <dd className="text-ink">{datasetLabel(result.query.dataset)}</dd>
          <dt className="text-ink-soft">Query</dt>
          <dd>
            <pre className="font-print text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">
              {result.query.sql}
            </pre>
          </dd>
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}
