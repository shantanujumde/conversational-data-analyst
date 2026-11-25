import { ChartColumn, ChartLine, Table2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type AnswerViewMode = 'chart' | 'table';

interface ViewToggleProps {
  value: AnswerViewMode;
  onChange: (value: AnswerViewMode) => void;
  chartType: 'bar' | 'line';
}

const ITEM =
  'size-8 min-w-8 rounded-none p-0 text-ink-soft hover:bg-cover-wash/60 hover:text-ink aria-checked:bg-cover-wash aria-checked:text-cover';

/** Switches a chart answer between the chart and its table. */
export function ViewToggle({ value, onChange, chartType }: ViewToggleProps) {
  const ChartIcon = chartType === 'line' ? ChartLine : ChartColumn;
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next === 'chart' || next === 'table') onChange(next);
      }}
      spacing={0}
      aria-label="Show as"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="chart" aria-label="Chart" className={ITEM}>
            <ChartIcon strokeWidth={1.5} />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Chart</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="table" aria-label="Table" className={ITEM}>
            <Table2 strokeWidth={1.5} />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Table</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
