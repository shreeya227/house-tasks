import "./env";
import pg from "pg";
import { mondayOf, todayIn } from "../lib/dates";

/**
 * Seeds one household, only if the database has none (DemoData.java in the old version).
 * Your existing Neon database already has the house, so this does nothing there.
 *
 *   npm run db:seed
 *
 * Heavy and light tasks alternate and the two bathrooms sit two weeks apart,
 * so nobody gets two hard weeks in a row.
 */

const TASKS: [name: string, covers: string, load: string][] = [
  ["Kitchen", "Counters, stovetop, sink, microwave, floor, fridge wipe-out", "Heavy"],
  ["Trash & recycling", "Empty bins every 3 to 4 days, bins on the road Wednesday night", "Light"],
  ["Upstairs bathroom", "Toilet, sink, shower, mirror, floor", "Medium"],
  ["Living + dining", "Vacuum or mop, wipe surfaces, dining table", "Medium"],
  ["Basement bathroom", "Toilet, sink, shower, mirror, floor", "Medium"],
  ["Basement common + stairs", "Vacuum or mop the common space and stairs", "Medium"],
];
const PEOPLE = ["Amanda", "Shreeya", "Shikshya", "Yogesh", "Jhapali", "Nikit", "Adit"];
const ADMIN = "Shreeya";
const TIMEZONE = "America/New_York";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query<{ n: string }>("select count(*) as n from household");
  if (Number(rows[0].n) > 0) {
    console.log("A household already exists; nothing to seed.");
  } else {
    await client.query("begin");
    const h = await client.query<{ id: string }>(
      `insert into household (name, join_code, timezone, week_start_date)
       values ($1, $2, $3, $4) returning id`,
      ["Our house", "burlington7", TIMEZONE, mondayOf(todayIn(TIMEZONE))]
    );
    const hid = h.rows[0].id;
    for (const [i, [name, covers, load]] of TASKS.entries()) {
      await client.query(
        `insert into task (household_id, name, covers, load_level, sequence_order) values ($1, $2, $3, $4, $5)`,
        [hid, name, covers, load, i]
      );
    }
    for (const [i, name] of PEOPLE.entries()) {
      await client.query(
        `insert into person (household_id, name, position, is_admin) values ($1, $2, $3, $4)`,
        [hid, name, i, name === ADMIN]
      );
    }
    await client.query("commit");
    console.log(`Seeded "Our house" with join code burlington7, ${TASKS.length} tasks, ${PEOPLE.length} people.`);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
