"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  History,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogIn,
  ShieldAlert,
  ClipboardList,
  FileText,
  UserCog,
  Server,
  RotateCcw,
} from "lucide-react";
import { useMe } from "@/components/MeProvider";
import { PageHeader, EmptyState } from "@/components/ui";

type Log = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};
type Resp = {
  logs: Log[];
  total: number;
  page: number;
  pageSize: number;
  actors: { id: string; name: string | null }[];
  actions: Record<string, string>;
};

const ENTITY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  auth: { label: "Đăng nhập", icon: LogIn, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  task: { label: "Công việc", icon: ClipboardList, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  meeting: { label: "Biên bản họp", icon: FileText, cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  user: { label: "Tài khoản", icon: UserCog, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  system: { label: "Hệ thống", icon: Server, cls: "bg-slate-100 text-slate-700 ring-slate-200" },
};
const DANGER = new Set(["auth.login_failed", "user.lock", "user.auto_lock", "system.reset_work_data", "meeting.file_delete"]);

const todayVN = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
function shiftDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fmtTime = (s: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(s));
const fmtDay = (s: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(s));
const dayKey = (s: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(s));

/** Rút gọn User-Agent: "Chrome · Windows" */
function device(ua: string | null) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /CocCoc|coc_coc/i.test(ua)
        ? "Cốc Cốc"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

const FIELD_VN: Record<string, string> = { title: "Tiêu đề", description: "Mô tả", priority: "Ưu tiên", dueDate: "Hạn", from: "Từ", to: "Sang" };
const STATUS_VN: Record<string, string> = { todo: "Cần làm", in_progress: "Đang thực hiện", done: "Hoàn thành" };
const PRIORITY_VN: Record<string, string> = { low: "Thấp", normal: "Bình thường", high: "Cao", urgent: "Khẩn" };
function val(v: unknown) {
  if (v == null || v === "") return "(trống)";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10).split("-").reverse().join("/");
  return STATUS_VN[s] ?? PRIORITY_VN[s] ?? s;
}

/** Chi tiết thay đổi (trước → sau) nếu có */
function MetaDetail({ log }: { log: Log }) {
  const m = log.meta;
  if (!m) return null;
  if (log.action === "task.update") {
    return (
      <ul className="space-y-1">
        {Object.entries(m as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => (
          <li key={k}>
            <span className="font-medium text-ink">{FIELD_VN[k] ?? k}:</span>{" "}
            <span className="text-overdue line-through decoration-1">{val(v?.from)}</span> → <span className="text-emerald-700">{val(v?.to)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <pre className="whitespace-pre-wrap break-all text-[12px] text-muted">{JSON.stringify(m, null, 2)}</pre>;
}

export default function AuditPage() {
  const { me } = useMe();
  const isAdmin = me?.roles.some((r) => r.role === "admin");
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState(() => shiftDays(todayVN(), -6));
  const [to, setTo] = useState(() => todayVN());
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (qDebounced.trim()) p.set("q", qDebounced.trim());
    if (entity) p.set("entity", entity);
    if (action) p.set("action", action);
    if (actor) p.set("actor", actor);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [qDebounced, entity, action, actor, from, to]);

  // Đổi bộ lọc thì tự quay về trang 1
  const filterKey = params.toString();
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (fn: (p: number) => number) => setPageState({ key: filterKey, page: fn(page) });
  const requestKey = `${filterKey}&page=${page}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!me || !isAdmin) return;
    let cancelled = false;
    fetch(`/api/admin/audit?${requestKey}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(d.error ?? "Không tải được lịch sử");
        else {
          setError(null);
          setData(d);
        }
      })
      .catch(() => !cancelled && setError("Không tải được lịch sử"))
      .finally(() => !cancelled && setLoadedKey(requestKey));
    return () => {
      cancelled = true;
    };
  }, [me, isAdmin, requestKey]);

  if (me && !isAdmin) {
    return <EmptyState icon={ShieldAlert} title="Chỉ quản trị hệ thống được xem lịch sử truy vết" />;
  }

  const actionsForEntity = Object.entries(data?.actions ?? {}).filter(([k]) => !entity || k.startsWith(`${entity}.`));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const today = todayVN();
  const quick = [
    { label: "Hôm nay", from: today, to: today },
    { label: "7 ngày", from: shiftDays(today, -6), to: today },
    { label: "30 ngày", from: shiftDays(today, -29), to: today },
    { label: "Tất cả", from: "", to: "" },
  ];
  const filtered = Boolean(q || entity || action || actor);

  // Nhóm theo ngày
  const groups: { day: string; label: string; logs: Log[] }[] = [];
  for (const l of data?.logs ?? []) {
    const k = dayKey(l.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.day === k) g.logs.push(l);
    else groups.push({ day: k, label: fmtDay(l.createdAt), logs: [l] });
  }

  return (
    <div>
      <PageHeader
        title="Lịch sử truy vết"
        description="Ghi lại mọi thao tác quan trọng: ai làm gì, lúc nào, từ thiết bị nào."
        actions={
          <a href={`/api/admin/audit?${params}&format=csv`} className="btn btn-secondary">
            <Download className="h-4 w-4" /> Xuất Excel (CSV)
          </a>
        }
      />

      {/* Bộ lọc */}
      <section className="todo-card mb-5 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {quick.map((r) => {
            const active = from === r.from && to === r.to;
            return (
              <button
                key={r.label}
                onClick={() => {
                  setFrom(r.from);
                  setTo(r.to);
                }}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition ${
                  active ? "bg-red-700 text-white ring-red-700" : "bg-white text-ink ring-line hover:bg-slate-50"
                }`}
              >
                {r.label}
              </button>
            );
          })}
          <div className="flex w-full items-center gap-2 text-[13px] text-muted sm:ml-auto sm:w-auto">
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="field !h-9 min-w-0 flex-1 sm:!w-auto sm:flex-none" />
            <span>→</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="field !h-9 min-w-0 flex-1 sm:!w-auto sm:flex-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_220px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo nội dung, tên người, IP…"
              className="field !pl-9"
            />
          </div>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setAction("");
            }}
            className="field"
          >
            <option value="">Mọi nhóm</option>
            {Object.entries(ENTITY_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="field">
            <option value="">Mọi hành động</option>
            {actionsForEntity.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className="field">
            <option value="">Mọi người thao tác</option>
            {(data?.actors ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.id}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              onClick={() => {
                setQ("");
                setEntity("");
                setAction("");
                setActor("");
              }}
              className="btn btn-secondary"
            >
              <RotateCcw className="h-4 w-4" /> Bỏ lọc
            </button>
          )}
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-100 bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{error}</p>}

      <section className="todo-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-muted">
          <span>
            {loading && !data ? "Đang tải…" : <><b className="text-ink">{data?.total ?? 0}</b> thao tác</>}
          </span>
          {data && data.total > data.pageSize && (
            <span className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-secondary !h-8 !px-2 disabled:opacity-40" aria-label="Trang trước">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 tabular-nums">
                {page}/{totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-secondary !h-8 !px-2 disabled:opacity-40" aria-label="Trang sau">
                <ChevronRight className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState icon={History} title="Chưa có thao tác nào trong khoảng thời gian này" />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            {groups.map((g) => (
              <div key={g.day}>
                <p className="sticky top-0 z-[1] bg-slate-50/95 px-5 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted backdrop-blur first-letter:uppercase">
                  {g.label}
                </p>
                <ul className="divide-y divide-line">
                  {g.logs.map((l) => {
                    const em = ENTITY_META[l.entityType ?? ""] ?? ENTITY_META.system;
                    const Icon = em.icon;
                    const danger = DANGER.has(l.action);
                    const hasDetail = Boolean(l.meta) || Boolean(l.userAgent);
                    const isOpen = open === l.id;
                    return (
                      <li key={l.id} className={danger ? "bg-[#FEF2F2]/60" : ""}>
                        <button
                          type="button"
                          onClick={() => hasDetail && setOpen(isOpen ? null : l.id)}
                          className="grid w-full grid-cols-[64px_1fr] items-start gap-3 px-5 py-3 text-left hover:bg-slate-50/80 md:grid-cols-[72px_190px_1fr_170px_16px]"
                        >
                          <span className="pt-0.5 text-[13px] tabular-nums text-muted">{fmtTime(l.createdAt)}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium text-ink">{l.actorName ?? "Hệ thống"}</span>
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                                danger ? "bg-red-50 text-red-700 ring-red-200" : em.cls
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {data?.actions[l.action] ?? l.action}
                            </span>
                          </span>
                          <span className="col-span-2 min-w-0 text-[14px] text-ink md:col-span-1">
                            {l.summary}
                            {l.entityType === "task" && l.entityId && (
                              <Link
                                href={`/dashboard/branch-tasks?task=${l.entityId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="ml-2 text-[12px] font-medium text-red-700 hover:underline"
                              >
                                Mở công việc
                              </Link>
                            )}
                          </span>
                          <span className="col-span-2 text-[12px] text-muted md:col-span-1">
                            {l.ip && <span className="block tabular-nums">{l.ip}</span>}
                            <span className="block truncate">{device(l.userAgent)}</span>
                          </span>
                          <span className="hidden pt-1 md:block">
                            {hasDetail && <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="mx-5 mb-3 space-y-2 rounded-lg bg-slate-50 px-4 py-3 text-[13px] md:ml-[calc(72px+190px+2.5rem)]">
                            <MetaDetail log={l} />
                            {l.userAgent && <p className="break-all text-[12px] text-muted">Thiết bị: {l.userAgent}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
