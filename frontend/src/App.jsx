import React, { useCallback, useEffect, useState } from "react";
import { api, session } from "./api.js";
import Admin from "./Admin.jsx";
import Stats from "./Stats.jsx";
import Wheel from "./Wheel.jsx";
import {
  enableNotifications,
  isIos,
  isStandalone,
  permission,
  pushSupported,
} from "./push.js";

const COLORS = ["#8FC9AE", "#F2C14E", "#8DB3E2", "#EFA08C", "#BFA7E0", "#93D3DC"];

/** The join code comes from the link you share: /?house=burlington7 */
function joinCodeFromUrl() {
  return new URLSearchParams(window.location.search).get("house") || "";
}

export default function App() {
  const [person, setPerson] = useState(session.person);
  const [vapidKey, setVapidKey] = useState(localStorage.getItem("housetasks.vapid") || "");

  if (!person) {
    return (
      <Join
        onJoined={(p, token, key) => {
          session.save(token, p);
          localStorage.setItem("housetasks.vapid", key || "");
          setVapidKey(key || "");
          setPerson(p);
        }}
      />
    );
  }
  return <Home person={person} vapidKey={vapidKey} onSignOut={() => { session.clear(); setPerson(null); }} />;
}

// ---------- joining ----------

function Join({ onJoined }) {
  const [code, setCode] = useState(joinCodeFromUrl());
  const [house, setHouse] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (c) => {
    setError("");
    setBusy(true);
    try {
      setHouse(await api.household(c));
    } catch (e) {
      setError("Couldn't find that house. Check the code or the link.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (code) load(code);
  }, [code, load]);

  async function pick(personId) {
    setBusy(true);
    try {
      const res = await api.join(code, personId);
      onJoined({ id: res.personId, name: res.name }, res.token, res.vapidPublicKey);
    } catch (e) {
      setError(e.message);
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
          <div className="inline">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="e.g. burlington7"
              aria-label="House code"
            />
            <button className="btn" onClick={() => load(code)} disabled={!code || busy}>
              Continue
            </button>
          </div>
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
                That's me
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

function Home({ person, vapidKey, onSignOut }) {
  const [tab, setTab] = useState("week");
  const [isAdmin, setIsAdmin] = useState(false);

  // The Setup tab only appears for admins, and the server rechecks every call.
  useEffect(() => {
    api.amIAdmin().then((r) => setIsAdmin(!!r.isAdmin)).catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="wrap">
      <header className="top">
        <h1>Hi {person.name}</h1>
        <p>Your tasks rotate every Monday.</p>
      </header>

      <div className="tabs" role="tablist">
        {[
          ["week", "This week"],
          ["rotation", "Rotation"],
          ["stats", "Progress"],
          ...(isAdmin ? [["setup", "Setup"]] : []),
          ["settings", "Settings"],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "week" && <ThisWeek person={person} />}
      {tab === "rotation" && <RotationTable />}
      {tab === "stats" && <Stats />}
      {tab === "setup" && isAdmin && <Admin />}
      {tab === "settings" && (
        <Settings person={person} vapidKey={vapidKey} onSignOut={onSignOut} />
      )}
    </div>
  );
}

function ThisWeek({ person }) {
  const [week, setWeek] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setWeek(await api.currentWeek());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(task) {
    // Optimistic: flip it locally, then reconcile with the server.
    setWeek((w) => ({
      ...w,
      tasks: w.tasks.map((t) => (t.taskId === task.taskId ? { ...t, done: !t.done } : t)),
    }));
    try {
      if (task.done) await api.unmarkDone(week.weekIndex, task.taskId);
      else await api.markDone(week.weekIndex, task.taskId);
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  if (error) return <p className="warn">{error}</p>;
  if (!week) return <p className="muted">Loading…</p>;

  const mine = week.tasks.find((t) => t.peopleIds.includes(person.id));
  const resting = week.resting.includes(person.name);

  const weekLabel = new Date(`${week.weekStart}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
            <h2 className="hero-title">You're off this week</h2>
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
          <span className="muted">{doneCount} of {week.tasks.length} done</span>
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
              <div className="who">{t.people.length ? t.people.join(", ") : <span className="warn">Nobody yet</span>}</div>
              <div className="what">
                <strong>{t.taskName}</strong>
                {t.loadLevel && <span className={`chip chip-${t.loadLevel.toLowerCase()}`}>{t.loadLevel}</span>}
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
    </>
  );
}

function RotationTable() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.weeks(undefined, 8).then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const taskNames = data.weeks[0].tasks.map((t) => t.taskName);

  return (
    <div className="panel">
      <h3>Next {data.weeks.length} weeks</h3>
      <p className="muted">
        The rotation repeats every {data.cycleLength} weeks, so it never runs out.
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              {taskNames.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th>Off</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.weekIndex} className={w.weekIndex === data.currentWeek ? "now" : ""}>
                <td>
                  <strong>
                    {new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </strong>
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

function Settings({ person, vapidKey, onSignOut }) {
  const [state, setState] = useState(permission());
  const [message, setMessage] = useState("");
  const needsHomeScreen = isIos() && !isStandalone();

  async function enable() {
    setMessage("");
    try {
      await enableNotifications(vapidKey);
      setState("granted");
      setMessage("Notifications are on. You'll get a nudge every Monday morning.");
    } catch (e) {
      setMessage(e.message);
    }
  }

  async function test() {
    setMessage("");
    try {
      await api.testPush();
      setMessage("Test sent. It should arrive in a few seconds.");
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <>
      <div className="panel">
        <h3>Monday notifications</h3>
        {!pushSupported() && <p className="muted">This browser can't do notifications.</p>}

        {needsHomeScreen && (
          <>
            <p className="muted">On iPhone, notifications only work once this is on your Home Screen:</p>
            <ol className="steps">
              <li>Tap the Share button in Safari.</li>
              <li>Tap <strong>Add to Home Screen</strong>, then Add.</li>
              <li>Open House Tasks from your Home Screen and come back here.</li>
            </ol>
          </>
        )}

        {!needsHomeScreen && pushSupported() && (
          <div className="inline">
            {state !== "granted" ? (
              <button className="btn" onClick={enable}>Enable notifications</button>
            ) : (
              <button className="btn ghost" onClick={test}>Send me a test</button>
            )}
          </div>
        )}
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="panel">
        <h3>You</h3>
        <p className="muted">Signed in as {person.name} on this device.</p>
        <button className="btn ghost" onClick={onSignOut}>Not you? Switch person</button>
      </div>
    </>
  );
}
