/**
 * The allow-list (docs/SPEC.md §5). The AI may only pick ids from here, and the
 * server builds SQL only from these fragments. Object keys are the ids.
 */
import type { DatasetId, MetricFormat } from '@cda/shared';
import { BRANCHES, CHANNELS, REGIONS, SEGMENTS, STATUSES, TXN_TYPES } from './referenceData';

export interface Metric {
  label: string;
  /** Aggregate SQL expression. */
  sql: string;
  format: MetricFormat;
}

export interface Dimension {
  label: string;
  /** Column or expression to select, group and filter by. */
  sql: string;
  /** `time` values are `YYYY-MM` months; `category` values are plain labels. */
  kind: 'time' | 'category';
  /** The only values a filter may use (category dimensions). */
  values?: readonly string[];
  /**
   * `false` for a category with no fixed value list (`customer`): it can be grouped by,
   * not filtered on (docs/SPEC.md §6).
   */
  filterable?: false;
}

export interface Dataset {
  label: string;
  description: string;
  /** Base table and joins, used as the FROM clause. */
  from: string;
  /** Column that date ranges filter on. */
  dateColumn: string;
  metrics: Readonly<Record<string, Metric>>;
  dimensions: Readonly<Record<string, Dimension>>;
}

const BRANCH_NAMES = BRANCHES.map((b) => b.name);

export const CATALOG: Readonly<Record<DatasetId, Dataset>> = {
  applications: {
    label: 'Onboarding applications',
    description: 'Applications by segment, branch, channel and status',
    from: 'onboarding_applications a JOIN branches b ON b.id = a.branch_id',
    dateColumn: 'a.submitted_at',
    metrics: {
      application_count: { label: 'Applications', sql: 'COUNT(*)', format: 'number' },
      approval_rate: {
        label: 'Approval rate',
        sql: "AVG(CASE WHEN a.status = 'APPROVED' THEN 1.0 ELSE 0 END)",
        format: 'percent',
      },
      rejection_rate: {
        label: 'Rejection rate',
        sql: "AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END)",
        format: 'percent',
      },
    },
    dimensions: {
      month: { label: 'Month', sql: "strftime('%Y-%m', a.submitted_at)", kind: 'time' },
      segment: { label: 'Segment', sql: 'a.segment', kind: 'category', values: SEGMENTS },
      branch: { label: 'Branch', sql: 'b.name', kind: 'category', values: BRANCH_NAMES },
      region: { label: 'Region', sql: 'b.region', kind: 'category', values: REGIONS },
      channel: {
        label: 'Channel',
        sql: 'a.channel',
        kind: 'category',
        values: CHANNELS,
      },
      status: {
        label: 'Status',
        sql: 'a.status',
        kind: 'category',
        values: STATUSES,
      },
    },
  },
  transactions: {
    label: 'Transactions',
    description: 'Customer credits and debits in INR',
    from: 'transactions t JOIN customers c ON c.id = t.customer_id JOIN branches b ON b.id = c.branch_id',
    dateColumn: 't.txn_date',
    metrics: {
      transaction_count: { label: 'Transactions', sql: 'COUNT(*)', format: 'number' },
      total_value: { label: 'Total value', sql: 'ROUND(SUM(t.amount), 2)', format: 'currency' },
      average_value: {
        label: 'Average value',
        sql: 'ROUND(AVG(t.amount), 2)',
        format: 'currency',
      },
    },
    dimensions: {
      month: { label: 'Month', sql: "strftime('%Y-%m', t.txn_date)", kind: 'time' },
      customer: { label: 'Customer', sql: 'c.name', kind: 'category', filterable: false },
      segment: { label: 'Segment', sql: 'c.segment', kind: 'category', values: SEGMENTS },
      branch: { label: 'Branch', sql: 'b.name', kind: 'category', values: BRANCH_NAMES },
      type: { label: 'Type', sql: 't.type', kind: 'category', values: TXN_TYPES },
    },
  },
  customers: {
    label: 'Customers',
    description: 'Customers by segment and home branch',
    from: 'customers c JOIN branches b ON b.id = c.branch_id',
    dateColumn: 'c.joined_at',
    metrics: {
      customer_count: { label: 'Customers', sql: 'COUNT(*)', format: 'number' },
    },
    dimensions: {
      segment: { label: 'Segment', sql: 'c.segment', kind: 'category', values: SEGMENTS },
      branch: { label: 'Branch', sql: 'b.name', kind: 'category', values: BRANCH_NAMES },
      region: { label: 'Region', sql: 'b.region', kind: 'category', values: REGIONS },
      month: { label: 'Month joined', sql: "strftime('%Y-%m', c.joined_at)", kind: 'time' },
    },
  },
};

/** Looks up a metric on a dataset without walking the prototype chain. */
export function getMetric(dataset: Dataset, id: string): Metric | undefined {
  return Object.hasOwn(dataset.metrics, id) ? dataset.metrics[id] : undefined;
}

/** True for the month dimension: values are `YYYY-MM`, and charts draw it as a time axis. */
export function isTimeDimension(dimension: Dimension): boolean {
  return dimension.kind === 'time';
}

/** Looks up a dimension on a dataset without walking the prototype chain. */
export function getDimension(dataset: Dataset, id: string): Dimension | undefined {
  return Object.hasOwn(dataset.dimensions, id) ? dataset.dimensions[id] : undefined;
}
