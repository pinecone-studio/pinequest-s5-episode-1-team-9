import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

/** Pooled connection (Neon `-pooler` host) for application traffic. */
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
pool.on("error", (err) => console.error("[db] Idle client error:", err));

export const db = drizzle({ client: pool, schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DB = typeof db | Tx;

/** Postgres unique_violation. */
export const isUniqueViolation = (err: unknown) =>
  (err as { code?: string }).code === "23505" || (err as { cause?: { code?: string } }).cause?.code === "23505";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
