import { EmptyState } from '@/components/EmptyState';
import { EntryList } from '@/components/entry/EntryList';
import { TellerSlip } from '@/components/input/TellerSlip';
import { PassbookPage } from '@/components/layout/PassbookPage';
import { TopBand } from '@/components/layout/TopBand';
import { useChat } from '@/hooks/useChat';
import { useExamples } from '@/hooks/useExamples';

export function App() {
  const { entries, ask, retry } = useChat();
  const examples = useExamples();

  return (
    <>
      <TopBand />
      <PassbookPage footer={<TellerSlip onSubmit={ask} />}>
        {entries.length === 0 && <EmptyState examples={examples} onPick={ask} />}
        <EntryList entries={entries} onAsk={ask} onRetry={retry} />
      </PassbookPage>
    </>
  );
}
