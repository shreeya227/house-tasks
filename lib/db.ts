import pg from "pg";

/**
 * One small connection pool per server instance. On Vercel an instance is reused across
 * requests, so the pool lives on globalThis to survive hot reloads in development too.
 *
 * Use Neon's *pooled* connection string (host contains "-pooler"): serverless instances
 * come and go, and the pooler keeps that from exhausting Postgres connections.
 */

// bigint (int8) ids come back from pg as strings by default; ours are small, use numbers.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
// date columns: keep "YYYY-MM-DD" as-is instead of turning them into local-midnight Dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

const g = globalThis as unknown as { __housetasksPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!g.__housetasksPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    g.__housetasksPool = new pg.Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return g.__housetasksPool;
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

/** Runs fn inside a transaction on one connection. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
