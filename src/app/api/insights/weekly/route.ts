import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api-helpers";
import { weeklySummary } from "@/lib/insights";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  return NextResponse.json(await weeklySummary(session));
}
