#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL connection string}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_name="$(node -e 'process.stdout.write(decodeURIComponent(new URL(process.argv[1]).pathname.replace(/^\//, "")))' "$DATABASE_URL")"
file="$BACKUP_DIR/${database_name}-${timestamp}.dump"

echo "Creating PostgreSQL backup: $file"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --compress=9 \
  --file="$file"

sha256sum "$file" > "$file.sha256"
ls -lh "$file" "$file.sha256"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) \
    -mtime +"$RETENTION_DAYS" -print -delete
fi

echo "Backup complete. Copy it to encrypted off-host storage."
