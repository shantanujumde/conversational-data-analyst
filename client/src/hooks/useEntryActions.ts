import { createContext, useContext } from 'react';
import type { ChatEntry } from './useChat';

/** What an entry or the empty state can do: ask a question, or re-send a failed one. */
export interface EntryActions {
  submit: (question: string) => void;
  retry: (entry: ChatEntry) => void;
}

/** Provided once in `App`, so the actions don't pass through every component on the way. */
export const EntryActionsContext = createContext<EntryActions | null>(null);

export function useEntryActions(): EntryActions {
  const actions = useContext(EntryActionsContext);
  if (!actions) throw new Error('useEntryActions must be used inside <EntryActionsContext>');
  return actions;
}
