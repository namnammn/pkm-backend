import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';

async function runSeed() {
  console.log('[Seeder] Memulai pengisian data awal database...');
  try {
    const seedSqlPath = path.resolve(process.cwd(), 'seed.sql');
    const sql = fs.readFileSync(seedSqlPath, 'utf8');

    await pool.query(sql);
    console.log('[Seeder] Berhasil mengisi data seeder ke database!');
  } catch (err) {
    console.error('[Seeder] Gagal menjalankan seeder:', err);
  } finally {
    await pool.end();
  }
}

runSeed();
