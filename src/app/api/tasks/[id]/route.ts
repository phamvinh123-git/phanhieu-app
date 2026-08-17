import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, taskStatusHistory, taskDepartments, departments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction, resolveScope, type ScopeFilter } from "@/lib/permissions";
import type { ModuleCode } from "@/lib/rbac-config";

const LEVEL_MODULE: Record<string, ModuleCode> = {
  branch: "branch_tasks",
  department: "department_tasks",
};

const VALID_STATUS = ["todo", "in_progress", "done"] as const;

async function getTaskDepartmentIds(taskId: number): Promise<number[]> {
  const rows = await db.select().from(taskDepartments).where(eq(taskDepartments.taskId, taskId));
  return rows.map((r) => r.departmentId);
}

async function inTaskScope(task: typeof tasks.$inferSelect, scope: ScopeFilter): Promise<boolean> {
  if (scope.all) return true;
  if (task.level === "department") {
    return task.departmentId != null && scope.departmentIds.includes(task.departmentId);
  }
  const deptIds = await getTaskDepartmentIds(task.id);
  return deptIds.some((id) => scope.departmentIds.includes(id));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, Number(id)));
  if (!task) return jsonError("Không tìm thấy công việc", 404);

  const moduleCode = LEVEL_MODULE[task.level];
  const scope = resolveScope(session, moduleCode, "view");
  if (!scope.allowed || !(await inTaskScope(task, scope))) {
    return jsonError("Không có quyền xem công việc này", 403);
  }

  const children = await db.select().from(tasks).where(eq(tasks.parentTaskId, task.id));

  let taskDepts: { id: number; code: string; name: string }[] = [];
  if (task.level === "branch") {
    const deptIds = await getTaskDepartmentIds(task.id);
    if (deptIds.length) {
      taskDepts = await db.select().from(departments).where(inArray(departments.id, deptIds));
    }
  }

  return NextResponse.json({ task: { ...task, departments: taskDepts }, children });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const { id } = await params;
  const taskId = Number(id);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return jsonError("Không tìm thấy công việc", 404);

  const moduleCode = LEVEL_MODULE[task.level];
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Dữ liệu không hợp lệ");

  const updates: Partial<typeof tasks.$inferInsert> = {};

  // ---- Cập nhật trạng thái (kéo-thả Kanban) --------------------------------
  if (body.status && body.status !== task.status) {
    if (!VALID_STATUS.includes(body.status)) return jsonError("Trạng thái không hợp lệ");

    const canMoveGeneral =
      hasAction(session, moduleCode, "update_status") || hasAction(session, moduleCode, "create");
    if (!canMoveGeneral) return jsonError("Không có quyền cập nhật trạng thái", 403);

    const statusAction = hasAction(session, moduleCode, "update_status") ? "update_status" : "create";
    const statusScope = resolveScope(session, moduleCode, statusAction);
    if (!(await inTaskScope(task, statusScope))) return jsonError("Công việc ngoài phạm vi của bạn", 403);

    updates.status = body.status;
    await db.insert(taskStatusHistory).values({
      taskId: task.id,
      fromStatus: task.status,
      toStatus: body.status,
      changedBy: session.userId,
    });
  }

  // ---- Sửa nội dung ----------------------------------------------------------
  const canEdit = hasAction(session, moduleCode, "create") || hasAction(session, moduleCode, "assign");
  if (canEdit) {
    const editScope = resolveScope(
      session,
      moduleCode,
      hasAction(session, moduleCode, "assign") ? "assign" : "create"
    );
    if (await inTaskScope(task, editScope)) {
      if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
      if (typeof body.description === "string") updates.description = body.description;
      if (body.priority) updates.priority = body.priority;
      if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("Không có thay đổi hợp lệ hoặc không có quyền", 403);
  }

  updates.updatedAt = new Date();
  const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, taskId)).returning();
  return NextResponse.json({ task: row });
}
