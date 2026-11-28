"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader, CalendarClock, CheckCircle2, Plus, Inbox } from "lucide-react";
import { useMe } from "@/components/MeProvider";
import { AttentionPanel } from "@/components/AttentionPanel";
import { can, DEPARTMENT_KANBAN_ENABLED, type RoleCode } from "@/lib/rbac-config";
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  EmptyState,
  STATUS_META,
  isOverdue,
  isDueSoon,
  formatDate,
  type TaskStatus,
} from "@/components/ui";

type Level = "branch" | "department";
type Task = {
  id: number;
  title: string;
  level: Level;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  departmentId: number | null;
  departments?: { id: number; code: string; name: string }[];
};
type Dept = { id: number; name: string; code: string };

const LEVEL_PAGE: Record<Level, string> = {
  branch: "/dashboard/branch-tasks",
  department: "/dashboard/department-tasks",
};

export default function DashboardHome() {
  const { me } = useMe();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);

  // Chỉ tải những cấp nhiệm vụ mà người dùng được xem (theo menu của vai trò).
  const levels = useMemo<Level[]>(() => {
    const mods = new Set(me?.nav.map((n) => n.module));
    const out: Level[] = [];
    if (mods.has("branch_tasks") || mods.has("reports")) out.push("branch");
    if (DEPARTMENT_KANBAN_ENABLED && (mods.has("department_tasks") || mods.has("reports"))) out.push("department");
    return out;
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    Promise.all([
      ...levels.map((l) =>
        fetch(`/api/tasks?level=${l}`)
          .then((r) => (r.ok ? r.json() : { tasks: [] }))
          .then((d) => (d.tasks ?? []) as Task[])
      ),
      fetch("/api/org")
        .then((r) => r.json())
        .then((d) => (d.departments ?? []) as Dept[]),
    ]).then((results) => {
      if (cancelled) return;
      const deptList = results.pop() as Dept[];
      setDepts(deptList);
      setTasks((results as Task[][]).flat());
    });
    return () => {
      cancelled = true;
    };
  }, [me, levels]);

  const roleCodes = (me?.roles.map((r) => r.role) ?? []) as RoleCode[];
  const createHref = roleCodes.some((r) => can(r, "branch_tasks", "create"))
    ? LEVEL_PAGE.branch
    : DEPARTMENT_KANBAN_ENABLED && roleCodes.some((r) => can(r, "department_tasks", "create"))
      ? LEVEL_PAGE.department
      : null;

  const stats = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      todo: list.filter((t) => t.status === "todo").length,
      inProgress: list.filter((t) => t.status === "in_progress").length,
      done: list.filter((t) => t.status === "done").length,
      dueSoon: list.filter((t) => isDueSoon(t)).length,
      overdue: list.filter((t) => isOverdue(t)),
      recent: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7),
    };
  }, [tasks]);

  const deptLabel = (t: Task) => {
    if (t.level === "department") return depts.find((d) => d.id === t.departmentId)?.name ?? "";
    const ds = t.departments ?? [];
    if (ds.length <= 1) return ds[0]?.name ?? "";
    return ds.map((d) => d.code).join(", ");
  };

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const loading = tasks === null;

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${me?.user?.fullName ?? ""}`}
        actions={
          createHref && (
            <Link href={createHref} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Tạo công việc
            </Link>
          )
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Tổng công việc" value={loading ? "–" : stats.total} icon={ClipboardList} tone="brand" />
        <KpiCard label="Đang thực hiện" value={loading ? "–" : stats.inProgress} icon={Loader} tone="progress" hint={`${stats.todo} việc chưa bắt đầu`} />
        <KpiCard label="Sắp đến hạn" value={loading ? "–" : stats.dueSoon} icon={CalendarClock} tone="todo" hint={`Trong 7 ngày tới · ${stats.overdue.length} quá hạn`} />
        <KpiCard
          label="Hoàn thành"
          value={loading ? "–" : stats.done}
          icon={CheckCircle2}
          tone="done"
          hint={stats.total ? `${Math.round((stats.done / stats.total) * 100)}% tổng số việc` : undefined}
        />
      </div>

      <AttentionPanel />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Công việc gần đây */}
        <section className="todo-card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-[17px] font-semibold text-ink">Công việc gần đây</h2>
          </div>
          {loading ? (
            <div className="space-y-2 px-5 pb-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : stats.recent.length === 0 ? (
            <EmptyState icon={Inbox} title="Chưa có công việc nào" />
          ) : (
            <>
            {/* Điện thoại: danh sách gọn */}
            <ul className="divide-y divide-line border-t border-line sm:hidden">
              {stats.recent.map((t) => (
                <li key={t.id}>
                  <Link href={`${LEVEL_PAGE[t.level]}?task=${t.id}`} className="block px-5 py-3 active:bg-slate-50">
                    <p className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{t.title}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-muted">
                        {deptLabel(t) || "—"}
                        {t.dueDate && (
                          <span className={isOverdue(t) ? "font-medium text-overdue" : ""}> · {formatDate(t.dueDate)}</span>
                        )}
                      </span>
                      <span className="shrink-0">
                        <StatusBadge status={t.status} overdue={isOverdue(t)} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="data-table min-w-[620px] table-fixed">
                <thead>
                  <tr>
                    <th className="w-[44%]">Công việc</th>
                    <th className="w-[24%]">Đơn vị</th>
                    <th className="w-[14%]">Hạn</th>
                    <th className="w-[18%]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`${LEVEL_PAGE[t.level]}?task=${t.id}`} className="block truncate font-medium text-ink hover:text-red-700">
                          {t.title}
                        </Link>
                      </td>
                      <td className="truncate text-muted">{deptLabel(t) || "—"}</td>
                      <td className={`tabular-nums ${isOverdue(t) ? "font-medium text-overdue" : "text-muted"}`}>
                        {formatDate(t.dueDate) || "—"}
                      </td>
                      <td>
                        <StatusBadge status={t.status} overdue={isOverdue(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>

        <div className="space-y-5">
          {/* Tình hình theo trạng thái */}
          <section className="todo-card p-5">
            <h2 className="mb-4 text-[17px] font-semibold text-ink">Tình hình công việc</h2>
            <div className="space-y-4">
              {(["todo", "in_progress", "done"] as TaskStatus[]).map((s) => {
                const n = s === "todo" ? stats.todo : s === "in_progress" ? stats.inProgress : stats.done;
                const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
                return (
                  <div key={s}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} />
                        {STATUS_META[s].label}
                      </span>
                      <span className="tabular-nums text-muted">
                        {n} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: STATUS_META[s].color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
