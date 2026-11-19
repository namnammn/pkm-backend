import pg from 'pg';
import { config } from './index.js';

const { Pool } = pg;

// Alokasi koneksi dinamis: default 10 (cukup dan hemat memori pada cloud starter/free)
const poolMax = process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10;

// Konfigurasi SSL otomatis: aktif di cloud/production jika bukan localhost atau host docker internal
function getSslConfig() {
  if (process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  if (process.env.DB_SSL === 'false') {
    return false;
  }
  if (config.env === 'production') {
    const isLocalOrDocker =
      config.databaseUrl.includes('localhost') ||
      config.databaseUrl.includes('127.0.0.1') ||
      config.databaseUrl.includes('@db:');
    if (!isLocalOrDocker) {
      return { rejectUnauthorized: false };
    }
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000, // Batasi query maksimal 10 detik agar koneksi tidak terkunci
  ssl: getSslConfig(),
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}
