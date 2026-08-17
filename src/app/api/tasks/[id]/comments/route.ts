import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, taskComments, users, taskDepartments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { resolveScope, type ScopeFilter } from "@/lib/permissions";
import type { ModuleCode } from "@/lib/rbac-config";

const LEVEL_MODULE: Record<string, ModuleCode> = {
  branch: "branch_tasks",
  department: "department_tasks",
};

async function inTaskScope(task: typeof tasks.$inferSelect, scope: ScopeFilter): Promise<boolean> {
  if (scope.all) return true;
  if (task.level === "department") {
    return task.departmentId != null && scope.departmentIds.includes(task.departmentId);
  }
  const rows = await db.select().from(taskDepartments).where(eq(taskDepartments.taskId, task.id));
  return rows.some((r) => scope.departmentIds.includes(r.departmentId));
}

async function loadTaskAndCheckView(taskId: number, session: Awaited<ReturnType<typeof requireSession>>) {
  if (!isSession(session)) return { error: session };
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return { error: jsonError("Không tìm thấy công việc", 404) };
  const moduleCode = LEVEL_MODULE[task.level];
  const scope = resolveScope(session, moduleCode, "view");
  if (!scope.allowed || !(await inTaskScope(task, scope))) return { error: jsonError("Không có quyền", 403) };
  return { task };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const check = await loadTaskAndCheckView(Number(id), session);
  if (check.error) return check.error;

  const rows = await db
    .select({
      id: taskComments.id,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
      userId: taskComments.userId,
      userName: users.fullName,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, Number(id)))
    .orderBy(asc(taskComments.createdAt));

  return NextResponse.json({ comments: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const check = await loadTaskAndCheckView(Number(id), session);
  if (check.error) return check.error;
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  if (!body?.content?.toString().trim()) return jsonError("Nội dung trống");

  const [row] = await db
    .insert(taskComments)
    .values({ taskId: Number(id), userId: session.userId, content: body.content.toString().trim() })
    .returning();

  return NextResponse.json({ comment: row }, { status: 201 });
}
