const TOKEN_KEY = "housetasks.token";
const PERSON_KEY = "housetasks.person";

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  },
  get person() {
    try {
      return JSON.parse(localStorage.getItem(PERSON_KEY) || "null");
    } catch {
      return null;
    }
  },
  save(token, person) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PERSON_KEY, JSON.stringify(person));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSON_KEY);
  },
};

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = session.token;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    session.clear();
    throw new Error("Your sign-in expired. Pick your name again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  household: (code) => request(`/households/${encodeURIComponent(code)}`, { auth: false }),
  join: (code, personId) =>
    request(`/households/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: { personId },
      auth: false,
    }),
  currentWeek: () => request("/weeks/current"),
  week: (index) => request(`/weeks/${index}`),
  weeks: (from, count = 8) =>
    request(`/weeks?count=${count}${from === undefined ? "" : `&from=${from}`}`),
  markDone: (week, taskId) => request(`/weeks/${week}/tasks/${taskId}/done`, { method: "POST" }),
  unmarkDone: (week, taskId) => request(`/weeks/${week}/tasks/${taskId}/done`, { method: "DELETE" }),
  swap: (week, personAId, personBId) =>
    request(`/weeks/${week}/swaps`, { method: "POST", body: { personAId, personBId } }),
  subscribePush: (sub) => request("/push/subscribe", { method: "POST", body: sub }),
  testPush: () => request("/push/test", { method: "POST" }),
  stats: (weeks = 8) => request(`/stats?weeks=${weeks}`),

  // Admin only. Every one of these returns 403 for a normal housemate.
  amIAdmin: () => request("/admin/me"),
  setup: () => request("/admin/setup"),
  addPerson: (name) => request("/admin/people", { method: "POST", body: { name } }),
  updatePerson: (id, body) => request(`/admin/people/${id}`, { method: "POST", body }),
  removePerson: (id) => request(`/admin/people/${id}`, { method: "DELETE" }),
  movePerson: (id, delta) => request(`/admin/people/${id}/move?delta=${delta}`, { method: "POST" }),
  addTask: () => request("/admin/tasks", { method: "POST", body: { name: "New task" } }),
  updateTask: (id, body) => request(`/admin/tasks/${id}`, { method: "POST", body }),
  removeTask: (id) => request(`/admin/tasks/${id}`, { method: "DELETE" }),
  moveTask: (id, delta) => request(`/admin/tasks/${id}/move?delta=${delta}`, { method: "POST" }),
  updateHousehold: (body) => request("/admin/household", { method: "POST", body }),
};
