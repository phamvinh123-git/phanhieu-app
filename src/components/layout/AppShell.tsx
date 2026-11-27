"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  LogOut,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  CalendarDays,
} from "lucide-react";
import { useMe } from "../MeProvider";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
};

const HOME = { href: "/dashboard", label: "Tổng quan", icon: "LayoutDashboard" };

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? "?";
}

function useNavItems() {
  const { me } = useMe();
  return [HOME, ...(me?.nav ?? [])];
}

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-phan-hieu.png" alt="Logo Phân hiệu Thanh Hoá" className="h-full w-full object-contain" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[15px] font-bold tracking-wide text-white">HMU TaskFlow</span>
        <span className="block text-xs text-white/75">Phân hiệu ĐH Y Hà Nội tại Thanh Hoá</span>
      </span>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useMe();
  const pathname = usePathname();
  const items = useNavItems();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleText = me?.roles
    .map((r) => (r.departmentName ? `${r.label} · ${r.departmentName}` : r.label))
    .join(", ");

  return (
    <div className="flex h-full flex-col">
      <Brand />
      <div className="mx-5 h-px bg-white/15" />

      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu chính">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? FileText;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-white" />}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/15 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {initials(me?.user?.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{me?.user?.fullName ?? "..."}</p>
            <p className="truncate text-xs text-white/70" title={roleText}>
              {roleText || " "}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const items = useNavItems();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const current =
    pathname === "/dashboard/change-password"
      ? { label: "Đổi mật khẩu" }
      : [...items].reverse().find((i) => isActive(pathname, i.href));
  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mở menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="hidden text-muted hover:text-ink sm:inline">
          Trang chủ
        </Link>
        {current && (
          <>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
            <span className="truncate font-semibold text-ink">{current.label}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] capitalize text-muted md:flex">
          <CalendarDays className="h-4 w-4" />
          {today}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenOn(menuOpen ? null : pathname)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
              {initials(me?.user?.fullName)}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:block">
              {me?.user?.fullName ?? "..."}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-white p-1.5 shadow-lg">
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-ink">{me?.user?.fullName}</p>
                <p className="truncate text-xs text-muted">{me?.user?.email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {me?.roles.map((r, i) => (
                    <span key={i} className="badge badge-brand">
                      {r.label}
                      {r.departmentName && <span className="opacity-70">· {r.departmentName}</span>}
                    </span>
                  ))}
                </div>
              </div>
              <div className="my-1 h-px bg-line" />
              <Link
                href="/dashboard/change-password"
                className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-ink hover:bg-red-50 hover:text-red-700"
              >
                <KeyRound className="h-4 w-4" />
                Đổi mật khẩu
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar cố định 248px — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] bg-[#941827] lg:block">
        <SidebarBody />
      </aside>

      {/* Sidebar dạng drawer — tablet & mobile */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] bg-[#941827] shadow-2xl lg:hidden"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng menu"
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarBody onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <Header onOpenMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
          <div className="animate-fade-in-up">{children}</div>
        </main>
        <footer className="px-6 pb-5 text-center text-xs text-muted">
          © {new Date().getFullYear()} Phân hiệu Trường Đại học Y Hà Nội tại Thanh Hoá · HMU TaskFlow
        </footer>
      </div>
    </div>
  );
}
