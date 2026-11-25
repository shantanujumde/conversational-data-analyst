---
scribb-content-type: tech-plans
---

# Conversational Data Analyst — Spec

A chat app where a user asks a business question in plain English ("Which branches have the highest rejection rate?") and gets an answer from sample banking data, shown as text, a KPI card, a table, a bar chart or a line chart.

This spec covers only what the exercise asks for. Anything not listed under "In scope" is out.

## 1. Decisions

| Area                   | Choice                                                                                                                              | Why                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend               | React 19 + Vite + TypeScript                                                                                                        | Fast dev server, zero config TS.                                                                                                                                           |
| Backend                | Node.js + Express + TypeScript (run with `tsx`)                                                                                     | Small, well known, easy to test with `supertest`.                                                                                                                          |
| Database               | SQLite via `better-sqlite3`                                                                                                         | One file, no install, created by a seed script. Query path opens it **read-only**.                                                                                         |
| UI kit                 | shadcn/ui on Tailwind CSS v4, re-themed to the passbook look in §14                                                                 | Accessible parts (menu, tooltip, table, toast) copied into our code as source files, so we can restyle them fully instead of shipping the default zinc look.               |
| Charts                 | Recharts, through shadcn's `Chart` wrapper                                                                                          | Built for React (charts are components), bar + line out of the box, renders SVG (needed for "copy chart as image"). The wrapper reads chart colours from our theme tokens. |
| AI layer               | Vercel AI SDK v7 (`ai`) + `@ai-sdk/google`, model `gemini-4-hydrogen`, plus a built-in `mock` provider                              | Switch model with one env var (`AI_MODEL`); other providers need only a new `@ai-sdk/*` package. Mock keeps tests running with no API key or network.                      |
| How AI talks to the DB | AI returns a **query plan** (JSON), never SQL. Server validates the plan against an allow-list and builds parameterised SQL itself. | Meets "no unrestricted AI SQL". Prompt injection can at worst produce a plan that fails validation.                                                                        |
| Validation             | Zod everywhere: env, request body, AI output, API response types                                                                    | One schema gives both runtime checks and TS types.                                                                                                                         |
| API style              | REST under `/api/v1`, one JSON envelope, standard status codes (404 unknown route, 405 + `Allow` for wrong method)                  | A future breaking change ships as `/api/v2` without breaking old clients.                                                                                                  |
| Repo layout            | npm workspaces: `shared/`, `server/`, `client/`                                                                                     | `shared/` holds the API and query-plan types both sides import, so they can't drift.                                                                                       |
| Lint / format          | ESLint 10 (flat config, `typescript-eslint` type-aware rules, React hooks rules) + Prettier; CI runs both                           | One style, checked on every push. TypeScript is pinned to 6.0 because `typescript-eslint` doesn't support TS 7 yet.                                                        |
| Tests                  | Vitest (+ `supertest` for the API)                                                                                                  | Same runner for all packages, TS with no extra setup.                                                                                                                      |

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
│ AnswerCard → Kpi | Table | Chart | Text│/api/v1/│   → planner: AI SDK Output.object(QueryPlanSchema) (or mock)       │
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

| Dataset        | Base table + joins                                | Metrics                                                | Dimensions                                                  | Date column      |
| -------------- | ------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | ---------------- |
| `applications` | `onboarding_applications a JOIN branches b`       | `application_count`, `approval_rate`, `rejection_rate` | `month`, `segment`, `branch`, `region`, `channel`, `status` | `a.submitted_at` |
| `transactions` | `transactions t JOIN customers c JOIN branches b` | `transaction_count`, `total_value`, `average_value`    | `month`, `customer`, `segment`, `branch`, `type`            | `t.txn_date`     |
| `customers`    | `customers c JOIN branches b`                     | `customer_count`                                       | `segment`, `branch`, `region`, `month` (from `joined_at`)   | `c.joined_at`    |

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
      metrics: string[]; // 1–3 catalog metric ids
      groupBy: string[]; // 0–2 catalog dimension ids
      filters: { dimension: string; values: string[] }[]; // max 5, value = equality / IN
      dateRange?: { from: string; to: string }; // YYYY-MM-DD
      sort?: { by: string; direction: 'asc' | 'desc' }; // metric or groupBy id
      limit?: number; // 1–100, default 100
      title: string; // short chart/answer title
    }
  | { kind: 'unsupported'; reason: string };
