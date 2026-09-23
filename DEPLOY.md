# Deploying and testing House Tasks

Written in the order you'd actually do it. Phase 1 takes an evening; phase 2 an hour;
phase 3 is the part your housemates see.

---

## Phase 1: Get it running locally

### 1. Start Postgres

```bash
cd housetasks
docker compose up -d db
docker compose ps          # confirm it says running
```

No Docker? Install Postgres directly and create a `housetasks` database.

### 2. Generate your VAPID keys

These identify your server to Apple's and Google's push services. Generate once and keep
them forever; changing them invalidates every existing subscription.

```bash
npx web-push generate-vapid-keys
```

```bash
cp .env.example .env
```

Paste the public and private keys in, and set `TOKEN_SECRET` to a long random string:

```bash
openssl rand -base64 32
```

### 3. Run the backend

```bash
cd backend
set -a; . ../.env; set +a      # exports everything in .env, quotes and spaces included
mvn spring-boot:run
```

What to check in the logs:

- Flyway applying `V1__init` and `V2__admin`
- No `ddl-auto` validation errors (they mean the schema and entities drifted)
- `Started HouseTasksApplication`

Then confirm the seed worked:

```bash
curl http://localhost:8080/api/households/burlington7
```

You should get the house name and seven people.

### 4. Run the tests

```bash
mvn test
```

`RotationTest` is the one that matters. If it passes, the schedule is correct forever,
because assignments are computed rather than stored.

### 5. Run the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open <http://localhost:5173/?house=burlington7>, pick your name, and you should see this
week's tasks. Pick **Shreeya** to see the Setup tab; pick anyone else and it disappears.

### 6. Test the API by hand

Grab a token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/households/burlington7/join \
  -H 'Content-Type: application/json' -d '{"personId":2}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s http://localhost:8080/api/weeks/current -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/weeks?count=8" -H "Authorization: $TOKEN" | python3 -m json.tool
```

Two things worth confirming yourself, since they're the whole point of the design:

- `count=60` still returns valid weeks, so the schedule never runs out.
- Week 7 matches week 0 exactly, because the cycle is 7 weeks long.

Check that the permission model works, using a non-admin's token:

```bash
curl -i -X POST http://localhost:8080/api/admin/people \
  -H "Authorization: $OTHER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Someone"}'
# expect 403 Forbidden
```

---

## Phase 2: Deploy

Notifications need HTTPS, so push can't be tested from `localhost` on your phone. You need
a real URL. Two routes:

### Quick route: a tunnel (good for a first push test, 5 minutes)

```bash
npx cloudflared tunnel --url http://localhost:5173
```

That prints an HTTPS URL you can open on your iPhone while everything runs on your laptop.
Fine for testing, not for the house: the URL changes each run and dies with your terminal.

### Real route: Render plus Neon plus Vercel (free tiers, ~30 minutes)

**a. Database on Neon**

1. Create a project at neon.tech and copy the connection details.
2. Convert them to JDBC form:
   `jdbc:postgresql://<host>/<db>?sslmode=require`
3. Keep the user and password separate for `DATABASE_USER` and `DATABASE_PASSWORD`.

**b. Backend on Render**

1. Push this repo to GitHub.
2. Render → New → Web Service → point at your repo, root directory `backend`, runtime
   Docker (it finds `backend/Dockerfile`).
3. Environment variables: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TOKEN_SECRET`,
   `APP_TIMEZONE=America/New_York`.
4. Deploy, then check the logs for Flyway and `Started HouseTasksApplication`.

**Important:** Render's free web services sleep after inactivity, and a sleeping service
never fires the Monday cron. Either use the cheapest paid instance, or keep it awake with a
free external scheduler (cron-job.org, UptimeRobot) hitting any endpoint every 10 minutes.

**c. Frontend on Vercel**

1. Vercel → New Project → same repo, root directory `frontend`, framework Vite.
2. Add `frontend/vercel.json` so API calls reach Render:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-APP.onrender.com/api/:path*" }
  ]
}
```

The rewrite matters: keeping the frontend and API on the same origin means no CORS and no
cross-site cookie problems.

**d. Simpler alternative: one service**

```bash
cd frontend && npm run build
cp -r dist/* ../backend/src/main/resources/static/
```

Then Spring Boot serves the app and the API together, and you deploy one thing. Fewer
moving parts, at the cost of rebuilding the frontend on every deploy.

---

## Phase 3: Test notifications on your iPhone

Order matters here. Notifications fail silently if step 2 is skipped.

1. Open your deployed URL in **Safari** (not Chrome), with `?house=burlington7`.
2. Share button → **Add to Home Screen** → Add.
3. Open House Tasks **from the Home Screen icon**, not from Safari.
4. Pick your name.
5. Settings tab → **Enable notifications** → Allow.
6. Settings tab → **Send me a test**. It should arrive within a few seconds.

Then test the real job without waiting for Monday:

```bash
curl -X POST https://YOUR-APP.onrender.com/api/push/run-weekly -H "Authorization: $TOKEN"
# {"sent":7}
```

Every subscribed person gets their own line: "Your task this week: Kitchen. Any time before
Sunday 9pm." Whoever is resting gets "You are off this week."

Finally, confirm the cron itself. Temporarily set `WEEKLY_CRON` to a minute or two ahead,
for example `0 47 14 * * *` for 14:47 daily, redeploy, wait, then set it back to
`0 0 8 * * MON`. Cron bugs are the kind you only find this way.

### When a notification doesn't arrive

| Symptom | Cause |
|---|---|
| "Add this page to your Home Screen first" | Opened from a Safari tab. iOS requires the installed app. |
| Enable button does nothing | Permission was denied before. iOS Settings → Notifications → House Tasks, or delete and re-add the icon. |
| Test works, Monday doesn't | The service was asleep, or the cron timezone is wrong. Check logs for "Weekly notifications sent". |
| Worked, then stopped | Subscription expired. `WebPushSender` prunes on 404/410; the person re-enables in Settings. |
| Nothing ever arrives | VAPID keys missing or mismatched between the key the browser subscribed with and the server's current key. |

---

## Phase 4: Roll it out

1. Replace the seed data with your real setup on the Setup tab, and set your own join code
   in the database (`update household set join_code = '...'`).
2. Add yourself as admin only. Everyone else gets This week, Rotation, and Settings.
3. Test the whole flow yourself on one phone, end to end, before telling anyone it works.
4. Send one message:

> Added notifications for the tasks. To get a Monday reminder:
> 1. Open [link] in Safari
> 2. Share → Add to Home Screen
> 3. Open it from your Home Screen, pick your name, tap Enable notifications

Expect 3 or 4 people to do it straight away and the rest to need a nudge. That's normal,
and the app still works for them; they just won't get the notification.

---

## Before you call it done

- Remove or protect `/api/push/run-weekly`. Right now any signed-in housemate can trigger
  it, which means they could spam the house.
- Set `TOKEN_SECRET` to something real in production. Changing it later signs everyone out.
- Add a `/health` endpoint (or use any existing one) for whatever keeps the service awake.
- Back up the database. Neon has branching and history, so this is mostly about knowing
  where the restore button is.
