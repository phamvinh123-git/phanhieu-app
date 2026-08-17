import { NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const depts = await db.select().from(departments);
  return NextResponse.json({ departments: depts });
}
