"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList } from "lucide-react";
import { EmptyState, KpiCard, PageHeader } from "@/components/ui";

type T = { id: number; title: string; dueDate: string | null; departments: { code: string }[]; daysLeft: number | null; doneAt: string | null };
type W = {
  week: { thisMon: string; thisSun: string; lastMon: string; lastSun: string };
  doneLastWeek: T[];
  dueThisWeek: T[];
  overdue: T[];
  newLastWeek: T[];
  openTotal: number;
};

const vn = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");

function Section({ title, items, tone, note }: { title: string; items: T[]; tone: string; note: (t: T) => string }) {
  return (
    <section className="todo-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone }} />
        {title}
        <span className="badge badge-neutral tabular-nums">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Không có</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/branch-tasks?task=${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-[#FFF5F5]">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t.title}</span>
                  <span className="text-xs text-muted">{t.departments.map((d) => d.code).join(", ")}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{note(t)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function WeeklyPage() {
  const [d, setD] = useState<W | null>(null);
  useEffect(() => {
    fetch("/api/insights/weekly")
      .then((r) => r.json())
      .then(setD);
  }, []);

  if (!d) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  return (
    <div>
      <PageHeader title="Bản tin tuần" description={`Tuần ${vn(d.week.thisMon)} – ${vn(d.week.thisSun)}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Quá hạn" value={d.overdue.length} icon={AlertTriangle} tone="overdue" />
        <KpiCard label="Đến hạn 7 ngày tới" value={d.dueThisWeek.length} icon={CalendarClock} tone="todo" />
        <KpiCard label="Hoàn thành tuần trước" value={d.doneLastWeek.length} icon={CheckCircle2} tone="done" hint={`${vn(d.week.lastMon)} – ${vn(d.week.lastSun)}`} />
        <KpiCard label="Mới được giao tuần trước" value={d.newLastWeek.length} icon={ClipboardList} tone="brand" />
      </div>
      {d.openTotal === 0 && d.doneLastWeek.length === 0 ? (
        <div className="todo-card mt-5">
          <EmptyState title="Không có nhiệm vụ nào trong phạm vi của bạn" />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Section title="Quá hạn" items={d.overdue} tone="#DC3545" note={(t) => `quá ${-(t.daysLeft ?? 0)} ngày`} />
          <Section title="Đến hạn trong 7 ngày tới" items={d.dueThisWeek} tone="#D97706" note={(t) => `hạn ${vn(t.dueDate)}`} />
          <Section title="Mới được giao tuần trước" items={d.newLastWeek} tone="#2878D0" note={(t) => (t.dueDate ? `hạn ${vn(t.dueDate)}` : "")} />
          <Section title="Hoàn thành tuần trước" items={d.doneLastWeek} tone="#16A36A" note={(t) => (t.doneAt ? vn(t.doneAt) : "")} />
        </div>
      )}
    </div>
  );
}
