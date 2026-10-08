# Backend image: FastAPI under uvicorn, with Litestream guarding the SQLite file.
#
# Litestream restores the database from object storage at boot and streams every
# later write back out, which is what lets a real SQLite file survive on a host
# with an ephemeral disk.
FROM python:3.12-slim-bookworm AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /usr/local/bin/uv

WORKDIR /srv/app

# Dependencies first: this layer is cached until the lockfile changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev


FROM base AS development

RUN uv sync --locked --no-install-project
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


FROM base AS production

ARG LITESTREAM_VERSION=0.5.17
# Release assets are named x86_64 and arm64, so map from the build machine's
# own architecture rather than trusting a default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && case "$(uname -m)" in \
        x86_64) arch=x86_64 ;; \
        aarch64|arm64) arch=arm64 ;; \
        *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;; \
       esac \
    && curl -fsSL -o /tmp/litestream.tar.gz \
        "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${arch}.tar.gz" \
    && tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz litestream \
    && rm /tmp/litestream.tar.gz \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Run as a non-root user; /data holds the SQLite file.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /data /srv/app
USER appuser

ENV DATABASE_URL=sqlite:////data/route53.db \
    APP_ENV=production

EXPOSE 8000
CMD ["./scripts/start.sh"]
