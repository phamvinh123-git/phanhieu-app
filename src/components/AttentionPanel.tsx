"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, BellRing, Building2, Check, Clock, MoonStar, X } from "lucide-react";
import { ModalShell } from "./ModalShell";

type Dept = { id: number; code: string; name: string };
type T = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  departments: Dept[];
  daysLeft: number | null;
  lastActivity: string;
  silentDays?: number;
};
type Data = {
  notStarted: T[];
  silent: T[];
  overdue: T[];
  hotspots: { dept: Dept; overdue: number; open: number }[];
  canRemind: boolean;
  silentThreshold: number;
};

const vn = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");

type TabKey = "overdue" | "notStarted" | "silent";

/**
 * "Cần lãnh đạo lưu ý": việc quá hạn, việc sắp đến hạn mà chưa bắt đầu, việc
 * lâu không cập nhật, và Phòng đang dồn nhiều việc quá hạn. Lãnh đạo / Thư ký
 * có nút "Nhắc" gửi thông báo (và email) tới Phòng phụ trách.
 */
export function AttentionPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<TabKey | null>(null);
  const [remindTask, setRemindTask] = useState<T | null>(null);
  const [reminded, setReminded] = useState<Record<number, boolean>>({});

  const load = useCallback(() => {
    fetch("/api/insights/attention")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!data) return <div className="todo-card mt-5 h-40 animate-pulse bg-slate-50" />;

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; items: T[]; tone: string }[] = [
    { key: "overdue", label: "Quá hạn", icon: AlertTriangle, items: data.overdue, tone: "#DC3545" },
    { key: "notStarted", label: "Sắp đến hạn chưa bắt đầu", icon: Clock, items: data.notStarted, tone: "#D97706" },
    { key: "silent", label: `Không cập nhật ≥ ${data.silentThreshold} ngày`, icon: MoonStar, items: data.silent, tone: "#667085" },
  ];
  const current = tab ?? tabs.find((t) => t.items.length)?.key ?? "overdue";
  const active = tabs.find((t) => t.key === current)!;
  const total = data.overdue.length + data.notStarted.length + data.silent.length;

  function note(t: T) {
    if (current === "overdue") return `Quá hạn ${-(t.daysLeft ?? 0)} ngày`;
    if (current === "notStarted") return t.daysLeft === 0 ? "Hạn hôm nay" : `Còn ${t.daysLeft} ngày`;
    return `${t.silentDays} ngày chưa cập nhật`;
  }

  return (
    <section className="todo-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          <AlertTriangle className="h-[18px] w-[18px] text-todo" />
          {data.canRemind ? "Cần lãnh đạo lưu ý" : "Cần lưu ý"}
          {total > 0 && <span className="badge badge-overdue tabular-nums">{total}</span>}
        </h2>
      </div>

      {data.hotspots.length > 0 && (
        <div className="mx-5 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">Phòng đang dồn việc quá hạn:</span>
          {data.hotspots.map((h) => (
            <span key={h.dept.id} className="badge bg-white text-[#B91C1C] ring-1 ring-[#F5C2C7]" title={h.dept.name}>
              {h.dept.code} · {h.overdue}/{h.open} việc
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = t.key === current;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                on ? "border-red-600 text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className="rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-muted">{t.items.length}</span>
            </button>
          );
        })}
      </div>

      {active.items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
          <Check className="h-4 w-4 text-done" /> Không có việc nào.
        </p>
      ) : (
        <ul className="thin-scrollbar max-h-[420px] divide-y divide-line overflow-y-auto">
          {active.items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FFF5F5]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: active.tone }} />
              <Link href={`/dashboard/branch-tasks?task=${t.id}`} className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink hover:text-red-700">{t.title}</span>
                <span className="text-xs text-muted">
                  {t.departments.map((d) => d.code).join(", ") || "—"}
                  {t.dueDate && ` · hạn ${vn(t.dueDate)}`}
                </span>
              </Link>
              <span className="hidden shrink-0 text-xs font-medium tabular-nums text-muted sm:block">{note(t)}</span>
              {data.canRemind &&
                (reminded[t.id] ? (
                  <span className="flex h-[34px] shrink-0 items-center gap-1 px-2 text-xs font-medium text-done">
                    <Check className="h-3.5 w-3.5" /> Đã nhắc
                  </span>
                ) : (
                  <button onClick={() => setRemindTask(t)} className="btn btn-soft btn-sm shrink-0">
                    <BellRing className="h-3.5 w-3.5" /> Nhắc
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {remindTask && (
          <RemindModal
            task={remindTask}
            onClose={() => setRemindTask(null)}
            onDone={(id) => {
              setReminded((m) => ({ ...m, [id]: true }));
              setRemindTask(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function RemindModal({ task, onClose, onDone }: { task: T; onClose: () => void; onDone: (id: number) => void }) {
  const overdue = task.daysLeft != null && task.daysLeft < 0;
  const [message, setMessage] = useState(
    overdue
      ? "Nhiệm vụ đã quá hạn, đề nghị đơn vị khẩn trương hoàn thành và báo cáo kết quả."
      : "Đề nghị đơn vị khẩn trương triển khai và cập nhật tiến độ."
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/tasks/${task.id}/remind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Không gửi được lời nhắc");
      return;
    }
    onDone(task.id);
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Nhắc nhiệm vụ</h2>
          <p className="mt-0.5 text-sm text-muted">{task.title}</p>
          <p className="text-xs text-muted">Gửi tới: {task.departments.map((d) => d.name).join(", ")}</p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <label htmlFor="remind-msg" className="field-label">Lời nhắc</label>
      <textarea id="remind-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="field" maxLength={300} />
      <p className="mt-1 text-xs text-muted">Lời nhắc được gửi vào chuông thông báo (và email nếu đã cài) của Phòng phụ trách, đồng thời ghi vào phần trao đổi của nhiệm vụ.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-secondary">Huỷ</button>
        <button onClick={send} disabled={sending || !message.trim()} className="btn btn-primary">
          <BellRing className="h-4 w-4" /> {sending ? "Đang gửi…" : "Gửi lời nhắc"}
        </button>
      </div>
    </ModalShell>
  );
}
