import type { Entry as ChatEntry } from '@/hooks/useChat';
import { Entry } from './Entry';

interface EntryListProps {
  entries: readonly ChatEntry[];
  onAsk: (question: string) => void;
  onRetry: (entry: ChatEntry) => void;
}

/** The printed entries, oldest first. Always mounted so screen readers hear new answers. */
export function EntryList({ entries, onAsk, onRetry }: EntryListProps) {
  return (
    <ol aria-live="polite" aria-label="Answers">
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} onAsk={onAsk} onRetry={onRetry} />
      ))}
    </ol>
  );
}
