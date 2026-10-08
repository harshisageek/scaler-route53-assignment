#!/usr/bin/env sh
# Production entrypoint.
#
# 1. Restore the SQLite file from object storage, if a backup exists.
# 2. Apply database migrations.
# 3. Serve the API, with Litestream streaming every write back to storage.
#
# Without replication configured the app still runs; it just starts from an
# empty database on each restart, which is fine for a local container.
set -eu

DB_PATH="${DB_PATH:-/data/route53.db}"

if [ -n "${LITESTREAM_S3_BUCKET:-}" ]; then
    echo "litestream: restoring ${DB_PATH} if a backup exists"
    litestream restore -if-replica-exists -if-db-not-exists -config /srv/app/litestream.yml "${DB_PATH}"
fi

echo "alembic: applying migrations"
alembic upgrade head

if [ -n "${LITESTREAM_S3_BUCKET:-}" ]; then
    echo "litestream: replicating ${DB_PATH}"
    exec litestream replicate -config /srv/app/litestream.yml -exec \
        "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
fi

echo "starting without replication (no LITESTREAM_S3_BUCKET set)"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
