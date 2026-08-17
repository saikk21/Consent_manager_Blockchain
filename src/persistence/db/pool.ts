import pg from "pg";
import { loadEnv } from "../../config/env.js";

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(): DbPool {
  const env = loadEnv();
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

