"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Clock, MessageSquare, Building2, Check, Inbox, Search, CalendarDays, FileText, Flag, Layers, Send, SlidersHorizontal } from "lucide-react";
import { useMe } from "./MeProvider";
import { MeetingFiles } from "./MeetingFiles";
import { ModalShell } from "./ModalShell";
import { can, type ModuleCode, type RoleCode } from "@/lib/rbac-config";
import { PageHeader, StatusBadge, STATUS_META, PRIORITY_META, isOverdue, formatDate } from "./ui";

type Level = "branch" | "department";

type Department = { id: number; name: string; code: string };

type Task = {
  id: number;
  title: string;
  description: string | null;
  level: Level;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "normal" | "high" | "urgent";
  parentTaskId: number | null;
  departmentId: number | null; // dùng cho cấp Phòng
  departments?: Department[]; // dùng cho cấp Phân Hiệu (có thể nhiều Phòng)
  createdBy: string | null;
  dueDate: string | null;
  meetingId: number | null;
  createdAt: string;
};

type Meeting = { id: number; title: string; meetingDate: string };

function meetingLabel(m: Meeting) {
  return `${m.title} (${formatDate(m.meetingDate)})`;
}

const STATUS_COLUMNS: { key: Task["status"]; label: string; color: string; tint: string }[] = [
  { key: "todo", label: STATUS_META.todo.label, color: STATUS_META.todo.color, tint: "#FFF8EE" },
  { key: "in_progress", label: STATUS_META.in_progress.label, color: STATUS_META.in_progress.color, tint: "#F3F8FE" },
  { key: "done", label: STATUS_META.done.label, color: STATUS_META.done.color, tint: "#F2FBF6" },
];

const MODULE_BY_LEVEL: Record<Level, ModuleCode> = {
  branch: "branch_tasks",
  department: "department_tasks",
};

type QuickFilter = "" | "todo" | "in_progress" | "done" | "overdue" | "joint";

const QUICK_FILTERS: { key: QuickFilter; label: string; color: string }[] = [
  { key: "", label: "Tất cả", color: "#B51F2E" },
  { key: "todo", label: "Cần làm", color: STATUS_META.todo.color },
  { key: "in_progress", label: "Đang thực hiện", color: STATUS_META.in_progress.color },
  { key: "done", label: "Hoàn thành", color: STATUS_META.done.color },
  { key: "overdue", label: "Quá hạn", color: "#DC3545" },
  { key: "joint", label: "Liên phòng", color: "#7C3AED" },
];

function matchesQuick(t: Task, f: Exclude<QuickFilter, "">) {
  if (f === "overdue") return isOverdue(t);
  if (f === "joint") return (t.departments?.length ?? 0) > 1;
  return t.status === f;
}

