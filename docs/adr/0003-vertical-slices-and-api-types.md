# ADR 0003: Vertical slices and generated API types

- Status: Accepted
- Date: 2026-10-08

## Context

The project spans a strict TypeScript frontend, a typed Python API, a database,
and several test layers. Building each layer separately would delay integration
feedback and make request and response types easy to duplicate incorrectly.

## Decision

Features are delivered as vertical slices: schema, repository, service, route,
frontend workflow, and tests land together. FastAPI's OpenAPI document is the
source of truth for network types. `make api-types` regenerates
`frontend/src/lib/api/schema.d.ts` with `openapi-typescript`.

TanStack Query owns server state; feature components consume small typed hooks
instead of issuing ad hoc requests.

## Consequences

- Every merged feature is usable through the browser and API.
- Backend schema changes produce a visible generated-type diff.
- CI catches Python typing, TypeScript typing, formatting, unit, API, component,
  accessibility, build, and end-to-end failures independently.
- Generated declarations must be refreshed whenever OpenAPI-visible schemas
  change.
