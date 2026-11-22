#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the target PostgreSQL connection string}"
backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Usage: CONFIRM_RESTORE=yes DATABASE_URL=... $0 /path/to/backup.dump" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes." >&2
  echo "Stop the API and worker first. This replaces objects in the target database." >&2
  exit 1
fi

if [[ -f "$backup_file.sha256" ]]; then
  echo "Verifying backup checksum..."
  (cd "$(dirname "$backup_file")" && sha256sum --check "$(basename "$backup_file").sha256")
fi

echo "Restoring $backup_file into $DATABASE_URL"
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "$backup_file"

echo "Restore complete. Run database migrations, start the API/worker, and verify /health/ready."
