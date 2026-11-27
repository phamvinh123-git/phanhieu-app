"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Download, Trash2, Upload, FileText, Image as ImageIcon, Loader2 } from "lucide-react";

export type MeetingFile = {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedByName: string | null;
};

export const FILE_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Tải lên một hoặc nhiều file cho biên bản; trả về thông báo lỗi (nếu có). */
export async function uploadMeetingFiles(meetingId: number, files: File[]): Promise<string | null> {
  if (!files.length) return null;
  const form = new FormData();
  files.forEach((f) => form.append("file", f));
  const res = await fetch(`/api/meetings/${meetingId}/files`, { method: "POST", body: form }).catch(() => null);
  if (!res) return "Không kết nối được máy chủ";
  if (res.status === 413) return "File quá lớn so với giới hạn của máy chủ";
  if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Không thể tải file lên";
  return null;
}

/** Mục "Biên bản gốc" trong cửa sổ xem biên bản: xem / tải về / tải lên / xoá. */
export function MeetingFiles({ meetingId, canEdit, onChanged }: { meetingId: number; canEdit: boolean; onChanged?: () => void }) {
  const [files, setFiles] = useState<MeetingFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/meetings/${meetingId}/files`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => setFiles(d.files ?? []))
      .catch(() => setFiles([]));
  }, [meetingId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    const err = await uploadMeetingFiles(meetingId, Array.from(list));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (err) setError(err);
    load();
    onChanged?.();
  }

  async function remove(f: MeetingFile) {
    if (!window.confirm(`Xoá file “${f.originalName}”?`)) return;
    const res = await fetch(`/api/meeting-files/${f.id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Không thể xoá file");
    load();
    onChanged?.();
  }

  // Chỉ xem (vd. trong ngăn chi tiết nhiệm vụ): không có file thì ẩn hẳn mục này
  if (!canEdit && files !== null && files.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Paperclip className="h-4 w-4" /> Biên bản gốc
        </h3>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn btn-soft btn-sm">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? "Đang tải lên…" : "Tải file lên"}
            </button>
          </>
        )}
      </div>

      {error && <p role="alert" className="mb-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{error}</p>}

      {files === null ? (
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ) : files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">Chưa có file biên bản gốc.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {files.map((f) => {
            const Icon = f.mimeType.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Icon className="h-4 w-4" />
                </span>
                <a
                  href={`/api/meeting-files/${f.id}`}
                  target="_blank"
                  rel="noopener"
                  className="min-w-0 flex-1"
                  title="Mở xem"
                >
                  <span className="block truncate text-sm font-medium text-ink hover:text-red-700">{f.originalName}</span>
                  <span className="block text-xs text-muted">
                    {formatSize(f.size)} · {new Date(f.createdAt).toLocaleDateString("vi-VN")}
                    {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
                  </span>
                </a>
                <a
                  href={`/api/meeting-files/${f.id}?download=1`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink"
                  title="Tải về"
                  aria-label={`Tải về ${f.originalName}`}
                >
                  <Download className="h-4 w-4" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(f)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Xoá file"
                    aria-label={`Xoá ${f.originalName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