```

Validation runs in three layers:

1. **Shape**: Zod parse of the AI output (the AI SDK does this, we parse again on the server).
2. **Catalog check** (`validatePlan.ts`): dataset exists; every metric and dimension belongs to that dataset; filter values for category dimensions are in the allowed `values` list; `sort.by` is a selected metric or dimension; dates are valid and `from ≤ to`.
3. **Build** (`buildQuery.ts`): SQL is assembled only from catalog fragments. User or AI values go in `?` placeholders. `LIMIT` is always present and capped at 100.

Example: "Which branches have the highest rejection rate?" →

```json
{
  "kind": "query",
  "dataset": "applications",
  "metrics": ["rejection_rate"],
  "groupBy": ["branch"],
  "filters": [],
  "sort": { "by": "rejection_rate", "direction": "desc" },
  "limit": 10,
  "title": "Rejection rate by branch"
}
```

→ built SQL:

```sql
SELECT b.name AS branch, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate
FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id
GROUP BY b.name ORDER BY rejection_rate DESC LIMIT ?
```

## 7. AI layer

### Model choice

| Model                            | Why / why not                                                                                                                                                                                  | Price per 1M tokens (in / out)                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **`gemini-4-hydrogen`** (chosen) | Newest Gemini 4 model (GA 12 Nov 2026), built for speed; supports structured outputs and thinking levels `low`–`xhigh`. Picking IDs from a short catalog doesn't need the top reasoning model. | $1.50 / $7.50                                    |
| `gemini-4-carbon`                | Google's "most capable reasoning model", but slower. Fallback if Hydrogen picks wrong plans: change `AI_MODEL` only.                                                                           | $2.00 / $10.00 (rises to $4 / $20 on 1 Dec 2026) |
| `gemini-3.8-flash`               | Previous-generation Flash, cheaper, older.                                                                                                                                                     | $0.75 / $3.75                                    |

Run Hydrogen with `thinkingLevel: 'low'` to keep answers fast. Source: Google's model list and changelog (aistudio.google.com/docs/models, checked 25 Nov 2026).

### Files

- `server/src/ai/provider.ts`: reads `AI_PROVIDER` (`google` | `mock`) and `AI_MODEL`, returns an AI SDK model (`google(AI_MODEL)`) or the mock planner. Fails fast at startup if `GOOGLE_GENERATIVE_AI_API_KEY` is missing when the provider is `google`.
- `server/src/ai/prompt.ts`: system prompt built **from the catalog object** (so prompt and allow-list never disagree), plus today's date. Rules: pick only listed IDs; return `unsupported` with a reason if the question can't be answered from these datasets. Put the question only in the user message, wrapped in `<question>` tags. Never paste it into the system prompt.
- `server/src/ai/planner.ts`: one call to `generateText({ model, system, prompt, output: Output.object({ schema: QueryPlanSchema }), providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } }, abortSignal: AbortSignal.timeout(15_000) })`. Read the plan from the result's `output`. No retries in v1. (`generateObject` still exists in AI SDK v7, but `generateText` + `Output.object` is the current pattern.)
- `server/src/ai/mockPlanner.ts`: keyword rules that return fixed plans for the four example questions and a few variants; everything else returns `unsupported`. Used by tests.

**Risk to check first thing in the 25–35 step:** Gemini's JSON-schema support is a subset of what Zod can express. If the call fails because of the `query | unsupported` union, flatten the schema the AI sees into one object (`kind` plus optional fields) and keep the strict union for the server-side Zod parse. Smoke-test one real call before building on it.

## 8. Picking the visual (deterministic, `chooseVisualization.ts`)

Rows are checked top to bottom; the first match wins.

| Plan shape                                  | Visual                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| `unsupported`                               | text only                                              |
| no `groupBy`, 1 metric                      | KPI card                                               |
| `groupBy` includes `month`, 1 metric        | line chart (2nd dimension, if any, becomes the series) |
| 1 category dimension, 1 metric              | bar chart                                              |
| anything else (2 category dims, 2+ metrics) | table                                                  |

Every answer also carries the rows, so the UI can always switch to the table view. `summarize.ts` builds one sentence from the rows, for example "North Point has the highest rejection rate at 34.2%." Empty result → "No data matched this question."

## 9. API

All responses use one envelope from `shared/src/api.ts`. `ErrorCode` and `ErrorBody` live in `shared/src/errors.ts` and are shown here for reference:

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ErrorBody };

interface ErrorBody {
  code: ErrorCode;
  message: string; // safe to show the user, always written by us
  requestId: string; // same value as the X-Request-Id header; quote it when reporting a problem
  suggestions?: string[]; // only for UNSUPPORTED_QUESTION
  retryAfterSeconds?: number; // only for RATE_LIMITED
}

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_QUESTION'
  | 'AI_ERROR'
  | 'QUERY_ERROR'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

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
  query: { dataset: string; sql: string }; // shown in a "How I got this" panel
  meta: { provider: string; model: string; durationMs: number };
}
```

| Endpoint                                  | Purpose                                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| `POST /api/v1/ask` `{ question: string }` | Main flow.                                                |
| `GET /api/v1/catalog`                     | Dataset names + example questions for the UI chips.       |
| `GET /api/v1/health`                      | Liveness + DB reachable. Sends `Cache-Control: no-store`. |

Error mapping:

