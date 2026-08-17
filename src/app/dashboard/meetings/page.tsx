"use client";

import { useEffect, useState } from "react";
import { Plus, X, CheckCircle2, Wand2, ArrowLeft, Send, Trash2, AlertTriangle } from "lucide-react";
import { useMe } from "@/components/MeProvider";
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
          <button
            onClick={() => setShowWizard(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Soạn biên bản &amp; phân việc
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(m.meetingDate).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.status === "reviewed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {m.status === "reviewed" ? "Đã rà soát" : "Nháp"}
                </span>
              </div>
              {m.content && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{m.content}</p>}
              {canCreate && (
                <button
                  onClick={() => toggleReviewed(m)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {m.status === "reviewed" ? "Chuyển về nháp" : "Đánh dấu đã rà soát"}
                </button>
              )}
            </div>
          ))}
          {meetings.length === 0 && <p className="text-sm text-slate-400">Chưa có biên bản họp nào.</p>}
        </div>
      )}

      {showWizard && (
        <DispatchWizard
          onClose={() => setShowWizard(false)}
          onDone={() => {
            setShowWizard(false);
            load();
          }}
        />
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {step === 1 ? "Soạn biên bản họp" : "Rà soát nhiệm vụ trích xuất được"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Tiêu đề cuộc họp</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Ngày họp</label>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-red-500"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <button
              onClick={runExtract}
              disabled={extracting || !title || !meetingDate}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {extracting ? "Đang trích xuất..." : "Trích xuất nhiệm vụ"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Trích xuất được <b>{rows.length}</b> nhiệm vụ. Kiểm tra lại tiêu đề, Phòng phụ trách
              trước khi gửi — có thể sửa hoặc xoá từng dòng.
            </p>

            {skipped.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
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
              {rows.map((r) => (
                <div key={r.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <input
                      value={r.title}
                      onChange={(e) => updateRow(r.key, { title: e.target.value })}
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeRow(r.key)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {departments.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleRowDept(r.key, d.id)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.departmentIds.includes(d.id)
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {d.code}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={r.priority}
                      onChange={(e) => updateRow(r.key, { priority: e.target.value as ExtractedRow["priority"] })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
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
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                  {r.departmentIds.length === 0 && (
                    <p className="mt-1.5 text-xs text-red-500">Chưa chọn Phòng nào — nhiệm vụ này sẽ không được gửi.</p>
                  )}
                  {r.departmentIds.length > 1 && (
                    <p className="mt-1.5 text-xs text-violet-600">
                      Liên phòng: {r.departmentIds.map(deptName).join(" + ")}
                    </p>
                  )}
                </div>
              ))}
              {rows.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-400">
                  Không trích xuất được nhiệm vụ nào. Quay lại và kiểm tra định dạng mã Phòng trong ngoặc.
                </p>
              )}
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại sửa biên bản
              </button>
              <button
                onClick={dispatch}
                disabled={sending || rows.some((r) => r.departmentIds.length === 0)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? "Đang gửi..." : `Gửi ${rows.length} nhiệm vụ cho các Phòng`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
