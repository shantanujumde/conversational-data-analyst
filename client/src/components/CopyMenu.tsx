import type { AskResult } from '@cda/shared';
import { Copy } from 'lucide-react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChartModel } from '@/lib/chartModel';
import { resolveColor } from '@/lib/chartSeries';
import { canCopyImage, copyPng, copyText, downloadBlob, pngFilename, svgToPng } from '@/lib/copy';
import { toCsv } from '@/lib/csv';
import { logError } from '@/lib/log';

const COPIED = 'Copied to clipboard';
const BLOCKED = "Couldn't copy. Your browser blocked clipboard access.";

interface CopyMenuProps {
  result: AskResult;
  /** Set when a chart is on screen; the menu then offers it as a PNG. */
  chart: { model: ChartModel; root: RefObject<HTMLElement | null> } | null;
}

async function copyOrWarn(text: string) {
  if (await copyText(text)) toast.success(COPIED);
  else toast.error(BLOCKED);
}

/** Copy the answer sentence, the rows as CSV, or the chart as a PNG. */
export function CopyMenu({ result, chart }: CopyMenuProps) {
  const imageClipboard = canCopyImage();

  function renderPng(): Promise<Blob> | null {
    const svg = chart?.root.current?.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!chart || !svg) return null;
    return svgToPng(svg, {
      title: result.title,
      legend:
        chart.model.series.length > 1
          ? chart.model.series.map((s) => ({
              label: s.label,
              color: resolveColor(s.color),
              dash: s.dash,
            }))
          : [],
      background: resolveColor('var(--sheet)'),
      ink: resolveColor('var(--ink)'),
    });
  }

  async function downloadChart(png: Promise<Blob>, afterBlocked: boolean) {
    try {
      downloadBlob(await png, pngFilename(result.title));
      if (afterBlocked)
        toast.error(BLOCKED, { description: 'Downloaded the chart as a PNG instead.' });
    } catch (err) {
      logError('chart export failed', err);
      toast.error("Couldn't make an image of this chart.");
    }
  }

  async function copyChart() {
    const png = renderPng();
    if (!png) return;
    // Start the clipboard write inside the click; the PNG finishes rendering inside it.
    if (await copyPng(png)) toast.success(COPIED);
    else await downloadChart(png, true);
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy"
              className="rounded-none text-ink-soft hover:bg-cover-wash/60 hover:text-ink aria-expanded:bg-cover-wash aria-expanded:text-cover"
            >
              <Copy strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-52 rounded-none border border-rule bg-sheet p-1 shadow-[0_4px_16px_rgb(35_38_43/0.12)] ring-0"
      >
        <DropdownMenuItem
          className="rounded-none py-2"
          onSelect={() => void copyOrWarn(result.text)}
        >
          Copy answer
        </DropdownMenuItem>
        {result.rows.length > 0 && (
          <DropdownMenuItem
            className="rounded-none py-2"
            onSelect={() => void copyOrWarn(toCsv(result.columns, result.rows))}
          >
            Copy data as CSV
          </DropdownMenuItem>
        )}
        {chart && (
          <DropdownMenuItem
            className="rounded-none py-2"
            onSelect={() => {
              if (imageClipboard) {
                void copyChart();
                return;
              }
              const png = renderPng();
              if (png) void downloadChart(png, false);
            }}
          >
            {imageClipboard ? 'Copy chart as PNG' : 'Download chart as PNG'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
