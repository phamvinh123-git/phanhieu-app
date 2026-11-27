"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, Copy, Check } from "lucide-react";
import { EmptyState, STATUS_META, formatDate } from "@/components/ui";

type Dept = { id: number; code: string; name: string };
type T = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  departments: Dept[];
  daysLeft: number | null;
  doneAt: string | null;
};
type P = { total: number; done: number; inProgress: number; todo: number; overdue: number };
type Report = {
  meeting: { id: number; title: string; meetingDate: string };
  progress: P;
  groups: { dept: Dept; progress: P; tasks: T[] }[];
};

const vn = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");

function statusText(t: T) {
  if (t.status === "done") return `Hoàn thành${t.doneAt ? ` ${vn(t.doneAt)}` : ""}`;
  if (t.daysLeft != null && t.daysLeft < 0) return `Quá hạn ${-t.daysLeft} ngày`;
  return STATUS_META[t.status].label;
}

function statusCls(t: T) {
  if (t.status === "done") return "badge-done";
  if (t.daysLeft != null && t.daysLeft < 0) return "badge-overdue";
  return t.status === "in_progress" ? "badge-progress" : "badge-todo";
}

export default function MeetingReportPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings/${id}/report`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? e : "Không tải được báo cáo"));
  }, [id]);

  const text = useMemo(() => {
    if (!data) return "";
    const p = data.progress;
    const lines = [
      `KẾT QUẢ THỰC HIỆN KẾT LUẬN CUỘC HỌP: ${data.meeting.title.toUpperCase()} (${vn(data.meeting.meetingDate)})`,
      `Tổng số ${p.total} nhiệm vụ: hoàn thành ${p.done}, đang thực hiện ${p.inProgress}, chưa bắt đầu ${p.todo}${p.overdue ? `, quá hạn ${p.overdue}` : ""}.`,
      "",
    ];
    data.groups.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.dept.name} (${g.progress.done}/${g.progress.total} hoàn thành${g.progress.overdue ? `, ${g.progress.overdue} quá hạn` : ""})`);
      for (const t of g.tasks) {
        const co = t.departments.slice(1).map((d) => d.code);
        lines.push(
          `   - [${statusText(t)}] ${t.title}${t.dueDate ? ` (hạn ${vn(t.dueDate)})` : ""}${co.length ? ` — phối hợp: ${co.join(", ")}` : ""}`
        );
      }
    });
    return lines.join("\n");
  }, [data]);

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <EmptyState title={error} />;
  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const p = data.progress;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/dashboard/meetings" className="btn btn-secondary btn-sm">
          <ArrowLeft className="h-4 w-4" /> Biên bản họp
        </Link>
        <div className="flex gap-2">
          <button onClick={copy} className="btn btn-secondary btn-sm">
            {copied ? <Check className="h-4 w-4 text-done" /> : <Copy className="h-4 w-4" />}
            {copied ? "Đã sao chép" : "Sao chép nội dung"}
          </button>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">
            <Printer className="h-4 w-4" /> In / Lưu PDF
          </button>
        </div>
      </div>

      <article className="todo-card p-6 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wide text-muted">
          Kết quả thực hiện kết luận cuộc họp
        </p>
        <h1 className="mt-1 text-center text-xl font-bold text-ink">{data.meeting.title}</h1>
        <p className="mt-1 text-center text-sm text-muted">Ngày họp {formatDate(data.meeting.meetingDate)} · cập nhật đến {formatDate(new Date())}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { l: "Tổng nhiệm vụ", v: p.total, c: "text-ink" },
            { l: "Hoàn thành", v: p.done, c: "text-done" },
            { l: "Đang thực hiện", v: p.inProgress, c: "text-progress" },
            { l: "Chưa bắt đầu", v: p.todo, c: "text-todo" },
            { l: "Quá hạn", v: p.overdue, c: "text-overdue" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg bg-background p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${k.c}`}>{k.v}</p>
              <p className="text-xs text-muted">{k.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-right text-xs tabular-nums text-muted">{pct}% hoàn thành</p>

        {data.groups.length === 0 && <EmptyState title="Cuộc họp này chưa có nhiệm vụ trong phạm vi của bạn" />}

        {data.groups.map((g, i) => (
          <section key={g.dept.id} className="mt-6 break-inside-avoid">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-[15px] font-semibold text-ink">
              <span>
                {i + 1}. {g.dept.name}
              </span>
              <span className="text-[13px] font-normal tabular-nums text-muted">
                {g.progress.done}/{g.progress.total} hoàn thành
                {g.progress.overdue > 0 && <span className="text-overdue"> · {g.progress.overdue} quá hạn</span>}
              </span>
            </h2>
            <ul className="mt-2 space-y-2">
              {g.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-sm">
                  <span className={`badge mt-0.5 shrink-0 ${statusCls(t)}`}>{statusText(t)}</span>
                  <span className="min-w-0 flex-1 text-ink">
                    <Link href={`/dashboard/branch-tasks?task=${t.id}`} className="hover:text-red-700 print:no-underline">
                      {t.title}
                    </Link>
                    <span className="block text-xs text-muted">
                      {t.dueDate ? `Hạn ${vn(t.dueDate)}` : "Chưa đặt hạn"}
                      {t.departments.length > 1 && ` · phối hợp: ${t.departments.slice(1).map((d) => d.code).join(", ")}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>
    </div>
  );
}
