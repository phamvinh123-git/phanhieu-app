import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { extractTasksFromMinutes } from "@/lib/extract-tasks";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create")) return jsonError("Không có quyền", 403);

  const body = await req.json().catch(() => null);
  const content = body?.content?.toString() ?? "";
  if (!content.trim()) return jsonError("Nội dung biên bản đang trống");

  const depts = await db.select().from(departments);
  const result = extractTasksFromMinutes(content, depts);

  return NextResponse.json(result);
}
