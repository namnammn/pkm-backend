import { createApp } from './app.js';
import { config } from './config/index.js';
import { pool } from './config/db.js';

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Server] Web Portal Siswa API running on port ${config.port} (0.0.0.0)`);
  console.log(`[Server] Base URL: http://0.0.0.0:${config.port}/api/v1`);
  console.log(`[Server] Environment: ${config.env}`);
});

// Graceful shutdown saat menerima sinyal SIGTERM atau SIGINT dari Docker / Render
async function handleShutdown(signal: string) {
  console.log(`[Server] Menerima sinyal ${signal}, memulai proses graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP server ditutup.');
    try {
      await pool.end();
      console.log('[Server] Koneksi database PostgreSQL ditutup dengan aman.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Gagal menutup pool database:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
