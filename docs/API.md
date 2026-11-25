---
scribb-content-type: developer-docs
---

# API contract

The server and client share one contract. The Zod schemas in `shared/src/` are the source of truth; this page explains them and gives example bodies. Design background is in [SPEC.md](SPEC.md) §9 and §10.

- Base path: `/api/v1`
- Request and response bodies: JSON
- Every response has an `X-Request-Id` header. An incoming `X-Request-Id` is reused; otherwise the server makes a UUID.

| Schema                                  | File                   |
| --------------------------------------- | ---------------------- |
| `ApiResponseSchema(data)`, `ApiSuccess` | `shared/src/api.ts`    |
| `AskRequestSchema`, `AskResultSchema`   | `shared/src/api.ts`    |
| `CatalogResponseSchema`                 | `shared/src/api.ts`    |
| `ErrorBodySchema`, `ERROR_CODES`        | `shared/src/errors.ts` |
| `HealthSchema`                          | `shared/src/health.ts` |
| `QueryPlanSchema` (server only uses it) | `shared/src/plan.ts`   |

## Envelope

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ErrorBody };

interface ErrorBody {
  code: ErrorCode;
  message: string; // safe to show the user
  requestId: string; // equals the X-Request-Id header
  suggestions?: string[]; // UNSUPPORTED_QUESTION only, up to 3
  retryAfterSeconds?: number; // RATE_LIMITED only
}
```

## Endpoints

| Method and path       | Body                   | Success `data`    |
| --------------------- | ---------------------- | ----------------- |
| `POST /api/v1/ask`    | `{ question: string }` | `AskResult`       |
| `GET /api/v1/catalog` | none                   | `CatalogResponse` |
| `GET /api/v1/health`  | none                   | `Health`          |

`question` is trimmed, then must be 1–500 characters.

## Errors

| HTTP | `code`                 | When                                                       | Extra fields                                   |
| ---- | ---------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | Empty, too long or non-string question; malformed JSON     | none                                           |
| 413  | `VALIDATION_ERROR`     | Body over 10 KB                                            | none                                           |
| 422  | `UNSUPPORTED_QUESTION` | AI says the question is out of scope, or plan fails checks | `suggestions`                                  |
| 429  | `RATE_LIMITED`         | More than 20 asks per minute from one IP                   | `retryAfterSeconds`, plus `Retry-After` header |
| 502  | `AI_ERROR`             | AI timeout or provider error after 2 tries, or bad output  | none                                           |
| 500  | `QUERY_ERROR`          | SQLite error                                               | none                                           |
| 404  | `NOT_FOUND`            | Unknown path                                               | none                                           |
| 405  | `METHOD_NOT_ALLOWED`   | Known path, wrong method                                   | `Allow` header                                 |
| 500  | `INTERNAL_ERROR`       | Anything else                                              | none                                           |

Messages are the exact texts in SPEC §10.1. No stack traces, SQL error text or AI provider text ever reach the client.

## How to read an `AskResult`

- **Row keys** are catalog ids: dimension ids (`branch`, `month`, `segment`, `region`, `channel`, `status`, `customer`, `type`) followed by metric ids (`application_count`, `approval_rate`, `rejection_rate`, `transaction_count`, `total_value`, `average_value`, `customer_count`). `columns` lists them in the same order, with a label and format.
- **Formats:** `percent` values are fractions (`0.342` → "34.2%"). `currency` values are raw INR numbers (`1234567.5` → "₹12,34,567.50"). `number` is a plain count or amount. `text` is a string. `month` values are `"YYYY-MM"` strings with format `text`.
- **Segment, status, channel, type values** are upper case as stored (`RETAIL`, `SME`, `CORPORATE`, `REJECTED`, …). The client decides how to display them.
- **Visual** is chosen by the server (SPEC §8):

| `visualization`                            | Rows                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ type: 'kpi', valueKey, format }`        | Exactly 1 row. `valueKey` is the metric id.                                                                                                                                                                                                                                 |
| `{ type: 'bar', x, y }`                    | `x` = dimension id, `y` = metric id. Already sorted by the server.                                                                                                                                                                                                          |
| `{ type: 'line', x: 'month', y, series? }` | Only when the question isn't a ranking. Sorted by month ascending. A ranking of months ("top 3 months") comes back as `bar` with `x: 'month'`, in metric order. With `series`, rows are long format: one row per month and series value. The client pivots them for charts. |
| `{ type: 'table' }`                        | Any shape. Show `columns` in order.                                                                                                                                                                                                                                         |
| `{ type: 'text' }`                         | Empty result or no visual. `rows` may be `[]`.                                                                                                                                                                                                                              |

