"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  LogOut,
  ShieldCheck,
  KeyRound,
  Menu,
  X,
} from "lucide-react";
import { useMe } from "./MeProvider";
import { LogoBadge } from "./LogoBadge";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
};

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? "?";
}

export function Sidebar() {
  const { me, loading } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Đóng menu di động mỗi khi chuyển trang (bấm vào 1 mục trong menu).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const body = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-4">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <LogoBadge size="md" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">Đại học Y Hà Nội</p>
          <p className="text-xs leading-tight text-red-600">Phân Hiệu Thanh Hóa</p>
        </div>
      </div>

      {/* Danh sách vai trò hiện có của người dùng — vì 1 người có thể kiêm
          nhiều vai trò, mọi tính năng của các vai trò đó được GỘP lại
          thành một danh sách menu duy nhất bên dưới. */}
      <div className="px-4 pb-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Vai trò của bạn
        </p>
        <div className="flex flex-wrap gap-1.5">
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
          <AnimatePresence>
            {me?.roles.map((r, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.85, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-100"
                title={r.departmentName ?? undefined}
              >
                <ShieldCheck className="h-3 w-3" />
                {r.label}
                {r.departmentName && <span className="text-red-400">· {r.departmentName}</span>}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {me?.nav.map((item) => {
          const Icon = ICONS[item.icon] ?? FileText;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="relative block">
              {active && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-xl bg-red-600 shadow-md shadow-red-600/20"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-slate-600 hover:bg-red-50/80 hover:text-red-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-red-500"}`} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-red-100/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-xs font-semibold text-white shadow-sm">
            {initials(me?.user?.fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{me?.user?.fullName}</p>
            <p className="truncate text-xs text-slate-400">{me?.user?.email}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <Link
            href="/dashboard/change-password"
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              pathname === "/dashboard/change-password" ? "text-red-600" : "text-slate-500 hover:text-red-600"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Đổi mật khẩu
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Thanh trên cùng chỉ hiện trên di động (< md): logo + nút mở menu */}
      <div className="flex items-center justify-between border-b border-red-100/70 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <LogoBadge size="sm" />
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Đại học Y Hà Nội</p>
            <p className="text-[11px] leading-tight text-red-600">Phân Hiệu Thanh Hóa</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Mở menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar cố định — chỉ hiện từ màn hình md trở lên */}
      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-red-100/70 bg-gradient-to-b from-[#fff8f8] via-white to-white md:flex">
        {body}
      </aside>

      {/* Menu trượt ra trên di động */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-gradient-to-b from-[#fff8f8] via-white to-white shadow-2xl md:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Đóng menu"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