| Case                                                                  | HTTP | Code                                              |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| Empty, too long (>500) or non-string question, or malformed JSON body | 400  | `VALIDATION_ERROR`                                |
| Body over 10 KB                                                       | 413  | `VALIDATION_ERROR`                                |
| AI says `unsupported`, or plan fails catalog check                    | 422  | `UNSUPPORTED_QUESTION` (with suggested questions) |
| AI timeout / provider error                                           | 502  | `AI_ERROR`                                        |
| SQLite error                                                          | 500  | `QUERY_ERROR`                                     |
| Too many requests                                                     | 429  | `RATE_LIMITED`                                    |
| Unknown route                                                         | 404  | `NOT_FOUND`                                       |
| Wrong HTTP method on a known route (sends an `Allow` header)          | 405  | `METHOD_NOT_ALLOWED`                              |
| Anything else                                                         | 500  | `INTERNAL_ERROR`                                  |

The server logs the full error; the client only gets `code`, a friendly `message` and the `requestId`, plus `suggestions` or `retryAfterSeconds` when set. No stack traces leave the server. How each layer raises and shows these errors is in §10.

## 10. Error handling

One rule on each side: **the server has exactly one place that writes an error response (`errorHandler.ts`), and the client has exactly one place that turns any failure into a typed result (`api/client.ts`).** Everything else throws (server) or returns a result (client).

### 10.1 Error codes and what the user sees

The server codes live in `shared/src/errors.ts` as `ERROR_CODES = [...] as const`, so both sides share one list. The client adds three codes of its own, which never come from the server.

| Code                   | From   | HTTP      | Message shown (exact text)                                                                                                                                          | Stamp             | Try again?                     |
| ---------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------ |
| `VALIDATION_ERROR`     | server | 400 / 413 | Empty: "Please type a question." Too long: "Questions can be up to 500 characters." Bad JSON: "Request body is not valid JSON." Over 10 KB: "Request is too large." | `COULD NOT PRINT` | No, fix the question           |
| `UNSUPPORTED_QUESTION` | server | 422       | "I can only answer questions about branches, customers, onboarding applications and transactions." + up to 3 suggestions                                            | `NOT IN LEDGER`   | No; suggestions are clickable  |
| `AI_ERROR`             | server | 502       | "The AI service ran into a problem. Please try again."                                                                                                              | `COULD NOT PRINT` | Yes                            |
| `QUERY_ERROR`          | server | 500       | "Something went wrong while reading the data. Please try again."                                                                                                    | `COULD NOT PRINT` | Yes                            |
| `RATE_LIMITED`         | server | 429       | "Too many questions at once. Try again in {n} seconds."                                                                                                             | `COULD NOT PRINT` | Yes, button enabled after {n}s |
| `NOT_FOUND`            | server | 404       | "That address doesn't exist." (only API callers see this, not the UI)                                                                                               | none              | n/a                            |
| `METHOD_NOT_ALLOWED`   | server | 405       | "That address doesn't accept this method." (only API callers see this)                                                                                              | none              | n/a                            |
| `INTERNAL_ERROR`       | server | 500       | "Something went wrong on our side. Please try again."                                                                                                               | `COULD NOT PRINT` | Yes                            |
| `NETWORK_ERROR`        | client | none      | "Couldn't reach the server. Check your connection and try again."                                                                                                   | `COULD NOT PRINT` | Yes                            |
| `TIMEOUT`              | client | none      | "This is taking too long. Please try again."                                                                                                                        | `COULD NOT PRINT` | Yes                            |
| `INVALID_RESPONSE`     | client | none      | "The server sent an answer we couldn't read. Please try again."                                                                                                     | `COULD NOT PRINT` | Yes                            |

Under each stamp, a small Courier Prime line shows `Ref: {requestId}` when there is one.

### 10.2 Backend

**`AppError`** (`server/src/errors.ts`):

```ts
class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string, // overrides the default user message (used for VALIDATION_ERROR)
    readonly extra: { suggestions?: string[]; retryAfterSeconds?: number; status?: number } = {}, // status replaces STATUS[code]; used only for 413
    options?: { cause?: unknown }, // the original error, logged but never sent
  ) {
    super(message ?? DEFAULT_MESSAGE[code], options);
  }
}
const STATUS: Record<ErrorCode, number> = { VALIDATION_ERROR: 400 /* … */ };
const DEFAULT_MESSAGE: Record<ErrorCode, string> = {/* texts from §10.1 */};
function toAppError(err: unknown): AppError;
// - AppError: returned as is
// - body-parser errors: err.type 'entity.parse.failed' → VALIDATION_ERROR (400), 'entity.too.large' → VALIDATION_ERROR with status 413
// - anything else: INTERNAL_ERROR, keeping the original as cause
```

`Record<ErrorCode, …>` means adding a code without a status and message fails `tsc`.

**Who raises what:**

