import { and, desc, eq, inArray, isNotNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, taskDepartments, tasks, userRoles, users } from "@/db/schema";
import type { SessionPayload } from "./auth";
import { DEPARTMENT_KANBAN_ENABLED } from "./rbac-config";
import { roleIsActive } from "./role-expiry";
import { weeklySummary } from "./insights";

/**
 * Thông báo trong app. Người nhận một thông báo về nhiệm vụ là: mọi tài khoản
 * đang hoạt động có vai trò thuộc (các) Phòng của nhiệm vụ đó + người tạo
 * nhiệm vụ — trừ chính người gây ra sự kiện.
 */

const REMIND_DAYS = 3; // còn ≤ 3 ngày thì bắt đầu nhắc

type TaskRow = typeof tasks.$inferSelect;

async function taskDepartmentIds(task: TaskRow): Promise<number[]> {
  if (task.level === "department") return task.departmentId != null ? [task.departmentId] : [];
  const rows = await db
    .select({ departmentId: taskDepartments.departmentId })
    .from(taskDepartments)
    .where(eq(taskDepartments.taskId, task.id));
  return rows.map((r) => r.departmentId);
}

export async function recipientsForTask(task: TaskRow, excludeUserId?: string): Promise<string[]> {
  const deptIds = await taskDepartmentIds(task);
  const ids = new Set<string>();
  if (deptIds.length) {
    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(inArray(userRoles.departmentId, deptIds), eq(users.isActive, true), roleIsActive()));
    rows.forEach((r) => ids.add(r.userId));
  }
  if (task.createdBy) ids.add(task.createdBy);
  if (excludeUserId) ids.delete(excludeUserId);
  return [...ids];
}

function snippet(s: string, n = 90) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Có bình luận mới ở nhiệm vụ → báo cho các đơn vị liên quan. */
export async function notifyComment(taskId: number, actor: SessionPayload, content: string) {
  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return;
    const to = await recipientsForTask(task, actor.userId);
    if (!to.length) return;
    await db.insert(notifications).values(
      to.map((userId) => ({
        userId,
        type: "comment" as const,
        taskId,
        actorId: actor.userId,
        message: `${actor.fullName}: “${snippet(content)}”`,
      }))
    );
  } catch (e) {
    console.error("[notify] comment", e);
  }
}

/** Nhiệm vụ mới được giao → báo cho Phòng nhận việc. */
export async function notifyAssigned(taskIds: number[], actor: SessionPayload) {
  try {
    for (const taskId of taskIds) {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) continue;
      const to = await recipientsForTask(task, actor.userId);
      if (!to.length) continue;
      await db
        .insert(notifications)
        .values(
          to.map((userId) => ({
            userId,
            type: "assigned" as const,
            taskId,
            actorId: actor.userId,
            message: `${actor.fullName} giao nhiệm vụ mới cho đơn vị`,
            dedupeKey: `assigned:${taskId}`,
          }))
        )
        .onConflictDoNothing();
    }
  } catch (e) {
    console.error("[notify] assigned", e);
  }
}

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd. */
function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function vnDate(ymd: string) {
  return ymd.split("-").reverse().join("/");
}

/**
 * Nhắc hạn cho người dùng hiện tại: mọi nhiệm vụ chưa hoàn thành của (các)
 * Phòng họ phụ trách hoặc do họ giao, còn ≤ 3 ngày hoặc đã quá hạn. Mỗi
 * nhiệm vụ chỉ giữ 1 lời nhắc mới nhất, làm mới (thành "chưa đọc") mỗi ngày.
 */
