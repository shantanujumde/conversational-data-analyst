import { RotateCcw } from 'lucide-react';
import { QuestionList } from '@/components/QuestionList';
import { Button } from '@/components/ui/button';
import type { FailedState } from '@/hooks/useChat';
import { useCountdown } from '@/hooks/useCountdown';
import { useEntryActions } from '@/hooks/useEntryActions';
import { errorView, rateLimitMessage } from '@/lib/errorView';

interface StampProps {
  failure: FailedState;
  onRetry: () => void;
}

/** A refusal or failure: red rubber stamp, its Ref line, a plain reason, suggestions and Try again. */
export function Stamp({ failure: { error, retryAt }, onRetry }: StampProps) {
  const { submit } = useEntryActions();
  const view = errorView[error.code];
  const secondsLeft = useCountdown(retryAt);
  const suggestions = (error.suggestions ?? []).slice(0, 3);
  // The UI shows `error.message`, except the rate limit: the server's "in 42 seconds" goes stale.
  const message = error.code === 'RATE_LIMITED' ? rateLimitMessage(secondsLeft) : error.message;

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

      {error.requestId && (
        <p className="font-print text-[13px] text-ink-soft">Ref: {error.requestId}</p>
      )}

      <p className="max-w-[68ch] text-[17px] text-ink">{message}</p>

      {suggestions.length > 0 && (
        <QuestionList
          questions={suggestions}
          onPick={submit}
          size="md"
          className="w-full max-w-[560px]"
        />
      )}

      {view.retry && (
        <Button type="button" variant="outline" onClick={onRetry} disabled={secondsLeft > 0}>
          <RotateCcw strokeWidth={1.5} aria-hidden="true" />
          {secondsLeft > 0 ? (
            <span className="tabular">Try again in {secondsLeft} s</span>
          ) : (
            'Try again'
          )}
        </Button>
      )}
    </div>
  );
}
