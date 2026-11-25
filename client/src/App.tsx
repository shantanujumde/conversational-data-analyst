import { useMemo } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { EntryList } from '@/components/entry/EntryList';
import { TellerSlip } from '@/components/input/TellerSlip';
import { PassbookPage } from '@/components/layout/PassbookPage';
import { TopBand } from '@/components/layout/TopBand';
import { useChat } from '@/hooks/useChat';
import { EntryActionsContext } from '@/hooks/useEntryActions';
import { useExamples } from '@/hooks/useExamples';

export function App() {
  const { entries, submit, retry } = useChat();
  const examples = useExamples();
  const actions = useMemo(() => ({ submit, retry }), [submit, retry]);

  return (
    <EntryActionsContext value={actions}>
      <TopBand />
      <PassbookPage footer={<TellerSlip onSubmit={submit} />}>
        {entries.length === 0 && <EmptyState examples={examples} />}
        <EntryList entries={entries} />
      </PassbookPage>
    </EntryActionsContext>
  );
}
