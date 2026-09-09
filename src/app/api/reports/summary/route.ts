import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, departments, taskDepartments } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireSession, isSession } from "@/lib/api-helpers";
import { resolveScope } from "@/lib/permissions";
import type { ModuleCode } from "@/lib/rbac-config";

const STATUSES = ["todo", "in_progress", "done"] as const;

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const depts = await db.select().from(departments);
  const result: Record<string, unknown> = {};

  // ---- Cấp Phân Hiệu (có thể liên nhiều Phòng / nhiệm vụ) -------------------
  {
    const moduleCode: ModuleCode = "branch_tasks";
    const scope = resolveScope(session, moduleCode, "view");
    if (scope.allowed) {
      let rows: (typeof tasks.$inferSelect)[];
      if (scope.all) {
        rows = await db.select().from(tasks).where(eq(tasks.level, "branch"));
      } else if (scope.departmentIds.length === 0) {
        rows = [];
      } else {
        const links = await db
          .select({ taskId: taskDepartments.taskId })
          .from(taskDepartments)
          .where(inArray(taskDepartments.departmentId, scope.departmentIds));
        const idSet = [...new Set(links.map((l) => l.taskId))];
        rows = idSet.length
          ? await db.select().from(tasks).where(and(eq(tasks.level, "branch"), inArray(tasks.id, idSet)))
          : [];
      }

      const byStatus = emptyStatus();
      for (const t of rows) byStatus[t.status]++;

      const breakdownMap = new Map<string, { key: string; label: string; total: number; done: number }>();
      if (rows.length > 0) {
        const links = await db
          .select({
            taskId: taskDepartments.taskId,
            departmentId: taskDepartments.departmentId,
          })
          .from(taskDepartments)
          .where(inArray(taskDepartments.taskId, rows.map((r) => r.id)));
        const statusByTaskId = new Map(rows.map((r) => [r.id, r.status]));
        for (const l of links) {
          const key = `d${l.departmentId}`;
          const label = depts.find((d) => d.id === l.departmentId)?.name ?? "Chưa xác định";
          const entry = breakdownMap.get(key) ?? { key, label, total: 0, done: 0 };
          entry.total++;
          if (statusByTaskId.get(l.taskId) === "done") entry.done++;
          breakdownMap.set(key, entry);
        }
      }

      result.branch = { total: rows.length, byStatus, breakdown: Array.from(breakdownMap.values()) };
    }
  }

  // ---- Cấp Phòng (luôn thuộc đúng 1 Phòng) -----------------------------------
  {
    const moduleCode: ModuleCode = "department_tasks";
    const scope = resolveScope(session, moduleCode, "view");
    if (scope.allowed) {
      const conditions = [eq(tasks.level, "department" as const)];
      let rows: (typeof tasks.$inferSelect)[] = [];
      if (scope.all) {
        rows = await db.select().from(tasks).where(and(...conditions));
      } else if (scope.departmentIds.length > 0) {
        rows = await db
          .select()
          .from(tasks)
          .where(and(...conditions, inArray(tasks.departmentId, scope.departmentIds)));
      }

      const byStatus = emptyStatus();
      for (const t of rows) byStatus[t.status]++;

      const breakdownMap = new Map<string, { key: string; label: string; total: number; done: number }>();
      for (const t of rows) {
        if (t.departmentId == null) continue;
        const key = `d${t.departmentId}`;
        const label = depts.find((d) => d.id === t.departmentId)?.name ?? "Chưa xác định";
        const entry = breakdownMap.get(key) ?? { key, label, total: 0, done: 0 };
        entry.total++;
        if (t.status === "done") entry.done++;
        breakdownMap.set(key, entry);
      }

      result.department = { total: rows.length, byStatus, breakdown: Array.from(breakdownMap.values()) };
    }
  }

  return NextResponse.json({ summary: result });
}

function emptyStatus() {
  return STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<(typeof STATUSES)[number], number>);
}
