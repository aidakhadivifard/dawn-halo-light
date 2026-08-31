#!/bin/sh
set -e

DB_PATH="${DATABASE_URL:-/data/dawnhalo.db}"

if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  echo "[litestream] restoring $DB_PATH from replica (if one exists)…"
  litestream restore -if-replica-exists -if-db-not-exists -config /etc/litestream.yml "$DB_PATH" || true
  echo "[litestream] replicating and starting server…"
  exec litestream replicate -config /etc/litestream.yml -exec "node --import tsx src/index.ts"
else
  echo "[litestream] LITESTREAM_REPLICA_URL not set — running without replication."
  exec node --import tsx src/index.ts
fi
