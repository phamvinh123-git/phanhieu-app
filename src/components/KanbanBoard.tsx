"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Clock, MessageSquare, User as UserIcon, Building2, Check, Inbox, Filter, FileText } from "lucide-react";
import { useMe } from "./MeProvider";
import { ModalShell } from "./ModalShell";
import { can, type ModuleCode, type RoleCode } from "@/lib/rbac-config";

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
  departments?: Department[]; // dùng cho cấp Phân hiệu (có thể nhiều Phòng)
  createdBy: string | null;
  dueDate: string | null;
  meetingId: number | null;
  createdAt: string;
};

type Meeting = { id: number; title: string; meetingDate: string };

function meetingLabel(m: Meeting) {
  const d = new Date(m.meetingDate);
  const ds = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${m.title} (${ds})`;
}

const STATUS_COLUMNS: { key: Task["status"]; label: string; dot: string; headerBg: string }[] = [
  { key: "todo", label: "Cần làm", dot: "bg-slate-400", headerBg: "from-slate-100 to-transparent" },
  { key: "in_progress", label: "Đang thực hiện", dot: "bg-red-500", headerBg: "from-red-100 to-transparent" },
  { key: "done", label: "Hoàn thành", dot: "bg-emerald-500", headerBg: "from-emerald-100 to-transparent" },
];

const PRIORITY_STYLE: Record<Task["priority"], string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const PRIORITY_DOT: Record<Task["priority"], string> = {
  low: "bg-slate-400",
  normal: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn cấp",
};

const MODULE_BY_LEVEL: Record<Level, ModuleCode> = {
  branch: "branch_tasks",
  department: "department_tasks",
};

export function KanbanBoard({
  level,
  title,
  description,
}: {
  level: Level;
  title: string;
  description: string;
}) {
  const { me } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeNoDue, setIncludeNoDue] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const moduleCode = MODULE_BY_LEVEL[level];
  const myRoleCodes = useMemo(() => (me?.roles.map((r) => r.role) ?? []) as RoleCode[], [me]);
  const canCreate = myRoleCodes.some((r) => can(r, moduleCode, "create"));

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

  // Chỉ nhiệm vụ cấp Phân hiệu mới gắn với 1 cuộc họp cụ thể (được trích
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
    return tasks.filter((t) => {
      if (meetingFilterActive && String(t.meetingId ?? "") !== selectedMeetingId) return false;
      if (dateFilterActive) {
        if (!t.dueDate) return includeNoDue;
        const d = t.dueDate.slice(0, 10);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      return true;
    });
  }, [tasks, fromDate, toDate, includeNoDue, dateFilterActive, meetingFilterActive, selectedMeetingId]);

  function clearDateFilter() {
    setFromDate("");
    setToDate("");
  }

  function clearMeetingFilter() {
    setSelectedMeetingId("");
  }

  const columns = useMemo(() => {
    const map: Record<Task["status"], Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of filteredTasks) map[t.status].push(t);
    return map;
  }, [filteredTasks]);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        {canCreate && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/25 transition-colors hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Tạo công việc
          </motion.button>
        )}
      </div>

      <div className="todo-card mb-5 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div className="flex items-center gap-1.5 pb-2 text-sm font-medium text-slate-500">
          <Filter className="h-4 w-4 text-red-500" />
          Lọc theo hạn hoàn thành
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Từ ngày
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-red-300"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Đến ngày
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-red-300"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-2.5 text-xs font-medium text-slate-500">
          <input
            type="checkbox"
            checked={includeNoDue}
            onChange={(e) => setIncludeNoDue(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-400"
          />
          Hiển thị cả công việc chưa có hạn
        </label>
        {dateFilterActive && (
          <button
            onClick={clearDateFilter}
            className="mb-0.5 flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <X className="h-3.5 w-3.5" /> Xóa lọc
          </button>
        )}
        {dateFilterActive && (
          <span className="pb-2.5 text-xs text-slate-400">
            Đang hiển thị {filteredTasks.length}/{tasks.length} công việc
          </span>
        )}
      </div>

      {level === "branch" && meetings.length > 0 && (
        <div className="todo-card mb-5 flex flex-wrap items-end gap-3 px-4 py-3.5">
          <div className="flex items-center gap-1.5 pb-2 text-sm font-medium text-slate-500">
            <FileText className="h-4 w-4 text-red-500" />
            Lọc theo cuộc họp
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Chọn cuộc họp
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="min-w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-red-300"
            >
              <option value="">Tất cả cuộc họp</option>
              {meetings.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {meetingLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {meetingFilterActive && (
            <button
              onClick={clearMeetingFilter}
              className="mb-0.5 flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" /> Xóa lọc
            </button>
          )}
          {meetingFilterActive && (
            <span className="pb-2.5 text-xs text-slate-400">
              Đang hiển thị {filteredTasks.length}/{tasks.length} công việc
            </span>
          )}
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="todo-card h-40 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATUS_COLUMNS.map((col) => (
            <div
              key={col.key}
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
              className={`todo-card min-h-[220px] overflow-hidden p-0 transition-shadow ${
                dragOverCol === col.key ? "ring-2 ring-red-400" : ""
              }`}
            >
              <div className={`flex items-center justify-between bg-gradient-to-b ${col.headerBg} px-3.5 py-3`}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.label}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">
                  {columns[col.key].length}
                </span>
              </div>
              <div className="thin-scrollbar max-h-[65vh] space-y-2 overflow-y-auto p-3">
                <AnimatePresence initial={false}>
                  {columns[col.key].map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      whileHover={{ y: -2 }}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      className="group cursor-pointer rounded-xl border border-slate-100 bg-white p-3 text-sm shadow-sm transition-colors hover:border-red-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(t.id, t.status === "done" ? "todo" : "done");
                          }}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            t.status === "done"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 text-transparent hover:border-red-400"
                          }`}
                          aria-label="Đánh dấu hoàn thành"
                        >
                          {t.status === "done" && <Check className="h-3 w-3 animate-check-pop" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1" onClick={() => setActiveTask(t)}>
                          <p
                            className={`font-medium leading-snug ${
                              t.status === "done" ? "text-slate-400 line-through" : "text-slate-800"
                            }`}
                          >
                            {t.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                              {PRIORITY_LABEL[t.priority]}
                            </span>
                            {t.dueDate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                <Clock className="h-3 w-3" />
                                {new Date(t.dueDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                            {level === "branch" && (t.departments?.length ?? 0) > 1 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                <Building2 className="h-3 w-3" /> Liên phòng
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-[11px] text-slate-400">{deptBadge(t)}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {columns[col.key].length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-300">
                    <Inbox className="h-6 w-6" />
                    <p className="text-xs">Trống</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
        {activeTask && (
          <TaskDetailModal task={activeTask} deptName={deptName} onClose={() => setActiveTask(null)} />
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
    <ModalShell onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Tạo công việc mới</h2>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tiêu đề</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-200"
          />
        </div>

        {level === "branch" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Giao cho Phòng (chọn nhiều nếu là việc phối hợp liên phòng)
            </label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-red-50">
                  <input
                    type="checkbox"
                    checked={departmentIds.includes(d.id)}
                    onChange={() => toggleDept(d.id)}
                    className="accent-red-600"
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Phòng</label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Mức độ ưu tiên</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="low">Thấp</option>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Hạn hoàn thành</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/25 transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Tạo công việc"}
        </motion.button>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Modal: chi tiết công việc + bình luận / báo cáo tiến độ
// ---------------------------------------------------------------------------

function TaskDetailModal({
  task,
  deptName,
  onClose,
}: {
  task: Task;
  deptName: (id: number | null) => string;
  onClose: () => void;
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

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
        <button onClick={onClose} className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {task.description && <p className="mb-3 text-sm text-slate-600">{task.description}</p>}

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
        {task.level === "department" && task.departmentId && (
          <span className="rounded-full bg-slate-100 px-2 py-1">Phòng: {deptName(task.departmentId)}</span>
        )}
        {task.level === "branch" &&
          task.departments?.map((d) => (
            <span key={d.id} className="rounded-full bg-slate-100 px-2 py-1">
              {d.name}
            </span>
          ))}
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <Clock className="h-3 w-3" /> Hạn: {new Date(task.dueDate).toLocaleDateString("vi-VN")}
          </span>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <MessageSquare className="h-4 w-4" /> Trao đổi / Báo cáo tiến độ
        </h3>
        {loadingComments ? (
          <p className="text-xs text-slate-400">Đang tải...</p>
        ) : (
          <div className="thin-scrollbar mb-3 max-h-52 space-y-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {comments.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-slate-50 p-2.5 text-sm"
                >
                  <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <UserIcon className="h-3 w-3" /> {c.userName ?? "Người dùng"}
                  </p>
                  <p className="text-slate-700">{c.content}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {comments.length === 0 && <p className="text-xs text-slate-300">Chưa có trao đổi nào.</p>}
          </div>
        )}
        <form onSubmit={submitComment} className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập báo cáo / bình luận..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-200"
          />
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            className="rounded-xl bg-red-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-red-600/25 hover:bg-red-700"
          >
            Gửi
          </motion.button>
        </form>
      </div>
    </ModalShell>
  );
}
