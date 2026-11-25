import type { QueryPlanQuery } from '@cda/shared';
import { unsupportedQuestion } from '../query/unsupported';
import type { Planner } from './planner';

type Plan = Omit<QueryPlanQuery, 'kind'>;

interface Rule {
  /** Every pattern must match the lower-cased question. */
  match: RegExp[];
  plan: Plan;
}

const NUMBER_WORDS: Record<string, number> = { three: 3, five: 5, ten: 10 };

/** "top five", "top 5" → 5; defaults to 5. */
function topN(question: string): number {
  const found = /top (\d+|three|five|ten)\b/.exec(question)?.[1];
  if (!found) return 5;
  return NUMBER_WORDS[found] ?? Math.min(Math.max(Number(found), 1), 100);
}

/** Fixed plans for the example questions and close variants. Checked top to bottom. */
const RULES: Rule[] = [
  {
    match: [/how many/, /applications?/, /rejected/],
    plan: {
      dataset: 'applications',
      metrics: ['application_count'],
      groupBy: [],
      filters: [{ dimension: 'status', values: ['REJECTED'] }],
      title: 'Rejected applications',
    },
  },
  {
    match: [/approval/, /rejection/, /region/, /channel/],
    plan: {
      dataset: 'applications',
      metrics: ['approval_rate', 'rejection_rate'],
      groupBy: ['region', 'channel'],
      filters: [],
      title: 'Approval and rejection rate by region and channel',
    },
  },
  {
    match: [/(rejection|reject) rate|most rejections/, /branch/],
    plan: {
      dataset: 'applications',
      metrics: ['rejection_rate'],
      groupBy: ['branch'],
      filters: [],
      sort: { by: 'rejection_rate', direction: 'desc' },
      limit: 10,
      title: 'Rejection rate by branch',
    },
  },
  {
    match: [/approval rate/, /branch/],
    plan: {
      dataset: 'applications',
      metrics: ['approval_rate'],
      groupBy: ['branch'],
      filters: [],
      sort: { by: 'approval_rate', direction: 'desc' },
      limit: 10,
      title: 'Approval rate by branch',
    },
  },
  {
    match: [/month/, /(onboarding|application)/, /segment/],
    plan: {
      dataset: 'applications',
      metrics: ['application_count'],
      groupBy: ['month', 'segment'],
      filters: [],
      title: 'Monthly applications by segment',
    },
  },
  {
    match: [/month/, /(onboarding|application)/],
    plan: {
      dataset: 'applications',
      metrics: ['application_count'],
      groupBy: ['month'],
      filters: [],
      title: 'Monthly applications',
    },
  },
  {
    match: [/compare|versus|vs\.?/, /retail/, /sme/, /(onboarding|application)/],
    plan: {
      dataset: 'applications',
      metrics: ['application_count'],
      groupBy: ['segment'],
      filters: [{ dimension: 'segment', values: ['RETAIL', 'SME'] }],
      title: 'Retail vs SME applications',
    },
  },
  {
    match: [/month/, /transaction/],
    plan: {
      dataset: 'transactions',
      metrics: ['total_value'],
      groupBy: ['month'],
      filters: [],
      title: 'Monthly transaction value',
    },
  },
  {
    match: [/customers?/, /region/],
    plan: {
      dataset: 'customers',
      metrics: ['customer_count'],
      groupBy: ['region'],
      filters: [],
      sort: { by: 'customer_count', direction: 'desc' },
      title: 'Customers by region',
    },
  },
];

/** Keyword rules instead of a model, for tests and offline use. Anything unknown throws UNSUPPORTED_QUESTION. */
export function createMockPlanner(): Planner {
  return {
    provider: 'mock',
    model: 'mock-planner',
    plan(question) {
      const q = question.toLowerCase();

      if (/top/.test(q) && /customers?/.test(q) && /transaction/.test(q)) {
        const n = topN(q);
        return Promise.resolve({
          kind: 'query',
          dataset: 'transactions',
          metrics: ['total_value'],
          groupBy: ['customer'],
          filters: [],
          sort: { by: 'total_value', direction: 'desc' },
          limit: n,
          title: `Top ${n} customers by transaction value`,
        });
      }

      const rule = RULES.find((r) => r.match.every((pattern) => pattern.test(q)));
      if (!rule) {
        return Promise.reject(unsupportedQuestion('No mock rule matches this question.'));
      }
      return Promise.resolve({ kind: 'query', ...rule.plan });
    },
  };
}
