import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create")) return jsonError("Không có quyền", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.status || !["draft", "reviewed"].includes(body.status)) {
    return jsonError("Trạng thái không hợp lệ");
  }

  const [row] = await db
    .update(meetings)
    .set({ status: body.status })
    .where(eq(meetings.id, Number(id)))
    .returning();

  if (!row) return jsonError("Không tìm thấy biên bản họp", 404);
  await audit(session, "meeting.status", `Biên bản "${row.title}" chuyển sang ${row.status === "reviewed" ? "đã duyệt" : "bản nháp"}`, {
    entityId: row.id,
  });
  return NextResponse.json({ meeting: row });
}
