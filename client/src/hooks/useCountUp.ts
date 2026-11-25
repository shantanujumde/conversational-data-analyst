import { useEffect, useState } from 'react';

const COUNT_UP_MS = 600;

/** Counts from 0 to `target` over 600 ms, easing out. Returns `target` at once when not `enabled`. */
export function useCountUp(target: number, enabled: boolean): number {
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
