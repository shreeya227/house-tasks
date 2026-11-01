import { existsSync } from "node:fs";

/** Scripts run outside Next.js, so load .env.local (or .env) ourselves. */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local or export it first.");
  process.exit(1);
}