| Layer                    | Failure                                                                         | Raises                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express.json()`         | Bad JSON / body over 10 KB                                                      | Its own error; `toAppError` turns it into `VALIDATION_ERROR` (400 / 413)                                                                                                              |
| `routes/ask.ts`          | Body fails `AskRequestSchema`                                                   | `VALIDATION_ERROR` with the first Zod issue's message. The schema sets them: `z.string().trim().min(1, 'Please type a question.').max(500, 'Questions can be up to 500 characters.')` |
| `ai/planner.ts`          | Timeout (15 s), network or provider error, output that doesn't match the schema | `AI_ERROR`, original error as `cause`                                                                                                                                                 |
| `ai/planner.ts`          | AI returns `{ kind: 'unsupported' }`                                            | `UNSUPPORTED_QUESTION` + 3 suggestions from `catalog/examples.ts`                                                                                                                     |
| `query/validatePlan.ts`  | Plan breaks a catalog rule                                                      | `UNSUPPORTED_QUESTION` + 3 suggestions (the broken rule is logged, not shown)                                                                                                         |
| `query/runQuery.ts`      | SQLite throws                                                                   | `QUERY_ERROR`, original as `cause`                                                                                                                                                    |
| `middleware/security.ts` | Rate limit hit                                                                  | The limiter's `handler` calls `next(new AppError('RATE_LIMITED', undefined, { retryAfterSeconds }))`, so it goes through the error handler; `Retry-After` header set too              |
| each router              | Known path, wrong method                                                        | Every route ends with `.all(methodNotAllowed)` → `METHOD_NOT_ALLOWED` + `Allow` header                                                                                                |
| `middleware/notFound.ts` | No route matched                                                                | `NOT_FOUND`                                                                                                                                                                           |
| anywhere                 | Anything unexpected                                                             | becomes `INTERNAL_ERROR` in the error handler                                                                                                                                         |

An empty result is **not** an error: it returns `ok: true` with the text "No data matched this question."

**Flow:**

1. Express 5 sends errors from `async` route handlers to the error handler on its own, so routes need no `try/catch`.
2. `errorHandler.ts` calls `toAppError(err)`, logs once, then sends `{ ok: false, error: { code, message, requestId, suggestions?, retryAfterSeconds? } }` with `extra.status ?? STATUS[code]`.
3. **Logging:** `pino-http` gives each request an id (reused from an incoming `X-Request-Id` if present, else a new UUID) and sends it back in the `X-Request-Id` header. 4xx errors log at `warn` without a stack; 5xx log at `error` with the stack and `cause`. The question text is logged; API keys and full rows never are.
4. **Never sent to the client:** stack traces, `cause`, SQL error text, AI provider messages, file paths.
5. **Startup:** if `config.ts` validation fails, print which env variable is wrong and exit with code 1, before listening.
6. **Process level** (`index.ts`): on `unhandledRejection` or `uncaughtException`, log at `fatal`, close the server, and exit with code 1.

### 10.3 Frontend

**API client** (`client/src/api/client.ts`) never throws. It always returns:

```ts
type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';
type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ClientErrorCode;
        message: string;
        requestId?: string;
        suggestions?: string[];
        retryAfterSeconds?: number;
      };
    };
