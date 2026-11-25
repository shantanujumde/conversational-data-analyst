-- Sample banking data. All of it is synthetic; created by `npm run db:seed`.

CREATE TABLE branches (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  city    TEXT NOT NULL,
  region  TEXT NOT NULL CHECK (region IN ('North','South','East','West'))
);

CREATE TABLE customers (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  segment    TEXT NOT NULL CHECK (segment IN ('RETAIL','SME','CORPORATE')),
  branch_id  INTEGER NOT NULL REFERENCES branches(id),
  joined_at  TEXT NOT NULL                  -- ISO date
);

CREATE TABLE onboarding_applications (
  id            INTEGER PRIMARY KEY,
  applicant     TEXT NOT NULL,
  segment       TEXT NOT NULL CHECK (segment IN ('RETAIL','SME','CORPORATE')),
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  channel       TEXT NOT NULL CHECK (channel IN ('BRANCH','ONLINE','MOBILE')),
  status        TEXT NOT NULL CHECK (status IN ('APPROVED','REJECTED','PENDING')),
  submitted_at  TEXT NOT NULL,              -- ISO date
  decided_at    TEXT                        -- ISO date; NULL while PENDING
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  amount       REAL NOT NULL CHECK (amount > 0),   -- INR
  type         TEXT NOT NULL CHECK (type IN ('CREDIT','DEBIT')),
  txn_date     TEXT NOT NULL                       -- ISO date
);

CREATE INDEX idx_apps_submitted ON onboarding_applications(submitted_at);
CREATE INDEX idx_txn_customer   ON transactions(customer_id);
