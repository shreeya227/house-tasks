import React, { useEffect, useState } from "react";
import { api } from "./api.js";

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Horizontal bars: how many of each person's tasks got ticked done. */
function PersonBars({ people }) {
  const max = Math.max(1, ...people.map((p) => p.assigned));
  return (
    <div className="bars">
      {people.map((p) => {
        const pct = p.assigned ? Math.round((p.done / p.assigned) * 100) : 0;
        return (
          <div className="bar-row" key={p.personId}>
            <span className="bar-name">{p.name}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${(p.assigned / max) * 100}%` }} />
              <span className="bar-done" style={{ width: `${(p.done / max) * 100}%` }} />
            </span>
            <span className="bar-value">
              {p.done}/{p.assigned}
              {p.assigned > 0 && <span className="muted"> · {pct}%</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Columns: how much of the house's work got done each week. */
function WeekColumns({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.assigned));
  return (
    <div className="cols" role="img" aria-label="Tasks completed per week">
      {weeks.map((w) => {
        const height = (w.assigned / max) * 100;
        const doneHeight = w.assigned ? (w.done / w.assigned) * height : 0;
        return (
          <div className="col" key={w.weekIndex}>
            <div className="col-stack" title={`${w.done} of ${w.assigned} done`}>
              <div className="col-assigned" style={{ height: `${height}%` }} />
              <div className="col-done" style={{ height: `${doneHeight}%` }} />
            </div>
            <span className="col-label">{fmtDate(w.weekStart)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.stats(8).then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const totalAssigned = data.people.reduce((sum, p) => sum + p.assigned, 0);
  const totalDone = data.people.reduce((sum, p) => sum + p.done, 0);
  const rate = totalAssigned ? Math.round((totalDone / totalAssigned) * 100) : 0;

  return (
    <>
      <div className="panel">
        <h3>Last {data.weeks.length} weeks</h3>
        <p className="big-stat">
          {rate}<span className="big-unit">%</span>
        </p>
        <p className="muted">
          {totalDone} of {totalAssigned} tasks ticked done across the house.
        </p>
        <WeekColumns weeks={data.weeks} />
        <p className="muted legend">
          <span className="key key-assigned" /> assigned
          <span className="key key-done" /> done
        </p>
      </div>

      <div className="panel">
        <h3>Per person</h3>
        <p className="muted">
          Credit follows the work: if you swapped, the task counts for whoever actually had it.
        </p>
        <PersonBars people={data.people} />
      </div>
    </>
  );
}