```

Steps inside `ask(question)`:

1. `fetch` with `signal: AbortSignal.timeout(20_000)` (a little longer than the server's 15 s AI timeout).
2. Timeout → `TIMEOUT`. Any other `fetch` rejection → `NETWORK_ERROR`.
3. Read the body as text and try `JSON.parse`. Not JSON and status ≥ 500 → `NETWORK_ERROR` (the dev proxy or another server answered, not our API); not JSON otherwise → `INVALID_RESPONSE`.
4. Validate with `ApiResponseSchema(AskResultSchema)` from `shared`. No match → `INVALID_RESPONSE`.
5. Return the parsed result as is (`ok: true` or the server's `ok: false`).

**Showing errors** (`lib/errorView.ts`): one `Record<ClientErrorCode, { stamp: 'NOT IN LEDGER' | 'COULD NOT PRINT'; retry: boolean; fallbackMessage: string }>`. `Entry.tsx` uses it to render the stamp, the message, suggestions and the Try again button. Because it's a `Record`, a new error code that isn't handled fails `tsc`. `client.ts` fills `message` from `errorView[code].fallbackMessage` for the three client codes; the UI always shows `error.message`.

**Where errors are caught in the UI:**

| Failure                                 | Handling                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty or too-long question              | Prevented before sending: the Print answer button is disabled for blank input; the textarea stops at 500 characters.                                                                                           |
| Any `ask()` failure                     | The entry stays in the list with its stamp and message (§14 motion), so the question isn't lost. Try again re-sends the same question into the same entry.                                                     |
| `RATE_LIMITED`                          | Try again shows a countdown and is enabled when it reaches zero.                                                                                                                                               |
| Catalog request fails                   | Fall back silently to the four example questions bundled in the client. No error shown.                                                                                                                        |
| A chart or table throws while rendering | `EntryErrorBoundary` around each entry shows "This answer couldn't be displayed." If the chart failed, it adds a Show table button; if the table failed, the message stands alone. Other entries keep working. |
| Anything else throws while rendering    | `AppErrorBoundary` in `main.tsx` shows a plain page: "Something went wrong. Reload the page." with a Reload button.                                                                                            |
| Clipboard blocked or unsupported        | Toast "Couldn't copy. Your browser blocked clipboard access."; for the chart, download the PNG instead.                                                                                                        |

Errors are logged with `console.error` in development only; production builds don't log to the console.

## 11. Security basics

- Read-only SQLite connection for queries; only the seed script opens it for writing.
- No AI-written SQL; allow-list + parameters + forced `LIMIT`.
- Zod on request body, AI output and env vars.
- `helmet`, CORS limited to `CLIENT_ORIGIN`, `express.json({ limit: '10kb' })`, `express-rate-limit` on `/api/v1/ask` (20 requests per minute per IP).
- API keys only in server `.env`; never sent to the client. `.env` in `.gitignore`.
- Generated SQL is shown to the user for transparency; it contains no secrets.

## 12. Directory structure

Rules that keep the code easy to follow:

- **Dependencies point one way:** `client` → `shared` ← `server`. The client never imports from `server`, and the server never imports from `client`.
- **Routes stay thin.** A route parses input, calls one service function and sends the result. Logic lives in `services/` and the modules it calls.
- **Each folder has one job** (named in the tree). Files are named after what they hold.
- **Only `db/` opens SQLite connections**; `query/runQuery.ts` is the only other file that runs SQL. Only `ai/` talks to the AI SDK.

```
conversational-data-analyst/
├── package.json                  # workspaces (shared, server, client) + root scripts (§16); engines node >=26
├── tsconfig.base.json            # strict, noUncheckedIndexedAccess
├── vitest.config.ts              # test.projects: server, client
├── eslint.config.js  .prettierrc.json  .prettierignore  .editorconfig  .nvmrc
├── .github/workflows/ci.yml      # format:check, lint, typecheck, test, build on push + PR
├── .env.example  .gitignore  README.md  SPEC.md  PRODUCT.md
│
├── shared/                       # types + Zod schemas used by both sides; no runtime deps except zod
│   ├── package.json              # "exports": "./src/index.ts"
│   └── src/
│       ├── index.ts              # re-exports everything below
│       ├── plan.ts               # QueryPlanSchema, QueryPlan
│       ├── api.ts                # AskRequestSchema, AskResultSchema, CatalogResponse, ApiResponse<T>, ApiResponseSchema()
│       └── errors.ts             # ERROR_CODES (as const), ErrorCode, ErrorBody
│
├── server/
│   ├── package.json  tsconfig.json
│   ├── data/                     # bank.db, created by the seed (gitignored)
│   ├── src/
│   │   ├── index.ts              # read config, open DB, start listening, process-level error handlers
│   │   ├── app.ts                # createApp({ db, planner }) → Express app; no listen(), so tests can import it
│   │   ├── config.ts             # Zod-parsed env; on bad config prints which variable is wrong and exits
│   │   ├── logger.ts             # pino logger
│   │   ├── errors.ts             # AppError, status + message per code, toAppError()
│   │   ├── routes/               # HTTP in and out only: parse, call a service, respond
│   │   │   ├── ask.ts            # POST /api/v1/ask
│   │   │   ├── catalog.ts        # GET  /api/v1/catalog
│   │   │   └── health.ts         # GET  /api/v1/health
│   │   ├── services/             # one function per use case, joins the modules below
│   │   │   └── askService.ts     # question → plan → validate → build → run → answer
│   │   ├── middleware/           # runs on every request: security, logging, 404, errors
│   │   │   ├── security.ts       # helmet, CORS, body-size limit, rate limit
│   │   │   ├── requestLogger.ts  # pino-http: request id, method, path, status, duration
│   │   │   ├── notFound.ts       # unknown route → NOT_FOUND; wrong method → METHOD_NOT_ALLOWED
│   │   │   └── errorHandler.ts   # the only place that writes an error response
│   │   ├── ai/                   # question → QueryPlan; the only code that calls the AI
│   │   │   ├── provider.ts       # picks google model or mock from config
│   │   │   ├── prompt.ts         # system prompt built from the catalog
│   │   │   ├── planner.ts        # generateText + Output.object → QueryPlan
│   │   │   └── mockPlanner.ts    # keyword rules, used by tests
│   │   ├── catalog/              # the allow-list: what can be asked and its SQL pieces
│   │   │   ├── catalog.ts        # datasets, metrics, dimensions, SQL fragments
│   │   │   └── examples.ts       # example questions (UI empty state, refusal suggestions)
│   │   ├── query/                # QueryPlan → checked, parameterised SQL → rows
│   │   │   ├── validatePlan.ts   # plan vs catalog
│   │   │   ├── buildQuery.ts     # plan → { sql, params }
│   │   │   └── runQuery.ts       # executes on the read-only connection
│   │   ├── answer/               # rows → visual + sentence
│   │   │   ├── chooseVisualization.ts
│   │   │   └── summarize.ts      # one-sentence answer from rows
│   │   └── db/                   # schema, connections, seed data
│   │       ├── schema.sql
│   │       ├── connection.ts     # openReadOnly(path), openWritable(path)
│   │       ├── random.ts         # seeded random generator
│   │       └── seed.ts           # npm run db:seed
│   └── test/
│       ├── helpers/testDb.ts     # seeds a temp DB per test file
│       ├── buildQuery.test.ts
│       ├── validatePlan.test.ts
│       └── ask.api.test.ts
│
└── client/
    ├── package.json  tsconfig.json  vite.config.ts  components.json  index.html
    └── src/
        ├── main.tsx              # fonts, styles, <AppErrorBoundary>, <Toaster />
        ├── App.tsx               # TopBand + PassbookPage
        ├── styles.css            # Tailwind + passbook tokens (§14)
        ├── api/                  # all HTTP calls
        │   └── client.ts         # ask(), getCatalog(); never throws, always returns ApiResult
        ├── hooks/                # state and side effects for components
        │   └── useChat.ts        # list of entries + the ask flow (useReducer)
        ├── components/           # what's drawn on screen
        │   ├── layout/           # TopBand.tsx, PassbookPage.tsx
        │   ├── entry/            # EntryList.tsx, Entry.tsx, PrintingLine.tsx, Stamp.tsx, HowIGotThis.tsx
        │   ├── answer/           # AnswerView.tsx, KpiFigure.tsx, DataTable.tsx, ChartView.tsx
        │   ├── input/            # TellerSlip.tsx
        │   ├── EmptyState.tsx    # first page with the example questions
        │   ├── CopyMenu.tsx      # copy text | CSV | chart PNG
        │   ├── ErrorBoundary.tsx # AppErrorBoundary + EntryErrorBoundary
        │   └── ui/               # shadcn components (button, textarea, dropdown-menu, tooltip, table, toggle-group, collapsible, sonner, chart)
        ├── lib/                  # plain functions, no React
        │   ├── format.ts         # INR, percent, number, date
        │   ├── pivot.ts          # long rows → chart series
        │   ├── csv.ts            # rows → CSV text
        │   ├── copy.ts           # clipboard text / PNG, download fallback
        │   └── errorView.ts      # error code → stamp, message, retry (§10)
        └── test/
            └── apiClient.test.ts
