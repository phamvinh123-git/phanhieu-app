import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { departments, meetings, taskComments, taskDepartments, taskStatusHistory, tasks } from "@/db/schema";
import type { SessionPayload } from "./auth";
import { resolveScope } from "./permissions";
import { todayVN } from "./role-expiry";

/**
 * Số liệu "thông minh" cho lãnh đạo / Trưởng phòng — tính trên nhiệm vụ cấp
 * Phân hiệu trong phạm vi người xem (BGĐ / Thư ký / Quản trị: toàn Phân hiệu;
 * Trưởng phòng: Phòng của mình).
 */

const DAY = 86400000;
export const SILENT_DAYS = 7; // quá 7 ngày không cập nhật → "im lặng"
export const NOT_STARTED_WINDOW = 7; // còn ≤ 7 ngày mà chưa bắt đầu

export type Dept = { id: number; code: string; name: string };

export type ScopedTask = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
  dueDate: string | null; // yyyy-mm-dd
  createdAt: string;
  meetingId: number | null;
  departments: Dept[]; // phòng đầu tiên = phòng chủ trì
  lastActivity: string; // ISO — lần cập nhật / trao đổi gần nhất
  daysLeft: number | null; // âm = quá hạn
  doneAt: string | null; // lần chuyển sang Hoàn thành gần nhất
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Người xem có phạm vi toàn Phân hiệu (BGĐ, Thư ký, Quản trị)? */
export function isLeader(session: SessionPayload) {
  return resolveScope(session, "branch_tasks", "view").all;
}

export async function loadScopedTasks(session: SessionPayload, opts: { meetingId?: number } = {}): Promise<ScopedTask[]> {
  const scope = resolveScope(session, "branch_tasks", "view");
  if (!scope.allowed) return [];

  const conds = [eq(tasks.level, "branch" as const)];
  if (opts.meetingId != null) conds.push(eq(tasks.meetingId, opts.meetingId));
  if (!scope.all) {
    if (scope.departmentIds.length === 0) return [];
    const linked = await db
      .selectDistinct({ taskId: taskDepartments.taskId })
      .from(taskDepartments)
      .where(inArray(taskDepartments.departmentId, scope.departmentIds));
    if (linked.length === 0) return [];
    conds.push(inArray(tasks.id, linked.map((l) => l.taskId)));
  }
  const rows = await db.select().from(tasks).where(and(...conds));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [links, lastComments, doneRows] = await Promise.all([
    db
      .select({ taskId: taskDepartments.taskId, id: departments.id, code: departments.code, name: departments.name })
      .from(taskDepartments)
      .innerJoin(departments, eq(departments.id, taskDepartments.departmentId))
      .where(inArray(taskDepartments.taskId, ids))
      .orderBy(taskDepartments.id),
    db
      .select({ taskId: taskComments.taskId, at: max(taskComments.createdAt) })
      .from(taskComments)
      .where(inArray(taskComments.taskId, ids))
      .groupBy(taskComments.taskId),
    db
      .select({ taskId: taskStatusHistory.taskId, at: max(taskStatusHistory.changedAt) })
      .from(taskStatusHistory)
      .where(and(inArray(taskStatusHistory.taskId, ids), eq(taskStatusHistory.toStatus, "done")))
      .groupBy(taskStatusHistory.taskId),
  ]);

  const deptByTask = new Map<number, Dept[]>();
  for (const l of links) deptByTask.set(l.taskId, [...(deptByTask.get(l.taskId) ?? []), { id: l.id, code: l.code, name: l.name }]);
  const commentAt = new Map(lastComments.map((c) => [c.taskId, c.at]));
  const doneAt = new Map(doneRows.map((d) => [d.taskId, d.at]));
  const today = todayVN();

  return rows.map((t) => {
    const activity = [t.updatedAt, t.createdAt, commentAt.get(t.id) ?? null].filter(Boolean) as Date[];
    const due = t.dueDate ? ymd(t.dueDate) : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: due,
      createdAt: t.createdAt.toISOString(),
      meetingId: t.meetingId,
      departments: deptByTask.get(t.id) ?? [],
      lastActivity: new Date(Math.max(...activity.map((d) => d.getTime()))).toISOString(),
      daysLeft: due ? daysBetween(today, due) : null,
      doneAt: t.status === "done" ? (doneAt.get(t.id) ?? t.updatedAt).toISOString() : null,
    };
  });
}

// ---------------------------------------------------------------------------
// 1. Theo dõi thực hiện kết luận họp
// ---------------------------------------------------------------------------

export type Progress = { total: number; done: number; inProgress: number; todo: number; overdue: number };

export function progressOf(list: ScopedTask[]): Progress {
  return {
    total: list.length,
    done: list.filter((t) => t.status === "done").length,
    inProgress: list.filter((t) => t.status === "in_progress").length,
    todo: list.filter((t) => t.status === "todo").length,
    overdue: list.filter((t) => t.status !== "done" && t.daysLeft != null && t.daysLeft < 0).length,
  };
}

