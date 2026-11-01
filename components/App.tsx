"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, session, SIGNED_OUT_EVENT, type Me } from "@/lib/client/api";
import { enableNotifications, isIos, isStandalone, permission, pushSupported } from "@/lib/client/push";
import type { HouseholdSummary, RotationTable as RotationTableData, TaskLine, WeekView } from "@/lib/types";
import Admin from "./Admin";
import { COLORS, shortDate } from "./format";
import Stats from "./Stats";
import Swap from "./Swap";
import Wheel from "./Wheel";

/** The join code comes from the link you share: /?house=burlington7 */
function joinCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get("house") || "";
}

export default function App() {
  const [person, setPerson] = useState<Me | null>(session.person);
  const [vapidKey, setVapidKey] = useState(session.vapidKey);

  // Any 401 from the API sends you back to the "who are you?" screen.
  useEffect(() => {
    const onSignedOut = () => setPerson(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  if (!person) {
    return (
      <Join
        onJoined={(p, token, key) => {
          session.save(token, p, key);
          setVapidKey(key);
          setPerson(p);
        }}
      />
    );
  }
  return (
    <Home
      person={person}
      vapidKey={vapidKey}
      onSignOut={() => {
        session.clear();
        setPerson(null);
      }}
    />
  );
}

// ---------- joining ----------

function Join({ onJoined }: { onJoined: (p: Me, token: string, vapidKey: string) => void }) {
  const [code, setCode] = useState(joinCodeFromUrl);
  const [house, setHouse] = useState<HouseholdSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (c: string) => {
    setError("");
    setBusy(true);
    try {
      setHouse(await api.household(c));
    } catch {
      setError("Couldn't find that house. Check the code or the link.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = joinCodeFromUrl();
    if (fromUrl) load(fromUrl);
  }, [load]);

  async function pick(personId: number) {
    setBusy(true);
    try {
      const res = await api.join(code, personId);
      onJoined({ id: res.personId, name: res.name }, res.token, res.vapidPublicKey);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <h1>House Tasks</h1>
        <p>Pick your name to get started. No password, no account.</p>
      </header>

      {!house && (
        <div className="panel">
          <h3>House code</h3>
          <form
            className="inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (code) load(code);
            }}
          >
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="e.g. burlington7"
              aria-label="House code"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button className="btn" type="submit" disabled={!code || busy}>
              Continue
            </button>
          </form>
          {error && <p className="warn">{error}</p>}
        </div>
      )}

      {house && (
        <div className="panel">
          <h3>Who are you?</h3>
          {house.people.map((p) => (
            <div className="row" key={p.id}>
              <span className="swatch" />
              <div className="who">{p.name}</div>
              <button className="btn ghost" onClick={() => pick(p.id)} disabled={busy}>
                That&apos;s me
              </button>
            </div>
          ))}
          {error && <p className="warn">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- signed in ----------

type Tab = "week" | "rotation" | "stats" | "setup" | "settings";

function Home({ person, vapidKey, onSignOut }: { person: Me; vapidKey: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("week");
  const [isAdmin, setIsAdmin] = useState(false);

  // The Setup tab only appears for admins, and the server rechecks every call.
  useEffect(() => {
    api
      .amIAdmin()
      .then((r) => setIsAdmin(!!r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const tabs: [Tab, string][] = [
    ["week", "This week"],
    ["rotation", "Rotation"],
    ["stats", "Progress"],
    ...(isAdmin ? ([["setup", "Setup"]] as [Tab, string][]) : []),
    ["settings", "Settings"],
  ];

  return (
    <div className="wrap">
      <header className="top">
        <h1>Hi {person.name}</h1>
        <p>Your tasks rotate every Monday.</p>
      </header>

      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "week" && <ThisWeek person={person} isAdmin={isAdmin} />}
      {tab === "rotation" && <RotationTable />}
      {tab === "stats" && <Stats />}
      {tab === "setup" && isAdmin && <Admin />}
      {tab === "settings" && (
        <Settings person={person} vapidKey={vapidKey} isAdmin={isAdmin} onSignOut={onSignOut} />
      )}
    </div>
  );
}

function ThisWeek({ person, isAdmin }: { person: Me; isAdmin: boolean }) {
  const [week, setWeek] = useState<WeekView | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setWeek(await api.currentWeek());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(task: TaskLine) {
    if (!week) return;
    // Optimistic: flip it locally, then reconcile with the server.
    setWeek((w) =>
      w && { ...w, tasks: w.tasks.map((t) => (t.taskId === task.taskId ? { ...t, done: !t.done } : t)) }
    );
    try {
      if (task.done) await api.unmarkDone(week.weekIndex, task.taskId);
      else await api.markDone(week.weekIndex, task.taskId);
    } catch (e) {
      setError(errorMessage(e));
      load();
    }
  }

  if (error) return <p className="warn">{error}</p>;
  if (!week) return <p className="muted">Loading…</p>;

  const mine = week.tasks.find((t) => t.peopleIds.includes(person.id));
  const resting = week.resting.includes(person.name);
  const weekLabel = shortDate(week.weekStart);
  const doneCount = week.tasks.filter((t) => t.done).length;

  return (
    <>
      <div className={`hero ${resting ? "hero-rest" : ""}`}>
        <p className="hero-kicker">Week of {weekLabel}</p>
        {mine ? (
          <>
            <h2 className="hero-title">{mine.taskName}</h2>
            <p className="hero-sub">{mine.covers}</p>
            <div className="hero-actions">
              <span className={`pill ${mine.done ? "pill-done" : ""}`}>
                {mine.done ? "Done ✓" : "Due Sunday 9pm"}
              </span>
              <button className="btn" onClick={() => toggle(mine)}>
                {mine.done ? "Undo" : "Mark mine done"}
              </button>
            </div>
          </>
        ) : resting ? (
          <>
            <h2 className="hero-title">You&apos;re off this week</h2>
            <p className="hero-sub">Nothing on your list. Enjoy it.</p>
          </>
        ) : (
          <>
            <h2 className="hero-title">Nothing assigned</h2>
            <p className="hero-sub">You have no task this week.</p>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>The wheel</h3>
          <span className="muted">
            {doneCount} of {week.tasks.length} done
          </span>
        </div>
        <Wheel
          tasks={week.tasks}
          resting={week.resting}
          weekLabel={weekLabel}
          colors={COLORS}
          highlightTaskId={mine ? mine.taskId : null}
        />
      </div>

      <div className="panel">
        <h3>Everyone</h3>
        {week.tasks.map((t, i) => (
          <div
            className={`row ${t.done ? "done" : ""} ${t.peopleIds.includes(person.id) ? "mine" : ""}`}
            key={t.taskId}
          >
            <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
            <div>
              <div className="who">
                {t.people.length ? t.people.join(", ") : <span className="warn">Nobody yet</span>}
              </div>
              <div className="what">
                <strong>{t.taskName}</strong>
                {t.loadLevel && (
                  <span className={`chip chip-${t.loadLevel.toLowerCase()}`}>{t.loadLevel}</span>
                )}
                <br />
                {t.covers}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
              Done
            </label>
          </div>
        ))}
        {week.resting.length > 0 && (
          <div className="row">
            <span className="swatch" />
            <div>
              <div className="who">{week.resting.join(", ")}</div>
              <div className="what">Week off</div>
            </div>
            <span />
          </div>
        )}
      </div>

      {isAdmin ? (
        <Swap weekIndex={week.weekIndex} weekLabel={weekLabel} onDone={load} />
      ) : (
        <div className="panel">
          <h3>Away this week?</h3>
          <p className="muted">
            Ask in the group chat and whoever runs the schedule will swap you with someone.
          </p>
        </div>
      )}
    </>
  );
}

function RotationTable() {
  const [data, setData] = useState<RotationTableData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .weeks(undefined, 8)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const taskNames = data.weeks[0]?.tasks.map((t) => t.taskName) ?? [];

  return (
    <div className="panel">
      <h3>Next {data.weeks.length} weeks</h3>
      <p className="muted">The rotation repeats every {data.cycleLength} weeks, so it never runs out.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              {taskNames.map((n, i) => (
                <th key={`${i}-${n}`}>{n}</th>
              ))}
              <th>Off</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.weekIndex} className={w.weekIndex === data.currentWeek ? "now" : ""}>
                <td>
                  <strong>{shortDate(w.weekStart)}</strong>
                </td>
                {w.tasks.map((t, i) => (
                  <td key={t.taskId}>
                    {t.people.length ? (
                      <span className="tag" style={{ background: COLORS[i % COLORS.length] }}>
                        {t.people.join(", ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
                <td>{w.resting.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({
  person,
  vapidKey,
  isAdmin,
  onSignOut,
}: {
  person: Me;
  vapidKey: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [state, setState] = useState(permission());
  const [message, setMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const needsHomeScreen = isIos() && !isStandalone();

  async function enable() {
    setMessage("");
    try {
      await enableNotifications(vapidKey);
      setState("granted");
      setMessage("Notifications are on. You'll get a nudge every Monday morning.");
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }

  async function test() {
    setMessage("");
    try {
      await api.testPush();
      setMessage("Test sent. It should arrive in a few seconds.");
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }

  async function runWeekly() {
    if (!confirm("Send everyone this week's Monday message now?")) return;
    setAdminMessage("");
    try {
      const r = await api.runWeekly();
      setAdminMessage(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}.`);
    } catch (e) {
      setAdminMessage(errorMessage(e));
    }
  }

  return (
    <>
      <div className="panel">
        <h3>Monday notifications</h3>
        {!pushSupported() && <p className="muted">This browser can&apos;t do notifications.</p>}

        {needsHomeScreen && (
          <>
            <p className="muted">On iPhone, notifications only work once this is on your Home Screen:</p>
            <ol className="steps">
              <li>Tap the Share button in Safari.</li>
              <li>
                Tap <strong>Add to Home Screen</strong>, then Add.
              </li>
              <li>Open House Tasks from your Home Screen and come back here.</li>
            </ol>
          </>
        )}

        {!needsHomeScreen && pushSupported() && (
          <div className="inline">
            {state !== "granted" ? (
              <button className="btn" onClick={enable}>
                Enable notifications
              </button>
            ) : (
              <>
                <button className="btn ghost" onClick={test}>
                  Send me a test
                </button>
                <button className="btn ghost" onClick={enable}>
                  Re-register this device
                </button>
              </>
            )}
          </div>
        )}
        {message && <p className="muted">{message}</p>}
      </div>

      {isAdmin && (
        <div className="panel">
          <h3>Monday message</h3>
          <p className="muted">
            Goes out automatically on Monday morning. Use this to test it, or to resend after a
            swap.
          </p>
          <button className="btn ghost" onClick={runWeekly}>
            Send this week&apos;s message now
          </button>
          {adminMessage && <p className="muted">{adminMessage}</p>}
        </div>
      )}

      <div className="panel">
        <h3>You</h3>
        <p className="muted">Signed in as {person.name} on this device.</p>
        <button className="btn ghost" onClick={onSignOut}>
          Not you? Switch person
        </button>
      </div>
    </>
  );
}