```

## 13. Frontend behaviour

- Chat history lives in React state only.
- Copy: text and CSV via `navigator.clipboard.writeText`; chart via SVG → canvas → `ClipboardItem('image/png')`, with a "Download PNG" fallback if the browser blocks image copy.
- Vite dev proxy sends `/api` to the server, so the client needs no env file.
- Setup: `npx shadcn@latest init` in `client/`, then add only the components listed under `ui/`. Theme tokens live in `client/src/styles.css`.

## 14. Visual design: the Bank Passbook

The user asked for: paper feel, animation, uncluttered, very simple, no cognitive load; not a ChatGPT clone, not a stock shadcn template.

**Idea.** The conversation is a bank passbook. Each question and its answer print as one dated, ruled entry on a tinted security-paper page. A branch manager has handled passbooks for years, so the layout reads without explanation: date on the left, particulars in the middle, the figure on the right.

**Scene.** An ops manager at an office desktop in daylight, glancing over between tasks. That makes it a light theme only, with large figures and nothing to learn first.

### Palette (Restrained: neutrals plus one accent)

| Token        | Hex                  | Use                                                                             |
| ------------ | -------------------- | ------------------------------------------------------------------------------- |
| `--page`     | `#EEF3EF`            | Page ground: pale green security tint. Not cream.                               |
| `--ink`      | `#23262B`            | All text and rules.                                                             |
| `--ink-soft` | `#5B6660`            | Secondary text (date, labels). 5.3:1 contrast on `--page`.                      |
| `--cover`    | `#1F4D3A`            | Passbook-cover green: top band, primary button, focus ring, first chart series. |
| `--stamp`    | `#B23A2E`            | Only for refusals, errors and the `REJECTED` status. Never decoration.          |
| `--rule`     | `#C9D6CD`            | 1px ruled lines between entries and table rows.                                 |
| chart 2, 3   | `#3E5F7D`, `#9A7330` | Second and third series (slate ink, brass). Never more than three.              |

Map these onto shadcn's CSS variables (`--background`, `--foreground`, `--primary`, `--destructive`, `--border`, `--chart-1..3`) and set `--radius: 0`. Square corners everywhere, like printed stationery.

### Type

