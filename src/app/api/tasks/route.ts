import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, taskDepartments, departments } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction, resolveScope } from "@/lib/permissions";
import type { ModuleCode } from "@/lib/rbac-config";

const LEVEL_MODULE: Record<string, ModuleCode> = {
  branch: "branch_tasks",
  department: "department_tasks",
};

/** Gắn danh sách Phòng (id + code + name) cho từng nhiệm vụ cấp Phân hiệu. */
async function attachDepartments<T extends { id: number; level: string }>(rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, departments: [] as { id: number; code: string; name: string }[] }));
  const ids = rows.map((r) => r.id);
  const links = await db
    .select({
      taskId: taskDepartments.taskId,
      id: departments.id,
      code: departments.code,
      name: departments.name,
    })
    .from(taskDepartments)
    .innerJoin(departments, eq(departments.id, taskDepartments.departmentId))
    .where(inArray(taskDepartments.taskId, ids));

  const byTask = new Map<number, { id: number; code: string; name: string }[]>();
  for (const l of links) {
    byTask.set(l.taskId, [...(byTask.get(l.taskId) ?? []), { id: l.id, code: l.code, name: l.name }]);
  }
  return rows.map((r) => ({ ...r, departments: byTask.get(r.id) ?? [] }));
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const level = req.nextUrl.searchParams.get("level") ?? "";
  const moduleCode = LEVEL_MODULE[level];
  if (!moduleCode) return jsonError("Thiếu hoặc sai tham số level (branch|department)");

  const scope = resolveScope(session, moduleCode, "view");
  if (!scope.allowed) return jsonError("Không có quyền xem", 403);

  if (level === "branch") {
    let rows;
    if (scope.all) {
      rows = await db.select().from(tasks).where(eq(tasks.level, "branch")).orderBy(desc(tasks.createdAt));
    } else {
      if (scope.departmentIds.length === 0) return NextResponse.json({ tasks: [] });
      const linkedTaskIds = await db
        .select({ taskId: taskDepartments.taskId })
        .from(taskDepartments)
        .where(inArray(taskDepartments.departmentId, scope.departmentIds));
      const idSet = [...new Set(linkedTaskIds.map((l) => l.taskId))];
      if (idSet.length === 0) return NextResponse.json({ tasks: [] });
      rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.level, "branch"), inArray(tasks.id, idSet)))
        .orderBy(desc(tasks.createdAt));
    }
    return NextResponse.json({ tasks: await attachDepartments(rows) });
  }

  // level === "department"
  const conditions = [eq(tasks.level, "department" as const)];
  if (!scope.all) {
    if (scope.departmentIds.length === 0) return NextResponse.json({ tasks: [] });
    conditions.push(inArray(tasks.departmentId, scope.departmentIds));
  }
  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  const level = body?.level as string;
  const moduleCode = LEVEL_MODULE[level];
  if (!moduleCode) return jsonError("Thiếu hoặc sai level");
  if (!body?.title) return jsonError("Thiếu tiêu đề công việc");

  if (!hasAction(session, moduleCode, "create")) return jsonError("Không có quyền tạo", 403);
  const scope = resolveScope(session, moduleCode, "create");

  const common = {
    title: String(body.title),
    description: body.description ? String(body.description) : null,
    level: level as "branch" | "department",
    status: "todo" as const,
    priority: (body.priority ?? "normal") as "low" | "normal" | "high" | "urgent",
    parentTaskId: body.parentTaskId ? Number(body.parentTaskId) : null,
    createdBy: session.userId,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  };

  if (level === "branch") {
    const rawDeptIds: unknown[] = Array.isArray(body.departmentIds)
      ? body.departmentIds
      : body.departmentId != null
        ? [body.departmentId]
        : [];
    const departmentIds = [...new Set(rawDeptIds.map((x) => Number(x)))];
    if (departmentIds.length === 0) return jsonError("Chọn ít nhất 1 phòng nhận nhiệm vụ");

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({ ...common, departmentId: null, meetingId: body.meetingId ? Number(body.meetingId) : null })
        .returning();
      await tx.insert(taskDepartments).values(departmentIds.map((departmentId) => ({ taskId: row.id, departmentId })));
      return row;
    });

    const [withDepts] = await attachDepartments([result]);
    return NextResponse.json({ task: withDepts }, { status: 201 });
  }

  // level === "department"
  const departmentId = Number(body.departmentId);
  if (!departmentId) return jsonError("Thiếu phòng ban");
  if (!scope.all && !scope.departmentIds.includes(departmentId)) {
    return jsonError("Bạn không có quyền tạo việc cho phòng này", 403);
  }

  const [row] = await db.insert(tasks).values({ ...common, departmentId }).returning();
  return NextResponse.json({ task: row }, { status: 201 });
}
