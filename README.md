# House Tasks

A small web app for a shared house: everyone gets one task a week, the rotation moves
along every Monday, one person gets the week off, and each person gets a push
notification on their phone telling them what they have.

Added to an iPhone Home Screen it behaves like a native app (own icon, full screen,
real notifications) with no App Store and no Xcode.

Version 2 runs entirely on **Vercel**: one Next.js project serves the screens and the API,
and Vercel Cron sends the Monday message. No Docker, no always-on server, no cold start
that takes a minute. Version 1 (Java 21 / Spring Boot on Render) is kept on the git branch
`spring-boot-v1`.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| API | Next.js route handlers in `app/api/*`, running as Vercel Functions |
| Database | PostgreSQL on Neon, plain SQL with `pg` |
| Push | Web Push with VAPID (`web-push`) |
| Scheduling | Vercel Cron → `/api/cron/weekly` |
| Tests | Vitest |

## Layout

```
app/
  page.tsx, layout.tsx           the shell; the app itself renders in the browser
  api/                           one folder per endpoint (same URLs as v1)
    cron/weekly/route.ts         the Monday job, called by Vercel Cron
components/
  App.tsx                        join, this week, rotation table, settings
  Admin.tsx  Stats.tsx  Swap.tsx  Wheel.tsx
lib/
  rotation.ts                    the core algorithm, pure (port of Rotation.java)
  rotation.test.ts               the tests that matter
  dates.ts                       calendar maths in UTC, "today" in the house's timezone
  schedule.ts                    feeds the database into the rotation
  weekly.ts                      the Monday message, exactly once per person per week
  push.ts  tokens.ts  repo.ts  db.ts  http.ts
  client/                        browser-side fetch wrapper and push helpers
db/migrations/                   schema, safe to run on the v1 database
scripts/                         migrate and seed
public/                          service worker, manifest, icons
vercel.json                      the cron schedule
```

## The core idea: assignments are computed, never stored

```
slot = (person.position + weekIndex) mod slotCount
```

Tasks are held in a sequence; everyone walks down it, one step per week. When there are
more people than tasks, the extra slots are rest weeks. A swap exchanges two people's
whole assignment for one week only. Nothing per-week is stored except swaps, ticks and the
"Monday message sent" log, so the schedule extends forever and adding a housemate never
needs a backfill. With 7 people and 6 tasks the cycle is 7 weeks.

## Running it locally

```bash
npm install
cp .env.example .env.local      # then fill it in
npm run db:migrate              # creates or updates the tables
npm run db:seed                 # only does anything on an empty database
npm run dev
```

Open http://localhost:3000/?house=burlington7 and pick your name.

```bash
npm test            # rotation, dates and token tests
npm run typecheck
npm run build       # what Vercel runs
```

## API

| Method | Path | Who |
|---|---|---|
| GET | `/api/households/{code}` | anyone with the code |
| POST | `/api/households/{code}/join` | anyone with the code |
| GET | `/api/weeks/current`, `/api/weeks/{i}`, `/api/weeks?from=&count=` | housemates |
| POST/DELETE | `/api/weeks/{i}/tasks/{id}/done` | housemates |
| GET | `/api/stats?weeks=8` | housemates |
| POST/DELETE | `/api/push/subscribe` | housemates |
| POST | `/api/push/test` | housemates |
| POST | `/api/weeks/{i}/swaps`, DELETE `/api/swaps/{id}` | admin |
| GET/POST/DELETE | `/api/admin/*` | admin |
| POST | `/api/push/run-weekly` | admin |
| GET | `/api/cron/weekly` | Vercel Cron only (`CRON_SECRET`) |
| GET | `/api/health` | anyone |

Auth is one signed HMAC token in the `Authorization` header, issued when someone picks
their name. Proportionate for 7 housemates; swap in real auth if this ever leaves the house.

Deploying: see [DEPLOY.md](DEPLOY.md). What changed from v1: see [CHANGES.md](CHANGES.md).
