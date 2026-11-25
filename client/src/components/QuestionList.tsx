import { CornerDownLeft } from 'lucide-react';
import { printLineStyle } from '@/lib/printLine';
import { cn } from '@/lib/utils';

interface QuestionListProps {
  questions: readonly string[];
  onPick: (question: string) => void;
  /** `lg` for the empty state's examples, `md` for the suggestions under a stamp. */
  size?: 'lg' | 'md';
  className?: string;
}

/** Questions printed as ruled lines; clicking one asks it. */
export function QuestionList({ questions, onPick, size = 'lg', className }: QuestionListProps) {
  return (
    <ul className={cn('border-t border-rule', className)}>
      {questions.map((q, i) => (
        <li key={q} className="print-line border-b border-rule" style={printLineStyle(i + 1)}>
          <button
            type="button"
            onClick={() => onPick(q)}
            className={cn(
              'group/q flex w-full items-center justify-between gap-4 text-left text-ink hover:bg-cover-wash/50 focus-visible:bg-cover-wash/50',
              size === 'lg' ? 'py-3.5 text-[17px]' : 'py-2 text-[15px]',
            )}
          >
            <span>{q}</span>
            <CornerDownLeft
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-4 shrink-0 text-cover opacity-0 group-hover/q:opacity-100 group-focus-visible/q:opacity-100"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
