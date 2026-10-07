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
