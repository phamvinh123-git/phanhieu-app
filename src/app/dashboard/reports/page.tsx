"use client";

import { useEffect, useState } from "react";

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

export default function ReportsPage() {
  const [summary, setSummary] = useState<Record<string, LevelSummary> | null>(null);

  useEffect(() => {
    fetch("/api/reports/summary")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Báo cáo &amp; Thống kê tiến độ</h1>
      <p className="mb-5 text-sm text-slate-500">
        Số liệu chỉ hiển thị trong phạm vi bạn được phép xem (toàn phân hiệu, phòng, nhóm, hoặc cá nhân).
      </p>

      {!summary && <p className="text-sm text-slate-400">Đang tải...</p>}

      <div className="space-y-6">
        {summary &&
          Object.entries(summary).map(([level, data]) => (
            <div key={level} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">{LEVEL_TITLES[level] ?? level}</h2>
                <span className="text-sm text-slate-400">{data.total} công việc</span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                {(["todo", "in_progress", "done"] as const).map((s) => (
                  <div key={s} className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-lg font-semibold text-slate-800">{data.byStatus[s]}</p>
                    <p className="text-xs text-slate-500">{STATUS_LABELS[s]}</p>
                  </div>
                ))}
              </div>

              {data.breakdown.length > 0 && (
                <div className="space-y-2">
                  {data.breakdown.map((b) => (
                    <div key={b.key}>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>{b.label}</span>
                        <span>
                          {b.done}/{b.total} hoàn thành
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${b.total ? (b.done / b.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
