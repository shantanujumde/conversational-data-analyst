# Conversational Data Analyst

Ask a business question in plain English and get an answer from sample banking data. See [SPEC.md](SPEC.md) for the full design.

This commit is the scaffold: a server with one REST endpoint, `GET /api/v1/health`, and a React page that calls it. The chat, AI planner and database come in later steps (SPEC §16).

## Setup

Needs Node 26 (see `.nvmrc`).

```sh
npm install
cp .env.example .env   # optional for now: every variable has a default
npm run dev            # server on http://localhost:3001, client on http://localhost:5173
```

Open http://localhost:5173. It shows "Server OK" when the API answers.

## Scripts

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Server and client together                    |
| `npm run dev:server`   | Server only (`tsx watch`)                     |
| `npm run dev:client`   | Client only (Vite, proxies `/api` to `:3001`) |
| `npm test`             | Vitest for server and client                  |
| `npm run typecheck`    | `tsc --noEmit` in every workspace             |
| `npm run lint`         | ESLint                                        |
| `npm run format`       | Prettier, rewrite files                       |
| `npm run format:check` | Prettier, check only (CI)                     |
| `npm run build`        | Production build of the client                |

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, tests and build on every push to `main` and on pull requests.

## Layout

```
shared/   Zod schemas and types used by both sides (API envelope, health)
server/   Express 5 API, run with tsx
client/   React 19 + Vite
```

## API

| Request              | Response                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/health` | 200 `{ ok: true, data: { status, service, version, uptimeSeconds, timestamp } }` |
| Other method on it   | 405 with `Allow: GET`, code `METHOD_NOT_ALLOWED`                                 |
| Unknown path         | 404, code `NOT_FOUND`                                                            |

Every error uses the same shape: `{ ok: false, error: { code, message } }`.
