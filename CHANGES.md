# v2: Spring Boot on Render → Next.js on Vercel

## Why

Render's free tier sleeps, so the first visit took 30–60 seconds and the Monday job needed
an external pinger. Vercel runs the API as functions that start in about a second, and
Vercel Cron calls the Monday job directly, on the free plan.

Vercel can't run a JVM, so the backend was rewritten in TypeScript. The Java version is
kept on the git branch `spring-boot-v1`.

## What stayed the same

- **The database.** Same Neon database, same tables and columns. Migrations are written as
  "if not exists", so they only add what's missing.
- **The rotation.** `lib/rotation.ts` is a line-for-line port of `Rotation.java`, and every
  test in `RotationTest.java` is carried over to `lib/rotation.test.ts`.
- **The API.** Same URLs and the same JSON shapes, so the screens barely changed.
- **Tokens.** Same format and HMAC signature as `Tokens.java`; a test checks this.
- **The screens.** Same components and styles, converted to TypeScript.

## What changed

**Hosting and structure**
- One Next.js project serves the screens and the API from the same origin: no Docker,
  no CORS settings, no copying `dist/` into Spring Boot's `static/` folder.
- `@Scheduled` → Vercel Cron (`vercel.json`) calling `/api/cron/weekly` on Mondays at
  13:00 UTC (8–9am Boston in winter), protected by `CRON_SECRET`.
- Flyway → `npm run db:migrate`, which tracks applied files in `schema_migrations`.
- `DemoData.java` → `npm run db:seed`, which only runs on an empty database.
- `DATABASE_URL` is now a normal `postgresql://` string, not the `jdbc:` form.

**Monday message**
- Exactly once per person per week: a `weekly_notification` row is claimed before each
  send, so a repeated cron run (Vercel Cron is best-effort) can't double-send. The table
  name is new on purpose, so it can't clash with the v1 `notification_log`.
- `/api/push/run-weekly` is now admin-only (it was open to every housemate) and doesn't
  count as the real send. There's a button for it in Settings, admins only.

**Security fixes**
- The join code no longer works as an `Authorization` header on the schedule endpoints;
  a signed token is required.
- A token for a removed housemate stops working.
- Swaps are checked as admin-only on the server, matching the screen.
- Ticking a task from another household is rejected.
- Removing a push subscription only removes your own.
- An admin can't remove themself or drop their own admin rights, so the house can't end up
  with nobody able to change it.

**Bug fixes**
- The Rotation table showed each week a day early (Sep 20 for Sep 21) in US timezones.
- Progress counted weeks before the rotation started as "assigned, not done", which
  dragged a new house's percentage down.
- "Send me a test" now says when you have no registered device, instead of silently
  succeeding.
- A 401 now takes you back to the "who are you?" screen instead of leaving an error on the page.
- The app icons referenced by the manifest were missing; they're in `public/` now.

**Small additions**
- `/api/health` checks the database.
- "Re-register this device" in Settings, for a phone whose subscription expired.
- Error messages from the server are plain sentences the screens can show as-is.

**Carried over from the last Render fix**
- The browser client only parses a reply that has a body, so an empty `201` or `204`
  can never trigger Safari's "The string did not match the expected pattern" again.
