import type {
  Household,
  HouseholdSummary,
  JoinResponse,
  Person,
  RotationTable,
  Setup,
  Stats,
  Task,
  WeekView,
} from "../types";

/** Browser-side fetch wrapper. The API lives on the same origin, so no CORS anywhere. */

const TOKEN_KEY = "housetasks.token";
const PERSON_KEY = "housetasks.person";
const VAPID_KEY = "housetasks.vapid";

export interface Me {
  id: number;
  name: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the app still works until the tab closes.
  }
}

export const session = {
  get token(): string {
    return read(TOKEN_KEY) || "";
  },
  get person(): Me | null {
    try {
      return JSON.parse(read(PERSON_KEY) || "null");
    } catch {
      return null;
    }
  },
  get vapidKey(): string {
    return read(VAPID_KEY) || "";
  },
  save(token: string, person: Me, vapidKey: string) {
    write(TOKEN_KEY, token);
    write(PERSON_KEY, JSON.stringify(person));
    write(VAPID_KEY, vapidKey);
  },
  clear() {
    write(TOKEN_KEY, null);
    write(PERSON_KEY, null);
  },
};

/** Fired when the server says the sign-in is no longer valid, so the app can go back to Join. */
export const SIGNED_OUT_EVENT = "housetasks:signed-out";

async function request<T>(
  path: string,
  { method = "GET", body, auth = true }: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = session.token;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    session.clear();
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    throw new Error("Your sign-in expired. Pick your name again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  // Some replies have no body (204, or an empty 201). Safari throws "The string did not
  // match the expected pattern" if you call res.json() on those, so only parse real bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

type PersonUpdate = Partial<Pick<Person, "name" | "notifyWeekly" | "isAdmin">> & {
  ownedTaskId?: number | null;
};
type TaskUpdate = Partial<Pick<Task, "name" | "covers" | "loadLevel">>;

export const api = {
  household: (code: string) =>
    request<HouseholdSummary>(`/households/${encodeURIComponent(code)}`, { auth: false }),
  join: (code: string, personId: number) =>
    request<JoinResponse>(`/households/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: { personId },
      auth: false,
    }),
  currentWeek: () => request<WeekView>("/weeks/current"),
  week: (index: number) => request<WeekView>(`/weeks/${index}`),
  weeks: (from?: number, count = 8) =>
    request<RotationTable>(`/weeks?count=${count}${from === undefined ? "" : `&from=${from}`}`),
  markDone: (week: number, taskId: number) =>
    request<null>(`/weeks/${week}/tasks/${taskId}/done`, { method: "POST" }),
  unmarkDone: (week: number, taskId: number) =>
    request<null>(`/weeks/${week}/tasks/${taskId}/done`, { method: "DELETE" }),
  swap: (week: number, personAId: number, personBId: number) =>
    request<{ id: number }>(`/weeks/${week}/swaps`, { method: "POST", body: { personAId, personBId } }),
  subscribePush: (sub: { endpoint: string; p256dh: string; auth: string }) =>
    request<null>("/push/subscribe", { method: "POST", body: sub }),
  testPush: () => request<{ delivered: number }>("/push/test", { method: "POST" }),
  runWeekly: () => request<{ sent: number; weekIndex: number }>("/push/run-weekly", { method: "POST" }),
  stats: (weeks = 8) => request<Stats>(`/stats?weeks=${weeks}`),

  // Admin only. Every one of these returns 403 for a normal housemate.
  amIAdmin: () => request<{ isAdmin: boolean }>("/admin/me"),
  setup: () => request<Setup>("/admin/setup"),
  addPerson: (name: string) => request<Person>("/admin/people", { method: "POST", body: { name } }),
  updatePerson: (id: number, body: PersonUpdate) =>
    request<Person>(`/admin/people/${id}`, { method: "POST", body }),
  removePerson: (id: number) => request<null>(`/admin/people/${id}`, { method: "DELETE" }),
  movePerson: (id: number, delta: number) =>
    request<Person[]>(`/admin/people/${id}/move?delta=${delta}`, { method: "POST" }),
  addTask: () => request<Task>("/admin/tasks", { method: "POST", body: { name: "New task" } }),
  updateTask: (id: number, body: TaskUpdate) =>
    request<Task>(`/admin/tasks/${id}`, { method: "POST", body }),
  removeTask: (id: number) => request<null>(`/admin/tasks/${id}`, { method: "DELETE" }),
  moveTask: (id: number, delta: number) =>
    request<Task[]>(`/admin/tasks/${id}/move?delta=${delta}`, { method: "POST" }),
  updateHousehold: (body: Partial<Pick<Household, "name" | "timezone" | "weekStartDate">>) =>
    request<Household>("/admin/household", { method: "POST", body }),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
