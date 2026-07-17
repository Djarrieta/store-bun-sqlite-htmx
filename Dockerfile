# CRISTA store — Bun + HTMX + SQLite (tech-spec §17)
FROM oven/bun:1.3.14-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock* ./
RUN bun install --production || bun install

# App source
COPY . .

# SQLite + private uploads persist here
VOLUME ["/app/data"]

ENV NODE_ENV=production
EXPOSE 4010

CMD ["bun", "src/index.ts"]
