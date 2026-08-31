# Dawnhalo API — free-tier friendly image.
#
# The trick that makes a FREE host (no persistent disk) safe for SQLite:
# Litestream continuously replicates the DB to S3-compatible object storage
# (Backblaze B2's free 10GB tier works, no credit card required) and restores
# it on boot. Kill the instance, redeploy, spin down — the data comes back.
#
# Without the LITESTREAM_* env vars the container just runs the server on the
# local file, exactly like `npm start` (safe for local docker runs).

FROM node:22-slim

# Litestream (static binary).
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz /tmp/litestream.tar.gz
RUN tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream && rm /tmp/litestream.tar.gz

WORKDIR /app

# Native deps (better-sqlite3) need build tools only at install time.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY tsconfig.json ./
COPY litestream.yml /etc/litestream.yml
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV DATABASE_URL=/data/dawnhalo.db
RUN mkdir -p /data

EXPOSE 10000
ENTRYPOINT ["/entrypoint.sh"]
