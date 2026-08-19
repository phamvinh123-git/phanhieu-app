"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMe } from "@/components/MeProvider";
import {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  BarChart3,
  Building2,
  FileText,
  Layers,
  KanbanSquare,
};

const GREETING_GRADIENTS = [
  "from-red-500 to-rose-600",
  "from-rose-500 to-orange-500",
  "from-red-600 to-red-800",
];

export default function DashboardHome() {
  const { me } = useMe();
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`todo-card relative overflow-hidden bg-gradient-to-br ${GREETING_GRADIENTS[0]} p-6 text-white`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-24 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2 text-sm font-medium text-red-100">
          <Sparkles className="h-4 w-4" />
          {greeting}
        </div>
        <h1 className="relative mt-1 text-2xl font-semibold">{me?.user?.fullName ?? "..."}</h1>
        <p className="relative mt-2 max-w-xl text-sm text-red-50/90">
          Bạn đang có {me?.roles.length ?? 0} vai trò trong hệ thống. Các tính năng tương ứng đã được gộp
          vào thanh menu bên trái.
        </p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {me?.nav.map((item, i) => {
          const Icon = ICONS[item.icon] ?? FileText;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link href={item.href} className="todo-card group flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-red-500" />
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="todo-card mt-6 p-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Luồng phân công công việc</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          {[
            <>Sau cuộc họp chủ chốt, <b>Thư kí phân hiệu</b> rà soát biên bản và tạo nhiệm vụ cấp Phân hiệu, giao cho các Phòng.</>,
            <><b>Trưởng phòng</b> nhận nhiệm vụ, tự chia nhỏ thành các việc cấp Phòng và tự quản lý bằng Kanban cho đến khi hoàn thành.</>,
            <><b>Ban giám đốc</b> theo dõi tiến độ toàn phân hiệu qua báo cáo tổng hợp từ Thư kí phân hiệu.</>,
          ].map((text, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.08 }}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[11px] font-semibold text-red-700">
                {i + 1}
              </span>
              <span>{text}</span>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}
