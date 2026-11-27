"use client";

/**
 * Thành phần giao diện dùng chung theo đặc tả HMU TaskFlow:
 * tiêu đề trang, thẻ KPI, badge trạng thái, trạng thái rỗng.
 */

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export type TaskStatus = "todo" | "in_progress" | "done";

export const STATUS_META: Record<TaskStatus, { label: string; badge: string; color: string; dot: string }> = {
  todo: { label: "Cần làm", badge: "badge-todo", color: "#D97706", dot: "bg-todo" },
  in_progress: { label: "Đang thực hiện", badge: "badge-progress", color: "#2878D0", dot: "bg-progress" },
  done: { label: "Hoàn thành", badge: "badge-done", color: "#16A36A", dot: "bg-done" },
};

export const PRIORITY_META: Record<"low" | "normal" | "high" | "urgent", { label: string; cls: string }> = {
  low: { label: "Thấp", cls: "badge-neutral" },
  normal: { label: "Bình thường", cls: "badge-neutral" },
  high: { label: "Cao", cls: "badge-todo" },
  urgent: { label: "Khẩn cấp", cls: "badge-overdue" },
};

/** Công việc chưa hoàn thành và đã qua hạn (so theo ngày). */
export function isOverdue(t: { status: string; dueDate: string | null }) {
  if (t.status === "done" || !t.dueDate) return false;
  const due = new Date(t.dueDate);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

/** Còn ≤ `days` ngày đến hạn và chưa hoàn thành. */
export function isDueSoon(t: { status: string; dueDate: string | null }, days = 7) {
  if (t.status === "done" || !t.dueDate || isOverdue(t)) return false;
  const due = new Date(t.dueDate).getTime();
  return due - Date.now() <= days * 86400000;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue) return <span className="badge badge-overdue">Quá hạn</span>;
  const m = STATUS_META[status];
  return <span className={`badge ${m.badge}`}>{m.label}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "brand" | "todo" | "progress" | "done" | "overdue";
}) {
  const tones: Record<string, string> = {
    brand: "bg-red-50 text-red-600",
    todo: "bg-[#FFF4E5] text-todo",
    progress: "bg-[#EFF6FF] text-progress",
    done: "bg-[#ECFDF3] text-done",
    overdue: "bg-[#FEF2F2] text-overdue",
  };
  return (
    <div className="todo-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="kpi-number mt-2 text-[30px] font-bold leading-none text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint }: { icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}
