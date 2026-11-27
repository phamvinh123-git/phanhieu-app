import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api-helpers";
import { ensureDueReminders, listNotifications } from "@/lib/notifications";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  await ensureDueReminders(session);
  return NextResponse.json(await listNotifications(session));
}
