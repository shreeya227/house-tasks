import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Applies db/migrations/*.sql in order, once each, like Flyway did.
 * Every migration is written with "if not exists", so running this against the
 * database the Spring Boot app already set up is safe: it only adds what's missing.
 *
 *   npm run db:migrate
 */

const dir = join(process.cwd(), "db", "migrations");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
  )`);
  const done = new Set(
    (await client.query<{ version: string }>("select version from schema_migrations")).rows.map((r) => r.version)
  );

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (version) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.error(`failed on ${file}:`, (e as Error).message);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(applied ? `Done: ${applied} applied.` : "Already up to date.");
} finally {
  await client.end();
}
