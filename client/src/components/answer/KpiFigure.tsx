import type { CellValue, MetricFormat } from '@cda/shared';
import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatValue } from '@/lib/format';

interface KpiFigureProps {
  value: CellValue;
  format: MetricFormat;
  label: string;
}

/** The single figure an answer is about, printed large. */
export function KpiFigure({ value, format, label }: KpiFigureProps) {
  const reduced = useReducedMotion();
  const target = typeof value === 'number' ? value : 0;
  const counted = useCountUp(target, typeof value === 'number' && !reduced);
  // Whole-number targets count in whole steps so the figure never shows stray decimals.
  const frameValue = Number.isInteger(target) ? Math.round(counted) : counted;
  const finalText = formatValue(value, format);

  return (
    <div className="flex flex-col gap-1">
      <data
        value={typeof value === 'number' ? String(value) : undefined}
        className="tabular text-[48px] leading-none font-medium tracking-[-0.02em] text-ink"
      >
        <span aria-hidden="true">
          {typeof value === 'number' ? formatValue(frameValue, format) : finalText}
        </span>
        <span className="sr-only">{finalText}</span>
      </data>
      <span className="text-[13px] text-ink-soft">{label}</span>
    </div>
  );
}
