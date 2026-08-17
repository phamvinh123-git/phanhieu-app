import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "view")) return jsonError("Không có quyền", 403);

  const rows = await db.select().from(meetings).orderBy(desc(meetings.meetingDate));
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

  return NextResponse.json({ meeting: row }, { status: 201 });
}