- **Empty result** is a success: `rows: []`, `visualization: { type: 'text' }`, `text: "No data matched this question."`.
- Every answer carries `rows` and `columns`, so the client can always show a table view.
- `query.sql` is the parameterised SQL with `?` placeholders. It is shown in "How I got this".

## Examples

### Single figure (KPI card)

`POST /api/v1/ask` `{ "question": "How many onboarding applications were rejected?" }` → 200

```json
{
  "ok": true,
  "data": {
    "question": "How many onboarding applications were rejected?",
    "title": "Rejected applications",
    "text": "Applications with status Rejected: 312.",
    "visualization": { "type": "kpi", "valueKey": "application_count", "format": "number" },
    "columns": [{ "key": "application_count", "label": "Applications", "format": "number" }],
    "rows": [{ "application_count": 312 }],
    "query": {
      "dataset": "applications",
      "sql": "SELECT COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id WHERE a.status IN (?) LIMIT ?"
    },
    "meta": { "provider": "google", "model": "gemini-4-hydrogen", "durationMs": 1240 }
  }
}
```

### Bar chart

`{ "question": "Which branches have the highest rejection rate?" }` → 200

```json
{
  "ok": true,
  "data": {
    "question": "Which branches have the highest rejection rate?",
    "title": "Rejection rate by branch",
    "text": "North Point has the highest rejection rate at 34.2%.",
    "visualization": { "type": "bar", "x": "branch", "y": "rejection_rate" },
    "columns": [
      { "key": "branch", "label": "Branch", "format": "text" },
      { "key": "rejection_rate", "label": "Rejection rate", "format": "percent" }
    ],
    "rows": [
      { "branch": "North Point", "rejection_rate": 0.342 },
      { "branch": "Harbour Road", "rejection_rate": 0.268 },
      { "branch": "Mill Square", "rejection_rate": 0.215 },
      { "branch": "Lake View", "rejection_rate": 0.124 }
    ],
    "query": {
      "dataset": "applications",
      "sql": "SELECT b.name AS branch, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY b.name ORDER BY rejection_rate DESC LIMIT ?"
    },
    "meta": { "provider": "google", "model": "gemini-4-hydrogen", "durationMs": 1385 }
  }
}
```

### Line chart with series

`{ "question": "Show monthly onboarding applications by customer segment" }` → 200 (rows trimmed to two months)

```json
{
  "ok": true,
  "data": {
    "question": "Show monthly onboarding applications by customer segment",
    "title": "Monthly applications by segment",
    "text": "Applications peaked in October 2026 for Retail at 92.",
    "visualization": {
      "type": "line",
      "x": "month",
      "y": "application_count",
      "series": "segment"
    },
    "columns": [
      { "key": "month", "label": "Month", "format": "text" },
      { "key": "segment", "label": "Segment", "format": "text" },
      { "key": "application_count", "label": "Applications", "format": "number" }
    ],
    "rows": [
      { "month": "2026-09", "segment": "CORPORATE", "application_count": 18 },
      { "month": "2026-09", "segment": "RETAIL", "application_count": 84 },
      { "month": "2026-09", "segment": "SME", "application_count": 31 },
      { "month": "2026-10", "segment": "CORPORATE", "application_count": 22 },
      { "month": "2026-10", "segment": "RETAIL", "application_count": 92 },
      { "month": "2026-10", "segment": "SME", "application_count": 37 }
    ],
    "query": {
      "dataset": "applications",
      "sql": "SELECT strftime('%Y-%m', a.submitted_at) AS month, a.segment AS segment, COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY month, segment ORDER BY month ASC LIMIT ?"
    },
    "meta": { "provider": "google", "model": "gemini-4-hydrogen", "durationMs": 1502 }
  }
}
```

