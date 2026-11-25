import type { AskResult } from '@cda/shared';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { AnswerView } from '@/components/answer/AnswerView';
import { type AnswerViewMode, ViewToggle } from '@/components/answer/ViewToggle';
import { CopyMenu } from '@/components/CopyMenu';
import { EntryErrorBoundary } from '@/components/ErrorBoundary';
import type { Entry as ChatEntry } from '@/hooks/useChat';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { chartModel } from '@/lib/chartModel';
import { formatEntryDate, formatEntryNumber } from '@/lib/format';
import { HowIGotThis } from './HowIGotThis';
import { PrintingLine } from './PrintingLine';
import { Stamp } from './Stamp';

/** Stagger index for the print-line wipe (50 ms per line). */
const line = (n: number) => ({ '--line': n }) as CSSProperties;

function hasVisual(result: AskResult): boolean {
  return result.rows.length > 0;
}

interface EntryProps {
  entry: ChatEntry;
  onAsk: (question: string) => void;
  onRetry: (entry: ChatEntry) => void;
}

/**
 * One ruled passbook row: number and date on the left, the question and its
 * answer in the middle, quiet actions on the right.
 */
export function Entry({ entry, onAsk, onRetry }: EntryProps) {
  const [view, setView] = useState<AnswerViewMode>('chart');
  const rowRef = useRef<HTMLLIElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { state } = entry;
  const result = state.status === 'answered' ? state.result : null;
  const model = useMemo(() => (result ? chartModel(result) : null), [result]);

  // Keep the newest printing in view, above the pinned slip.
  useEffect(() => {
    rowRef.current?.scrollIntoView({
      block: state.status === 'pending' ? 'end' : 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [state.status, reduced]);

  return (
    <li
      ref={rowRef}
      className="group/entry grid scroll-mt-4 scroll-mb-44 grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-b border-rule px-4 py-5 [grid-template-areas:'meta_actions'_'body_body'] sm:grid-cols-[96px_1fr_auto] sm:gap-x-6 sm:px-8 sm:py-6 sm:[grid-template-areas:'meta_body_actions']"
    >
      <div className="flex items-baseline gap-3 font-print text-[13px] [grid-area:meta] sm:flex-col sm:gap-0.5 sm:pt-[3px]">
        <span className="text-ink">{formatEntryNumber(entry.id)}</span>
        <time dateTime={entry.askedAt.toISOString()} className="text-ink-soft">
          {formatEntryDate(entry.askedAt)}
        </time>
      </div>

      <div className="flex min-w-0 flex-col gap-3 [grid-area:body]">
        <h2 className="print-line text-[17px] leading-snug font-semibold text-pretty text-ink">
          {entry.question}
        </h2>

        {state.status === 'pending' && <PrintingLine />}

        {state.status === 'failed' && (
          <Stamp
            error={state.error}
            retryAt={state.retryAt}
            onRetry={() => onRetry(entry)}
            onAsk={onAsk}
          />
        )}

        {result && (
          <>
            <p
              className="print-line max-w-[68ch] text-[17px] leading-relaxed text-ink"
              style={line(1)}
            >
              {result.text}
            </p>
            {hasVisual(result) && (
              <div className="print-line mt-2" style={line(2)}>
                <EntryErrorBoundary
                  resetKey={view}
                  chartShown={model !== null && view === 'chart'}
                  onShowTable={() => setView('table')}
                >
                  <AnswerView result={result} model={model} view={view} chartRef={chartRef} />
                </EntryErrorBoundary>
              </div>
            )}
            <div className="print-line mt-1" style={line(3)}>
              <HowIGotThis result={result} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-start gap-1 justify-self-end opacity-60 transition-opacity duration-150 [grid-area:actions] group-focus-within/entry:opacity-100 group-hover/entry:opacity-100 [@media(hover:none)]:opacity-100">
        {model && <ViewToggle value={view} onChange={setView} chartType={model.type} />}
        {result && (
          <CopyMenu
            result={result}
            chart={model && view === 'chart' ? { model, root: chartRef } : null}
          />
        )}
      </div>
    </li>
  );
}
