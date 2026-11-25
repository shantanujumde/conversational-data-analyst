import type { CSSProperties } from 'react';

/** Inline style for a `.print-line`: its place in the print order, 50 ms per line (SPEC §14). */
export function printLineStyle(index: number): CSSProperties {
  return { '--line': index } as CSSProperties;
}
