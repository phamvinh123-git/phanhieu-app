"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, Loader, AlertTriangle, X, BarChart3, Download, ArrowUpDown, ArrowDown, ArrowUp, Table2 } from "lucide-react";
import { DEPARTMENT_KANBAN_ENABLED } from "@/lib/rbac-config";
import { useMe } from "@/components/MeProvider";
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

type DeptRow = { id: number; code: string; name: string; total: number; todo: number; inProgress: number; done: number; overdue: number; multi: number };
type DeptSortKey = "name" | "total" | "todo" | "inProgress" | "done" | "overdue" | "multi" | "rate";
const DEPT_COLS: { key: DeptSortKey; label: string }[] = [
  { key: "name", label: "Đơn vị" },
  { key: "total", label: "Được giao" },
  { key: "todo", label: "Cần làm" },
  { key: "inProgress", label: "Đang làm" },
  { key: "done", label: "Hoàn thành" },
  { key: "overdue", label: "Quá hạn" },
  { key: "multi", label: "Liên phòng" },
  { key: "rate", label: "Tỉ lệ HT" },
];

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
      const allowed = Object.keys(s.summary ?? {}).filter(
        (k): k is Level => k === "branch" || (DEPARTMENT_KANBAN_ENABLED && k === "department")
      );
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

  // Lọc theo cấp / trạng thái / thời gian (chưa lọc theo đơn vị) — dùng cho bảng theo phòng
  const filteredAllDepts = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (levelFilter && t.level !== levelFilter) return false;
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
  }, [tasks, levelFilter, statusFilter, fromDate, toDate]);

  const filtered = useMemo(
    () => (deptFilter ? filteredAllDepts.filter((t) => deptIdsOf(t).includes(Number(deptFilter))) : filteredAllDepts),
    [filteredAllDepts, deptFilter]
  );

  // ---- Bảng thống kê theo từng phòng (mọi phòng, kể cả phòng chưa có việc) ----
  const { me } = useMe();
  // Lãnh đạo / Thư ký / Admin: mọi phòng. Trưởng phòng: chỉ (các) phòng của mình.
  const ownDeptIds = useMemo(() => {
    const roles = me?.roles ?? [];
    if (roles.some((r) => r.role === "admin" || r.role === "bgd" || r.role === "tkph")) return null;
    return new Set(roles.map((r) => r.departmentId).filter((x): x is number => x != null));
  }, [me]);
  const [sortKey, setSortKey] = useState<DeptSortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const deptTable = useMemo(() => {
    const rows = new Map<number, DeptRow>();
    for (const d of depts) if (!ownDeptIds || ownDeptIds.has(d.id)) rows.set(d.id, { id: d.id, code: d.code, name: d.name, total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, multi: 0 });
    for (const t of filteredAllDepts) {
      const ids = deptIdsOf(t);
      for (const id of ids) {
        const e = rows.get(id);
        if (!e) continue;
        e.total++;
        if (t.status === "todo") e.todo++;
        else if (t.status === "in_progress") e.inProgress++;
        else e.done++;
        if (isOverdue(t)) e.overdue++;
        if (ids.length > 1) e.multi++;
      }
    }
    const list = [...rows.values()];
    const val = (x: DeptRow) => (sortKey === "rate" ? (x.total ? x.done / x.total : -1) : sortKey === "name" ? x.code : x[sortKey]);
    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string, "vi") : (va as number) - (vb as number);
      return (sortDir === "asc" ? c : -c) || a.code.localeCompare(b.code);
    });
    const sum = list.reduce(
      (acc, x) => ({
        total: acc.total + x.total,
        todo: acc.todo + x.todo,
        inProgress: acc.inProgress + x.inProgress,
        done: acc.done + x.done,
        overdue: acc.overdue + x.overdue,
        multi: acc.multi + x.multi,
      }),
      { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, multi: 0 }
    );
    return { list, sum, distinct: filteredAllDepts.length };
  }, [filteredAllDepts, depts, sortKey, sortDir, ownDeptIds]);

  function toggleSort(k: DeptSortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  }

  function exportDeptCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Mã", "Đơn vị", "Tổng được giao", "Cần làm", "Đang thực hiện", "Hoàn thành", "Quá hạn", "Liên phòng", "Tỉ lệ hoàn thành (%)"];
    const line = (x: DeptRow | (typeof deptTable)["sum"], code: string, name: string) =>
      [code, name, x.total, x.todo, x.inProgress, x.done, x.overdue, x.multi, x.total ? Math.round((x.done / x.total) * 100) : 0];
    const range = fromDate || toDate ? ` (hạn ${fromDate || "…"} → ${toDate || "…"})` : "";
    const lines = [
      [`Thống kê công việc theo đơn vị${range} — xuất ngày ${new Date().toLocaleDateString("vi-VN")}`].map(esc).join(","),
      head.map(esc).join(","),
      ...deptTable.list.map((x) => line(x, x.code, x.name).map(esc).join(",")),
      line(deptTable.sum, "", "Tổng (việc liên phòng tính cho từng phòng)").map(esc).join(","),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "thong-ke-theo-phong.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

      {/* Bảng thống kê theo từng phòng */}
      <section className="todo-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <Table2 className="h-[18px] w-[18px] text-red-700" />
            <h2 className="text-[17px] font-semibold text-ink">Thống kê theo từng phòng</h2>
          </div>
          <button onClick={exportDeptCsv} disabled={loading} className="btn btn-secondary btn-sm">
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        </div>
        {loading ? (
          <div className="mx-5 mb-5 h-48 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <>
          {/* Điện thoại: mỗi phòng một thẻ */}
          <ul className="divide-y divide-line border-t border-line sm:hidden">
            {deptTable.list.map((x) => {
              const pct = x.total ? Math.round((x.done / x.total) * 100) : 0;
              const selected = deptFilter === String(x.id);
              return (
                <li key={x.id}>
                  <button
                    onClick={() => setDeptFilter(selected ? "" : String(x.id))}
                    className={`block w-full px-5 py-3 text-left ${selected ? "bg-red-50/70" : "active:bg-slate-50"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 font-semibold text-ink">{x.code}</span>
                        <span className="min-w-0 truncate text-xs text-muted">{x.name}</span>
                      </p>
                      <p className="shrink-0 text-[13px] text-muted">
                        <b className="text-[17px] tabular-nums text-ink">{x.total}</b> việc
                      </p>
                    </div>
                    {x.total > 0 && (
                      <>
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-done" style={{ width: `${(x.done / x.total) * 100}%` }} />
                          <div className="h-full bg-progress" style={{ width: `${(x.inProgress / x.total) * 100}%` }} />
                        </div>
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] tabular-nums text-muted">
                          <span>Cần làm {x.todo}</span>
                          <span className="text-progress">Đang làm {x.inProgress}</span>
                          <span className="text-done">Xong {x.done} ({pct}%)</span>
                          {x.overdue > 0 && <span className="font-semibold text-overdue">Quá hạn {x.overdue}</span>}
                          {x.multi > 0 && <span>Liên phòng {x.multi}</span>}
                        </p>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
            <li className="flex items-baseline justify-between bg-slate-50 px-5 py-3 text-[13px]">
              <span className="font-semibold text-ink">Tổng</span>
              <span className="tabular-nums text-muted">
                <b className="text-ink">{deptTable.sum.total}</b> lượt giao · <span className="text-overdue">{deptTable.sum.overdue} quá hạn</span> ·{" "}
                {deptTable.sum.total ? Math.round((deptTable.sum.done / deptTable.sum.total) * 100) : 0}% xong
              </span>
            </li>
          </ul>
          <div className="thin-scrollbar hidden overflow-x-auto sm:block">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  {DEPT_COLS.map((c) => {
                    const active = sortKey === c.key;
                    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        className={`${c.key === "name" ? "sticky left-0 z-[1]" : "!text-right"} ${c.key === "rate" ? "w-[160px]" : ""}`}
                      >
                        <button
                          onClick={() => toggleSort(c.key)}
                          className={`inline-flex items-center gap-1 whitespace-nowrap ${active ? "text-ink" : ""}`}
                          title="Sắp xếp"
                        >
                          {c.label}
                          <Icon className={`h-3.5 w-3.5 ${active ? "text-red-700" : "text-slate-300"}`} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {deptTable.list.map((x) => {
                  const pct = x.total ? Math.round((x.done / x.total) * 100) : 0;
                  const selected = deptFilter === String(x.id);
                  return (
                    <tr
                      key={x.id}
                      onClick={() => setDeptFilter(selected ? "" : String(x.id))}
                      className={`cursor-pointer ${selected ? "bg-red-50/70" : ""}`}
                      title={selected ? "Bỏ lọc theo phòng này" : "Lọc cả trang theo phòng này"}
                    >
                      <td className={`sticky left-0 z-[1] max-w-[280px] ${selected ? "bg-red-50" : "bg-white"}`}>
                        <p className="font-semibold text-ink">{x.code}</p>
                        <p className="truncate text-xs text-muted" title={x.name}>{x.name}</p>
                      </td>
                      <td className="text-right font-semibold tabular-nums text-ink">{x.total}</td>
                      <td className="text-right tabular-nums text-muted">{x.todo || "–"}</td>
                      <td className="text-right tabular-nums text-progress">{x.inProgress || "–"}</td>
                      <td className="text-right tabular-nums text-done">{x.done || "–"}</td>
                      <td className={`text-right tabular-nums ${x.overdue ? "font-semibold text-overdue" : "text-muted"}`}>{x.overdue || "–"}</td>
                      <td className="text-right tabular-nums text-muted">{x.multi || "–"}</td>
                      <td>
                        {x.total ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-9 text-right text-[13px] font-medium tabular-nums text-ink">{pct}%</span>
                          </div>
                        ) : (
                          <p className="text-right text-muted">–</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-slate-50 font-semibold">
                  <td className="sticky left-0 z-[1] bg-slate-50 text-ink">Tổng</td>
                  <td className="text-right tabular-nums text-ink">{deptTable.sum.total}</td>
                  <td className="text-right tabular-nums">{deptTable.sum.todo}</td>
                  <td className="text-right tabular-nums text-progress">{deptTable.sum.inProgress}</td>
                  <td className="text-right tabular-nums text-done">{deptTable.sum.done}</td>
                  <td className="text-right tabular-nums text-overdue">{deptTable.sum.overdue}</td>
                  <td className="text-right tabular-nums">{deptTable.sum.multi}</td>
                  <td className="text-right tabular-nums text-ink">
                    {deptTable.sum.total ? Math.round((deptTable.sum.done / deptTable.sum.total) * 100) : 0}%
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="px-5 py-3 text-xs text-muted">
              Việc liên phòng được tính cho mỗi phòng tham gia, nên dòng Tổng ({deptTable.sum.total}) có thể lớn hơn số việc thực tế ({deptTable.distinct}).
            </p>
          </div>
          <p className="px-5 py-3 text-xs text-muted sm:hidden">
            Việc liên phòng được tính cho mỗi phòng tham gia ({deptTable.distinct} việc thực tế).
          </p>
          </>
        )}
      </section>

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