- **Public Sans** (self-hosted via `@fontsource/public-sans`) for everything you read: questions, answer sentences, labels, buttons. Figures use `font-variant-numeric: tabular-nums`, so numbers line up and don't jitter while counting up.
- **Courier Prime** (`@fontsource/courier-prime`) only for the printed parts of an entry: entry number, date, the SQL in "How I got this", and the error `Ref:` line. It's the passbook printer's voice. Never use it for body text.
- Scale: answer figure 48px, entry question 17px semibold, answer sentence 17px, labels 13px. Keep the answer sentence under 70 characters per line.

### Layout

- **Top band:** a slim cover-green strip with the product name in white. Nothing else in it: no avatars, settings or nav.
- **The page:** one passbook page, max 960px wide, centred on the tint, with a faint security pattern (a repeating guilloche SVG, the fine looping-line pattern on banknotes and cheques, at 4% opacity) and a soft shadow so it reads as a sheet lying on a desk.
- **Each entry is a ruled row in three columns**, like a passbook:
  - **Left (96px):** entry number `No. 014` and date, in Courier Prime.
  - **Middle:** the question in semibold, then the answer sentence, then the visual (KPI, chart or table).
  - **Right:** the actions (Copy menu, Chart/Table toggle). They stay quiet (ink-soft icons) until the row is hovered or focused.
- **Entries are separated by 1px rules.** No cards, no bubbles, no avatars, no left/right alignment for "me vs AI". The question and the answer belong to the same entry.
- **Input:** a teller's slip pinned to the bottom of the page: a ruled textarea labelled "Ask about branches, customers, applications or transactions", with a cover-green "Print answer" button. Enter sends; Shift+Enter adds a new line. A character count appears from 450 characters; the limit is 500.
- **"How I got this":** a collapsible line under each answer showing the dataset and the SQL in Courier Prime. Closed by default.
- **Under 640px:** the date column folds into a header line above the question; charts go full width; the slip stays pinned.

### Motion: the printing effect

- **Loading:** the new entry appears with its number and date already printed, and a thin print-head bar slides along the empty line with the words "Printing…".
- **Answer arrives:** lines print top to bottom. Each line wipes in left to right with `clip-path` over 200ms, ease-out, starting 50ms after the line above. The KPI counts up to its value over 600ms. Bars grow and lines draw in with Recharts' built-in animation over 700ms.
- **Refusal or error:** a red rubber stamp, `NOT IN LEDGER` (question outside the catalog) or `COULD NOT PRINT` (technical error), presses on once: scales from 1.15 to 1 over 180ms and stays rotated −3°. Below it are a plain-English reason and up to three suggested questions as clickable printed lines. Errors also offer a "Try again" button.
- **Copy:** a small Sonner toast, "Copied to clipboard", bottom right.
- **`prefers-reduced-motion`:** everything appears at once, no wipe, count-up or stamp press.
- Nothing else moves: no hover bounces and no animated backgrounds.

### Empty state (first visit)

The blank first page of the passbook: one sentence, "Ask a question about this bank's branches, customers, onboarding and transactions.", then the four example questions from the brief printed as ruled lines you can click. Clicking one sends it.

### Finishing details

