// Response bodies copied from docs/API.md "Examples".
import type { AskResult, CatalogResponse, ErrorBody } from '@cda/shared';

const meta = { provider: 'google', model: 'gemini-4-hydrogen' } as const;

export const kpiAnswer: AskResult = {
  question: 'How many onboarding applications were rejected?',
  title: 'Rejected applications',
  text: 'There are 312 rejected applications.',
  visualization: { type: 'kpi', valueKey: 'application_count', format: 'number' },
  columns: [{ key: 'application_count', label: 'Applications', format: 'number' }],
  rows: [{ application_count: 312 }],
  query: {
    dataset: 'applications',
    sql: 'SELECT COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id WHERE a.status IN (?) LIMIT ?',
  },
  meta: { ...meta, durationMs: 1240 },
};

export const barAnswer: AskResult = {
  question: 'Which branches have the highest rejection rate?',
  title: 'Rejection rate by branch',
  text: 'North Point has the highest rejection rate at 34.2%.',
  visualization: { type: 'bar', x: 'branch', y: 'rejection_rate' },
  columns: [
    { key: 'branch', label: 'Branch', format: 'text' },
    { key: 'rejection_rate', label: 'Rejection rate', format: 'percent' },
  ],
  rows: [
    { branch: 'North Point', rejection_rate: 0.342 },
    { branch: 'Harbour Road', rejection_rate: 0.268 },
    { branch: 'Mill Square', rejection_rate: 0.215 },
    { branch: 'Lake View', rejection_rate: 0.124 },
  ],
  query: {
    dataset: 'applications',
    sql: "SELECT b.name AS branch, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY b.name ORDER BY rejection_rate DESC LIMIT ?",
  },
  meta: { ...meta, durationMs: 1385 },
};

export const lineAnswer: AskResult = {
  question: 'Show monthly onboarding applications by customer segment',
  title: 'Monthly applications by segment',
  text: 'Applications peaked in 2026-10 with 151 across all segments.',
  visualization: { type: 'line', x: 'month', y: 'application_count', series: 'segment' },
  columns: [
    { key: 'month', label: 'Month', format: 'text' },
    { key: 'segment', label: 'Segment', format: 'text' },
    { key: 'application_count', label: 'Applications', format: 'number' },
  ],
  rows: [
    { month: '2026-09', segment: 'CORPORATE', application_count: 18 },
    { month: '2026-09', segment: 'RETAIL', application_count: 84 },
    { month: '2026-09', segment: 'SME', application_count: 31 },
    { month: '2026-10', segment: 'CORPORATE', application_count: 22 },
    { month: '2026-10', segment: 'RETAIL', application_count: 92 },
    { month: '2026-10', segment: 'SME', application_count: 37 },
  ],
  query: {
    dataset: 'applications',
    sql: "SELECT strftime('%Y-%m', a.submitted_at) AS month, a.segment AS segment, COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY month, segment ORDER BY month ASC LIMIT ?",
  },
  meta: { ...meta, durationMs: 1502 },
};

export const tableAnswer: AskResult = {
  question: 'Show approval and rejection rate by region and channel',
  title: 'Approval and rejection rate by region and channel',
  text: 'Showing 2 rows.',
  visualization: { type: 'table' },
  columns: [
    { key: 'region', label: 'Region', format: 'text' },
    { key: 'channel', label: 'Channel', format: 'text' },
    { key: 'approval_rate', label: 'Approval rate', format: 'percent' },
    { key: 'rejection_rate', label: 'Rejection rate', format: 'percent' },
  ],
  rows: [
    { region: 'North', channel: 'BRANCH', approval_rate: 0.61, rejection_rate: 0.27 },
    { region: 'North', channel: 'ONLINE', approval_rate: 0.66, rejection_rate: 0.21 },
  ],
  query: {
    dataset: 'applications',
    sql: "SELECT b.region AS region, a.channel AS channel, AVG(CASE WHEN a.status = 'APPROVED' THEN 1.0 ELSE 0 END) AS approval_rate, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY region, channel LIMIT ?",
  },
  meta: { ...meta, durationMs: 1610 },
};

export const emptyAnswer: AskResult = {
  question: 'Show corporate applications from the Lake View branch in January 2020',
  title: 'Corporate applications at Lake View',
  text: 'No data matched this question.',
  visualization: { type: 'text' },
  columns: [{ key: 'application_count', label: 'Applications', format: 'number' }],
  rows: [],
  query: {
    dataset: 'applications',
    sql: 'SELECT COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id WHERE a.segment IN (?) AND b.name IN (?) AND a.submitted_at BETWEEN ? AND ? LIMIT ?',
  },
  meta: { ...meta, durationMs: 1190 },
};

export const refusalError: ErrorBody = {
  code: 'UNSUPPORTED_QUESTION',
  message:
    'I can only answer questions about branches, customers, onboarding applications and transactions.',
  requestId: '3f0b8f2e-6a1d-4c4e-9a51-0d2b6f7c1a90',
  suggestions: [
    'Which branches have the highest rejection rate?',
    'Show monthly onboarding applications by customer segment',
    'Show the top five customers by transaction value',
  ],
};

export const rateLimitedError: ErrorBody = {
  code: 'RATE_LIMITED',
  message: 'Too many questions at once. Try again in 42 seconds.',
  requestId: '8c1e2d4a-1b7f-4f0e-a3c2-55e9d0b1f6aa',
  retryAfterSeconds: 42,
};

export const catalog: CatalogResponse = {
  datasets: [
    {
      id: 'applications',
      label: 'Onboarding applications',
      description: 'Applications by segment, branch, channel and status',
    },
    {
      id: 'transactions',
      label: 'Transactions',
      description: 'Customer credits and debits in INR',
    },
    { id: 'customers', label: 'Customers', description: 'Customers by segment and home branch' },
  ],
  examples: [
    'Show monthly onboarding applications by customer segment',
    'Which branches have the highest rejection rate?',
    'Compare retail and SME onboarding volumes',
    'Show the top five customers by transaction value',
  ],
};