export function KanbanBoard({
  level,
  title,
  description,
}: {
  level: Level;
  title: string;
  description?: string;
}) {
  const { me } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);
  // Kéo-thả bằng ngón tay (điện thoại / máy tính bảng): nhấn giữ thẻ ~0,4s để nhấc lên
  const [touchDrag, setTouchDrag] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [touchOver, setTouchOver] = useState<Task["status"] | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  // Bỏ tích "Hoàn thành" → hỏi xác nhận rồi đưa về trạng thái trước đó
  const [reopenTask, setReopenTask] = useState<Task | null>(null);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeNoDue, setIncludeNoDue] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [quick, setQuick] = useState<QuickFilter>("");

  // Mở thẳng một nhiệm vụ khi đến từ thông báo: /dashboard/...?task=ID
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramTaskId = Number(searchParams.get("task")) || null;
  const paramTask = paramTaskId ? tasks.find((t) => t.id === paramTaskId) ?? null : null;
  const shownTask = activeTask ?? paramTask;
  function closeTask() {
    setActiveTask(null);
    if (paramTaskId) router.replace(pathname, { scroll: false });
  }

  const moduleCode = MODULE_BY_LEVEL[level];
  const myRoleCodes = useMemo(() => (me?.roles.map((r) => r.role) ?? []) as RoleCode[], [me]);
  const canCreate = myRoleCodes.some((r) => can(r, moduleCode, "create"));
  // Người chỉ có quyền xem (Quản trị, Ban Giám đốc) không đổi trạng thái được
  const canMove = myRoleCodes.some((r) => can(r, moduleCode, "update_status") || can(r, moduleCode, "create"));

  const loadTasks = useCallback(() => {
    setLoading(true);
    fetch(`/api/tasks?level=${level}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks ?? []))
      .finally(() => setLoading(false));
  }, [level]);

  useEffect(() => {
    loadTasks();
    fetch("/api/org")
      .then((r) => r.json())
      .then((data) => setDepartments(data.departments ?? []));
  }, [loadTasks]);

  // Chỉ nhiệm vụ cấp Phân Hiệu mới gắn với 1 cuộc họp cụ thể (được trích
  // xuất từ biên bản họp) — nhiệm vụ cấp Phòng không có mục lọc này. Một số
  // vai trò (Trưởng phòng) không có quyền xem "meetings" nên bỏ qua lỗi nếu
  // có, mục lọc sẽ tự ẩn khi danh sách cuộc họp rỗng.
  useEffect(() => {
    if (level !== "branch") return;
    fetch("/api/meetings")
      .then((r) => (r.ok ? r.json() : { meetings: [] }))
      .then((data) => setMeetings(data.meetings ?? []))
      .catch(() => setMeetings([]));
  }, [level]);

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name ?? "";

  function deptBadge(t: Task) {
    if (level === "department") return deptName(t.departmentId);
    if (!t.departments || t.departments.length === 0) return "";
    if (t.departments.length === 1) return t.departments[0].name;
    return `${t.departments.length} phòng phối hợp: ${t.departments.map((d) => d.code).join(", ")}`;
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }

  function onCardTouchStart(e: React.TouchEvent, t: Task) {
    if (!canMove || e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    cancelPress();
    pressStart.current = { x, y };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      suppressClick.current = true;
      navigator.vibrate?.(15);
      setTouchDrag({ task: t, x, y });
      setTouchOver(null);
    }, 380);
  }

  function onCardTouchMove(e: React.TouchEvent) {
    // Ngón tay di chuyển trước khi đủ thời gian giữ → đang cuộn trang, không kéo
    const st = pressStart.current;
    if (!st || !pressTimer.current) return;
    const { clientX, clientY } = e.touches[0];
    if (Math.abs(clientX - st.x) > 10 || Math.abs(clientY - st.y) > 10) cancelPress();
  }

  // Khi đang kéo: chặn cuộn trang, cho thẻ đi theo ngón tay, thả vào cột / ô trạng thái
  const dragTaskId = touchDrag?.task.id;
  useEffect(() => {
    if (dragTaskId == null) return;
    const targetAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-status]");
      return (el?.dataset.dropStatus as Task["status"] | undefined) ?? null;
    };
    let over: Task["status"] | null = null;
    const move = (e: TouchEvent) => {
      e.preventDefault();
      const { clientX: x, clientY: y } = e.touches[0];
      over = targetAt(x, y);
      setTouchOver(over);
      setTouchDrag((d) => (d ? { ...d, x, y } : d));
    };
    const end = () => {
      const task = tasks.find((t) => t.id === dragTaskId);
      if (over && task && over !== task.status) updateStatus(dragTaskId, over);
      setTouchDrag(null);
      setTouchOver(null);
      // Bỏ qua cú "click" trình duyệt phát ra ngay sau khi nhấc tay
      setTimeout(() => (suppressClick.current = false), 400);
    };
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragTaskId]);

  async function confirmReopen() {
    if (!reopenTask) return;
    setReopening(true);
    const res = await fetch(`/api/tasks/${reopenTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reopen" }),
    });
    const data = await res.json().catch(() => ({}));
    setReopening(false);
    setReopenTask(null);
    if (res.ok && data.task) {
      setTasks((ts) => ts.map((t) => (t.id === data.task.id ? { ...t, status: data.task.status } : t)));
    } else {
      setError(data.error ?? "Không thể mở lại công việc");
      setTimeout(() => setError(null), 3500);
    }
  }

  async function updateStatus(taskId: number, status: Task["status"]) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTasks(prev);
      setError(data.error ?? "Không thể cập nhật trạng thái");
      setTimeout(() => setError(null), 3500);
    }
  }

  const dateFilterActive = Boolean(fromDate || toDate);
  const meetingFilterActive = level === "branch" && Boolean(selectedMeetingId);

  // Hai bộ lọc độc lập, kết hợp với nhau (AND): lọc theo cuộc họp gốc và
  // lọc theo khoảng hạn hoàn thành — mỗi bộ lọc có thể bật/tắt riêng.
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (quick && !matchesQuick(t, quick)) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (deptFilter) {
        const ids = level === "department" ? [t.departmentId] : (t.departments ?? []).map((d) => d.id);
        if (!ids.includes(Number(deptFilter))) return false;
      }
      if (meetingFilterActive && String(t.meetingId ?? "") !== selectedMeetingId) return false;
      if (dateFilterActive) {
        if (!t.dueDate) return includeNoDue;
        const d = t.dueDate.slice(0, 10);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      return true;
    });
  }, [tasks, query, quick, priorityFilter, deptFilter, level, fromDate, toDate, includeNoDue, dateFilterActive, meetingFilterActive, selectedMeetingId]);

  const anyFilter = Boolean(query || quick || priorityFilter || deptFilter || dateFilterActive || meetingFilterActive);

  function clearFilters() {
    setQuick("");
    setQuery("");
    setPriorityFilter("");
    setDeptFilter("");
    setFromDate("");
    setToDate("");
    setSelectedMeetingId("");
  }

  const columns = useMemo(() => {
    const map: Record<Task["status"], Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of filteredTasks) map[t.status].push(t);
    return map;
  }, [filteredTasks]);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Tạo công việc
            </button>
          )
        }
      />

      {/* Bộ lọc */}
      <div className="todo-card mb-5 p-4">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Lọc nhanh">
          {QUICK_FILTERS.filter((f) => f.key !== "joint" || level === "branch").map((f) => {
            const active = quick === f.key;
            const count = f.key ? tasks.filter((t) => matchesQuick(t, f.key as Exclude<QuickFilter, "">)).length : tasks.length;
            return (
              <button
                key={f.key || "all"}
                type="button"
                onClick={() => setQuick(f.key)}
                aria-pressed={active}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                  active ? "border-transparent text-white" : "border-line bg-white text-ink hover:bg-slate-50"
                }`}
                style={active ? { background: f.color } : undefined}
              >
                {!active && f.key && <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />}
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/25 text-white" : "bg-slate-100 text-muted"}`}
                >
                  {loading ? "…" : count}
                </span>
              </button>
            );
          })}
        </div>
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${level === "branch" && meetings.length > 0 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor="kb-search" className="field-label">Tìm kiếm</label>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <input
              id="kb-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên công việc"
              className="field pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="btn btn-secondary sm:col-span-2 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showFilters ? "Ẩn bộ lọc" : "Bộ lọc"}
          </button>
          <div className={`${showFilters ? "contents" : "hidden"} lg:contents`}>
          <div>
            <label htmlFor="kb-dept" className="field-label">Đơn vị</label>
            <select id="kb-dept" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="field">
              <option value="">Tất cả đơn vị</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kb-priority" className="field-label">Mức ưu tiên</label>
            <select id="kb-priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="field">
              <option value="">Tất cả mức</option>
              {(Object.keys(PRIORITY_META) as Task["priority"][]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
          {level === "branch" && meetings.length > 0 && (
            <div>
              <label htmlFor="kb-meeting" className="field-label">Cuộc họp</label>
              <select
                id="kb-meeting"
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="field"
              >
                <option value="">Tất cả cuộc họp</option>
                {meetings.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {meetingLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="kb-from" className="field-label">Hạn từ ngày</label>
            <input id="kb-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="kb-to" className="field-label">Hạn đến ngày</label>
            <input id="kb-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="field" />
          </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          {dateFilterActive && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeNoDue} onChange={(e) => setIncludeNoDue(e.target.checked)} className="h-4 w-4" />
              Hiển thị cả công việc chưa có hạn
            </label>
          )}
          {anyFilter && (
            <>
              <span className="tabular-nums">
                Đang hiển thị {filteredTasks.length}/{tasks.length} công việc
              </span>
              <button onClick={clearFilters} className="btn btn-secondary btn-sm">
                <X className="h-3.5 w-3.5" /> Xoá bộ lọc
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Bảng Kanban: 3 cột trên desktop, cuộn ngang trên điện thoại */}
      <div className="thin-scrollbar -mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {STATUS_COLUMNS.map((col) => (
          <section
            key={col.key}
            aria-label={col.label}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.key);
            }}
            onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => {
              if (dragId != null) updateStatus(dragId, col.key);
              setDragId(null);
              setDragOverCol(null);
            }}
            data-drop-status={col.key}
            className={`flex w-[85vw] max-w-[380px] shrink-0 snap-start flex-col rounded-xl border bg-white sm:w-[340px] lg:w-auto lg:max-w-none ${
              dragOverCol === col.key || touchOver === col.key ? "border-red-300 ring-2 ring-red-100" : "border-line"
            }`}
          >
            <div
              className="flex items-center justify-between rounded-t-xl border-b border-line px-4 py-3"
              style={{ background: col.tint, boxShadow: `inset 0 3px 0 ${col.color}` }}
            >
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                {col.label}
              </h3>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted ring-1 ring-line">
                {loading ? "…" : columns[col.key].length}
              </span>
            </div>
            <div className="thin-scrollbar max-h-[68vh] min-h-[200px] flex-1 space-y-2.5 overflow-y-auto p-3">
              {loading ? (
                [0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />)
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {columns[col.key].map((t) => {
                      const overdue = isOverdue(t);
                      return (
                        <motion.article
                          key={t.id}
                          layout
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          draggable={canMove}
                          onDragStart={() => setDragId(t.id)}
                          onTouchStart={(e) => onCardTouchStart(e, t)}
                          onTouchMove={onCardTouchMove}
                          onTouchEnd={cancelPress}
                          onTouchCancel={cancelPress}
                          onContextMenu={(e) => {
                            // Nhấn giữ trên điện thoại: không hiện menu của trình duyệt
                            if (canMove && (pressTimer.current || touchDrag)) e.preventDefault();
                          }}
                          onClick={() => {
                            if (suppressClick.current) return;
                            setActiveTask(t);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setActiveTask(t);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Mở chi tiết: ${t.title}`}
                          className={`kanban-card group cursor-pointer rounded-lg border bg-white p-3 transition-colors hover:border-red-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${
                            touchDrag?.task.id === t.id ? "opacity-40" : ""
                          } ${
                            overdue ? "border-l-[3px] border-[#F5C2C7] border-l-overdue" : "border-line"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {canMove && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.status === "done") setReopenTask(t);
                                else updateStatus(t.id, "done");
                              }}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                t.status === "done"
                                  ? "border-done bg-done text-white"
                                  : "border-slate-300 text-transparent hover:border-done"
                              }`}
                              aria-label={t.status === "done" ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                            >
                              {t.status === "done" && <Check className="h-3 w-3 animate-check-pop" strokeWidth={3} />}
                            </button>
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[15px] font-semibold leading-snug ${
                                  t.status === "done" ? "text-slate-400 line-through" : "text-ink"
                                }`}
                              >
                                {t.title}
                              </p>
                              {deptBadge(t) && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{deptBadge(t)}</span>
                                </p>
                              )}
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                <span className={`badge ${PRIORITY_META[t.priority].cls}`}>
                                  <Flag className="h-3 w-3" />
                                  {PRIORITY_META[t.priority].label}
                                </span>
                                {t.dueDate && (
                                  <span className={`badge ${overdue ? "badge-overdue" : "badge-neutral"}`}>
                                    <Clock className="h-3 w-3" />
                                    {formatDate(t.dueDate)}
                                  </span>
                                )}
                                {overdue && <span className="badge badge-overdue">Quá hạn</span>}
                                {level === "branch" && (t.departments?.length ?? 0) > 1 && (
                                  <span className="badge badge-progress">Liên phòng</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                  {columns[col.key].length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-300">
                      <Inbox className="h-6 w-6" />
                      <p className="text-xs text-slate-400">{anyFilter ? "Không có việc khớp bộ lọc" : "Chưa có công việc"}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Kéo bằng ngón tay: thẻ "nổi" theo tay + 3 ô trạng thái lớn ở cuối màn hình */}
      <AnimatePresence>
        {touchDrag && (
          <>
            <div
              className="pointer-events-none fixed z-[90] w-[70vw] max-w-[300px] -translate-x-1/2 -translate-y-[120%] rotate-[-2deg] rounded-lg border border-red-200 bg-white p-3 shadow-2xl"
              style={{ left: touchDrag.x, top: touchDrag.y }}
            >
              <p className="line-clamp-2 text-[14px] font-semibold text-ink">{touchDrag.task.title}</p>
            </div>
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[80] grid grid-cols-3 gap-2 border-t border-line bg-white/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur"
            >
              {STATUS_COLUMNS.map((col) => {
                const current = touchDrag.task.status === col.key;
                const over = touchOver === col.key;
                return (
                  <div
                    key={col.key}
                    data-drop-status={col.key}
                    className={`flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center text-[13px] font-semibold transition-all ${
                      over ? "scale-105 text-white" : current ? "opacity-40" : "text-ink"
                    }`}
                    style={{
                      borderColor: col.color,
                      background: over ? col.color : col.tint,
                    }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: over ? "#fff" : col.color }} />
                    {col.label}
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reopenTask && (
          <ModalShell onClose={() => !reopening && setReopenTask(null)}>
            <h3 className="text-lg font-semibold text-ink">Mở lại công việc này?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="font-medium text-ink">“{reopenTask.title}”</span> sẽ bỏ trạng thái Hoàn thành và quay về
              trạng thái trước khi hoàn thành (Cần làm hoặc Đang thực hiện).
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setReopenTask(null)} disabled={reopening} className="btn btn-secondary">
                Huỷ
              </button>
              <button type="button" onClick={confirmReopen} disabled={reopening} className="btn btn-primary">
                {reopening ? "Đang mở lại…" : "Mở lại"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <CreateTaskModal
            level={level}
            departments={departments}
            myRoles={me?.roles ?? []}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              loadTasks();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shownTask && (
          <TaskDetailDrawer
            key={shownTask.id}
            task={tasks.find((t) => t.id === shownTask.id) ?? shownTask}
            deptName={deptName}
            onClose={closeTask}
            onChangeStatus={canMove ? (status) => updateStatus(shownTask.id, status) : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: tạo công việc mới
// ---------------------------------------------------------------------------

function CreateTaskModal({
  level,
  departments,
  myRoles,
  onClose,
  onCreated,
}: {
  level: Level;
  departments: Department[];
  myRoles: { role: RoleCode; departmentId: number | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myDeptScopes = myRoles.filter((r) => r.departmentId != null).map((r) => r.departmentId!);

  function toggleDept(id: number) {
    setDepartmentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body =
      level === "branch"
        ? { level, title, description, priority, dueDate: dueDate || null, departmentIds }
        : { level, title, description, priority, dueDate: dueDate || null, departmentId };
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể tạo công việc");
      return;
    }
    onCreated();
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Tạo công việc mới</h2>
        <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ct-title" className="field-label">Tên công việc <span className="text-red-600">*</span></label>
          <input id="ct-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
        </div>
        <div>
          <label htmlFor="ct-desc" className="field-label">Mô tả</label>
          <textarea id="ct-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="field" />
        </div>

        {level === "branch" ? (
          <div>
            <span className="field-label">Giao cho Phòng (chọn nhiều nếu là việc phối hợp liên phòng)</span>
            <div className="thin-scrollbar max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-[#d0d5dd] p-1.5">
              {departments.map((d) => (
                <label key={d.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-red-50">
                  <input type="checkbox" checked={departmentIds.includes(d.id)} onChange={() => toggleDept(d.id)} className="h-4 w-4" />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="ct-dept" className="field-label">Phòng <span className="text-red-600">*</span></label>
            <select id="ct-dept" required value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value))} className="field">
              <option value="">-- Chọn phòng --</option>
              {departments
                .filter((d) => myDeptScopes.length === 0 || myDeptScopes.includes(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ct-priority" className="field-label">Mức độ ưu tiên</label>
            <select id="ct-priority" value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className="field">
              <option value="low">Thấp</option>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </div>
          <div>
            <label htmlFor="ct-due" className="field-label">Hạn hoàn thành</label>
            <input id="ct-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field" />
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary">Huỷ</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Đang lưu..." : "Tạo công việc"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Drawer: chi tiết công việc + bình luận / báo cáo tiến độ
// (mở từ bên phải trên desktop, toàn màn hình trên điện thoại)
// ---------------------------------------------------------------------------

function TaskDetailDrawer({
  task,
  deptName,
  onClose,
  onChangeStatus,
}: {
  task: Task;
  deptName: (id: number | null) => string;
  onClose: () => void;
  onChangeStatus?: (status: Task["status"]) => void;
}) {
  const [comments, setComments] = useState<{ id: number; content: string; userName: string | null; createdAt: string }[]>([]);
  const [content, setContent] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .finally(() => setLoadingComments(false));
  }, [task.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((c) => [...c, { ...data.comment, userName: "Bạn" }]);
      setContent("");
    }
  }

  const overdue = isOverdue(task);
  const units =
    task.level === "department"
      ? [deptName(task.departmentId)].filter(Boolean)
      : (task.departments ?? []).map((d) => d.name);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/30"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết công việc ${task.title}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[520px]"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-ink">{task.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={task.status} />
              {overdue && <span className="badge badge-overdue">Quá hạn</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="thin-scrollbar flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Cập nhật trạng thái — phương án thay cho kéo thả trên thiết bị cảm ứng */}
          {onChangeStatus && (
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">Cập nhật trạng thái</h3>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_COLUMNS.map((c) => {
                const active = task.status === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => !active && onChangeStatus?.(c.key)}
                    aria-pressed={active}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium transition-colors ${
                      active ? "text-white" : "border-line bg-white text-ink hover:bg-slate-50"
                    }`}
                    style={active ? { background: c.color, borderColor: c.color } : undefined}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">Thông tin</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg bg-background p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted"><Building2 className="h-3.5 w-3.5" /> Đơn vị</dt>
                <dd className="mt-0.5 font-medium text-ink">{units.length ? units.join(", ") : "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" /> Hạn hoàn thành</dt>
                <dd className={`mt-0.5 font-medium ${overdue ? "text-overdue" : "text-ink"}`}>{formatDate(task.dueDate) || "Chưa đặt hạn"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted"><Flag className="h-3.5 w-3.5" /> Mức ưu tiên</dt>
                <dd className="mt-0.5"><span className={`badge ${PRIORITY_META[task.priority].cls}`}>{PRIORITY_META[task.priority].label}</span></dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted"><Layers className="h-3.5 w-3.5" /> Ngày tạo</dt>
                <dd className="mt-0.5 font-medium text-ink">{formatDate(task.createdAt)}</dd>
              </div>
              {task.meetingId && (
                <div className="sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-xs text-muted"><FileText className="h-3.5 w-3.5" /> Nguồn</dt>
                  <dd className="mt-0.5 font-medium text-ink">Trích xuất từ biên bản họp</dd>
                </div>
              )}
            </dl>
          </section>

          {task.meetingId && <MeetingFiles meetingId={task.meetingId} canEdit={false} />}

          {task.description && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-muted">Mô tả</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{task.description}</p>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              <MessageSquare className="h-4 w-4" /> Trao đổi / Báo cáo tiến độ
              {!loadingComments && <span className="tabular-nums">({comments.length})</span>}
            </h3>
            {loadingComments ? (
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ) : comments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">Chưa có trao đổi nào.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-700">
                      {(c.userName ?? "?").trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg bg-background px-3 py-2">
                      <p className="text-xs font-semibold text-ink">
                        {c.userName ?? "Người dùng"}
                        {c.createdAt && <span className="ml-1.5 font-normal text-muted">{new Date(c.createdAt).toLocaleString("vi-VN")}</span>}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{c.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form onSubmit={submitComment} className="flex gap-2 border-t border-line px-5 py-3">
          <label htmlFor="td-comment" className="sr-only">Bình luận</label>
          <input
            id="td-comment"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập báo cáo / bình luận..."
            className="field flex-1"
          />
          <button type="submit" disabled={!content.trim()} className="btn btn-primary" aria-label="Gửi bình luận">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </form>
      </motion.aside>
    </>
  );
}
