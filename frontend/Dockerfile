# Frontend image for local development with Docker Compose.
#
# Production runs on Vercel, which builds from source, so this image only needs
# a development target: `next dev` with the source bind-mounted in.
FROM node:24-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.10.1

WORKDIR /app

# Dependencies first: this layer is cached until the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM base AS development

COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
