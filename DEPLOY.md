# Moving House Tasks from Render to Vercel

The code is already in this repo and the Java version is saved on the `spring-boot-v1`
branch. What's left is about 20 minutes of clicking. Do the steps in order; each ends
with a check. Your Neon database stays exactly where it is, with all your data.

---

## Step 1: Add the one new table in Neon (2 min)

Neon dashboard → your project → **SQL Editor**, paste, **Run**:

```sql
create table if not exists weekly_notification (
  id            bigserial   primary key,
  household_id  bigint      not null references household(id) on delete cascade,
  week_index    int         not null,
  person_id     bigint      not null references person(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  unique (household_id, week_index, person_id)
);
```

**Check:** the result says the statement ran with no error. It stops the Monday message
going out twice. Nothing else in the database changes.

## Step 2: Collect the seven values (5 min)

Write these in a note; you paste them into Vercel in step 3.

| Name | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → **Connect** → turn on **Connection pooling** → copy. Starts with `postgresql://`, host contains `-pooler`. Not the `jdbc:` form. |
| `VAPID_PUBLIC_KEY` | Render → your service → **Environment** (copy as-is) |
| `VAPID_PRIVATE_KEY` | Render → Environment |
| `VAPID_SUBJECT` | Render → Environment |
| `TOKEN_SECRET` | Render → Environment. Keeping it means nobody is signed out. |
| `CRON_SECRET` | New: run `openssl rand -base64 32`, or any long random string |

## Step 3: Create the Vercel project (5 min)

1. vercel.com → **Sign up / Log in with GitHub**.
2. **Add New → Project** → **Import** `house-tasks`. If it isn't listed, click
   **Adjust GitHub App Permissions** and give Vercel access to it.
3. Framework Preset: **Next.js** (detected). Leave Root Directory and build settings alone.
4. Open **Environment Variables** and add all six names from step 2.
5. **Deploy**. It takes about a minute.

**Check:** you get a URL like `https://house-tasks-xxxx.vercel.app`. Open
`https://YOUR-APP.vercel.app/api/health` in a browser:

```
{"ok":true,"database":"up"}
```

If it says `"database":"down"`, re-copy `DATABASE_URL` from Neon into Vercel
(**Settings → Environment Variables**), then **Deployments → ⋯ → Redeploy**. Variable
changes only take effect on a new deploy.

## Step 4: Check the Monday job (2 min)

Vercel → your project → **Settings → Cron Jobs**: you should see `/api/cron/weekly` with
schedule `0 13 * * 1`.

That's Monday 13:00 UTC, which is **8–9am Boston time** in winter (Vercel's free plan
fires somewhere in that hour). In March, when the clocks go forward, it becomes 9–10am;
change `13` to `12` in `vercel.json` then if you want 8am back.

## Step 5: Clear the old phone registrations (1 min)

The app has a new address, so every phone re-adds it. In Neon's SQL Editor:

```sql
delete from push_subscription;
```

Without this, the old Render registrations keep sending a second notification with a
link that no longer works.

## Step 6: Test on your phone (5 min)

1. Delete the old House Tasks icon from your Home Screen.
2. Open `https://YOUR-APP.vercel.app/?house=YOUR-JOIN-CODE` in **Safari**.
3. Share → **Add to Home Screen** → Add. Open it **from the icon**, pick your name.
4. Settings → **Enable notifications** → Allow → **Send me a test**.
5. Settings → **Send this week's message now** (admin only; it doesn't stop Monday's).
6. This week → do one swap and check the list updates.

## Step 7: Tell the house, then turn off Render

Send one message:

> House Tasks moved to a faster link. Please delete the old icon, then:
> 1. Open [new link] in Safari
> 2. Share → Add to Home Screen
> 3. Open it from the Home Screen, pick your name, tap Enable notifications

Then:

1. cron-job.org (or whatever pinged Render) → delete the job.
2. Render → your service → **Settings → Suspend** (or **Delete**). Render's own builds of
   this repo will fail from now on anyway, since the Java code is gone from `main`.

---

## From now on

Every push to `main` deploys to Vercel automatically. Locally:

```bash
npm install
cp .env.example .env.local   # paste the same values
npm run dev                  # http://localhost:3000/?house=YOUR-JOIN-CODE
npm test
```

## When something doesn't work

| Symptom | Cause |
|---|---|
| `/api/health` says database down | Wrong `DATABASE_URL`, or changed without redeploying. |
| Everyone has to pick their name again | `TOKEN_SECRET` differs from Render's. Harmless. |
| "Notifications aren't set up on the server" | VAPID keys missing on Vercel. Add, redeploy, then Settings → Switch person and pick your name again. |
| Test works, Monday doesn't | Vercel → **Logs**, filter `/api/cron/weekly`. `CRON_SECRET is not set` means it's missing. |
| Two notifications | An old Render registration survived. Rerun step 5, then re-enable on the phone. |
