#!/bin/sh
set -e

echo "[Startup] Menjalankan migrasi database..."
node dist/seeders/migrate.js

echo "[Startup] Migrasi selesai, menjalankan server..."
exec node dist/server.js
