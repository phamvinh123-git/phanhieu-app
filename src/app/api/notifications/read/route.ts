import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { markRead } from "@/lib/notifications";

/** Đánh dấu đã đọc: body { ids: number[] } hoặc { all: true } */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const body = await req.json().catch(() => null);
  if (body?.all === true) await markRead(session, "all");
  else if (Array.isArray(body?.ids) && body.ids.length) await markRead(session, body.ids.map(Number));
  else return jsonError("Thiếu danh sách thông báo");
  return NextResponse.json({ ok: true });
}
