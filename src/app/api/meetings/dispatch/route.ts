import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments, meetings, tasks, taskDepartments } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { notifyBranchTasksAssigned } from "@/lib/email";

type IncomingTask = {
  title: string;
  departmentIds: number[];
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string | null;
};

/**
 * Tạo biên bản họp VÀ toàn bộ nhiệm vụ cấp Phân hiệu được trích xuất từ đó
 * trong một lần — dùng ở bước cuối "Gửi cho các phòng ban" ngay sau khi
 * Thư kí phân hiệu rà soát/sửa danh sách nhiệm vụ được trích xuất.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create") || !hasAction(session, "branch_tasks", "create")) {
    return jsonError("Không có quyền", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.meetingDate) return jsonError("Thiếu tiêu đề hoặc ngày họp");
  const incomingTasks = Array.isArray(body.tasks) ? (body.tasks as IncomingTask[]) : [];

  for (const t of incomingTasks) {
    if (!t.title?.toString().trim()) return jsonError("Có nhiệm vụ thiếu tiêu đề");
    if (!Array.isArray(t.departmentIds) || t.departmentIds.length === 0) {
      return jsonError(`Nhiệm vụ "${t.title}" chưa gắn Phòng nào`);
    }
  }

  const validDeptIds = new Set((await db.select().from(departments)).map((d) => d.id));
  for (const t of incomingTasks) {
    for (const id of t.departmentIds) {
      if (!validDeptIds.has(Number(id))) return jsonError(`Phòng ban không hợp lệ: ${id}`);
    }
  }

  const result = await db.transaction(async (tx) => {
    const [meeting] = await tx
      .insert(meetings)
      .values({
        title: String(body.title),
        meetingDate: new Date(body.meetingDate),
        content: body.content ? String(body.content) : null,
        status: "reviewed",
        createdBy: session.userId,
      })
      .returning();

    const createdTasks = [];
    for (const t of incomingTasks) {
      const [row] = await tx
        .insert(tasks)
        .values({
          title: t.title.toString().trim(),
          level: "branch",
          status: "todo",
          priority: t.priority ?? "normal",
          meetingId: meeting.id,
          departmentId: null,
          createdBy: session.userId,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
        })
        .returning();

      const deptIds = [...new Set(t.departmentIds.map(Number))];
      await tx.insert(taskDepartments).values(deptIds.map((departmentId) => ({ taskId: row.id, departmentId })));

      createdTasks.push({ ...row, departmentIds: deptIds });
    }

    return { meeting, tasks: createdTasks };
  });

  // Gửi email thông báo cho Trưởng phòng các đơn vị liên quan — không chặn
  // response nếu gửi mail lỗi/chậm (sendMail bên trong đã tự bắt lỗi).
  void notifyBranchTasksAssigned(
    result.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      departmentIds: t.departmentIds,
    }))
  );

  return NextResponse.json(result, { status: 201 });
}
