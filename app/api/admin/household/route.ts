import { query } from "@/lib/db";
import { mondayOf, isIsoDate } from "@/lib/dates";
import { badRequest, json, readJson, requireAdmin, route } from "@/lib/http";
import { HOUSEHOLD_COLUMNS } from "@/lib/repo";
import type { Household } from "@/lib/types";

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const POST = route(async (req) => {
  const { household: h } = await requireAdmin(req);
  const body = await readJson<{ name: string; timezone: string; weekStartDate: string }>(req);

  const name = body.name?.trim() || h.name;
  const timezone = body.timezone?.trim() || h.timezone;
  if (!validTimezone(timezone)) throw badRequest("Unknown timezone");

  let weekStartDate = h.weekStartDate;
  if (body.weekStartDate) {
    if (!isIsoDate(body.weekStartDate)) throw badRequest("Use a date like 2026-09-21");
    // Always snapped to a Monday so week indexing stays predictable.
    weekStartDate = mondayOf(body.weekStartDate);
  }

  const rows = await query<Household>(
    `update household set name = $2, timezone = $3, week_start_date = $4
     where id = $1 returning ${HOUSEHOLD_COLUMNS}`,
    [h.id, name, timezone, weekStartDate]
  );
  return json(rows[0]);
});
