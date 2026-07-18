#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-api}"

wait_for_postgres() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is not set"
    exit 1
  fi

  echo "Waiting for Postgres..."

  for attempt in $(seq 1 60); do
    if node <<'NODE'
const url = new URL(process.env.DATABASE_URL);
const host = url.hostname;
const port = Number(url.port || 5432);
const net = require('net');
const socket = net.connect({ host, port }, () => {
  socket.end();
  process.exit(0);
});
socket.on('error', () => process.exit(1));
socket.setTimeout(2000, () => {
  socket.destroy();
  process.exit(1);
});
NODE
    then
      echo "Postgres is ready"
      return 0
    fi
    sleep 2
  done

  echo "Postgres did not become ready in time"
  exit 1
}

ensure_pgvector_extension() {
  echo "Ensuring pgvector extension is available..."
  node <<'NODE' || true
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.end();
  console.log('pgvector extension ready');
})().catch(async (error) => {
  console.warn('Could not ensure pgvector extension yet:', error.message);
  try { await client.end(); } catch {}
  process.exit(0);
});
NODE
}

bootstrap_database() {
  if [[ "${TYPEORM_SYNC:-false}" == "true" ]]; then
    echo "Using TYPEORM_SYNC=true; skipping explicit migrations"
    return 0
  fi

  echo "Running database migrations..."
  pnpm --filter @video-rag/api migration:run || true
}

wait_for_postgres
ensure_pgvector_extension
bootstrap_database

case "$ROLE" in
  api|worker)
    # Ingestion consumer runs inside the API Nest process (IngestionModule).
    # "worker" is accepted for backwards-compatible compose commands.
    exec pnpm --filter @video-rag/api start
    ;;
  *)
    exec "$@"
    ;;
esac
