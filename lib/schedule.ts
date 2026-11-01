import { addWeeks, mondayOf, todayIn, weekIndex } from "./dates";
import { completionsBetween, peopleOf, swapsBetween, tasksOf } from "./repo";
import { assignments, cycleLength, unassignedTasks } from "./rotation";
import type { Household, Person, Stats, Swap, Task, WeekView } from "./types";

/**
 * Feeds the database into the pure rotation and shapes API responses
 * (RotationService.java in the old version). Ranges are loaded with one query per table
 * rather than one per week, which matters more now that every request is a fresh function.
 */

export function currentWeekIndex(h: Household, now: Date = new Date()): number {
  return weekIndex(h.weekStartDate, todayIn(h.timezone, now));
}

export function weekStart(h: Household, index: number): string {
  return addWeeks(mondayOf(h.weekStartDate), index);
}

function buildWeek(
  h: Household,
  people: Person[],
  tasks: Task[],
  index: number,
  swaps: Swap[],
  doneTaskIds: Set<number>
): WeekView {
  const map = assignments(people, tasks, index, swaps);

  const lines = tasks.map((t) => {
    const who = people.filter((p) => map.get(p.id) === t.id);
    return {
      taskId: t.id,
      taskName: t.name,
      covers: t.covers,
      loadLevel: t.loadLevel,
      people: who.map((p) => p.name),
      peopleIds: who.map((p) => p.id),
      done: doneTaskIds.has(t.id),
    };
  });

  const resting = people.filter((p) => map.has(p.id) && map.get(p.id) === null).map((p) => p.name);
  const unassigned = unassignedTasks(tasks, map)
    .map((id) => tasks.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n);

  return { weekIndex: index, weekStart: weekStart(h, index), tasks: lines, resting, unassigned };
}

/** Weeks from..to inclusive, with everything loaded up front. */
export async function loadWeeks(h: Household, from: number, to: number): Promise<WeekView[]> {
  const [people, tasks, swaps, completions] = await Promise.all([
    peopleOf(h.id),
    tasksOf(h.id),
    swapsBetween(h.id, from, to),
    completionsBetween(h.id, from, to),
  ]);
  const out: WeekView[] = [];
  for (let w = from; w <= to; w++) {
    const done = new Set(completions.filter((c) => c.weekIndex === w).map((c) => c.taskId));
    out.push(buildWeek(h, people, tasks, w, swaps.filter((s) => s.weekIndex === w), done));
  }
  return out;
}

export async function loadWeek(h: Household, index: number): Promise<WeekView> {
  return (await loadWeeks(h, index, index))[0];
}

export async function loadCycleLength(h: Household): Promise<number> {
  const [people, tasks] = await Promise.all([peopleOf(h.id), tasksOf(h.id)]);
  return cycleLength(people, tasks);
}

/**
 * Completion history for the last N weeks (this week included).
 * A task is credited to whoever was assigned it that week, not to whoever tapped Done,
 * so a swap moves the credit with the work.
 */
export async function loadStats(h: Household, weeks: number): Promise<Stats> {
  const current = currentWeekIndex(h);
  const span = Math.max(1, Math.min(weeks, 52));
  // Never count weeks before the rotation started: nobody had tasks yet, and counting
  // them as "assigned, not done" dragged the percentage down for a new house.
  const from = Math.max(current - span + 1, Math.min(0, current));

  const [people, tasks, swaps, completions] = await Promise.all([
    peopleOf(h.id),
    tasksOf(h.id),
    swapsBetween(h.id, from, current),
    completionsBetween(h.id, from, current),
  ]);

  const perPerson = new Map(people.map((p) => [p.id, { assigned: 0, done: 0 }]));
  const weekStats = [];

  for (let w = from; w <= current; w++) {
    const map = assignments(people, tasks, w, swaps.filter((s) => s.weekIndex === w));
    const doneTasks = new Set(completions.filter((c) => c.weekIndex === w).map((c) => c.taskId));
    let assigned = 0;
    let done = 0;
    for (const p of people) {
      const taskId = map.get(p.id);
      if (taskId == null) continue; // rest week, or nothing to do
      assigned++;
      perPerson.get(p.id)!.assigned++;
      if (doneTasks.has(taskId)) {
        done++;
        perPerson.get(p.id)!.done++;
      }
    }
    weekStats.push({ weekIndex: w, weekStart: weekStart(h, w), assigned, done });
  }

  return {
    fromWeek: from,
    toWeek: current,
    people: people.map((p) => ({ personId: p.id, name: p.name, ...perPerson.get(p.id)! })),
    weeks: weekStats,
  };
}

/** What to tell one person in the Monday push, or null when they should get nothing. */
export function notificationFor(
  person: Person,
  people: Person[],
  tasks: Task[],
  index: number,
  swaps: Swap[]
): string | null {
  const map = assignments(people, tasks, index, swaps);
  if (!map.has(person.id)) return null;
  const taskId = map.get(person.id);
  if (taskId === null) return "You are off this week. Enjoy it.";
  const task = tasks.find((t) => t.id === taskId);
  return task ? `Your task this week: ${task.name}. Any time before Sunday 9pm.` : null;
}
