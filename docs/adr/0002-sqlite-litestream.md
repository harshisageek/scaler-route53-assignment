# ADR 0002: SQLite durability with Litestream

- Status: Accepted
- Date: 2026-10-08

## Context

The assignment requires SQLite. Render's free service has an ephemeral
filesystem, so an unreplicated database would disappear on restart. Replacing
SQLite with hosted PostgreSQL would violate the requirement.

## Decision

The production container keeps SQLite at `/data/route53.db`. Its startup script:

1. restores the latest database from Supabase Storage when one exists;
2. runs Alembic migrations;
3. starts FastAPI under Litestream, which continuously replicates writes to the
   S3-compatible bucket.

Local Docker uses a named volume and does not require Litestream credentials.

## Consequences

- The application keeps SQLite while surviving ordinary service restarts.
- Backups use inexpensive S3-compatible storage.
- Recovery depends on valid Supabase credentials and the latest completed
  replication.
- This design supports one writing application instance; it is not a
  multi-writer distributed database.