### Table

`{ "question": "Show approval and rejection rate by region and channel" }` → 200 (rows trimmed)

```json
{
  "ok": true,
  "data": {
    "question": "Show approval and rejection rate by region and channel",
    "title": "Approval and rejection rate by region and channel",
    "text": "Showing 2 rows.",
    "visualization": { "type": "table" },
    "columns": [
      { "key": "region", "label": "Region", "format": "text" },
      { "key": "channel", "label": "Channel", "format": "text" },
      { "key": "approval_rate", "label": "Approval rate", "format": "percent" },
      { "key": "rejection_rate", "label": "Rejection rate", "format": "percent" }
    ],
    "rows": [
      { "region": "North", "channel": "BRANCH", "approval_rate": 0.61, "rejection_rate": 0.27 },
      { "region": "North", "channel": "ONLINE", "approval_rate": 0.66, "rejection_rate": 0.21 }
    ],
    "query": {
      "dataset": "applications",
      "sql": "SELECT b.region AS region, a.channel AS channel, AVG(CASE WHEN a.status = 'APPROVED' THEN 1.0 ELSE 0 END) AS approval_rate, AVG(CASE WHEN a.status = 'REJECTED' THEN 1.0 ELSE 0 END) AS rejection_rate FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id GROUP BY region, channel LIMIT ?"
    },
    "meta": { "provider": "google", "model": "gemini-4-hydrogen", "durationMs": 1610 }
  }
}
```

### Empty result

```json
{
  "ok": true,
  "data": {
    "question": "Show corporate applications from the Lake View branch in January 2020",
    "title": "Corporate applications at Lake View",
    "text": "No data matched this question.",
    "visualization": { "type": "text" },
    "columns": [{ "key": "application_count", "label": "Applications", "format": "number" }],
    "rows": [],
    "query": {
      "dataset": "applications",
      "sql": "SELECT COUNT(*) AS application_count FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id WHERE a.segment IN (?) AND b.name IN (?) AND a.submitted_at BETWEEN ? AND ? LIMIT ?"
    },
    "meta": { "provider": "google", "model": "gemini-4-hydrogen", "durationMs": 1190 }
  }
}
```

### Refusal (422)

`{ "question": "What's the weather in Mumbai?" }`

```json
{
  "ok": false,
  "error": {
    "code": "UNSUPPORTED_QUESTION",
    "message": "I can only answer questions about branches, customers, onboarding applications and transactions.",
    "requestId": "3f0b8f2e-6a1d-4c4e-9a51-0d2b6f7c1a90",
    "suggestions": [
      "Which branches have the highest rejection rate?",
      "Show monthly onboarding applications by customer segment",
      "Show the top five customers by transaction value"
    ]
  }
}
```

### Rate limited (429)

Headers include `Retry-After: 42`.

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many questions at once. Try again in 42 seconds.",
    "requestId": "8c1e2d4a-1b7f-4f0e-a3c2-55e9d0b1f6aa",
    "retryAfterSeconds": 42
  }
}
```

### Catalog

`GET /api/v1/catalog` → 200

```json
{
  "ok": true,
  "data": {
    "datasets": [
      {
        "id": "applications",
        "label": "Onboarding applications",
        "description": "Applications by segment, branch, channel and status"
      },
      {
        "id": "transactions",
        "label": "Transactions",
        "description": "Customer credits and debits in INR"
      },
      {
        "id": "customers",
        "label": "Customers",
        "description": "Customers by segment and home branch"
      }
    ],
    "examples": [
      "Show monthly onboarding applications by customer segment",
      "Which branches have the highest rejection rate?",
      "Compare retail and SME onboarding volumes",
      "Show the top five customers by transaction value"
    ]
  }
}
```

### Health

`GET /api/v1/health` → 200, `Cache-Control: no-store`. `status` is `degraded` when the database check fails.

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "service": "cda-server",
    "version": "0.1.0",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-25T10:00:00.000Z"
  }
}
```
