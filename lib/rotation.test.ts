import { describe, expect, it } from "vitest";
import { addWeeks, mondayOf, todayIn, weekIndex } from "./dates";
import { assignments, cycleLength, restSlots, unassignedTasks } from "./rotation";

/** The rotation is the heart of the app, so it is tested without a database or a clock. */

const person = (id: number, ownedTaskId: number | null = null) => ({ id, ownedTaskId });
const sevenPeople = () => [1, 2, 3, 4, 5, 6, 7].map((id) => person(id));
const sixTasks = () => [100, 101, 102, 103, 104, 105].map((id) => ({ id }));

describe("rotation", () => {
  it("first week gives everyone their starting task", () => {
    const a = assignments(sevenPeople(), sixTasks(), 0, []);
    expect(a.get(1)).toBe(100);
    expect(a.get(6)).toBe(105);
    expect(a.get(7)).toBeNull(); // the seventh person rests in week 0
  });

  it("everyone shifts one task each week", () => {
    const a = assignments(sevenPeople(), sixTasks(), 1, []);
    expect(a.get(1)).toBe(101);
    expect(a.get(6)).toBeNull(); // the rest week moves along too
    expect(a.get(7)).toBe(100);
  });

  it("repeats after one cycle", () => {
    expect(assignments(sevenPeople(), sixTasks(), 7, [])).toEqual(
      assignments(sevenPeople(), sixTasks(), 0, [])
    );
    expect(cycleLength(sevenPeople(), sixTasks())).toBe(7);
  });

  it("handles weeks before the start", () => {
    expect(assignments(sevenPeople(), sixTasks(), -1, [])).toEqual(
      assignments(sevenPeople(), sixTasks(), 6, [])
    );
  });

  it("everyone passes through every task and one rest week", () => {
    for (const p of sevenPeople()) {
      const seen = new Set<number | null | undefined>();
      for (let w = 0; w < 7; w++) seen.add(assignments(sevenPeople(), sixTasks(), w, []).get(p.id));
      expect(seen.size).toBe(7);
      expect(seen.has(null)).toBe(true);
    }
  });

  it("an owned task stays with its owner every week", () => {
    const ps = sevenPeople();
    ps[3].ownedTaskId = 102; // person 4 always does task 102
    for (let w = 0; w < 14; w++) {
      const a = assignments(ps, sixTasks(), w, []);
      expect(a.get(4)).toBe(102);
      expect([...a.values()].filter((v) => v === 102)).toHaveLength(1);
    }
  });

  it("a swap exchanges two people for that week only", () => {
    const s = { weekIndex: 2, personAId: 1, personBId: 7 };
    const before = assignments(sevenPeople(), sixTasks(), 2, []);
    const after = assignments(sevenPeople(), sixTasks(), 2, [s]);
    expect(after.get(1)).toBe(before.get(7));
    expect(after.get(7)).toBe(before.get(1));
    expect(assignments(sevenPeople(), sixTasks(), 3, [s])).toEqual(
      assignments(sevenPeople(), sixTasks(), 3, [])
    );
  });

  it("the same swap twice cancels out", () => {
    const s = { weekIndex: 2, personAId: 1, personBId: 7 };
    expect(assignments(sevenPeople(), sixTasks(), 2, [s, s])).toEqual(
      assignments(sevenPeople(), sixTasks(), 2, [])
    );
  });

  it("fewer people than tasks leaves tasks unassigned", () => {
    const a = assignments([person(1), person(2), person(3)], sixTasks(), 0, []);
    expect(unassignedTasks(sixTasks(), a)).toHaveLength(3);
  });

  it("counts rest slots", () => {
    expect(restSlots(sevenPeople(), sixTasks())).toBe(1);
    const ps = sevenPeople();
    ps[0].ownedTaskId = 100;
    expect(restSlots(ps, sixTasks())).toBe(1);
    expect(restSlots(sevenPeople().slice(0, 5), sixTasks())).toBe(0);
  });
});

describe("dates", () => {
  const start = "2026-09-21"; // a Monday

  it("counts Mondays from the start", () => {
    expect(weekIndex(start, start)).toBe(0);
    expect(weekIndex(start, "2026-09-27")).toBe(0); // that Sunday
    expect(weekIndex(start, "2026-09-28")).toBe(1);
    expect(weekIndex(start, "2026-11-09")).toBe(7); // across the DST change
    expect(weekIndex(start, "2026-09-14")).toBe(-1);
  });

  it("snaps to Monday", () => {
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(mondayOf("2026-01-01")).toBe("2025-12-29");
    expect(addWeeks(start, 7)).toBe("2026-11-09");
  });

  it("uses the household's day, not the server's", () => {
    // 2am UTC on a Monday is still Sunday evening in Boston.
    const now = new Date("2026-09-28T02:00:00Z");
    expect(todayIn("America/New_York", now)).toBe("2026-09-27");
    expect(todayIn("UTC", now)).toBe("2026-09-28");
  });
});
