/**
 * Creates the SQLite file with synthetic banking data: `npm run db:seed`.
 * The random generator is seeded and the end date is fixed, so every run produces the same rows.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveDatabasePath } from '../config';
import { type Db, openWritable } from './connection';
import { Random } from './random';

export const SEED = 20261125;
/** Last day of the data. The 12 calendar months up to and including it are covered. */
export const SEED_END_DATE = '2026-11-30';
export const COUNTS = { customers: 200, applications: 1500, transactions: 5000 } as const;

type Region = 'North' | 'South' | 'East' | 'West';
type Segment = 'RETAIL' | 'SME' | 'CORPORATE';

interface BranchSeed {
  name: string;
  city: string;
  region: Region;
  /** Share of this branch's applications that are rejected. */
  rejectionRate: number;
}

/** Fictional branch names. North Point is the clear highest rejection rate. */
export const BRANCHES: readonly BranchSeed[] = [
  { name: 'North Point', city: 'Delhi', region: 'North', rejectionRate: 0.34 },
  { name: 'Ridge Avenue', city: 'Chandigarh', region: 'North', rejectionRate: 0.16 },
  { name: 'Harbour Road', city: 'Chennai', region: 'South', rejectionRate: 0.27 },
  { name: 'Lake View', city: 'Bengaluru', region: 'South', rejectionRate: 0.12 },
  { name: 'Mill Square', city: 'Kolkata', region: 'East', rejectionRate: 0.22 },
  { name: 'River Gate', city: 'Bhubaneswar', region: 'East', rejectionRate: 0.19 },
  { name: 'Market Street', city: 'Mumbai', region: 'West', rejectionRate: 0.14 },
  { name: 'Fort Lane', city: 'Ahmedabad', region: 'West', rejectionRate: 0.1 },
];

const SEGMENT_WEIGHTS: Record<Segment, number> = { RETAIL: 65, SME: 25, CORPORATE: 10 };
const CHANNEL_WEIGHTS = { BRANCH: 35, ONLINE: 40, MOBILE: 25 } as const;
const TYPE_WEIGHTS = { CREDIT: 50, DEBIT: 50 } as const;

/** Transaction amount range in INR, per segment. */
const AMOUNT_RANGE: Record<Segment, [number, number]> = {
  RETAIL: [200, 200_000],
  SME: [5_000, 2_000_000],
  CORPORATE: [50_000, 10_000_000],
};

/** Applications submitted this recently that aren't rejected are still pending. */
const PENDING_WINDOW_DAYS = 14;

const FIRST_NAMES = [
  'Aarav', 'Ananya', 'Arjun', 'Diya', 'Ishaan', 'Kavya', 'Rohan', 'Meera', 'Vikram', 'Nisha',
  'Kabir', 'Priya', 'Aditya', 'Sneha', 'Rahul', 'Tara', 'Siddharth', 'Pooja', 'Nikhil', 'Zara',
  'Karan', 'Leela', 'Manav', 'Riya', 'Dev', 'Asha', 'Neil', 'Gauri', 'Yash', 'Isha',
]; // prettier-ignore
const LAST_NAMES = [
  'Sharma', 'Iyer', 'Banerjee', 'Patel', 'Reddy', 'Khanna', 'Menon', 'Das', 'Joshi', 'Nair',
  'Kapoor', 'Rao', 'Ghosh', 'Shah', 'Pillai', 'Mehta', 'Bose', 'Kulkarni', 'Verma', 'Desai',
]; // prettier-ignore
const SME_WORDS = ['Traders', 'Textiles', 'Foods', 'Logistics', 'Electricals', 'Pharma', 'Motors'];
const CORPORATE_PREFIXES = [
  'Indus',
  'Sahyadri',
  'Ganga',
  'Kaveri',
  'Vindhya',
  'Narmada',
  'Aravali',
];
const CORPORATE_WORDS = ['Industries', 'Holdings', 'Infra', 'Technologies', 'Steel', 'Agro'];

const DAY_MS = 86_400_000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** First day of the month `monthsBack` months before `date`'s month (UTC). */
function monthStart(date: Date, monthsBack: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));
}

function randomDateBetween(rng: Random, from: Date, to: Date): Date {
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
  return addDays(from, rng.int(0, days));
}

function personName(rng: Random): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

function customerName(rng: Random, segment: Segment): string {
  if (segment === 'RETAIL') return personName(rng);
  if (segment === 'SME') return `${rng.pick(LAST_NAMES)} ${rng.pick(SME_WORDS)}`;
  return `${rng.pick(CORPORATE_PREFIXES)} ${rng.pick(CORPORATE_WORDS)} Ltd`;
}

