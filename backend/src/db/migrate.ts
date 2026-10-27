import dotenv from "dotenv";
import path from "node:path";

// Muat .env dengan aturan yang sama seperti koneksi utama.
// Variabel yang sudah ada di environment TIDAK ditimpa (dukung override,
// mis. DB_NAME berbeda untuk database uji) — perilaku bawaan dotenv.
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { buildDatabaseUrl } from "./index";

/**
 * Penerap migrasi Drizzle untuk drizzle-kit 0.20.x.
 *
 * Konteks: CLI `drizzle-kit` terpin (0.20.18) tidak memiliki perintah
 * `migrate`, dan `up:mysql` hanyalah utilitas upgrade folder lama
 * (handler-nya no-op terhadap database). Jalur resmi yang didukung
 * versi ini adalah migrator `drizzle-orm` (0.29.x).
 *
 * Memakai folder `drizzle/` (journal + SQL) sebagai sumber kebenaran,
 * mencatat bookkeeping `__drizzle_migrations` secara otomatis, dan
 * TIDAK pernah menyentuh database selain yang ditunjuk konfigurasi.
 */
async function main(): Promise<void> {
  const pool = mysql.createPool(buildDatabaseUrl());
  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, "../../drizzle"),
    });
    console.log("Migrasi selesai.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migrasi gagal:", error);
  process.exit(1);
});