export async function ensureDueReminders(session: SessionPayload) {
  const today = todayVN();
  const limit = new Date(Date.parse(today) + (REMIND_DAYS + 1) * 86400000);
  const deptIds = [...new Set(session.roles.map((r) => r.departmentId).filter((x): x is number => x != null))];

  const branchIds = deptIds.length
    ? (
        await db
          .select({ taskId: taskDepartments.taskId })
          .from(taskDepartments)
          .where(inArray(taskDepartments.departmentId, deptIds))
      ).map((r) => r.taskId)
    : [];

  const scope = [eq(tasks.createdBy, session.userId)];
  if (deptIds.length && DEPARTMENT_KANBAN_ENABLED) scope.push(and(eq(tasks.level, "department"), inArray(tasks.departmentId, deptIds))!);
  if (branchIds.length) scope.push(inArray(tasks.id, branchIds));

  const due = await db
    .select({ id: tasks.id, dueDate: tasks.dueDate })
    .from(tasks)
    .where(
      and(
        ne(tasks.status, "done"),
        isNotNull(tasks.dueDate),
        lte(tasks.dueDate, limit),
        or(...scope),
        DEPARTMENT_KANBAN_ENABLED ? undefined : eq(tasks.level, "branch")
      )
    );

  for (const t of due) {
    const dueYmd = t.dueDate!.toISOString().slice(0, 10);
    const daysLeft = Math.round((Date.parse(dueYmd) - Date.parse(today)) / 86400000);
    if (daysLeft > REMIND_DAYS) continue;
    const overdue = daysLeft < 0;
    const key = `${overdue ? "overdue" : "due"}:${t.id}:${today}`;
    const message = overdue
      ? `Đã quá hạn ${-daysLeft} ngày (hạn ${vnDate(dueYmd)})`
      : daysLeft === 0
        ? `Đến hạn hôm nay (${vnDate(dueYmd)})`
        : `Còn ${daysLeft} ngày đến hạn (${vnDate(dueYmd)})`;

    const inserted = await db
      .insert(notifications)
      .values({ userId: session.userId, type: overdue ? "overdue" : "due_soon", taskId: t.id, message, dedupeKey: key })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (inserted.length) {
      // Chỉ giữ lời nhắc mới nhất của nhiệm vụ này
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, session.userId),
            eq(notifications.taskId, t.id),
            inArray(notifications.type, ["due_soon", "overdue"]),
            ne(notifications.id, inserted[0].id)
          )
        );
    }
  }

  // Nhiệm vụ đã hoàn thành / hết trong phạm vi → bỏ lời nhắc cũ
  const keepIds = due.map((t) => t.id);
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, session.userId),
        inArray(notifications.type, ["due_soon", "overdue"]),
        keepIds.length ? notInArray(notifications.taskId, keepIds) : sql`true`
      )
    );
}

/** Bản tin tuần trong chuông thông báo: mỗi tuần 1 tin (tạo từ thứ Hai). */
export async function ensureWeeklyDigest(session: SessionPayload) {
  const d = await weeklySummary(session);
  const key = `digest:${d.week.thisMon}`;
  const vn = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
  const parts = [
    d.overdue.length ? `${d.overdue.length} quá hạn` : null,
    `${d.dueThisWeek.length} việc đến hạn trong 7 ngày`,
    `${d.doneLastWeek.length} hoàn thành tuần trước`,
    d.newLastWeek.length ? `${d.newLastWeek.length} việc mới` : null,
  ].filter(Boolean);
  if (d.openTotal === 0 && d.doneLastWeek.length === 0 && d.newLastWeek.length === 0) return;
  await db
    .insert(notifications)
    .values({
      userId: session.userId,
      type: "digest",
      message: `Tuần ${vn(d.week.thisMon)}–${vn(d.week.thisSun)}: ${parts.join(" · ")}`,
      dedupeKey: key,
    })
    .onConflictDoNothing();
}

export async function listNotifications(session: SessionPayload, limit = 40) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      message: notifications.message,
      taskId: notifications.taskId,
      taskTitle: tasks.title,
      taskLevel: tasks.level,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .where(
      and(
        eq(notifications.userId, session.userId),
        DEPARTMENT_KANBAN_ENABLED ? undefined : sql`(${tasks.level} is null or ${tasks.level} = 'branch')`
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .where(
      and(
        eq(notifications.userId, session.userId),
        sql`${notifications.readAt} is null`,
        DEPARTMENT_KANBAN_ENABLED ? undefined : sql`(${tasks.level} is null or ${tasks.level} = 'branch')`
      )
    );

  return {
    unread: count,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      read: r.readAt != null,
      createdAt: r.createdAt,
      link: r.taskId
        ? `${r.taskLevel === "department" ? "/dashboard/department-tasks" : "/dashboard/branch-tasks"}?task=${r.taskId}`
        : r.type === "digest"
          ? "/dashboard/weekly"
          : null,
    })),
  };
}

export async function markRead(session: SessionPayload, ids: number[] | "all") {
  const mine = eq(notifications.userId, session.userId);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(ids === "all" ? and(mine, sql`${notifications.readAt} is null`) : and(mine, inArray(notifications.id, ids)));
}
