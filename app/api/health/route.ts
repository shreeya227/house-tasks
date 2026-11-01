import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Is the app up and can it reach the database? */
export async function GET() {
  try {
    await query("select 1");
    return NextResponse.json({ ok: true, database: "up" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, database: "down" }, { status: 503 });
  }
}
