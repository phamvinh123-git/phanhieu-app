import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/** Thư mục lưu file biên bản gốc. Mặc định: <thư mục app>/uploads/meetings
 *  (không nằm trong git nên không bị xoá khi deploy). */
export function uploadDir() {
  return process.env.UPLOAD_DIR ? path.join(process.env.UPLOAD_DIR, "meetings") : path.join(process.cwd(), "uploads", "meetings");
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

/** Kiểm tra & lưu file; trả về thông tin để ghi vào bảng meeting_files. */
export async function saveMeetingFile(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED[ext]) throw new Error("Chỉ nhận file PDF, Word (.doc, .docx) hoặc ảnh (.jpg, .png)");
  if (file.size === 0) throw new Error("File rỗng");
  if (file.size > MAX_FILE_SIZE) throw new Error("File vượt quá 20 MB");
  const storedName = `${randomUUID()}${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), storedName), Buffer.from(await file.arrayBuffer()));
  // Tên gốc: bỏ đường dẫn, giới hạn độ dài
  const originalName = path.basename(file.name).slice(0, 200) || `bien-ban${ext}`;
  return { storedName, originalName, mimeType: ALLOWED[ext], size: file.size };
}

export async function readMeetingFile(storedName: string) {
  // storedName do hệ thống sinh (uuid + đuôi) — chặn mọi ký tự đường dẫn
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(storedName)) throw new Error("Tên file không hợp lệ");
  return readFile(path.join(uploadDir(), storedName));
}

export async function deleteMeetingFile(storedName: string) {
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(storedName)) return;
  await unlink(path.join(uploadDir(), storedName)).catch(() => {});
}
