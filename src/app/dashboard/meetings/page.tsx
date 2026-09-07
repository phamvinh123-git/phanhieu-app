"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  X,
  CheckCircle2,
  Wand2,
  ArrowLeft,
  Send,
  Trash2,
  AlertTriangle,
  FileText,
  CalendarDays,
} from "lucide-react";
import { useMe } from "@/components/MeProvider";
import { ModalShell } from "@/components/ModalShell";
import { can, type RoleCode } from "@/lib/rbac-config";

type Meeting = {
  id: number;
  title: string;
  meetingDate: string;
  content: string | null;
  status: "draft" | "reviewed";
};

type Department = { id: number; name: string; code: string };

export default function MeetingsPage() {
  const { me } = useMe();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const canCreate = (me?.roles.map((r) => r.role) as RoleCode[] | undefined)?.some((r) =>
    can(r, "meetings", "create")
  );

  function load() {
    setLoading(true);
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((d) => setMeetings(d.meetings ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleReviewed(m: Meeting) {
    const next = m.status === "draft" ? "reviewed" : "draft";
    const res = await fetch(`/api/meetings/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Biên bản họp chủ chốt</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Gõ trực tiếp nội dung biên bản, hệ thống tự trích xuất đầu việc theo mã Phòng đặt
            trong ngoặc ở cuối mỗi dòng, và gửi thẳng cho các phòng ngay sau khi họp xong.
          </p>
        </div>
        {canCreate && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowWizard(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Soạn biên bản &amp; phân việc
          </motion.button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="todo-card h-24 animate-pulse bg-slate-100/70" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {meetings.map((m, i) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 340, damping: 30 }}
                className="todo-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{m.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(m.meetingDate).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      m.status === "reviewed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {m.status === "reviewed" ? "Đã rà soát" : "Nháp"}
                  </span>
                </div>
                {m.content && (
                  <p className="mt-2.5 whitespace-pre-line pl-12 text-sm text-slate-600">{m.content}</p>
                )}
                {canCreate && (
                  <button
                    onClick={() => toggleReviewed(m)}
                    className="mt-3 ml-12 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 transition-colors hover:text-red-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {m.status === "reviewed" ? "Chuyển về nháp" : "Đánh dấu đã rà soát"}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {meetings.length === 0 && (
            <div className="todo-card flex flex-col items-center gap-2 p-10 text-center">
              <FileText className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">Chưa có biên bản họp nào.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showWizard && (
          <DispatchWizard
            onClose={() => setShowWizard(false)}
            onDone={() => {
              setShowWizard(false);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard: soạn biên bản -> trích xuất nhiệm vụ -> rà soát -> gửi cho các Phòng
// ---------------------------------------------------------------------------

type ExtractedRow = {
  key: string;
  line: string;
  title: string;
  departmentIds: number[];
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string;
};

type SkippedLine = { line: string; reason: "no_tag" | "unmatched_codes"; unmatchedCodes?: string[] };

const EXAMPLE_TEXT = `1. Hoàn thiện kế hoạch tuyển sinh đợt bổ sung, gửi Ban giám đốc trước 25/8 (DT).
2. Rà soát lại quy chế chi tiêu nội bộ, phối hợp cung cấp số liệu (HCTH, DT).
3. Chuẩn bị cơ sở vật chất phòng học cho đợt nhập học mới (HCTH).`;

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-200";

function DispatchWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []));
  }, []);

  async function runExtract() {
    if (!content.trim()) {
      setError("Nhập nội dung biên bản trước đã.");
      return;
    }
    setExtracting(true);
    setError(null);
    const res = await fetch("/api/meetings/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setExtracting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể trích xuất");
      return;
    }
    const data = await res.json();
    setRows(
      (data.tasks as { line: string; title: string; departmentIds: number[] }[]).map((t, i) => ({
        key: `${i}-${t.line}`,
        line: t.line,
        title: t.title,
        departmentIds: t.departmentIds,
        priority: "normal",
        dueDate: "",
      }))
    );
    setSkipped(data.skipped ?? []);
    setStep(2);
  }

  function updateRow(key: string, patch: Partial<ExtractedRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleRowDept(key: string, deptId: number) {
    setRows((rs) =>
      rs.map((r) =>
        r.key === key
          ? {
              ...r,
              departmentIds: r.departmentIds.includes(deptId)
                ? r.departmentIds.filter((id) => id !== deptId)
                : [...r.departmentIds, deptId],
            }
          : r
      )
    );
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  async function dispatch() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/meetings/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        meetingDate,
        content,
        tasks: rows.map((r) => ({
          title: r.title,
          departmentIds: r.departmentIds,
          priority: r.priority,
          dueDate: r.dueDate || null,
        })),
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể gửi");
      return;
    }
    onDone();
  }

  const deptName = (id: number) => departments.find((d) => d.id === id)?.name ?? "";

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {step === 1 ? "Soạn biên bản họp" : "Rà soát nhiệm vụ trích xuất được"}
        </h2>
        <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Thanh tiến trình 2 bước */}
      <div className="mb-4 flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                step >= s ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {s}
            </div>
            {s === 1 && (
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full bg-red-500"
                  initial={false}
                  animate={{ width: step === 2 ? "100%" : "0%" }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Tiêu đề cuộc họp</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Ngày họp</label>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nội dung biên bản — mỗi dòng là một đầu việc, đặt mã Phòng trong ngoặc ở cuối dòng
                (nhiều Phòng thì cách nhau bằng dấu phẩy). Mã Phòng hiện có:{" "}
                {departments.map((d) => d.code).join(", ") || "..."}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder={EXAMPLE_TEXT}
                className={`${inputCls} font-mono text-xs`}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={runExtract}
              disabled={extracting || !title || !meetingDate}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700 disabled:opacity-60"
            >
              <Wand2 className={`h-4 w-4 ${extracting ? "animate-pulse" : ""}`} />
              {extracting ? "Đang trích xuất..." : "Trích xuất nhiệm vụ"}
            </motion.button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <p className="text-sm text-slate-500">
              Trích xuất được <b>{rows.length}</b> nhiệm vụ. Kiểm tra lại tiêu đề, Phòng phụ trách
              trước khi gửi — có thể sửa hoặc xoá từng dòng.
            </p>

            {skipped.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> {skipped.length} dòng không được nhận diện là nhiệm vụ
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {skipped.map((s, i) => (
                    <li key={i}>
                      {s.line}
                      {s.reason === "unmatched_codes" && s.unmatchedCodes?.length
                        ? ` — mã không nhận diện được: ${s.unmatchedCodes.join(", ")}`
                        : " — không có mã Phòng trong ngoặc ở cuối dòng"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {rows.map((r, i) => (
                  <motion.div
                    key={r.key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.03, type: "spring", stiffness: 340, damping: 30 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        value={r.title}
                        onChange={(e) => updateRow(r.key, { title: e.target.value })}
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
                      />
                      <button
                        onClick={() => removeRow(r.key)}
                        className="text-slate-300 transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {departments.map((d) => (
                        <motion.button
                          key={d.id}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => toggleRowDept(r.key, d.id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            r.departmentIds.includes(d.id)
                              ? "bg-red-600 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {d.code}
                        </motion.button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={r.priority}
                        onChange={(e) => updateRow(r.key, { priority: e.target.value as ExtractedRow["priority"] })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-red-400"
                      >
                        <option value="low">Ưu tiên thấp</option>
                        <option value="normal">Ưu tiên bình thường</option>
                        <option value="high">Ưu tiên cao</option>
                        <option value="urgent">Khẩn cấp</option>
                      </select>
                      <input
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => updateRow(r.key, { dueDate: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-red-400"
                      />
                    </div>
                    <AnimatePresence>
                      {r.departmentIds.length === 0 && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-1.5 text-xs text-red-500"
                        >
                          Chưa chọn Phòng nào — nhiệm vụ này sẽ không được gửi.
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {r.departmentIds.length > 1 && (
                      <p className="mt-1.5 text-xs text-violet-600">
                        Liên phòng: {r.departmentIds.map(deptName).join(" + ")}
                      </p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {rows.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
                  Không trích xuất được nhiệm vụ nào. Quay lại và kiểm tra định dạng mã Phòng trong ngoặc.
                </p>
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại sửa biên bản
              </button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={dispatch}
                disabled={sending || rows.some((r) => r.departmentIds.length === 0)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? "Đang gửi..." : `Gửi ${rows.length} nhiệm vụ cho các Phòng`}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
}
