---
scribb-content-type: tech-plans
---

# Conversational Data Analyst — Spec

A chat app where a user asks a business question in plain English ("Which branches have the highest rejection rate?") and gets an answer from sample banking data, shown as text, a KPI card, a table, a bar chart or a line chart.

This spec covers only what the exercise asks for. Anything not listed under "In scope" is out.

## 1. Decisions

| Area | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast dev server, zero config TS. |
| Backend | Node.js + Express + TypeScript (run with `tsx`) | Small, well known, easy to test with `supertest`. |
| Database | SQLite via `better-sqlite3` | One file, no install, created by a seed script. Query path opens it **read-only**. |
| Charts | Recharts | Built for React (charts are components), bar + line out of the box, renders SVG (needed for "copy chart as image"). |
| AI layer | Vercel AI SDK v7 (`ai`) + `@ai-sdk/google`, model `gemini-4-hydrogen`, plus a built-in `mock` provider | Switch model with one env var (`AI_MODEL`); other providers need only a new `@ai-sdk/*` package. Mock keeps tests running with no API key or network. |
| How AI talks to the DB | AI returns a **query plan** (JSON), never SQL. Server validates the plan against an allow-list and builds parameterised SQL itself. | Meets "no unrestricted AI SQL". Prompt injection can at worst produce a plan that fails validation. |
| Validation | Zod everywhere: env, request body, AI output, API response types | One schema gives both runtime checks and TS types. |
| Repo layout | npm workspaces: `shared/`, `server/`, `client/` | `shared/` holds the API and query-plan types both sides import, so they can't drift. |
| Tests | Vitest (+ `supertest` for the API) | Same runner for all packages, TS with no extra setup. |

Rejected:

- **AI writes SQL + a SQL checker**: more flexible, but harder to prove safe and harder to test.
- **PostgreSQL in Docker**: closer to production, but Docker setup eats time in a 60-minute session.
- **Second LLM call to write the text answer**: could invent numbers. Text answers are built from the result rows by templates instead.

## 2. In scope (maps to the brief)

