import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api-helpers";
import { meetingProgressMap } from "@/lib/insights";

/** Tiến độ thực hiện kết luận của từng cuộc họp (trong phạm vi người xem). */
export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  return NextResponse.json({ progress: await meetingProgressMap(session) });
}
