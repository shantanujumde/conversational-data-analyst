import type { ComponentProps, Ref } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { categoryAxisWidth, categoryLabel, toText } from '@/lib/chartFormat';
import type { ChartModel, ChartSeries } from '@/lib/chartModel';
import { formatAxis, formatValue } from '@/lib/format';

const ANIMATION_MS = 700;
const BAR_ROW_PX = 34;
const LINE_HEIGHT_PX = 260;

/** Recharts' grow and draw-in animation (SPEC §14 Motion). */
interface Animation {
  isAnimationActive: boolean;
  animationDuration: number;
  animationEasing: 'ease-out';
}

function SeriesSwatch({ series }: { series: Pick<ChartSeries, 'color' | 'dash'> }) {
  return (
    <svg width="20" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2="20"
        y2="4"
        stroke={series.color}
        strokeWidth="2"
        strokeDasharray={series.dash}
      />
    </svg>
  );
}

function SeriesLegend({ model }: { model: ChartModel }) {
  if (model.series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink">
      {model.series.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <SeriesSwatch series={s} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

interface PassbookTooltipProps {
  model: ChartModel;
  /** The hover highlight: a wash behind a bar, or a dashed rule on a line chart. */
  cursor: ComponentProps<typeof ChartTooltip>['cursor'];
}

function PassbookTooltip({ model, cursor }: PassbookTooltipProps) {
  return (
    <ChartTooltip
      cursor={cursor}
      content={
        <ChartTooltipContent
          className="min-w-40 border-rule bg-sheet px-3 py-2 text-[13px] shadow-tip"
          labelClassName="font-medium text-ink"
          labelFormatter={(label) => categoryLabel(label)}
          formatter={(value, _name, item) => {
            const s = model.series.find((x) => x.key === item.dataKey) ?? model.series[0];
            return (
              <div className="flex w-full items-center gap-2">
                {s && model.series.length > 1 && <SeriesSwatch series={s} />}
                <span className="text-ink-soft">{s?.label}</span>
                <span className="tabular ml-auto pl-4 text-ink">
                  {typeof value === 'number' ? formatValue(value, model.y.format) : toText(value)}
                </span>
              </div>
            );
          }}
        />
      }
    />
  );
}

interface ChartBodyProps {
  model: ChartModel;
  config: ChartConfig;
  animation: Animation;
}

/** Horizontal bars, one per category, with the value printed at the end of each bar. */
function BarChartView({ model, config, animation }: ChartBodyProps) {
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full text-[13px]"
      style={{ height: model.data.length * BAR_ROW_PX + 8 }}
    >
      <BarChart
        data={model.data}
        layout="vertical"
        margin={{ top: 4, right: 88, bottom: 4, left: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" dataKey={model.y.key} hide domain={[0, 'dataMax']} />
        <YAxis
          type="category"
          dataKey={model.x}
          width={categoryAxisWidth(model)}
          tickLine={false}
          axisLine={{ stroke: 'var(--rule)' }}
          tick={{ fill: 'var(--ink)' }}
          tickFormatter={categoryLabel}
        />
        <PassbookTooltip model={model} cursor={{ fill: 'var(--cover-wash)', fillOpacity: 0.6 }} />
        <Bar dataKey={model.y.key} fill={`var(--color-${model.y.key})`} {...animation}>
          <LabelList
            dataKey={model.y.key}
            position="right"
            offset={8}
            fill="var(--ink)"
            className="tabular"
            formatter={(v: unknown) => {
              if (typeof v !== 'number') return toText(v);
              // Full INR amounts don't fit beside a bar; the tooltip and table keep them.
              return model.y.format === 'currency'
                ? formatAxis(v, 'currency')
                : formatValue(v, model.y.format);
            }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** One line per series over the months. */
function LineChartView({ model, config, animation }: ChartBodyProps) {
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full text-[13px]"
      style={{ height: LINE_HEIGHT_PX }}
    >
      <LineChart data={model.data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--rule)" />
        <XAxis
          dataKey={model.x}
          tickLine={false}
          axisLine={{ stroke: 'var(--rule)' }}
          tickMargin={8}
          minTickGap={16}
          tickFormatter={categoryLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={(v: number) => formatAxis(v, model.y.format)}
        />
        <PassbookTooltip
          model={model}
          cursor={{ stroke: 'var(--ink-soft)', strokeDasharray: '2 3' }}
        />
        {model.series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="linear"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            strokeDasharray={s.dash}
            dot={{ r: 3, strokeWidth: 2, fill: 'var(--sheet)', strokeDasharray: '0' }}
            activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--sheet)', strokeDasharray: '0' }}
            {...animation}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** The one place that picks the chart for the model's type. */
function ChartBody(props: ChartBodyProps) {
  switch (props.model.type) {
    case 'bar':
      return <BarChartView {...props} />;
    case 'line':
      return <LineChartView {...props} />;
  }
}

interface ChartViewProps {
  model: ChartModel;
  title: string;
  /** The wrapper element; the copy menu finds the chart's SVG inside it. */
  ref?: Ref<HTMLDivElement>;
}

/** A bar or line chart drawn in the passbook's three ink colours. */
export function ChartView({ model, title, ref }: ChartViewProps) {
  const reduced = useReducedMotion();
  const body: ChartBodyProps = {
    model,
    config: Object.fromEntries(
      model.series.map((s) => [s.key, { label: s.label, color: s.color }]),
    ),
    animation: {
      isAnimationActive: !reduced,
      animationDuration: ANIMATION_MS,
      animationEasing: 'ease-out',
    },
  };

  return (
    <figure ref={ref} aria-label={title} className="m-0">
      <SeriesLegend model={model} />
      <ChartBody {...body} />
      {model.hiddenSeries > 0 && (
        <figcaption className="mt-2 text-[13px] text-ink-soft">
          Showing the {model.series.length} largest of {model.series.length + model.hiddenSeries}.
          The table view has all of them.
        </figcaption>
      )}
    </figure>
  );
}
