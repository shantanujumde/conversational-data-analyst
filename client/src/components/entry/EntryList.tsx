import type { ChatEntry } from '@/hooks/useChat';
import { Entry } from './Entry';

/** The printed entries, oldest first. Always mounted so screen readers hear new answers. */
export function EntryList({ entries }: { entries: readonly ChatEntry[] }) {
  return (
    <ol aria-live="polite" aria-label="Answers">
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
