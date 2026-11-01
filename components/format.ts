export const COLORS = ["#8FC9AE", "#F2C14E", "#8DB3E2", "#EFA08C", "#BFA7E0", "#93D3DC"];

/** "2026-09-21" → "Sep 21", read as a local calendar date (never shifted by timezone). */
export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
