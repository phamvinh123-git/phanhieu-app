"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  LogOut,
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

export function Sidebar() {
  const { me, loading } = useMe();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-red-100">
          <Image src="/logo.png" alt="Logo" width={32} height={32} className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">Đại học Y Hà Nội</p>
          <p className="text-xs leading-tight text-red-600">Phân Hiệu Thanh Hóa</p>
        </div>
      </div>

      {/* Danh sách vai trò hiện có của người dùng — vì 1 người có thể kiêm
          nhiều vai trò, mọi tính năng của các vai trò đó được GỘP lại
          thành một danh sách menu duy nhất bên dưới. */}
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Vai trò của bạn
        </p>
        <div className="flex flex-wrap gap-1.5">
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
          {me?.roles.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
              title={r.departmentName ?? undefined}
            >
              <ShieldCheck className="h-3 w-3" />
              {r.label}
              {r.departmentName && <span className="text-red-400">· {r.departmentName}</span>}
            </span>
          ))}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {me?.nav.map((item) => {
          const Icon = ICONS[item.icon] ?? FileText;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-red-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3">
        <p className="truncate text-sm font-medium text-slate-800">{me?.user?.fullName}</p>
        <p className="truncate text-xs text-slate-400">{me?.user?.email}</p>
        <button
          onClick={logout}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
