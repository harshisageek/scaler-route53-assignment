# Route 53 Console Clone

A working clone of the AWS Route 53 console for managing hosted zones and DNS
records, built for the Scaler SDE Fullstack assignment.

> **Status:** early scaffolding. Features, the live demo link and the full
> documentation land in later pull requests.

## Tech stack

| Layer    | Choice                                                                 |
| -------- | ---------------------------------------------------------------------- |
| Frontend | Next.js (App Router), React, strict TypeScript, Cloudscape Design System, TanStack Query |
| Backend  | FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic                          |
| Database | SQLite                                                                 |
| Tests    | pytest, Vitest with Testing Library, Playwright                        |
| Tooling  | uv, pnpm, ruff, mypy, ESLint, Prettier, Docker Compose                 |

## Quick start with Docker

Requires Docker with Compose v2.

```sh
docker compose up --build
```

Then open <http://localhost:3000>. The API is at <http://localhost:8000>, with
interactive docs at <http://localhost:8000/docs>.

## Running without Docker

Requires Python 3.12 with [uv](https://docs.astral.sh/uv/), and Node.js 24 with
[pnpm](https://pnpm.io/).

```sh
make install

# Terminal 1: API on http://localhost:8000
cd backend && cp .env.example .env && uv run alembic upgrade head && uv run uvicorn app.main:app --reload

# Terminal 2: UI on http://localhost:3000
cd frontend && cp .env.example .env.local && pnpm dev
```

## Checks

| Command             | What it runs                                    |
| ------------------- | ----------------------------------------------- |
| `make format`       | ruff format and Prettier, rewriting files       |
| `make format-check` | the same, failing on any unformatted file       |
| `make lint`         | ruff and ESLint                                 |
| `make typecheck`    | mypy (strict) and `tsc --noEmit`                |
| `make test`         | pytest and Vitest                               |
| `make e2e`          | Playwright, against a production build          |
| `make check`        | format check, lint, typecheck and tests         |
| `make api-types`    | regenerate the frontend's API types from the backend's OpenAPI schema |

## Deployment

| Part     | Host                       | Config                                    |
| -------- | -------------------------- | ----------------------------------------- |
| Frontend | Vercel                     | root directory `frontend`                 |
| Backend  | Render (free, Docker)      | [`render.yaml`](render.yaml) Blueprint    |
| Database | SQLite, backed up by Litestream to Supabase Storage | [`backend/litestream.yml`](backend/litestream.yml) |

The browser only talks to Vercel. Next.js forwards `/api/*` to Render, so the
session cookie stays first-party and production needs no CORS.

Render's free disk is wiped on every restart. At boot, the container restores
the SQLite file from Supabase Storage, applies migrations, then runs the API
under Litestream, which streams every write back to storage.

**Backend (Render):** create a Blueprint from this repository, then enter the
five `LITESTREAM_*` values from Supabase (Storage, then S3 connection) when
Render asks for them.

**Frontend (Vercel):** import the repository with root directory `frontend`,
and set:

| Variable                       | Value                                         |
| ------------------------------ | --------------------------------------------- |
| `BACKEND_URL`                  | the Render URL, e.g. `https://route53-clone-api.onrender.com` |
| `NEXT_PUBLIC_APP_ENV`          | `production`                                  |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, so Vercel uses the pnpm version pinned in `package.json` |

`BACKEND_URL` is read when Next.js builds, so redeploy after changing it.

**Keep-awake:** Render's free tier sleeps after 15 idle minutes. Set the GitHub
repository variable `HEALTHCHECK_URL` to the API's `/api/v1/health` URL and
[`keep-awake.yml`](.github/workflows/keep-awake.yml) pings it every 10 minutes.

## Project layout

```text
backend/    FastAPI app, Alembic migrations, pytest suites
frontend/   Next.js app, Vitest and Playwright suites
```

## Configuration

Every setting is listed with a comment in
[`backend/.env.example`](backend/.env.example) and
[`frontend/.env.example`](frontend/.env.example). The backend validates them at
startup and refuses to boot if one is invalid. Real `.env` files are never
committed.
