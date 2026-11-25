import type { CellValue, ValueFormat } from '@cda/shared';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatValue } from '@/lib/format';

const COUNT_UP_MS = 600;

/** Counts from 0 to `target` over 600 ms, easing out. Returns `target` at once with reduced motion. */
function useCountUp(target: number, enabled: boolean): number {
  const [shown, setShown] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t === 1 ? target : target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return enabled ? shown : target;
}

interface KpiFigureProps {
  value: CellValue;
  format: Exclude<ValueFormat, 'text'>;
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
