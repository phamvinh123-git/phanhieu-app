import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { desc, inArray, sql } from "drizzle-orm";
import { visibleMeetingIds } from "@/lib/meeting-scope";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "view")) return jsonError("Không có quyền", 403);

  const visible = await visibleMeetingIds(session);
  if (visible !== null && visible.length === 0) return NextResponse.json({ meetings: [] });
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      content: meetings.content,
      status: meetings.status,
      createdBy: meetings.createdBy,
      createdAt: meetings.createdAt,
      fileCount: sql<number>`(select count(*)::int from "meeting_files" mf where mf."meeting_id" = "meetings"."id")`,
    })
    .from(meetings)
    .where(visible === null ? undefined : inArray(meetings.id, visible))
    .orderBy(desc(meetings.meetingDate));
  return NextResponse.json({ meetings: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create")) return jsonError("Không có quyền", 403);

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.meetingDate) return jsonError("Thiếu tiêu đề hoặc ngày họp");

  const [row] = await db
    .insert(meetings)
    .values({
      title: body.title,
      meetingDate: new Date(body.meetingDate),
      content: body.content ?? null,
      status: "draft",
      createdBy: session.userId,
    })
    .returning();

  await audit(session, "meeting.create", `Tạo biên bản họp "${row.title}"`, { entityId: row.id });
  return NextResponse.json({ meeting: row }, { status: 201 });
}
