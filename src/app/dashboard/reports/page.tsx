"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, Loader, AlertTriangle, X, BarChart3 } from "lucide-react";
import { PageHeader, KpiCard, EmptyState, STATUS_META, isOverdue, formatDate, type TaskStatus } from "@/components/ui";

type Level = "branch" | "department";
type Dept = { id: number; name: string; code: string };
type Task = {
  id: number;
  title: string;
  level: Level;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  departmentId: number | null;
  departments?: Dept[];
};

const LEVEL_LABEL: Record<Level, string> = { branch: "Cấp Phân hiệu", department: "Cấp Phòng" };

function deptIdsOf(t: Task) {
  return t.level === "department" ? (t.departmentId != null ? [t.departmentId] : []) : (t.departments ?? []).map((d) => d.id);
}

function daysLate(t: Task) {
  if (!t.dueDate) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000));
}

export default function ReportsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [levelFilter, setLevelFilter] = useState<"" | Level>("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    // /api/reports/summary chỉ trả về các cấp người dùng được phép xem →
    // dùng nó để biết cần tải danh sách nhiệm vụ của cấp nào.
    Promise.all([
      fetch("/api/reports/summary").then((r) => r.json()),
      fetch("/api/org").then((r) => r.json()),
    ]).then(async ([s, o]) => {
      const allowed = Object.keys(s.summary ?? {}).filter((k): k is Level => k === "branch" || k === "department");
      setLevels(allowed);
      setDepts(o.departments ?? []);
      const lists = await Promise.all(
        allowed.map((l) =>
          fetch(`/api/tasks?level=${l}`)
            .then((r) => (r.ok ? r.json() : { tasks: [] }))
            .then((d) => (d.tasks ?? []) as Task[])
        )
      );
      setTasks(lists.flat());
    });
  }, []);

  const filtered = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (levelFilter && t.level !== levelFilter) return false;
      if (deptFilter && !deptIdsOf(t).includes(Number(deptFilter))) return false;
      if (statusFilter === "overdue") {
        if (!isOverdue(t)) return false;
      } else if (statusFilter && t.status !== statusFilter) return false;
      if (fromDate || toDate) {
        if (!t.dueDate) return false;
        const d = t.dueDate.slice(0, 10);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      return true;
    });
  }, [tasks, levelFilter, deptFilter, statusFilter, fromDate, toDate]);

  const anyFilter = Boolean(levelFilter || deptFilter || statusFilter || fromDate || toDate);

  const stats = useMemo(() => {
    const overdue = filtered.filter(isOverdue).sort((a, b) => daysLate(b) - daysLate(a));
    // Theo đơn vị — một nhiệm vụ liên phòng được tính cho từng phòng liên quan
    const byDept = new Map<number, { total: number; done: number; inProgress: number; overdue: number }>();
    for (const t of filtered) {
      for (const id of deptIdsOf(t)) {
        const e = byDept.get(id) ?? { total: 0, done: 0, inProgress: 0, overdue: 0 };
        e.total++;
        if (t.status === "done") e.done++;
        if (t.status === "in_progress") e.inProgress++;
        if (isOverdue(t)) e.overdue++;
        byDept.set(id, e);
      }
    }
    // Theo tháng (theo hạn hoàn thành) — 6 tháng gần nhất có dữ liệu
    const byMonth = new Map<string, { total: number; done: number }>();
    for (const t of filtered) {
      if (!t.dueDate) continue;
      const k = t.dueDate.slice(0, 7);
      const e = byMonth.get(k) ?? { total: 0, done: 0 };
      e.total++;
      if (t.status === "done") e.done++;
      byMonth.set(k, e);
    }
    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return {
      total: filtered.length,
      done: filtered.filter((t) => t.status === "done").length,
      inProgress: filtered.filter((t) => t.status === "in_progress").length,
      notDone: filtered.filter((t) => t.status !== "done").length,
      overdue,
      byDept: [...byDept.entries()]
        .map(([id, v]) => ({ id, name: depts.find((d) => d.id === id)?.name ?? "Chưa xác định", ...v }))
        .sort((a, b) => b.total - a.total),
      months,
      monthMax: Math.max(1, ...months.map(([, v]) => v.total)),
    };
  }, [filtered, depts]);

  const loading = tasks === null;
  const deptName = (t: Task) =>
    deptIdsOf(t)
      .map((id) => depts.find((d) => d.id === id)?.code)
      .filter(Boolean)
      .join(", ");

  return (
    <div>
      <PageHeader
        title="Báo cáo thống kê"
      />

      {/* Bộ lọc */}
      <div className="todo-card mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {levels.length > 1 && (
            <div>
              <label htmlFor="rp-level" className="field-label">Cấp nhiệm vụ</label>
              <select id="rp-level" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as "" | Level)} className="field">
                <option value="">Tất cả</option>
                {levels.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="rp-dept" className="field-label">Đơn vị</label>
            <select id="rp-dept" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="field">
              <option value="">Tất cả đơn vị</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rp-status" className="field-label">Trạng thái</label>
            <select id="rp-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field">
              <option value="">Tất cả</option>
              <option value="todo">Cần làm</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="done">Hoàn thành</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </div>
          <div>
            <label htmlFor="rp-from" className="field-label">Hạn từ ngày</label>
            <input id="rp-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="rp-to" className="field-label">Hạn đến ngày</label>
            <input id="rp-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="field" />
          </div>
        </div>
        {anyFilter && (
          <div className="mt-3 flex items-center gap-3 text-[13px] text-muted">
            <span className="tabular-nums">{filtered.length}/{tasks?.length ?? 0} công việc</span>
            <button
              onClick={() => {
                setLevelFilter("");
                setDeptFilter("");
                setStatusFilter("");
                setFromDate("");
                setToDate("");
              }}
              className="btn btn-secondary btn-sm"
            >
              <X className="h-3.5 w-3.5" /> Xoá bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng số nhiệm vụ" value={loading ? "–" : stats.total} icon={ClipboardList} tone="brand" />
        <KpiCard
          label="Đã hoàn thành"
          value={loading ? "–" : stats.done}
          icon={CheckCircle2}
          tone="done"
          hint={stats.total ? `${Math.round((stats.done / stats.total) * 100)}% tổng số` : undefined}
        />
        <KpiCard label="Đang thực hiện" value={loading ? "–" : stats.inProgress} icon={Loader} tone="progress" />
        <KpiCard
          label="Chưa hoàn thành / Quá hạn"
          value={loading ? "–" : `${stats.notDone} / ${stats.overdue.length}`}
          icon={AlertTriangle}
          tone="overdue"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Biểu đồ cột theo tháng */}
        <section className="todo-card p-5">
          <h2 className="text-[17px] font-semibold text-ink">Nhiệm vụ theo tháng (hạn hoàn thành)</h2>
          <div className="mt-1 mb-4 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Tổng</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-done" /> Hoàn thành</span>
          </div>
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
          ) : stats.months.length === 0 ? (
            <EmptyState icon={BarChart3} title="Chưa có dữ liệu theo tháng" />
          ) : (
            <div className="flex h-52 items-end gap-3 border-b border-line pb-0">
              {stats.months.map(([m, v]) => (
                <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold tabular-nums text-ink">{v.total}</span>
                  <div
                    className="relative w-full max-w-[56px] overflow-hidden rounded-t-md bg-slate-200"
                    style={{ height: `${(v.total / stats.monthMax) * 80}%` }}
                    title={`${v.done}/${v.total} hoàn thành`}
                  >
                    <div className="absolute inset-x-0 bottom-0 bg-done" style={{ height: `${(v.done / v.total) * 100}%` }} />
                  </div>
                  <span className="pb-1 text-xs tabular-nums text-muted">{m.slice(5)}/{m.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Theo đơn vị */}
        <section className="todo-card p-5">
          <h2 className="mb-4 text-[17px] font-semibold text-ink">Thống kê theo đơn vị</h2>
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
          ) : stats.byDept.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" />
          ) : (
            <ul className="space-y-3.5">
              {stats.byDept.map((d) => {
                const pct = Math.round((d.done / d.total) * 100);
                return (
                  <li key={d.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate font-medium text-ink">{d.name}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {d.done}/{d.total} hoàn thành
                        {d.overdue > 0 && <span className="ml-1.5 font-medium text-overdue">· {d.overdue} quá hạn</span>}
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-done" style={{ width: `${pct}%` }} />
                      <div className="h-full bg-progress" style={{ width: `${(d.inProgress / d.total) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
              <li className="flex gap-4 pt-1 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-done" /> {STATUS_META.done.label}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-progress" /> {STATUS_META.in_progress.label}</span>
              </li>
            </ul>
          )}
        </section>
      </div>

      {/* Danh sách quá hạn */}
      <section className="todo-card mt-5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4">
          <AlertTriangle className="h-[18px] w-[18px] text-overdue" />
          <h2 className="text-[17px] font-semibold text-ink">Công việc quá hạn</h2>
          {!loading && <span className="badge badge-overdue tabular-nums">{stats.overdue.length}</span>}
        </div>
        {loading ? (
          <div className="mx-5 mb-5 h-24 animate-pulse rounded-lg bg-slate-100" />
        ) : stats.overdue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Không có công việc quá hạn" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[620px]">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th>Đơn vị phụ trách</th>
                  <th>Hạn</th>
                  <th className="text-right">Số ngày quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {stats.overdue.map((t) => (
                  <tr key={t.id}>
                    <td className="max-w-[360px]">
                      <p className="truncate font-medium text-ink">{t.title}</p>
                    </td>
                    <td className="text-muted">{deptName(t) || "—"}</td>
                    <td className="tabular-nums text-muted">{formatDate(t.dueDate)}</td>
                    <td className="text-right font-semibold tabular-nums text-overdue">{daysLate(t)} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
