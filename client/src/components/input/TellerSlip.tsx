import { QUESTION_MAX_LENGTH } from '@cda/shared';
import { type FormEvent, type KeyboardEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** The character count shows from here on. */
const COUNT_FROM = 450;

interface TellerSlipProps {
  onSubmit: (question: string) => void;
}

/** The input: a ruled teller's slip pinned to the foot of the page. */
export function TellerSlip({ onSubmit }: TellerSlipProps) {
  const [text, setText] = useState('');
  const id = useId();
  const blank = text.trim().length === 0;

  function send() {
    if (blank) return;
    onSubmit(text);
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line. Leave Enter alone while an IME is composing.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className="border-t border-dashed border-ink-soft/50 bg-sheet px-4 pt-3 pb-4 shadow-[0_-12px_24px_-16px_rgb(35_38_43/0.18)] sm:px-8 sm:pb-5"
    >
      <label htmlFor={id} className="mb-1 block text-[13px] text-ink-soft">
        Ask about branches, customers, applications or transactions
      </label>
      <div className="flex items-end gap-3 sm:gap-4">
        <Textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={QUESTION_MAX_LENGTH}
          rows={1}
          autoFocus
          aria-describedby={text.length >= COUNT_FROM ? `${id}-count` : undefined}
          className="ruled-field max-h-[calc(28px*5)] min-h-[56px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-[17px] text-ink shadow-none focus-visible:outline-offset-4 md:text-[17px]"
        />
        <Button
          type="submit"
          disabled={blank}
          className="h-11 shrink-0 rounded-none bg-cover px-5 text-[15px] font-semibold text-white hover:bg-[#173d2e] disabled:opacity-40"
        >
          Print answer
        </Button>
      </div>
      {text.length >= COUNT_FROM && (
        <p id={`${id}-count`} className="tabular mt-1 text-right text-[13px] text-ink-soft">
          {text.length} / {QUESTION_MAX_LENGTH}
        </p>
      )}
    </form>
  );
}
