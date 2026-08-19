"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

type LevelSummary = {
  total: number;
  byStatus: Record<"todo" | "in_progress" | "done", number>;
  breakdown: { key: string; label: string; total: number; done: number }[];
};

const LEVEL_TITLES: Record<string, string> = {
  branch: "Cấp Phân hiệu",
  department: "Cấp Phòng",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Cần làm",
  in_progress: "Đang thực hiện",
  done: "Hoàn thành",
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-red-500",
  done: "bg-emerald-500",
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<Record<string, LevelSummary> | null>(null);

  useEffect(() => {
    fetch("/api/reports/summary")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary));
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <BarChart3 className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Báo cáo &amp; Thống kê tiến độ</h1>
          <p className="text-sm text-slate-500">
            Số liệu chỉ hiển thị trong phạm vi bạn được phép xem (toàn phân hiệu, phòng, nhóm, hoặc cá nhân).
          </p>
        </div>
      </div>

      {!summary && (
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="todo-card h-40 animate-pulse bg-slate-100/70" />
          ))}
        </div>
      )}

      <div className="space-y-6">
        {summary &&
          Object.entries(summary).map(([level, data], levelIdx) => (
            <motion.div
              key={level}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: levelIdx * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="todo-card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">{LEVEL_TITLES[level] ?? level}</h2>
                <span className="text-sm text-slate-400">{data.total} công việc</span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                {(["todo", "in_progress", "done"] as const).map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: levelIdx * 0.08 + i * 0.05 + 0.1, type: "spring", stiffness: 320, damping: 26 }}
                    className="rounded-xl bg-slate-50 p-3 text-center"
                  >
                    <p className="flex items-center justify-center gap-1.5 text-lg font-semibold text-slate-800">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                      {data.byStatus[s]}
                    </p>
                    <p className="text-xs text-slate-500">{STATUS_LABELS[s]}</p>
                  </motion.div>
                ))}
              </div>

              {data.breakdown.length > 0 && (
                <div className="space-y-2.5">
                  {data.breakdown.map((b, i) => (
                    <div key={b.key}>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>{b.label}</span>
                        <span>
                          {b.done}/{b.total} hoàn thành
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${b.total ? (b.done / b.total) * 100 : 0}%` }}
                          transition={{ delay: levelIdx * 0.08 + i * 0.05 + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
      </div>
    </div>
  );
}