export async function meetingProgressMap(session: SessionPayload) {
  const list = await loadScopedTasks(session);
  const byMeeting = new Map<number, ScopedTask[]>();
  for (const t of list) if (t.meetingId != null) byMeeting.set(t.meetingId, [...(byMeeting.get(t.meetingId) ?? []), t]);
  return Object.fromEntries([...byMeeting.entries()].map(([id, l]) => [id, progressOf(l)]));
}

export async function meetingReport(session: SessionPayload, meetingId: number) {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
  if (!meeting) return null;
  const list = await loadScopedTasks(session, { meetingId });
  const groups = new Map<number, { dept: Dept; tasks: ScopedTask[] }>();
  for (const t of list) {
    const lead = t.departments[0] ?? { id: 0, code: "", name: "Chưa xác định" };
    const g = groups.get(lead.id) ?? { dept: lead, tasks: [] };
    g.tasks.push(t);
    groups.set(lead.id, g);
  }
  const order = { todo: 1, in_progress: 1, done: 2 } as const;
  return {
    meeting: { id: meeting.id, title: meeting.title, meetingDate: ymd(meeting.meetingDate) },
    progress: progressOf(list),
    groups: [...groups.values()]
      .map((g) => ({
        ...g,
        progress: progressOf(g.tasks),
        tasks: g.tasks.sort((a, b) => order[a.status] - order[b.status] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)),
      }))
      .sort((a, b) => a.dept.name.localeCompare(b.dept.name, "vi")),
  };
}

// ---------------------------------------------------------------------------
// 2. Cảnh báo sớm — "Cần lãnh đạo lưu ý"
// ---------------------------------------------------------------------------

export async function attention(session: SessionPayload) {
  const list = (await loadScopedTasks(session)).filter((t) => t.status !== "done");
  const now = Date.now();
  const silentDays = (t: ScopedTask) => Math.floor((now - Date.parse(t.lastActivity)) / DAY);

  const notStarted = list
    .filter((t) => t.status === "todo" && t.daysLeft != null && t.daysLeft >= 0 && t.daysLeft <= NOT_STARTED_WINDOW)
    .sort((a, b) => a.daysLeft! - b.daysLeft!);
  const silent = list
    .filter((t) => silentDays(t) >= SILENT_DAYS && !(t.daysLeft != null && t.daysLeft < 0))
    .map((t) => ({ ...t, silentDays: silentDays(t) }))
    .sort((a, b) => b.silentDays - a.silentDays);
  const overdue = list.filter((t) => t.daysLeft != null && t.daysLeft < 0).sort((a, b) => a.daysLeft! - b.daysLeft!);

  const perDept = new Map<number, { dept: Dept; overdue: number; open: number }>();
  for (const t of list) {
    for (const d of t.departments) {
      const e = perDept.get(d.id) ?? { dept: d, overdue: 0, open: 0 };
      e.open++;
      if (t.daysLeft != null && t.daysLeft < 0) e.overdue++;
      perDept.set(d.id, e);
    }
  }
  const hotspots = [...perDept.values()].filter((e) => e.overdue >= 2).sort((a, b) => b.overdue - a.overdue);

  return { notStarted, silent, overdue, hotspots, canRemind: isLeader(session), silentThreshold: SILENT_DAYS };
}

// ---------------------------------------------------------------------------
// 3. Bản tin tuần
// ---------------------------------------------------------------------------

/** Thứ Hai của tuần chứa ngày `ymdStr` (giờ VN). */
export function mondayOf(ymdStr: string) {
  const d = new Date(`${ymdStr}T00:00:00Z`);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return ymd(new Date(d.getTime() - (dow - 1) * DAY));
}

export async function weeklySummary(session: SessionPayload) {
  const today = todayVN();
  const thisMon = mondayOf(today);
  const thisSun = ymd(new Date(Date.parse(thisMon) + 6 * DAY));
  const lastMon = ymd(new Date(Date.parse(thisMon) - 7 * DAY));
  const lastSun = ymd(new Date(Date.parse(thisMon) - DAY));
  const inRange = (iso: string | null, from: string, to: string) => {
    if (!iso) return false;
    const d = new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 10); // theo giờ VN
    return d >= from && d <= to;
  };

  const list = await loadScopedTasks(session);
  const open = list.filter((t) => t.status !== "done");
  const byDue = (a: ScopedTask, b: ScopedTask) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  return {
    week: { thisMon, thisSun, lastMon, lastSun },
    doneLastWeek: list.filter((t) => t.status === "done" && inRange(t.doneAt, lastMon, lastSun)),
    // "7 ngày tới" (tính cả hôm nay) — xem giữa tuần vẫn thấy việc hạn đầu tuần sau
    dueThisWeek: open.filter((t) => t.daysLeft != null && t.daysLeft >= 0 && t.daysLeft <= 6).sort(byDue),
    overdue: open.filter((t) => t.daysLeft != null && t.daysLeft < 0).sort(byDue),
    newLastWeek: list.filter((t) => inRange(t.createdAt, lastMon, lastSun)),
    openTotal: open.length,
  };
}


