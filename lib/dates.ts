/**
 * Calendar dates as plain "YYYY-MM-DD" strings, with all arithmetic done in UTC so the
 * server's own timezone (UTC on Vercel) can never shift a day. Only "what is today?" needs
 * a real timezone, and that comes from the household.
 */

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Not a date: ${iso}`);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtcMs(s));
}

/** Monday of the week containing the date. */
export function mondayOf(iso: string): string {
  const ms = toUtcMs(iso);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7; // days since Monday
  return fromUtcMs(ms - back * DAY_MS);
}

export function addWeeks(iso: string, weeks: number): string {
  return fromUtcMs(toUtcMs(iso) + weeks * 7 * DAY_MS);
}

/** Week index of a date relative to the rotation start. Negative before the start. */
export function weekIndex(startMonday: string, date: string): number {
  const days = Math.round((toUtcMs(mondayOf(date)) - toUtcMs(mondayOf(startMonday))) / DAY_MS);
  return Math.floor(days / 7);
}

/** Today's date in the given IANA timezone, e.g. "America/New_York". */
export function todayIn(timezone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
