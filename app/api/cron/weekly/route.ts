import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { allHouseholds } from "@/lib/repo";
import { notifyHousehold, type WeeklyResult } from "@/lib/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by Vercel Cron (see vercel.json) every Monday. Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; anything else is turned away, so a housemate
 * who finds this URL can't spam the house.
 *
 * Safe to call more than once: weekly_notification makes each person's message
 * go out at most once per week. That also means any external scheduler can call it as a
 * backup with the same header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse("CRON_SECRET is not set", { status: 500 });
  }
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results: (WeeklyResult | { householdId: number; error: string })[] = [];
  for (const h of await allHouseholds()) {
    try {
      results.push(await notifyHousehold(h));
    } catch (e) {
      console.error(`Weekly notification failed for household ${h.id}`, e);
      results.push({ householdId: h.id, error: (e as Error).message });
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