- `::selection` in pale cover-green, `caret-color: var(--cover)`, a thin themed scrollbar, and a 2px cover-green focus ring with 2px offset.
- Amounts are formatted in INR (`₹12,34,567`); percentages to one decimal place.
- Icons come from lucide (shadcn's default), stroke 1.5, one size. No emoji or sparkle "AI" icons.
- `aria-live="polite"` on the entry list so screen readers hear new answers. Every chart has a table view.

### Never

Kicker or eyebrow labels above headings; grids of same-size cards; gradient text; glass or blur; coloured side borders on alerts; chat bubbles or avatars; the default shadcn zinc theme; dark mode; red used for anything other than refusals, errors and `REJECTED`.

### Direction contract (paste as the first child of `<body>` in `client/index.html`)

```html
<!--
THESIS: The chat is a bank passbook; each answer prints as one dated, ruled entry. Refuses the centred AI-chat column with bubbles.
OWN-WORLD: Pale green security-tint page, ink text, passbook-cover green as the only accent, red rubber stamp for refusals; square corners, 1px rules, Public Sans with tabular figures, Courier Prime for printed lines.
STORY: The manager asks in plain words, watches the answer print, reads one figure, copies it on.
FIRST VIEWPORT: Cover-green band; one passbook page; empty state prints four example questions as ruled lines; teller's slip input pinned at the foot with "Print answer".
FORM: Bank Passbook, position 1 on the grounded list, seed b33de222.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->
```

## 15. Tests (minimum)

| File                                | What it proves                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/test/buildQuery.test.ts`    | Plan → expected SQL + params; `LIMIT` always present and capped.                                                                                                                                                                                                                                                                                          |
| `server/test/validatePlan.test.ts`  | Rejects unknown dataset/metric, a metric from the wrong dataset, a filter value not in the list, and an injection attempt like `"segment; DROP TABLE customers"`.                                                                                                                                                                                         |
| `server/test/ask.api.test.ts`       | With `AI_PROVIDER=mock` and a seeded temp DB: rejection-rate question → 200, bar chart, rows sorted desc; empty question → 400; off-topic question → 422 with suggestions; a planner that throws → 502 `AI_ERROR` with no stack or provider text in the body; unknown route → 404. Every error body has a `requestId` matching the `X-Request-Id` header. |
| `client/src/test/apiClient.test.ts` | With `fetch` stubbed: rejected fetch → `NETWORK_ERROR`; HTML body with status 502 → `NETWORK_ERROR`; JSON that fails the schema → `INVALID_RESPONSE`; a server error body is passed through unchanged.                                                                                                                                                    |

## 16. Repo layout and scripts

The full file tree is in §12.

`shared` is a source-only package (`"exports": "./src/index.ts"`); Vite and `tsx` both read TS directly.

Root scripts:

```
npm install
npm run db:seed        # creates server/data/bank.db
npm run dev            # server :3001 + client :5173 (concurrently)
npm run dev:server     # server only
npm run dev:client     # client only
npm test               # vitest in all workspaces
npm run typecheck      # tsc --noEmit everywhere
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check . (CI)
npm run build          # vite build for the client
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

Versions checked on 25 Nov 2026: `better-sqlite3` 13.2.0 installs on Node 26 without compiling (prebuilt binary works); `ai` 7.0.181; `@ai-sdk/google` 4.0.126; `typescript` 6.0.3 (7.0.2 is out, but `typescript-eslint` 8.74.0 supports only `<6.1`); `eslint` 10.15.0; `prettier` 3.10.1.

The server loads the root `.env` with Node's `--env-file-if-exists` flag (through `tsx`); every env var has a default, so `npm run dev` works without a `.env`.

## 17. 60-minute build order (one commit per step)

| Min   | Step                                                                                                                                                                                                                                                                                                                      | Commit                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0–5   | `git init`, first commit (spec), then `gh repo create conversational-data-analyst --private --source . --push`; workspaces, tsconfig, lint/format, CI, `.gitignore`, `.env.example`; `GET /api/v1/health`, `AppError` + error handler, 404/405, security middleware (helmet, CORS, body limit); health page in the client | `chore: scaffold workspaces with health endpoint`     |
| 5–15  | `shared` types + plan schema; schema.sql + seed; catalog                                                                                                                                                                                                                                                                  | `feat: banking schema, seed data and query catalog`   |
| 15–25 | `validatePlan`, `buildQuery`, `runQuery` + their tests                                                                                                                                                                                                                                                                    | `feat: safe query builder with allow-list validation` |
| 25–35 | AI provider (AI SDK + mock), prompt, `/api/v1/ask`, rate limit, request ids + logging (`pino-http`), API test                                                                                                                                                                                                             | `feat: ask endpoint with AI query planner`            |
| 35–50 | `shadcn init` + passbook theme tokens (§14), chat UI, answer entry, KPI/table/charts, copy menu, error states                                                                                                                                                                                                             | `feat: chat UI with charts and copy actions`          |
| 50–57 | README (architecture, assumptions, done, limits, productionising, AI disclosure)                                                                                                                                                                                                                                          | `docs: README and setup instructions`                 |
| 57–60 | Buffer: run tests, typecheck, final push                                                                                                                                                                                                                                                                                  | —                                                     |

If behind schedule, cut in this order: PNG copy (keep text + CSV), `/api/v1/catalog` (hard-code chips), extra mock-planner variants (keep the four example questions).

## 18. README outline (submission)

1. What it does + screenshot
2. Setup (Node version, `npm install`, `npm run db:seed`, `.env`, `npm run dev`, `npm test`)
3. Architecture (diagram from §3, the query-plan safety model)
4. Assumptions (questions are single-turn; data is synthetic; all amounts in INR; rejection rate = rejected ÷ all applications, pending included)
5. Completed functionality (checklist against the brief)
6. Known limitations (only catalog questions; no follow-ups; no auth; SQLite; single-node rate limit; no AI retry)
7. Productionising: Postgres with a read-only DB role and statement timeout; auth + per-user rate limits; move catalog to config/semantic layer; AI response caching; observability (ship the structured logs to a log store, metrics and alerts on AI latency, cost and error rates); eval set of questions → expected plans run in CI; compile `shared` with project references; Docker + CI pipeline
8. AI tools used and decisions I made myself (query-plan approach over AI SQL, catalog allow-list, deterministic visual choice and summaries, SQLite, AI SDK for model switching, Gemini 4 Hydrogen for speed, workspaces with shared types)

## 19. Settled answers

- Model: `gemini-4-hydrogen` via a real Gemini API key; mock only for tests.
- Repo: private on GitHub, made public when sharing.
- This spec may be brought into the session.
- `better-sqlite3` install verified on Node 26.

- Currency: all amounts are INR. Format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (e.g. ₹12,34,567.00) in `client/src/lib/format.ts` and in `summarize.ts`.

## 20. Open questions

None.