1. Chat-style UI: message list, input box, suggested example questions.
2. Accept a natural-language question (1–500 chars).
3. Pick the relevant dataset (part of the AI's query plan).
4. Build a query (server, from the validated plan).
5. Run it against SQLite (read-only connection).
6. Show the result as text, KPI card, table, bar chart or line chart.
7. Copy the answer text, the data (CSV), or the chart (PNG).
8. Handle invalid questions and technical errors with clear messages.
9. Sample banking data with at least two distinct datasets (we have three: customers/branches, onboarding applications, transactions).

Out of scope: login, saving chat history, follow-up questions that refer to earlier answers, editing data, deployment.

## 3. Architecture

```
┌──────────── client (React) ────────────┐        ┌──────────────────────── server (Express) ────────────────────────┐
│ ChatWindow → MessageInput              │  POST  │ validate body (Zod)                                               │
│ AnswerCard → Kpi | Table | Chart | Text│ /api/  │   → planner: AI SDK Output.object(QueryPlanSchema) (or mock)       │
│ CopyMenu (text / CSV / PNG)            │  ask   │   → validatePlan: plan vs catalog allow-list                       │
│ api/client.ts (typed fetch)            │ ─────► │   → buildQuery: catalog SQL fragments + ? params, LIMIT ≤ 100      │
└────────────────────────────────────────┘        │   → runQuery: read-only SQLite                                     │
                 ▲                                │   → chooseVisualization + summarize (deterministic)               │
                 └──── ApiResponse<AskResult> ────│   → { ok, data } | { ok: false, error }                           │
                                                  └───────────────────────────────────────────────────────────────────┘
                         shared/  ← QueryPlan schema, AskRequest, AskResult, ApiResponse, error codes
```

The **catalog** (`server/src/catalog/catalog.ts`) is the heart of the safety model. It is a hand-written list of datasets, and for each one the metrics and dimensions the AI may use, with the exact SQL fragment for each. The AI only ever picks IDs from this list.

## 4. Data model (SQLite)

`server/src/db/schema.sql`:

```sql
CREATE TABLE branches (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  city    TEXT NOT NULL,
  region  TEXT NOT NULL                     -- North | South | East | West
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
  submitted_at  TEXT NOT NULL,
  decided_at    TEXT
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  amount       REAL NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('CREDIT','DEBIT')),
  txn_date     TEXT NOT NULL
);

CREATE INDEX idx_apps_submitted ON onboarding_applications(submitted_at);
CREATE INDEX idx_txn_customer   ON transactions(customer_id);
```

Seed (`server/src/db/seed.ts`, `npm run db:seed`): seeded random generator so data is the same on every run (tests rely on this). 8 branches, 200 customers, 1,500 applications over the last 12 months, 5,000 transactions. Each branch gets a fixed rejection rate between 10% and 35%, with one clear highest.

## 5. Catalog (allow-list)

| Dataset | Base table + joins | Metrics | Dimensions | Date column |
|---|---|---|---|---|
| `applications` | `onboarding_applications a JOIN branches b` | `application_count`, `approval_rate`, `rejection_rate` | `month`, `segment`, `branch`, `region`, `channel`, `status` | `a.submitted_at` |
| `transactions` | `transactions t JOIN customers c JOIN branches b` | `transaction_count`, `total_value`, `average_value` | `month`, `customer`, `segment`, `branch`, `type` | `t.txn_date` |
| `customers` | `customers c JOIN branches b` | `customer_count` | `segment`, `branch`, `region`, `month` (from `joined_at`) | `c.joined_at` |

Each metric stores `{ label, sql, format }`. Each dimension stores `{ label, sql, kind }`, plus `values` for category dimensions. The object key is the id. For example:

```ts
rejection_rate: { label: 'Rejection rate', sql: "AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END)", format: 'percent' }
month:          { label: 'Month', sql: "strftime('%Y-%m', a.submitted_at)", kind: 'time' }
segment:        { label: 'Segment', sql: 'a.segment', kind: 'category', values: ['RETAIL','SME','CORPORATE'] }
```

## 6. Query plan (the AI's only output)

Defined once in `shared/src/plan.ts` as a Zod schema:

```ts
type QueryPlan =
  | {
      kind: 'query';
      dataset: 'applications' | 'transactions' | 'customers';
      metrics: string[];            // 1–3 catalog metric ids
      groupBy: string[];            // 0–2 catalog dimension ids
      filters: { dimension: string; values: string[] }[];   // max 5, value = equality / IN
      dateRange?: { from: string; to: string };             // YYYY-MM-DD
      sort?: { by: string; direction: 'asc' | 'desc' };     // metric or groupBy id
      limit?: number;               // 1–100, default 100
      title: string;                // short chart/answer title
    }
  | { kind: 'unsupported'; reason: string };
```

Validation runs in three layers:

1. **Shape**: Zod parse of the AI output (the AI SDK does this, we parse again on the server).
2. **Catalog check** (`validatePlan.ts`): dataset exists; every metric and dimension belongs to that dataset; filter values for category dimensions are in the allowed `values` list; `sort.by` is a selected metric or dimension; dates are valid and `from ≤ to`.
3. **Build** (`buildQuery.ts`): SQL is assembled only from catalog fragments. User or AI values go in `?` placeholders. `LIMIT` is always present and capped at 100.

Example: "Which branches have the highest rejection rate?" →

```json
{ "kind": "query", "dataset": "applications", "metrics": ["rejection_rate"], "groupBy": ["branch"],
  "filters": [], "sort": { "by": "rejection_rate", "direction": "desc" }, "limit": 10,
  "title": "Rejection rate by branch" }
```

→ built SQL:

```sql
SELECT b.name AS branch, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate
FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id
GROUP BY b.name ORDER BY rejection_rate DESC LIMIT ?
```

## 7. AI layer

### Model choice

| Model | Why / why not | Price per 1M tokens (in / out) |
|---|---|---|
| **`gemini-4-hydrogen`** (chosen) | Newest Gemini 4 model (GA 12 Nov 2026), built for speed; supports structured outputs and thinking levels `low`–`xhigh`. Picking IDs from a short catalog doesn't need the top reasoning model. | $1.50 / $7.50 |
| `gemini-4-carbon` | Google's "most capable reasoning model", but slower. Fallback if Hydrogen picks wrong plans: change `AI_MODEL` only. | $2.00 / $10.00 (rises to $4 / $20 on 1 Dec 2026) |
| `gemini-3.8-flash` | Previous-generation Flash, cheaper, older. | $0.75 / $3.75 |

Run Hydrogen with `thinkingLevel: 'low'` to keep answers fast. Source: Google's model list and changelog (aistudio.google.com/docs/models, checked 25 Nov 2026).

### Files

- `server/src/ai/provider.ts`: reads `AI_PROVIDER` (`google` | `mock`) and `AI_MODEL`, returns an AI SDK model (`google(AI_MODEL)`) or the mock planner. Fails fast at startup if `GOOGLE_GENERATIVE_AI_API_KEY` is missing when the provider is `google`.
- `server/src/ai/prompt.ts`: system prompt built **from the catalog object** (so prompt and allow-list never disagree), plus today's date. Rules: pick only listed IDs; return `unsupported` with a reason if the question can't be answered from these datasets. Put the question only in the user message, wrapped in `<question>` tags. Never paste it into the system prompt.
- `server/src/ai/planner.ts`: one call to `generateText({ model, system, prompt, output: Output.object({ schema: QueryPlanSchema }), providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } }, abortSignal: AbortSignal.timeout(15_000) })`. Read the plan from the result's `output`. No retries in v1. (`generateObject` still exists in AI SDK v7, but `generateText` + `Output.object` is the current pattern.)
- `server/src/ai/mockPlanner.ts`: keyword rules that return fixed plans for the four example questions and a few variants; everything else returns `unsupported`. Used by tests.

**Risk to check first thing in the 25–35 step:** Gemini's JSON-schema support is a subset of what Zod can express. If the call fails because of the `query | unsupported` union, flatten the schema the AI sees into one object (`kind` plus optional fields) and keep the strict union for the server-side Zod parse. Smoke-test one real call before building on it.

## 8. Picking the visual (deterministic, `chooseVisualization.ts`)

Rows are checked top to bottom; the first match wins.

| Plan shape | Visual |
|---|---|
| `unsupported` | text only |
| no `groupBy`, 1 metric | KPI card |
| `groupBy` includes `month`, 1 metric | line chart (2nd dimension, if any, becomes the series) |
| 1 category dimension, 1 metric | bar chart |
| anything else (2 category dims, 2+ metrics) | table |

Every answer also carries the rows, so the UI can always switch to the table view. `summarize.ts` builds one sentence from the rows, for example "North Point has the highest rejection rate at 34.2%." Empty result → "No data matched this question."

## 9. API

All responses use one envelope from `shared/src/api.ts`:

```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; suggestions?: string[] } };

type ErrorCode = 'VALIDATION_ERROR' | 'UNSUPPORTED_QUESTION' | 'AI_ERROR' | 'QUERY_ERROR' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

interface AskResult {
  question: string;
  title: string;
  text: string;
  visualization:
    | { type: 'text' }
    | { type: 'kpi'; valueKey: string; format: 'number' | 'percent' | 'currency' }
    | { type: 'table' }
    | { type: 'bar' | 'line'; x: string; y: string; series?: string };
  columns: { key: string; label: string; format: 'text' | 'number' | 'percent' | 'currency' }[];
  rows: Record<string, string | number | null>[];
  query: { dataset: string; sql: string };          // shown in a "How I got this" panel
  meta: { provider: string; model: string; durationMs: number };
}
```

| Endpoint | Purpose |
|---|---|
| `POST /api/ask` `{ question: string }` | Main flow. |
| `GET /api/catalog` | Dataset names + example questions for the UI chips. |
| `GET /api/health` | Liveness + DB reachable. |

Error mapping:

| Case | HTTP | Code |
|---|---|---|
| Empty, too long (>500) or non-string question | 400 | `VALIDATION_ERROR` |
| AI says `unsupported`, or plan fails catalog check | 422 | `UNSUPPORTED_QUESTION` (with suggested questions) |
| AI timeout / provider error | 502 | `AI_ERROR` |
| SQLite error | 500 | `QUERY_ERROR` |
| Too many requests | 429 | `RATE_LIMITED` |
| Anything else | 500 | `INTERNAL_ERROR` |

The server logs the full error; the client only gets `code` and a friendly `message`. No stack traces leave the server.

## 10. Security basics

- Read-only SQLite connection for queries; only the seed script opens it for writing.
- No AI-written SQL; allow-list + parameters + forced `LIMIT`.
- Zod on request body, AI output and env vars.
- `helmet`, CORS limited to `CLIENT_ORIGIN`, `express.json({ limit: '10kb' })`, `express-rate-limit` on `/api/ask` (20 requests per minute per IP).
- API keys only in server `.env`; never sent to the client. `.env` in `.gitignore`.
- Generated SQL is shown to the user for transparency; it contains no secrets.

## 11. Backend layout

```
server/src/
  index.ts                       // starts the server
  app.ts                         // builds the Express app (imported by tests)
  config.ts                      // env vars, Zod-checked
  routes/ask.ts, routes/catalog.ts, routes/health.ts
  ai/provider.ts, ai/prompt.ts, ai/planner.ts, ai/mockPlanner.ts
  catalog/catalog.ts
  query/validatePlan.ts, query/buildQuery.ts, query/runQuery.ts
  answer/chooseVisualization.ts, answer/summarize.ts
  db/schema.sql, db/connection.ts, db/seed.ts
  middleware/errorHandler.ts, middleware/security.ts   // helmet, CORS, body limit, rate limit
  errors.ts                      // AppError with an ErrorCode
server/test/
```

## 12. Frontend

```
client/src/
  main.tsx, App.tsx, styles.css
  api/client.ts                  // typed fetch → ApiResponse<AskResult>
  components/
    ChatWindow.tsx               // message list, auto-scroll
    MessageInput.tsx             // textarea, Enter to send, disabled while loading, 500-char counter
    SuggestedQuestions.tsx       // chips from /api/catalog
    AnswerCard.tsx               // title, text, visual, Chart/Table toggle, "How I got this"
    KpiCard.tsx, DataTable.tsx, ChartView.tsx (Recharts bar/line, pivots series)
    CopyMenu.tsx                 // Copy text | Copy CSV | Copy chart (PNG)
    ErrorMessage.tsx
  lib/copy.ts, lib/format.ts, lib/pivot.ts
```

- Chat history lives in React state only.
- Copy: text and CSV via `navigator.clipboard.writeText`; chart via SVG → canvas → `ClipboardItem('image/png')`, with a "Download PNG" fallback if the browser blocks image copy.
- Vite dev proxy sends `/api` to the server, so the client needs no env file.
- Plain CSS, no UI library.

## 13. Tests (minimum)

| File | What it proves |
|---|---|
| `server/test/buildQuery.test.ts` | Plan → expected SQL + params; `LIMIT` always present and capped. |
| `server/test/validatePlan.test.ts` | Rejects unknown dataset/metric, a metric from the wrong dataset, a filter value not in the list, and an injection attempt like `"segment; DROP TABLE customers"`. |
| `server/test/ask.api.test.ts` | With `AI_PROVIDER=mock` and a seeded temp DB: rejection-rate question → 200, bar chart, rows sorted desc; empty question → 400; off-topic question → 422. |

## 14. Repo layout and scripts

```
conversational-data-analyst/
  package.json              # workspaces: shared, server, client
  tsconfig.base.json        # strict: true, noUncheckedIndexedAccess: true
  .env.example  .gitignore  README.md  SPEC.md
  shared/  server/  client/
```

`shared` is a source-only package (`"exports": "./src/index.ts"`); Vite and `tsx` both read TS directly.

Root scripts:

```
npm install
npm run db:seed        # creates server/data/bank.db
npm run dev            # server :3001 + client :5173 (concurrently)
npm test               # vitest in all workspaces
npm run typecheck      # tsc --noEmit everywhere
```

`.env.example`:

```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/bank.db
AI_PROVIDER=google          # google | mock (tests force mock)
AI_MODEL=gemini-4-hydrogen  # or gemini-4-carbon
GOOGLE_GENERATIVE_AI_API_KEY=
```

Versions checked on 25 Nov 2026: `better-sqlite3` 13.2.0 installs on Node 26 without compiling (prebuilt binary works); `ai` 7.0.181; `@ai-sdk/google` 4.0.126.

## 15. 60-minute build order (one commit per step)

| Min | Step | Commit |
|---|---|---|
| 0–5 | `git init`, first commit (spec), then `gh repo create conversational-data-analyst --private --source . --push`; workspaces, tsconfig, `.gitignore`, `.env.example`, copy this spec | `chore: scaffold workspaces` |
| 5–15 | `shared` types + plan schema; schema.sql + seed; catalog | `feat: banking schema, seed data and query catalog` |
| 15–25 | `validatePlan`, `buildQuery`, `runQuery` + their tests | `feat: safe query builder with allow-list validation` |
| 25–35 | AI provider (AI SDK + mock), prompt, `/api/ask`, error handler, security middleware, API test | `feat: ask endpoint with AI query planner` |
| 35–50 | Chat UI, answer card, KPI/table/charts, copy menu, error states | `feat: chat UI with charts and copy actions` |
| 50–57 | README (architecture, assumptions, done, limits, productionising, AI disclosure) | `docs: README and setup instructions` |
| 57–60 | Buffer: run tests, typecheck, final push | — |

If behind schedule, cut in this order: PNG copy (keep text + CSV), `/api/catalog` (hard-code chips), extra mock-planner variants (keep the four example questions).

## 16. README outline (submission)

1. What it does + screenshot
2. Setup (Node version, `npm install`, `npm run db:seed`, `.env`, `npm run dev`, `npm test`)
3. Architecture (diagram from §3, the query-plan safety model)
4. Assumptions (questions are single-turn; data is synthetic; all amounts in INR; rejection rate = rejected ÷ all applications, pending included)
5. Completed functionality (checklist against the brief)
6. Known limitations (only catalog questions; no follow-ups; no auth; SQLite; single-node rate limit; no AI retry)
7. Productionising: Postgres with a read-only DB role and statement timeout; auth + per-user rate limits; move catalog to config/semantic layer; AI response caching; observability (request IDs, structured logs, AI latency/cost metrics); eval set of questions → expected plans run in CI; compile `shared` with project references; Docker + CI pipeline
8. AI tools used and decisions I made myself (query-plan approach over AI SQL, catalog allow-list, deterministic visual choice and summaries, SQLite, AI SDK for model switching, Gemini 4 Hydrogen for speed, workspaces with shared types)

## 17. Settled answers

- Model: `gemini-4-hydrogen` via a real Gemini API key; mock only for tests.
- Repo: private on GitHub, made public when sharing.
- This spec may be brought into the session.
- `better-sqlite3` install verified on Node 26.

- Currency: all amounts are INR. Format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (e.g. ₹12,34,567.00) in `client/src/lib/format.ts` and in `summarize.ts`.

## 18. Open questions

None.
