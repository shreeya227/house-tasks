import React, { useEffect, useState } from "react";
import { api } from "./api.js";

/**
 * Swap two people's assignments for one week: a task, or a rest week.
 * Admin only, because a swap changes someone else's week and needs one person
 * holding the pen. Swapping the same pair again cancels it out.
 */
export default function Swap({ weekIndex, weekLabel, onDone }) {
  const [people, setPeople] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .setup()
      .then((d) => {
        setPeople(d.people);
        if (d.people.length > 1) {
          setA(String(d.people[0].id));
          setB(String(d.people[1].id));
        }
      })
      .catch(() => setPeople([]));
  }, []);

  if (people.length < 2) return null;

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await api.swap(weekIndex, Number(a), Number(b));
      setMessage("Swapped. Both of them will see the change.");
      onDone && onDone();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>Swap for this week</h3>
      <p className="muted">
        Someone away? Trade their whole task (or rest week) with another person, for the week
        of {weekLabel} only. Doing the same swap again undoes it.
      </p>
      <div className="inline">
        <select value={a} onChange={(e) => setA(e.target.value)} aria-label="First person">
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="muted">with</span>
        <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Second person">
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn" onClick={submit} disabled={busy || a === b}>
          {busy ? "Swapping…" : "Swap"}
        </button>
      </div>
      {a === b && <p className="muted">Pick two different people.</p>}
      {message && <p className="muted">{message}</p>}
    </div>
  );
}
