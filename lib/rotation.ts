import type { Person, Swap, Task } from "./types";

/**
 * The core of the whole app, deliberately pure: no database, no framework, no clock.
 * Assignments are never stored. They are computed from the week index, each person's
 * position, and the task sequence, so adding or removing a person never needs a backfill.
 *
 * The rule: slot = (position + weekIndex) mod slotCount, walking down the task sequence.
 * When there are more people than tasks, the extra slots are rest weeks.
 *
 * Ported line for line from Rotation.java; rotation.test.ts carries over its tests.
 */

type P = Pick<Person, "id" | "ownedTaskId">;
type T = Pick<Task, "id">;
type S = Pick<Swap, "weekIndex" | "personAId" | "personBId">;

/** personId → taskId, or null for a rest week. People missing from the map have nothing. */
export type Assignments = Map<number, number | null>;

const floorMod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Who does what in a given week.
 * @param people ordered by position
 * @param tasks  ordered by sequenceOrder
 * @param swaps  swaps for this week (others are ignored)
 */
export function assignments(people: P[], tasks: T[], weekIndex: number, swaps: S[]): Assignments {
  const result: Assignments = new Map();
  const taskIds = new Set(tasks.map((t) => t.id));

  // 1. People who always do the same task keep it and leave the rotation.
  const owned = new Set<number>();
  for (const p of people) {
    if (p.ownedTaskId != null && taskIds.has(p.ownedTaskId) && !owned.has(p.ownedTaskId)) {
      result.set(p.id, p.ownedTaskId);
      owned.add(p.ownedTaskId);
    }
  }

  // 2. Everyone else rotates through the remaining tasks, in sequence order.
  const rotating = people.filter((p) => !result.has(p.id));
  const slots: (number | null)[] = tasks.filter((t) => !owned.has(t.id)).map((t) => t.id);

  const slotCount = Math.max(rotating.length, slots.length);
  if (slotCount > 0) {
    while (slots.length < slotCount) slots.push(null); // rest weeks
    const shift = floorMod(weekIndex, slotCount);
    rotating.forEach((p, i) => result.set(p.id, slots[(i + shift) % slotCount]));
  }

  // 3. A swap exchanges two people's whole assignment for this week, rest weeks included.
  for (const s of swaps) {
    if (s.weekIndex !== weekIndex) continue;
    if (!result.has(s.personAId) || !result.has(s.personBId)) continue;
    const a = result.get(s.personAId)!;
    result.set(s.personAId, result.get(s.personBId)!);
    result.set(s.personBId, a);
  }
  return result;
}

/** Tasks nobody is doing this week: usually a sign the house has fewer people than tasks. */
export function unassignedTasks(tasks: T[], a: Assignments): number[] {
  const taken = new Set(a.values());
  return tasks.filter((t) => !taken.has(t.id)).map((t) => t.id);
}

/** How many weeks before the rotation repeats. */
export function cycleLength(people: P[], tasks: T[]): number {
  const owned = new Set(people.filter((p) => p.ownedTaskId != null).map((p) => p.ownedTaskId));
  const rotatingPeople = people.filter((p) => p.ownedTaskId == null).length;
  const rotatingTasks = tasks.filter((t) => !owned.has(t.id)).length;
  return Math.max(rotatingPeople, rotatingTasks);
}

/** Rotating people minus tasks nobody owns: how many people rest each week. */
export function restSlots(people: P[], tasks: T[]): number {
  const rotatingPeople = people.filter((p) => p.ownedTaskId == null).length;
  const unownedTasks = tasks.filter((t) => !people.some((p) => p.ownedTaskId === t.id)).length;
  return Math.max(0, rotatingPeople - unownedTasks);
}
