import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "./types";

/**
 * The Monday job promises "exactly once per person per week", even when Vercel Cron
 * fires twice or a manual run overlaps it. That promise lives in a Postgres unique
 * constraint, so it is tested against a real Postgres, not a mock.
 *
 * Runs when TEST_DATABASE_URL is set (CI starts a Postgres service); skipped otherwise.
 * The database is wiped and rebuilt from db/migrations, so never point it at real data.
 */

const url = process.env.TEST_DATABASE_URL;

// Count pushes instead of sending them.
vi.mock("./push", () => ({ sendToPerson: vi.fn(async () => {}) }));

describe.skipIf(!url)("Monday notifications against a real Postgres", () => {
  let db: typeof import("./db");
  let weekly: typeof import("./weekly");
  let sendToPerson: ReturnType<typeof vi.fn>;
  let house: Household;
  let optedOutId: number;

  const sentRows = async () =>
    Number((await db.query<{ n: string }>("select count(*) as n from weekly_notification"))[0].n);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    weekly = await import("./weekly");
    sendToPerson = (await import("./push")).sendToPerson as unknown as ReturnType<typeof vi.fn>;

    // Fresh schema from the real migrations, so the test checks the schema we ship.
    await db.pool().query("drop schema if exists public cascade; create schema public;");
    const dir = join(process.cwd(), "db", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await db.pool().query(readFileSync(join(dir, file), "utf8"));
    }

    // 4 housemates, 3 tasks: three people get a task, one rests. One person opted out.
    const [h] = await db.query<{ id: number }>(
      `insert into household (name, join_code, week_start_date) values ('Test house', 'test1', '2026-01-05') returning id`
    );
    for (const [i, name] of ["Kitchen", "Bathrooms", "Trash"].entries()) {
      await db.query("insert into task (household_id, name, sequence_order) values ($1, $2, $3)", [h.id, name, i]);
    }
    for (const [i, name] of ["Shreeya", "Fuchu", "Anish", "Priya"].entries()) {
      await db.query(
        "insert into person (household_id, name, position, notify_weekly) values ($1, $2, $3, $4)",
        [h.id, name, i, name !== "Priya"]
      );
    }
    const repo = await import("./repo");
    house = (await repo.householdById(h.id))!;
    optedOutId = (await repo.peopleOf(h.id)).find((p) => p.name === "Priya")!.id;
  });

  beforeEach(async () => {
    await db.query("truncate weekly_notification");
    sendToPerson.mockClear();
  });

  afterAll(async () => {
    await db?.pool().end();
  });

  it("messages every opted-in person once and records each send", async () => {
    const result = await weekly.notifyHousehold(house);
    expect(result).toMatchObject({ sent: 3, skipped: 0 });
    expect(sendToPerson).toHaveBeenCalledTimes(3);
    expect(await sentRows()).toBe(3);
  });

  it("never messages someone who turned notifications off", async () => {
    await weekly.notifyHousehold(house);
    const recipients = sendToPerson.mock.calls.map((call) => call[0]);
    expect(recipients).not.toContain(optedOutId);
  });

  it("a second run in the same week sends nothing", async () => {
    await weekly.notifyHousehold(house);
    const again = await weekly.notifyHousehold(house);
    expect(again).toMatchObject({ sent: 0, skipped: 3 });
    expect(sendToPerson).toHaveBeenCalledTimes(3);
  });

  it("overlapping runs still send exactly once per person", async () => {
    // Three runs at the same moment, like a doubled cron plus an admin pressing "run now".
    const results = await Promise.all([
      weekly.notifyHousehold(house),
      weekly.notifyHousehold(house),
      weekly.notifyHousehold(house),
    ]);
    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    expect(totalSent).toBe(3);
    expect(sendToPerson).toHaveBeenCalledTimes(3);
    expect(new Set(sendToPerson.mock.calls.map((call) => call[0])).size).toBe(3);
    expect(await sentRows()).toBe(3);
  });

  it("the admin test button (force) sends without using up the real Monday send", async () => {
    await weekly.notifyHousehold(house, true);
    expect(sendToPerson).toHaveBeenCalledTimes(3);
    expect(await sentRows()).toBe(0);

    const real = await weekly.notifyHousehold(house);
    expect(real.sent).toBe(3);
  });
});
