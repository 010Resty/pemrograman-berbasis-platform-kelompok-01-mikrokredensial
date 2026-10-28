import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

/**
 * Konfigurasi koneksi Tahap 1.
 * Prioritas: DATABASE_URL (satu string, cocok untuk production/PaaS).
 * Fallback: DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
 * (cocok dengan `.env.example` dan `drizzle.config.ts`).
 */
export function buildDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const host = process.env.DB_HOST || "localhost";
  const port = Number.parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "aristoteles";

  if (!Number.isFinite(port)) {
    throw new Error("DB_PORT harus berupa angka");
  }

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const databaseUrl = buildDatabaseUrl();

// Pool disetel eksplisit agar fan-out paralel (Promise.all) tidak antre/exhaust:
// 10 koneksi cukup untuk beban instruktur, antre 50, idle 30 dtk, timeout 10 dtk.
const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  queueLimit: 50,
  idleTimeout: 30000,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export const db = drizzle(pool, {
  schema,
  mode: "default",
});
export { pool };

export async function testDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log("Koneksi MySQL berhasil!");
  } finally {
    connection.release();
  }
}