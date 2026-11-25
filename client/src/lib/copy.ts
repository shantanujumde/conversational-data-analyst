/** Copies plain text. Resolves `false` if the browser blocks or lacks the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser can put an image on the clipboard at all. */
export function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.write === 'function'
  );
}

/**
 * Copies a PNG. Takes a promise so the clipboard write starts inside the click
 * (Safari refuses writes that start after an `await`).
 */
export async function copyPng(png: Promise<Blob>): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "Rejection rate by branch" → "rejection-rate-by-branch.png" */
export function pngFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'chart'}.png`;
}

// Presentation attributes the chart gets from CSS; inlined so the standalone
// image looks the same (CSS variables don't resolve outside the page).
const INLINE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
] as const;

function inlineStyles(source: Element, target: Element): void {
  const computed = getComputedStyle(source);
  const style = INLINE_PROPS.map((p) => `${p}:${computed.getPropertyValue(p)}`).join(';');
  target.setAttribute('style', style);
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    const s = sourceChildren[i];
    const t = targetChildren[i];
    if (s && t) inlineStyles(s, t);
  }
}

export interface PngLegendItem {
  label: string;
  /** A resolved colour (not a CSS variable). */
  color: string;
  dash?: string;
}

interface PngOptions {
  /** Printed above the chart so the pasted image explains itself. */
  title?: string;
  /** Series names, drawn under the title (the on-screen legend is HTML, not part of the SVG). */
  legend?: readonly PngLegendItem[];
  background: string;
  ink: string;
  scale?: number;
}

/** Draws an on-screen chart SVG onto a canvas and returns it as a PNG. */
export async function svgToPng(svg: SVGSVGElement, options: PngOptions): Promise<Blob> {
  const { width, height } = svg.getBoundingClientRect();
  const scale = options.scale ?? 2;
  const pad = 24;
  const legend = options.legend ?? [];
  const titleHeight = (options.title ? 32 : 0) + (legend.length > 0 ? 28 : 0);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = Math.round((width + pad * 2) * scale);
    canvas.height = Math.round((height + pad * 2 + titleHeight) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.scale(scale, scale);
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width + pad * 2, height + pad * 2 + titleHeight);
    if (options.title) {
      ctx.fillStyle = options.ink;
      ctx.font = '600 16px "Public Sans", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(options.title, pad, pad);
    }
    if (legend.length > 0) {
      const y = pad + (options.title ? 32 : 0) + 8;
      let x = pad;
      ctx.font = '400 13px "Public Sans", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2;
      for (const item of legend) {
        ctx.strokeStyle = item.color;
        ctx.setLineDash(item.dash ? item.dash.split(' ').map(Number) : []);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 20, y);
        ctx.stroke();
        ctx.fillStyle = options.ink;
        ctx.fillText(item.label, x + 26, y);
        x += 26 + ctx.measureText(item.label).width + 20;
      }
      ctx.setLineDash([]);
    }
    ctx.drawImage(img, pad, pad + titleHeight, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
