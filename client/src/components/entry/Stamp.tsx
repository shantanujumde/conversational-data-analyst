import { CornerDownRight, RotateCcw } from 'lucide-react';
import type { ClientError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { errorView } from '@/lib/errorView';

interface StampProps {
  error: ClientError;
  /** Epoch ms before which Try again stays disabled (rate limit). */
  retryAt: number | null;
  onRetry: () => void;
  onAsk: (question: string) => void;
}

/** A refusal or failure: red rubber stamp, a plain reason, suggestions and Try again. */
export function Stamp({ error, retryAt, onRetry, onAsk }: StampProps) {
  const view = errorView[error.code];
  const secondsLeft = useCountdown(retryAt);
  const suggestions = (error.suggestions ?? []).slice(0, 3);

  return (
    <div className="flex flex-col items-start gap-3">
      {view.stamp && (
        <p
          className="stamp mt-1 border-2 border-stamp px-3 py-1 text-[15px] font-semibold tracking-[0.14em] text-stamp outline-1 outline-offset-2 outline-stamp outline-solid"
          aria-label={`Stamped: ${view.stamp}`}
        >
          {view.stamp}
        </p>
      )}

      <p className="max-w-[68ch] text-[17px] text-ink">{error.message || view.fallbackMessage}</p>

      {suggestions.length > 0 && (
        <div className="w-full max-w-[560px]">
          <p className="mb-1 text-[13px] text-ink-soft">You could ask:</p>
          <ul className="border-t border-rule">
            {suggestions.map((s) => (
              <li key={s} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onAsk(s)}
                  className="group/s flex w-full items-center gap-2 py-2 text-left text-[15px] text-ink hover:bg-cover-wash/50"
                >
                  <CornerDownRight
                    strokeWidth={1.5}
                    className="size-4 shrink-0 text-ink-soft group-hover/s:text-cover"
                    aria-hidden="true"
                  />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.retry && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={secondsLeft > 0}
          className="h-9 rounded-none border-ink/70 bg-transparent px-3 text-[15px] text-ink hover:bg-cover-wash/60"
        >
          <RotateCcw strokeWidth={1.5} aria-hidden="true" />
          {secondsLeft > 0 ? (
            <span className="tabular">Try again in {secondsLeft} s</span>
          ) : (
            'Try again'
          )}
        </Button>
      )}

      {error.requestId && (
        <p className="font-print text-[13px] text-ink-soft">Ref: {error.requestId}</p>
      )}
    </div>
  );
}
