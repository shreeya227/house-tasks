/**
 * Rows as the API returns them. Field names match the old Spring Boot JSON exactly,
 * so the screens did not have to change.
 */

export interface Household {
  id: number;
  name: string;
  joinCode: string;
  timezone: string;
  /** "YYYY-MM-DD". The Monday the rotation starts; week index 0 is that week. */
  weekStartDate: string;
  createdAt: string;
}

export interface Task {
  id: number;
  householdId: number;
  name: string;
  covers: string;
  /** Heavy, Medium or Light. Display only, plus a hint when ordering tasks. */
  loadLevel: string;
  /** Position in the weekly sequence. Everyone walks down this order. */
  sequenceOrder: number;
}

export interface Person {
  id: number;
  householdId: number;
  name: string;
  /** Starting offset in the rotation. */
  position: number;
  /** Set when this person always does the same task and skips the rotation. */
  ownedTaskId: number | null;
  notifyWeekly: boolean;
  /** Admins can add or remove people and tasks. Everyone else is read-only. */
  isAdmin: boolean;
}

export interface Swap {
  id: number;
  householdId: number;
  weekIndex: number;
  personAId: number;
  personBId: number;
}

export interface Completion {
  id: number;
  householdId: number;
  weekIndex: number;
  taskId: number;
  personId: number | null;
  completedAt: string;
}

export interface TaskLine {
  taskId: number;
  taskName: string;
  covers: string;
  loadLevel: string;
  people: string[];
  peopleIds: number[];
  done: boolean;
}

export interface WeekView {
  weekIndex: number;
  weekStart: string;
  tasks: TaskLine[];
  resting: string[];
  unassigned: string[];
}

export interface RotationTable {
  currentWeek: number;
  cycleLength: number;
  weeks: WeekView[];
}

export interface PersonStat {
  personId: number;
  name: string;
  assigned: number;
  done: number;
}

export interface WeekStat {
  weekIndex: number;
  weekStart: string;
  assigned: number;
  done: number;
}

export interface Stats {
  fromWeek: number;
  toWeek: number;
  people: PersonStat[];
  weeks: WeekStat[];
}

export interface Setup {
  household: Household;
  people: Person[];
  tasks: Task[];
  cycleLength: number;
  restSlots: number;
}

export interface HouseholdSummary {
  name: string;
  joinCode: string;
  people: { id: number; name: string; notifyWeekly: boolean }[];
}

export interface JoinResponse {
  personId: number;
  name: string;
  token: string;
  vapidPublicKey: string;
}
