import { pool } from "./client";

/** Checks the pool can reach Postgres. Migrations are applied explicitly with `npm run db:migrate`. */
export async function connectDatabase(): Promise<void> {
  await pool.query("select 1");
  console.log("[db] Connected to Postgres");
}

export async function disconnectDatabase(): Promise<void> {
  await pool.end();
}
