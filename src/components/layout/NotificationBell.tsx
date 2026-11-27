"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, MessageSquare, Clock, AlertTriangle, ClipboardList, CheckCheck, Newspaper } from "lucide-react";

type Item = {
  id: number;
  type: "comment" | "assigned" | "due_soon" | "overdue" | "reminder" | "digest";
  message: string;
  taskId: number | null;
  taskTitle: string | null;
  read: boolean;
  createdAt: string;
  link: string | null;
};

const TYPE_META: Record<Item["type"], { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  comment: { icon: MessageSquare, cls: "bg-[#EFF6FF] text-progress", label: "Trao đổi mới" },
  assigned: { icon: ClipboardList, cls: "bg-red-50 text-red-600", label: "Nhiệm vụ mới" },
  due_soon: { icon: Clock, cls: "bg-[#FFF4E5] text-todo", label: "Sắp đến hạn" },
  overdue: { icon: AlertTriangle, cls: "bg-[#FEF2F2] text-overdue", label: "Quá hạn" },
  reminder: { icon: BellRing, cls: "bg-red-50 text-red-700", label: "Lãnh đạo nhắc" },
  digest: { icon: Newspaper, cls: "bg-[#ECFDF3] text-done", label: "Bản tin tuần" },
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setItems(d.items ?? []);
        setUnread(d.unread ?? 0);
      })
      .catch(() => {});
  }, []);

  // Tải khi mở trang, rồi cập nhật mỗi phút
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(body: { ids: number[] } | { all: true }) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function openItem(it: Item) {
    setOpenOn(null);
    if (!it.read) {
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, read: true } : x)));
      setUnread((n) => Math.max(0, n - 1));
      void markRead({ ids: [it.id] });
    }
    if (it.link) router.push(it.link);
  }

  async function readAll() {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await markRead({ all: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) load();
          setOpenOn(open ? null : pathname);
        }}
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,400px)] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[15px] font-semibold text-ink">Thông báo</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="flex items-center gap-1 text-[13px] font-medium text-red-700 hover:underline"
              >
                <CheckCheck className="h-4 w-4" /> Đánh dấu đã đọc
              </button>
            )}
          </div>
          <ul className="thin-scrollbar max-h-[70vh] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Chưa có thông báo</li>}
            {items.map((it) => {
              const meta = TYPE_META[it.type];
              const Icon = meta.icon;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => openItem(it)}
                    className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#FFF5F5] ${
                      it.read ? "" : "bg-red-50/40"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-muted">{meta.label}</span>
                      {it.taskTitle && (
                        <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug text-ink">
                          {it.taskTitle}
                        </span>
                      )}
                      <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-slate-600">{it.message}</span>
                      <span className="mt-1 block text-xs text-muted">{timeAgo(it.createdAt)}</span>
                    </span>
                    {!it.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" aria-label="Chưa đọc" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
