import { query } from "./db";
import type { Completion, Household, Person, Swap, Task } from "./types";

/** Plain SQL, one function per question the app asks. Columns are aliased to camelCase. */

const HOUSEHOLD = `id, name, join_code as "joinCode", timezone,
  week_start_date as "weekStartDate", created_at as "createdAt"`;
const TASK = `id, household_id as "householdId", name, covers, load_level as "loadLevel",
  sequence_order as "sequenceOrder"`;
const PERSON = `id, household_id as "householdId", name, position,
  owned_task_id as "ownedTaskId", notify_weekly as "notifyWeekly", is_admin as "isAdmin"`;
const SWAP = `id, household_id as "householdId", week_index as "weekIndex",
  person_a_id as "personAId", person_b_id as "personBId"`;
const COMPLETION = `id, household_id as "householdId", week_index as "weekIndex",
  task_id as "taskId", person_id as "personId", completed_at as "completedAt"`;

export { HOUSEHOLD as HOUSEHOLD_COLUMNS, PERSON as PERSON_COLUMNS, TASK as TASK_COLUMNS };

export async function householdByCode(code: string): Promise<Household | null> {
  const rows = await query<Household>(`select ${HOUSEHOLD} from household where join_code = $1`, [code]);
  return rows[0] ?? null;
}

export async function householdById(id: number): Promise<Household | null> {
  const rows = await query<Household>(`select ${HOUSEHOLD} from household where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function allHouseholds(): Promise<Household[]> {
  return query<Household>(`select ${HOUSEHOLD} from household order by id`);
}

export async function peopleOf(householdId: number): Promise<Person[]> {
  return query<Person>(
    `select ${PERSON} from person where household_id = $1 order by position, id`,
    [householdId]
  );
}

export async function tasksOf(householdId: number): Promise<Task[]> {
  return query<Task>(
    `select ${TASK} from task where household_id = $1 order by sequence_order, id`,
    [householdId]
  );
}

export async function personInHousehold(householdId: number, id: number): Promise<Person | null> {
  const rows = await query<Person>(
    `select ${PERSON} from person where id = $1 and household_id = $2`,
    [id, householdId]
  );
  return rows[0] ?? null;
}

export async function taskInHousehold(householdId: number, id: number): Promise<Task | null> {
  const rows = await query<Task>(
    `select ${TASK} from task where id = $1 and household_id = $2`,
    [id, householdId]
  );
  return rows[0] ?? null;
}

export async function swapsBetween(householdId: number, from: number, to: number): Promise<Swap[]> {
  return query<Swap>(
    `select ${SWAP} from swap where household_id = $1 and week_index between $2 and $3 order by id`,
    [householdId, from, to]
  );
}

export async function completionsBetween(
  householdId: number,
  from: number,
  to: number
): Promise<Completion[]> {
  return query<Completion>(
    `select ${COMPLETION} from completion
     where household_id = $1 and week_index between $2 and $3`,
    [householdId, from, to]
  );
}
