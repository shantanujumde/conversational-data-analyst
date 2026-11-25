/** Most series a chart shows; each gets one of the three passbook chart colours. */
export const MAX_SERIES = 3;

export interface SeriesStyle {
  /** CSS colour token (resolved by the browser). */
  color: string;
  /** SVG dash pattern. Green and slate are close in lightness, so slate also gets a dash. */
  dash?: string;
}

export const SERIES_STYLES: readonly SeriesStyle[] = [
  { color: 'var(--chart-1)' },
  { color: 'var(--chart-2)', dash: '6 4' },
  { color: 'var(--chart-3)' },
];

export function seriesStyle(index: number): SeriesStyle {
  return SERIES_STYLES[index % SERIES_STYLES.length] ?? { color: 'var(--chart-1)' };
}

/** Resolves a `var(--token)` colour to its current value, for drawing on a canvas. */
export function resolveColor(color: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(color);
  if (!match?.[1]) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color;
}
