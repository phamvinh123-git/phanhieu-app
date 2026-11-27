"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  LogOut,
  KeyRound,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useMe } from "./MeProvider";

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

/** Khối logo + tên hệ thống, dùng chung cho header trang trong và trang đăng nhập. */
export function BrandHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="gb-header relative z-20 text-white md:sticky md:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold leading-tight">
          <span className="gb-logo-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-phan-hieu.png" alt="Logo Phân hiệu Thanh Hoá" />
          </span>
          <span>
            Phân hiệu Trường ĐH Y Hà Nội tại Thanh Hoá
            <br />
            <span className="text-sm font-normal text-red-100">Hệ thống Quản lý &amp; Phân công công việc</span>
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}

export function AppHeader() {
  const { me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  // Ghi nhớ menu tài khoản được mở ở trang nào: chuyển sang trang khác thì
  // menu tự đóng mà không cần effect. Bấm ra ngoài hoặc nhấn Esc cũng đóng.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null);
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

  const navItems = [{ href: "/dashboard", label: "Tổng quan", icon: "Home" }, ...(me?.nav ?? [])];

  return (
    <BrandHeader>
      <nav className="flex w-full flex-wrap items-center gap-1 text-sm">
        {navItems.map((item) => {
          const Icon = item.icon === "Home" ? Home : (ICONS[item.icon] ?? FileText);
          const active =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`gb-nav-link${active ? " active" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div ref={menuRef} className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            title="Tài khoản"
            className={`gb-nav-link${pathname === "/dashboard/change-password" ? " active" : ""}`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50 bg-white/20 text-xs font-semibold">
              {initials(me?.user?.fullName)}
            </span>
            <span className="max-w-[12rem] truncate text-red-100">{me?.user?.fullName ?? "..."}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl bg-white p-1.5 text-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold">{me?.user?.fullName}</p>
                <p className="truncate text-xs text-slate-500">{me?.user?.email}</p>
                {!!me?.roles.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {me.roles.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {r.label}
                        {r.departmentName && <span className="text-red-400">· {r.departmentName}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="my-1 h-px bg-slate-200" />
              <Link
                href="/dashboard/change-password"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700"
              >
                <KeyRound className="h-4 w-4" />
                Đổi mật khẩu
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </nav>
    </BrandHeader>
  );
}

export function AppFooter() {
  return (
    <footer className="relative z-[1] py-4 text-center text-xs text-slate-400">
      Phân hiệu Trường Đại học Y Hà Nội tại Tỉnh Thanh Hoá &middot; Hệ thống Quản lý &amp; Phân công công việc
    </footer>
  );
}

export function Watermark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-phan-hieu.png" alt="" aria-hidden="true" className="gb-watermark" />;
}
