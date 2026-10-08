# One entry point for both halves of the project. Run from the repo root.
#
#   make install   install backend and frontend dependencies
#   make dev       run the whole stack in Docker (http://localhost:3000)
#   make check     everything CI runs: format check, lint, typecheck, tests
#
# Each check target runs the backend first, then the frontend.

BACKEND  := cd backend &&
FRONTEND := cd frontend &&

.DEFAULT_GOAL := help
.PHONY: help install dev down api-types format format-check lint typecheck test e2e check

help: ## List the available targets
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  %-14s %s\n", $$1, $$2}'

install: ## Install backend (uv) and frontend (pnpm) dependencies
	$(BACKEND) uv sync
	$(FRONTEND) pnpm install --frozen-lockfile

dev: ## Start backend and frontend with Docker Compose
	docker compose up --build

down: ## Stop the Docker Compose stack
	docker compose down

api-types: ## Regenerate the frontend's API types from the backend's OpenAPI schema
	$(BACKEND) uv run python -m scripts.export_openapi ../frontend/openapi.json
	$(FRONTEND) pnpm generate:api && rm openapi.json

format: ## Rewrite files to match the formatters
	$(BACKEND) uv run ruff format .
	$(BACKEND) uv run ruff check --select I --fix .
	$(FRONTEND) pnpm format

format-check: ## Fail if any file is not formatted (what CI runs)
	$(BACKEND) uv run ruff format --check .
	$(FRONTEND) pnpm format:check

lint: ## Lint both sides
	$(BACKEND) uv run ruff check .
	$(FRONTEND) pnpm lint

typecheck: ## Type-check both sides
	$(BACKEND) uv run mypy .
	$(FRONTEND) pnpm typecheck

test: ## Run backend (pytest) and frontend (Vitest) tests
	$(BACKEND) uv run pytest
	$(FRONTEND) pnpm test

e2e: ## Run Playwright end-to-end tests (needs the backend running)
	$(FRONTEND) pnpm e2e

check: format-check lint typecheck test ## Everything CI runs, in CI's order
