"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import type { Setup } from "@/lib/types";

const LOADS = ["Heavy", "Medium", "Light"];

/**
 * Household setup: add and remove people, edit and reorder tasks.
 * Only rendered for admins, and every call is checked server-side too, so a
 * housemate can't reach it by poking at the URL.
 */
export default function Admin() {
  const [data, setData] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.setup());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      // Show the problem, then reload so the screen matches the server again.
      alert(errorMessage(e));
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { people, tasks, household, cycleLength, restSlots } = data;
  const ownedIds = people.map((p) => p.ownedTaskId).filter((id): id is number => id != null);

  return (
    <>
      <div className="panel">
        <h3>People</h3>
        <p className="muted">
          The order sets who starts where. Anyone set to &quot;Always does&quot; keeps that task every
          week and leaves the rotation, rest weeks included.
        </p>

        {people.map((p, i) => (
          <div className="row" key={p.id}>
            <span className="swatch" />
            <div>
              <input
                type="text"
                defaultValue={p.name}
                aria-label="Name"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== p.name) run(() => api.updatePerson(p.id, { name, ownedTaskId: p.ownedTaskId }));
                }}
              />
              <div className="inline" style={{ marginTop: 6 }}>
                <select
                  value={p.ownedTaskId ?? ""}
                  aria-label={`Task choice for ${p.name}`}
                  onChange={(e) =>
                    run(() =>
                      api.updatePerson(p.id, {
                        ownedTaskId: e.target.value ? Number(e.target.value) : null,
                      })
                    )
                  }
                >
                  <option value="">Rotates</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id} disabled={ownedIds.includes(t.id) && p.ownedTaskId !== t.id}>
                      Always does {t.name}
                    </option>
                  ))}
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={p.notifyWeekly}
                    onChange={(e) =>
                      run(() =>
                        api.updatePerson(p.id, { notifyWeekly: e.target.checked, ownedTaskId: p.ownedTaskId })
                      )
                    }
                  />
                  Monday nudge
                </label>
              </div>
            </div>
            <div className="inline">
              <button
                className="btn ghost"
                disabled={i === 0 || busy}
                onClick={() => run(() => api.movePerson(p.id, -1))}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="btn ghost"
                disabled={i === people.length - 1 || busy}
                onClick={() => run(() => api.movePerson(p.id, 1))}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => confirm(`Remove ${p.name} from the house?`) && run(() => api.removePerson(p.id))}
                aria-label={`Remove ${p.name}`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <form
          className="inline"
          style={{ marginTop: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (newName.trim() && (await run(() => api.addPerson(newName.trim())))) setNewName("");
          }}
        >
          <input
            type="text"
            value={newName}
            placeholder="Name"
            aria-label="New person's name"
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!newName.trim() || busy}>
            Add person
          </button>
        </form>

        <p className="muted" style={{ marginTop: 12 }}>
          {restSlots > 0
            ? `${restSlots} ${restSlots > 1 ? "people get" : "person gets"} a rest week each week. The rotation repeats every ${cycleLength} weeks.`
            : "Nobody gets a rest week with this setup. Remove a task if you want one."}
        </p>
      </div>

      <div className="panel">
        <h3>Tasks</h3>
        <p className="muted">
          This is the weekly order: everyone works down this list, one task a week. Keep the heavy
          task next to a light one, and the two bathrooms apart, so nobody gets two hard weeks in a
          row.
        </p>

        {tasks.map((t, i) => (
          <div className="row" key={t.id}>
            <span className="swatch" />
            <div>
              <input
                type="text"
                defaultValue={t.name}
                aria-label="Task name"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== t.name) run(() => api.updateTask(t.id, { name }));
                }}
              />
              <input
                type="text"
                defaultValue={t.covers}
                aria-label="What it covers"
                style={{ marginTop: 6, width: "100%" }}
                onBlur={(e) => e.target.value !== t.covers && run(() => api.updateTask(t.id, { covers: e.target.value }))}
              />
              <select
                value={t.loadLevel}
                aria-label="How heavy"
                style={{ marginTop: 6 }}
                onChange={(e) => run(() => api.updateTask(t.id, { loadLevel: e.target.value }))}
              >
                {LOADS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline">
              <button
                className="btn ghost"
                disabled={i === 0 || busy}
                onClick={() => run(() => api.moveTask(t.id, -1))}
                aria-label="Move earlier"
              >
                ↑
              </button>
              <button
                className="btn ghost"
                disabled={i === tasks.length - 1 || busy}
                onClick={() => run(() => api.moveTask(t.id, 1))}
                aria-label="Move later"
              >
                ↓
              </button>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => confirm(`Remove "${t.name}"?`) && run(() => api.removeTask(t.id))}
                aria-label={`Remove ${t.name}`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <button className="btn ghost" style={{ marginTop: 12 }} disabled={busy} onClick={() => run(() => api.addTask())}>
          Add task
        </button>
      </div>

      <div className="panel">
        <h3>House</h3>
        <label className="muted" style={{ display: "block", marginBottom: 8 }}>
          Rotation started (snapped to that Monday)
          <input
            type="date"
            key={household.weekStartDate}
            defaultValue={household.weekStartDate}
            style={{ display: "block", marginTop: 4 }}
            onChange={(e) => e.target.value && run(() => api.updateHousehold({ weekStartDate: e.target.value }))}
          />
        </label>
        <p className="muted">
          Join code <strong>{household.joinCode}</strong>. Share the link as{" "}
          <code>?house={household.joinCode}</code>. Changing people, tasks or the start date
          reshuffles every week, past ones included. Done ticks stay with their task.
        </p>
      </div>
    </>
  );
}
