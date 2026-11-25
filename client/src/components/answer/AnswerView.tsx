import type { AskResult } from '@cda/shared';
import type { Ref } from 'react';
import type { ChartModel } from '@/lib/chartModel';
import { findColumn, hasRows } from '@/lib/result';
import { ChartView } from './ChartView';
import { DataTable } from './DataTable';
import { KpiFigure } from './KpiFigure';
import type { AnswerViewMode } from './ViewToggle';

interface AnswerViewProps {
  result: AskResult;
  /** From `chartModel(result)`; `null` when the answer isn't a chart. */
  model: ChartModel | null;
  view: AnswerViewMode;
  chartRef?: Ref<HTMLDivElement>;
}

/** The visual part of an answer: a KPI figure, a chart or a table. Text-only answers draw nothing. */
export function AnswerView({ result, model, view, chartRef }: AnswerViewProps) {
  const vis = result.visualization;

  if (vis.type === 'kpi') {
    const row = result.rows[0];
    if (row) {
      const label = findColumn(result.columns, vis.valueKey)?.label ?? result.title;
      return <KpiFigure value={row[vis.valueKey] ?? null} format={vis.format} label={label} />;
    }
  }

  if (model && view === 'chart') {
    return <ChartView ref={chartRef} model={model} title={result.title} />;
  }

  if (hasRows(result)) {
    return <DataTable columns={result.columns} rows={result.rows} caption={result.title} />;
  }

  return null;
}
