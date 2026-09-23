# House Tasks

A small web app for a shared house: everyone gets one task a week, the rotation moves
along every Monday, one person gets the week off, and each person gets a push
notification on their phone telling them what they have.

Added to an iPhone Home Screen it behaves like a native app — own icon, full screen,
real notifications — with no App Store, no Apple Developer account, and no Xcode.

## Why a PWA and not a native app

Since iOS 16.4, a site added to the Home Screen can receive Web Push notifications. That
removes the only real reason to write Swift for this project, and it means the whole thing
is Java and React.

Two constraints to design around, both handled in the code here:

1. Notifications only work **after** the site is added to the Home Screen. A normal Safari
   tab can't subscribe.
2. `Notification.requestPermission()` must be called from a real tap, never on page load.

## Stack

| Layer | Choice |
|---|---|
| Backend | Java 21, Spring Boot 3.3, Spring Data JPA |
| Database | PostgreSQL, Flyway migrations |
| Push | Web Push with VAPID (`nl.martijndwars:web-push`) |
| Scheduling | Spring `@Scheduled` cron |
| Frontend | React 18, Vite, one service worker |
| Deploy | Docker, any container host |

## Layout

```
backend/
  src/main/java/com/housetasks/
    rotation/Rotation.java          the core algorithm, pure, no Spring
    rotation/RotationService.java   feeds the database into Rotation
    web/ApiController.java          the REST API
    push/WebPushSender.java         sends Web Push, prunes dead subscriptions
    push/WeeklyNotificationJob.java Monday 8am cron
    config/Tokens.java              signed person tokens, no passwords
    config/DemoData.java            seeds one household on first run
    domain/                         entities and repositories
  src/main/resources/db/migration/  schema
  src/test/.../RotationTest.java    the tests that matter
frontend/
  src/App.jsx                       join, this week, rotation, settings
  src/Wheel.jsx                     the rotation drawn as an SVG wheel
  src/Stats.jsx                     completion graphs, per week and per person
  src/api.js                        fetch wrapper
  src/push.js                       subscription + iOS checks
  public/sw.js                      service worker
  public/manifest.json              makes it installable
```

## The core idea: assignments are computed, never stored

```
slot = (person.position + weekIndex) mod slotCount
```

Tasks are held in a sequence; everyone walks down it, one step per week. When there are
more people than tasks, the extra slots are rest weeks. A swap exchanges two people's
whole assignment for one week only.

Nothing per-week is written to the database except swaps and completions, so adding or
removing a housemate never requires backfilling rows, and the schedule extends infinitely
into the future. With 7 people and 6 tasks the cycle is 7 weeks, which is also the number
to use if you ever set up repeating calendar reminders.

Task order matters, and the seed data puts it in a deliberate sequence:

```
Kitchen (Heavy) → Trash (Light) → Upstairs bathroom → Living + dining
  → Basement bathroom → Basement common + stairs → rest week
```

Heavy work sits next to light work, and the two bathrooms are two weeks apart, so nobody
gets two hard weeks in a row.

## Running it locally

### 1. Database

```bash
docker compose up -d db
```

### 2. VAPID keys (once)

```bash
npx web-push generate-vapid-keys
```

Copy `.env.example` to `.env` and paste in the public and private keys, plus a long random
`TOKEN_SECRET`.

### 3. Backend

```bash
cd backend
set -a; . ../.env; set +a      # or use your IDE's env config
mvn spring-boot:run
```

On first start it seeds a household with join code `burlington7`, the six tasks, and seven
people. Edit `DemoData.java` before the first run, or change the rows later with SQL.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/?house=burlington7 and pick your name. Vite proxies `/api` to
Spring Boot, so there's no CORS setup in development.

### 5. Tests

```bash
cd backend && mvn test
```

`RotationTest` covers the rules worth being sure about: everyone shifts one task a week,
the cycle repeats after 7 weeks, each person passes through every task plus one rest week,
an owned task never moves, a swap affects one week only, and week indexing handles the
Sunday/Monday boundary.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/households/{code}` | List the people, for the "who are you?" screen |
| POST | `/api/households/{code}/join` | Returns a token and the VAPID public key |
| GET | `/api/weeks/current` | This week's assignments and completions |
| GET | `/api/weeks?from=&count=` | The rotation table |
| POST/DELETE | `/api/weeks/{i}/tasks/{id}/done` | Tick and untick |
| POST | `/api/weeks/{i}/swaps` | Swap two people for one week |
| GET | `/api/stats?weeks=8` | Completion history per person and per week |
| POST | `/api/push/subscribe` | Store a device subscription |
| POST | `/api/push/test` | Send yourself a test notification |
| POST | `/api/push/run-weekly` | Fire the Monday job now (remove before real use) |

Auth is one signed HMAC token in the `Authorization` header, issued when someone picks
their name. For 7 housemates that's proportionate; full accounts would mostly be a reason
for people never to finish setup. Swap in real auth if this ever leaves the house.

## Deploying

Any container host works. A cheap, boring setup:

1. **Database:** Neon or Supabase (free tier). Copy the JDBC URL.
2. **Backend:** Render or Fly.io from `backend/Dockerfile`. Set `DATABASE_URL`,
   `DATABASE_USER`, `DATABASE_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `TOKEN_SECRET`, `APP_TIMEZONE`.
3. **Frontend:** `npm run build`, then deploy `dist/` to Vercel or Netlify, with `/api/*`
   rewritten to the backend URL. Or serve `dist/` from Spring Boot's `static/` folder and
   run one service instead of two.

HTTPS is mandatory for service workers and push. Every host above gives it free.

Watch out for free tiers that sleep: if the backend is asleep at 8am Monday, the cron
never fires. Render's free web services sleep, so either use a paid instance or ping the
service with an external scheduler.

## Rolling it out to the house

The notification setup is the part where people give up, so keep it to three taps and send
one message:

> Added notifications to the tasks page. To get a Monday reminder:
> 1. Open [link] in Safari
> 2. Share button → Add to Home Screen
> 3. Open it from your Home Screen, pick your name, tap Enable notifications

Then use `/api/push/test` from your own phone to confirm it works before telling everyone
it does. `Settings → Send me a test` does the same thing from the UI.

## What to build next

- **Per-person quiet settings.** `person.notify_weekly` already exists; expose it in
  Settings so anyone who dislikes reminders can turn theirs off without leaving the app.
- **Self-service swaps.** Right now swaps go through the API; a "I'm away, ask someone to
  swap" button that proposes a trade to whoever has the rest week is the natural next step.
- **A nudge on Sunday evening** for tasks still unticked, sent only to that person.
- **Household admin screens** for adding people and reordering tasks, so it isn't SQL.
- **Groceries.** The original idea: a shared list, a "we're low on X" command, and cost
  splitting. Same service, one more table.
