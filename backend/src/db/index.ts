import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum dikonfigurasi");
}

const pool = mysql.createPool(databaseUrl);

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