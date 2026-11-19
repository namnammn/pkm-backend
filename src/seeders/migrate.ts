import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';

async function runMigrate() {
  console.log('[Migrate] Menjalankan migrasi DDL schema ke database...');
  try {
    const schemaSqlPath = path.resolve(process.cwd(), 'schema.sql');
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');

    await pool.query(sql);
    console.log('[Migrate] Migrasi schema database berhasil diselesaikan!');
  } catch (err) {
    console.error('[Migrate] Gagal menjalankan migrasi schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrate();
