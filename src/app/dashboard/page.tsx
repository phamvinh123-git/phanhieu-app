"use client";

import Link from "next/link";
import { useMe } from "@/components/MeProvider";
import {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  ArrowRight,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
};

export default function DashboardHome() {
  const { me } = useMe();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        Xin chào, {me?.user?.fullName ?? "..."}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Bạn đang có {me?.roles.length ?? 0} vai trò trong hệ thống. Các tính năng tương ứng đã được
        gộp vào thanh menu bên trái.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {me?.nav.map((item) => {
          const Icon = ICONS[item.icon] ?? FileText;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-800">{item.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-red-500" />
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Luồng phân công công việc</h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-slate-600">
          <li>Sau cuộc họp chủ chốt, <b>Thư kí phân hiệu</b> rà soát biên bản và tạo nhiệm vụ cấp Phân hiệu, giao cho các Phòng.</li>
          <li><b>Trưởng phòng</b> nhận nhiệm vụ, tự chia nhỏ thành các việc cấp Phòng và tự quản lý bằng Kanban cho đến khi hoàn thành.</li>
          <li><b>Ban giám đốc</b> theo dõi tiến độ toàn phân hiệu qua báo cáo tổng hợp từ Thư kí phân hiệu.</li>
        </ol>
      </div>
    </div>
  );
}
