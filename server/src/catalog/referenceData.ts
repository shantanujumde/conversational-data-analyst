/**
 * The fixed lists the bank's data is made of. The seed script writes rows from them and the
 * catalog uses them as the allowed filter values, so the two can't disagree.
 */

export const SEGMENTS = ['RETAIL', 'SME', 'CORPORATE'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const REGIONS = ['North', 'South', 'East', 'West'] as const;
export type Region = (typeof REGIONS)[number];

export const CHANNELS = ['BRANCH', 'ONLINE', 'MOBILE'] as const;
export type Channel = (typeof CHANNELS)[number];

export const STATUSES = ['APPROVED', 'REJECTED', 'PENDING'] as const;
export type Status = (typeof STATUSES)[number];

export const TXN_TYPES = ['CREDIT', 'DEBIT'] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export interface Branch {
  name: string;
  city: string;
  region: Region;
  /** Share of this branch's applications that the seed marks rejected. */
  rejectionRate: number;
}

/** Fictional branch names. North Point is the clear highest rejection rate. */
export const BRANCHES: readonly Branch[] = [
  { name: 'North Point', city: 'Delhi', region: 'North', rejectionRate: 0.34 },
  { name: 'Ridge Avenue', city: 'Chandigarh', region: 'North', rejectionRate: 0.16 },
  { name: 'Harbour Road', city: 'Chennai', region: 'South', rejectionRate: 0.27 },
  { name: 'Lake View', city: 'Bengaluru', region: 'South', rejectionRate: 0.12 },
  { name: 'Mill Square', city: 'Kolkata', region: 'East', rejectionRate: 0.22 },
  { name: 'River Gate', city: 'Bhubaneswar', region: 'East', rejectionRate: 0.19 },
  { name: 'Market Street', city: 'Mumbai', region: 'West', rejectionRate: 0.14 },
  { name: 'Fort Lane', city: 'Ahmedabad', region: 'West', rejectionRate: 0.1 },
];
