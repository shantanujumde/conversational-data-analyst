import type { ReactNode } from 'react';

const TILE_W = 160;
const TILE_H = 48;

/** One sine wave across a tile, as an SVG path. Whole periods, so tiles join seamlessly. */
function wave(periods: number, amplitude: number, phase: number): string {
  const points: string[] = [];
  for (let x = 0; x <= TILE_W; x += 2) {
    const y = TILE_H / 2 + amplitude * Math.sin((x / TILE_W) * periods * 2 * Math.PI + phase);
    points.push(`${x},${y.toFixed(2)}`);
  }
  return `M${points.join(' L')}`;
}

// Phase-shifted waves at two frequencies cross into the looping guilloche lattice
// printed on cheques and passbooks.
const GUILLOCHE_PATHS = [
  ...Array.from({ length: 6 }, (_, i) => wave(1, 16, (i * Math.PI) / 3)),
  ...Array.from({ length: 4 }, (_, i) => wave(2, 9, (i * Math.PI) / 2)),
];

function Guilloche() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-cover opacity-[0.04]"
    >
      <defs>
        <pattern
          id="guilloche"
          width={TILE_W}
          height={TILE_H}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          {GUILLOCHE_PATHS.map((d) => (
            <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="1" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#guilloche)" />
    </svg>
  );
}

interface PassbookPageProps {
  children: ReactNode;
  /** Pinned to the foot of the page (the teller's slip). */
  footer: ReactNode;
}

/** One passbook page lying on the desk: tinted security paper, ruled columns, a soft shadow. */
export function PassbookPage({ children, footer }: PassbookPageProps) {
  return (
    <main className="mx-auto w-full max-w-[960px] sm:px-4 sm:pt-6">
      <div className="relative flex min-h-[calc(100dvh-3rem)] flex-col bg-sheet shadow-sheet sm:min-h-[calc(100dvh-4.5rem)]">
        <Guilloche />
        <div className="relative flex-1">{children}</div>
        <div className="sticky bottom-0 z-10">{footer}</div>
      </div>
    </main>
  );
}