/** Creates the tables and fills them. Expects an empty database. */
export function seedDatabase(db: Db): void {
  const rng = new Random(SEED);
  const end = new Date(`${SEED_END_DATE}T00:00:00Z`);
  const windowStart = monthStart(end, 11);
  const customersSince = monthStart(end, 23);

  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

  const insertBranch = db.prepare(
    'INSERT INTO branches (id, name, city, region) VALUES (?, ?, ?, ?)',
  );
  const insertCustomer = db.prepare(
    'INSERT INTO customers (id, name, segment, branch_id, joined_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertApplication = db.prepare(
    `INSERT INTO onboarding_applications
       (id, applicant, segment, branch_id, channel, status, submitted_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertTransaction = db.prepare(
    'INSERT INTO transactions (id, customer_id, amount, type, txn_date) VALUES (?, ?, ?, ?, ?)',
  );

  db.transaction(() => {
    BRANCHES.forEach((b, i) => insertBranch.run(i + 1, b.name, b.city, b.region));
    const branchIds = BRANCHES.map((_, i) => i + 1);

    // Customers: unique names, so "top customers" never merges two people.
    const customers: { id: number; segment: Segment; joinedAt: Date }[] = [];
    const usedNames = new Set<string>();
    for (let id = 1; id <= COUNTS.customers; id++) {
      const segment = rng.weighted(SEGMENT_WEIGHTS);
      let name = customerName(rng, segment);
      while (usedNames.has(name)) name = customerName(rng, segment);
      usedNames.add(name);
      const joinedAt = randomDateBetween(rng, customersSince, end);
      insertCustomer.run(id, name, segment, rng.pick(branchIds), isoDate(joinedAt));
      customers.push({ id, segment, joinedAt });
    }

    // Applications: each branch gets exactly its fixed rejection rate.
    const applications = Array.from({ length: COUNTS.applications }, (_, i) => ({
      id: i + 1,
      applicant: personName(rng),
      segment: rng.weighted(SEGMENT_WEIGHTS),
      branchIndex: rng.int(0, BRANCHES.length - 1),
      channel: rng.weighted(CHANNEL_WEIGHTS),
      submittedAt: randomDateBetween(rng, windowStart, end),
    }));
    const rejected = new Set<number>();
    BRANCHES.forEach((branch, index) => {
      const ids = applications.filter((a) => a.branchIndex === index).map((a) => a.id);
      const count = Math.ceil(ids.length * branch.rejectionRate);
      for (const id of rng.shuffle(ids).slice(0, count)) rejected.add(id);
    });
    const pendingSince = addDays(end, -PENDING_WINDOW_DAYS);
    for (const app of applications) {
      const status = rejected.has(app.id)
        ? 'REJECTED'
        : app.submittedAt > pendingSince
          ? 'PENDING'
          : 'APPROVED';
      const decidedAt =
        status === 'PENDING'
          ? null
          : isoDate(new Date(Math.min(addDays(app.submittedAt, rng.int(1, 14)).getTime(), +end)));
      insertApplication.run(
        app.id,
        app.applicant,
        app.segment,
        app.branchIndex + 1,
        app.channel,
        status,
        isoDate(app.submittedAt),
        decidedAt,
      );
    }

    // Transactions: never dated before the customer joined.
    for (let id = 1; id <= COUNTS.transactions; id++) {
      const customer = rng.pick(customers);
      const [min, max] = AMOUNT_RANGE[customer.segment];
      const amount = Math.round(rng.logUniform(min, max) * 100) / 100;
      const from = customer.joinedAt > windowStart ? customer.joinedAt : windowStart;
      const date = randomDateBetween(rng, from, end);
      insertTransaction.run(id, customer.id, amount, rng.weighted(TYPE_WEIGHTS), isoDate(date));
    }
  })();
}

/** Deletes any file at `path` and writes a freshly seeded database there. */
export function createSeededDatabase(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true });
  const db = openWritable(path);
  try {
    seedDatabase(db);
  } finally {
    db.close();
  }
}

function main(): void {
  const path = resolveDatabasePath(process.env.DATABASE_PATH);
  createSeededDatabase(path);
  console.log(
    `Seeded ${path}: ${BRANCHES.length} branches, ${COUNTS.customers} customers, ` +
      `${COUNTS.applications} applications, ${COUNTS.transactions} transactions.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
