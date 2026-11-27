import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { meetings, taskDepartments, tasks } from "@/db/schema";
import type { SessionPayload } from "./auth";
import { resolveScope } from "./permissions";

/**
 * Phạm vi xem biên bản họp: Ban Giám đốc / Thư ký / Quản trị xem tất cả;
 * Trưởng phòng chỉ xem các cuộc họp có nhiệm vụ giao cho (các) Phòng của mình.
 * Trả về null = xem tất cả; mảng = danh sách id cuộc họp được xem.
 */
export async function visibleMeetingIds(session: SessionPayload): Promise<number[] | null> {
  const scope = resolveScope(session, "meetings", "view");
  if (!scope.allowed) return [];
  if (scope.all) return null;
  if (scope.departmentIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ meetingId: tasks.meetingId })
    .from(tasks)
    .innerJoin(taskDepartments, eq(taskDepartments.taskId, tasks.id))
    .where(and(inArray(taskDepartments.departmentId, scope.departmentIds), sql`${tasks.meetingId} is not null`));
  return rows.map((r) => r.meetingId!).filter((x) => x != null);
}

export async function canViewMeeting(session: SessionPayload, meetingId: number): Promise<boolean> {
  const ids = await visibleMeetingIds(session);
  if (ids === null) {
    const [m] = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, meetingId));
    return Boolean(m);
  }
  return ids.includes(meetingId);
}
