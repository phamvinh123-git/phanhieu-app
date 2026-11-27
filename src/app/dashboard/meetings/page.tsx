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
  Search,
  Eye,
} from "lucide-react";
import { useMe } from "@/components/MeProvider";
import { ModalShell } from "@/components/ModalShell";
import { can, type RoleCode } from "@/lib/rbac-config";
import { PageHeader, EmptyState, formatDate } from "@/components/ui";

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
  const [viewing, setViewing] = useState<Meeting | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const q = query.trim().toLowerCase();
  const visible = meetings.filter((m) => {
    if (q && !m.title.toLowerCase().includes(q) && !(m.content ?? "").toLowerCase().includes(q)) return false;
    const d = m.meetingDate.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Biên bản họp"
        description="Gõ trực tiếp nội dung biên bản, hệ thống tự trích xuất đầu việc theo mã Phòng đặt trong ngoặc ở cuối mỗi dòng và gửi cho các phòng ngay sau khi họp."
        actions={
          canCreate && (
            <button onClick={() => setShowWizard(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Tạo biên bản
            </button>
          )
        }
      />

      <div className="todo-card overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <label htmlFor="mt-search" className="field-label">Tìm kiếm</label>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <input
              id="mt-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên cuộc họp hoặc nội dung"
              className="field pl-9"
            />
          </div>
          <div>
            <label htmlFor="mt-from" className="field-label">Từ ngày</label>
            <input id="mt-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="mt-to" className="field-label">Đến ngày</label>
            <input id="mt-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="mt-status" className="field-label">Trạng thái</label>
            <select id="mt-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field">
              <option value="">Tất cả</option>
              <option value="reviewed">Đã rà soát</option>
              <option value="draft">Nháp</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={meetings.length === 0 ? "Chưa có biên bản họp nào" : "Không có biên bản phù hợp"}
            hint={meetings.length === 0 && canCreate ? "Bấm “Tạo biên bản” để soạn biên bản và phân việc." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Mã biên bản</th>
                  <th>Tên cuộc họp</th>
                  <th>Ngày họp</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium tabular-nums text-muted">BB-{String(m.id).padStart(3, "0")}</td>
                    <td className="max-w-[360px]">
                      <button
                        onClick={() => setViewing(m)}
                        className="block max-w-full truncate text-left font-medium text-ink hover:text-red-700"
                      >
                        {m.title}
                      </button>
                    </td>
                    <td className="tabular-nums text-muted">{formatDate(m.meetingDate)}</td>
                    <td>
                      <span className={`badge ${m.status === "reviewed" ? "badge-done" : "badge-todo"}`}>
                        {m.status === "reviewed" ? "Đã rà soát" : "Nháp"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewing(m)} className="btn btn-secondary btn-sm">
                          <Eye className="h-3.5 w-3.5" /> Xem
                        </button>
                        {canCreate && (
                          <button onClick={() => toggleReviewed(m)} className="btn btn-soft btn-sm">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {m.status === "reviewed" ? "Chuyển về nháp" : "Đã rà soát"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewing && (
          <ModalShell onClose={() => setViewing(null)} maxWidth="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium tabular-nums text-muted">BB-{String(viewing.id).padStart(3, "0")}</p>
                <h2 className="text-lg font-semibold text-ink">{viewing.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <CalendarDays className="h-4 w-4" /> Ngày họp {formatDate(viewing.meetingDate)}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                aria-label="Đóng"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">Nội dung / kết luận</h3>
            {viewing.content ? (
              <p className="whitespace-pre-line rounded-lg bg-background p-4 text-sm leading-relaxed text-ink">{viewing.content}</p>
            ) : (
              <p className="text-sm text-muted">Biên bản không có nội dung.</p>
            )}
          </ModalShell>
        )}
      </AnimatePresence>

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
  autoDue: boolean; // hạn do hệ thống tự nhận diện
  source: "tag" | "mention" | "section";
  section?: string;
};

type SkippedLine = { line: string; reason: "no_tag" | "unmatched_codes"; unmatchedCodes?: string[] };

const EXAMPLE_TEXT = `1. Rà soát chương trình đào tạo học kỳ mới trước 25/8 (QLDT).
2. Giao Phòng Tổ chức - Hành chính - Quản trị chủ trì, phối hợp TCKT chuẩn bị quy chế chi tiêu nội bộ, hoàn thành trong tháng 9.

II. Phòng Khảo thí và Đảm bảo Chất lượng giáo dục:
- Khẩn trương hoàn thiện hồ sơ tự đánh giá, chậm nhất ngày 15/10/2026.
- Tổ chức thi kết thúc học phần; tổng hợp kết quả thi học kỳ I.`;

const inputCls = "field";

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
      body: JSON.stringify({ content, meetingDate }),
    });
    setExtracting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể trích xuất");
      return;
    }
    const data = await res.json();
    setRows(
      (
        data.tasks as {
          line: string;
          title: string;
          departmentIds: number[];
          dueDate: string | null;
          priority: ExtractedRow["priority"];
          source: ExtractedRow["source"];
          section?: string;
        }[]
      ).map((t, i) => ({
        key: `${i}-${t.line}`,
        line: t.line,
        title: t.title,
        departmentIds: t.departmentIds,
        priority: t.priority ?? "normal",
        dueDate: t.dueDate ?? "",
        autoDue: Boolean(t.dueDate),
        source: t.source ?? "tag",
        section: t.section,
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
        <h2 className="text-lg font-semibold text-ink">
          {step === 1 ? "Soạn biên bản họp" : "Rà soát nhiệm vụ trích xuất được"}
        </h2>
        <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
                  className="h-full bg-red-600"
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
                <label className="field-label">Tiêu đề cuộc họp</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="field-label">Ngày họp</label>
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
              <label className="field-label">Nội dung biên bản</label>
              <div className="mb-2 rounded-lg bg-background p-3 text-xs leading-relaxed text-muted">
                Dán nguyên biên bản vào đây. Hệ thống tự nhận Phòng phụ trách khi: có mã trong ngoặc cuối dòng{" "}
                <b className="text-ink">(QLDT, TCKT)</b>; câu nhắc tên hoặc mã Phòng (“Giao Phòng Quản lý Đào tạo chủ
                trì…”, “Phòng TCKT: …”); hoặc các gạch đầu dòng nằm dưới tiêu đề mục của một Phòng. Hạn hoàn thành
                nhận được: 25/8, 25/08/2026, “ngày 25 tháng 8”, “trong tháng 9”, “trước quý IV”, “tuần sau”. Mã Phòng
                hiện có: <b className="text-ink">{departments.map((d) => d.code).join(", ") || "..."}</b>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder={EXAMPLE_TEXT}
                className={`${inputCls} font-mono text-[13px]`}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
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
              className="btn btn-primary w-full"
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
            <p className="text-sm text-muted">
              Trích xuất được <b className="text-ink">{rows.length}</b> nhiệm vụ
              {rows.length > 0 && (
                <>
                  {" "}· <b className="text-ink">{rows.filter((r) => r.dueDate).length}</b> có hạn hoàn thành
                </>
              )}
              . Kiểm tra lại tiêu đề, Phòng phụ trách và hạn trước khi gửi — có thể sửa hoặc xoá từng dòng.
            </p>

            {skipped.length > 0 && (
              <div className="rounded-lg border border-[#FDE3BF] bg-[#FFF4E5] p-3 text-xs text-[#B45309]">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> {skipped.length} dòng không được nhận diện là nhiệm vụ
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {skipped.map((s, i) => (
                    <li key={i}>
                      {s.line}
                      {s.reason === "unmatched_codes" && s.unmatchedCodes?.length
                        ? ` — mã không nhận diện được: ${s.unmatchedCodes.join(", ")}`
                        : " — không xác định được Phòng phụ trách"}
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
                    className="rounded-lg border border-line p-3"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        value={r.title}
                        onChange={(e) => updateRow(r.key, { title: e.target.value })}
                        className="field h-9 flex-1"
                      />
                      <button
                        onClick={() => removeRow(r.key)}
                        className="text-slate-300 transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mb-2 text-xs text-muted">
                      {r.source === "tag" && "Phòng lấy từ mã trong ngoặc"}
                      {r.source === "mention" && "Phòng lấy từ nội dung câu"}
                      {r.source === "section" && `Phòng lấy theo mục: ${r.section ?? ""}`}
                    </p>
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
                      <label className="sr-only" htmlFor={`prio-${r.key}`}>Mức ưu tiên</label>
                      <select
                        id={`prio-${r.key}`}
                        value={r.priority}
                        onChange={(e) => updateRow(r.key, { priority: e.target.value as ExtractedRow["priority"] })}
                        className="field h-9 text-[13px]"
                      >
                        <option value="low">Ưu tiên thấp</option>
                        <option value="normal">Ưu tiên bình thường</option>
                        <option value="high">Ưu tiên cao</option>
                        <option value="urgent">Khẩn cấp</option>
                      </select>
                      <div>
                        <label className="sr-only" htmlFor={`due-${r.key}`}>Hạn hoàn thành</label>
                        <input
                          id={`due-${r.key}`}
                          type="date"
                          value={r.dueDate}
                          onChange={(e) => updateRow(r.key, { dueDate: e.target.value, autoDue: false })}
                          className={`field h-9 text-[13px] ${r.dueDate ? "" : "border-[#F5C27A] bg-[#FFF8EE]"}`}
                        />
                      </div>
                    </div>
                    <p className={`mt-1.5 text-xs ${r.dueDate ? "text-done" : "text-[#B45309]"}`}>
                      {r.dueDate
                        ? r.autoDue
                          ? `Hạn tự nhận từ biên bản: ${r.dueDate.split("-").reverse().join("/")}`
                          : `Hạn: ${r.dueDate.split("-").reverse().join("/")}`
                        : "Biên bản không ghi hạn cho việc này — hãy chọn hạn nếu cần."}
                    </p>
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
                <p className="rounded-lg bg-background p-4 text-center text-sm text-muted">
                  Không trích xuất được nhiệm vụ nào. Quay lại và ghi rõ Phòng phụ trách (mã trong ngoặc, tên Phòng
                  trong câu, hoặc tiêu đề mục theo Phòng).
                </p>
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="btn btn-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại sửa biên bản
              </button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={dispatch}
                disabled={sending || rows.some((r) => r.departmentIds.length === 0)}
                className="btn btn-primary flex-1"
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
