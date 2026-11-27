import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { canViewMeeting } from "@/lib/meeting-scope";
import { meetingReport } from "@/lib/insights";

/** Báo cáo thực hiện kết luận một cuộc họp, chia theo Phòng chủ trì. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "view")) return jsonError("Không có quyền", 403);
  const { id } = await params;
  if (!(await canViewMeeting(session, Number(id)))) return jsonError("Không có quyền", 403);
  const report = await meetingReport(session, Number(id));
  if (!report) return jsonError("Không tìm thấy biên bản họp", 404);
  return NextResponse.json(report);
}
