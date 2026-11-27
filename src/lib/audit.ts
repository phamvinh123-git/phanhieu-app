import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/** Mã hành động → nhãn tiếng Việt (dùng cho bộ lọc & hiển thị). */
export const AUDIT_ACTIONS = {
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập thất bại",
  "auth.logout": "Đăng xuất",
  "auth.password_change": "Đổi mật khẩu",
  "task.create": "Tạo công việc",
  "task.status": "Đổi trạng thái công việc",
  "task.update": "Sửa công việc",
  "task.comment": "Bình luận",
  "task.remind": "Nhắc nhiệm vụ",
  "meeting.create": "Tạo biên bản họp",
  "meeting.dispatch": "Giao việc từ biên bản",
  "meeting.status": "Đổi trạng thái biên bản",
  "meeting.file_upload": "Tải lên biên bản gốc",
  "meeting.file_delete": "Xoá file biên bản",
  "meeting.file_view": "Xem / tải biên bản gốc",
  "user.create": "Tạo tài khoản",
  "user.lock": "Tạm khoá tài khoản",
  "user.unlock": "Mở khoá tài khoản",
  "user.roles": "Đổi phân quyền",
  "user.auto_lock": "Tự khoá do hết hạn quyền",
  "system.reset_work_data": "Xoá dữ liệu công việc",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  auth: "Đăng nhập",
  task: "Công việc",
  meeting: "Biên bản họp",
  user: "Tài khoản",
  system: "Hệ thống",
};

type Actor = { userId: string; fullName: string } | null;

/**
 * Ghi một dòng lịch sử truy vết. Không bao giờ làm hỏng thao tác chính:
 * mọi lỗi khi ghi log chỉ được in ra console.
 */
export async function audit(
  actor: Actor,
  action: AuditAction,
  summary: string,
  opts: { entityId?: string | number | null; meta?: Record<string, unknown>; actorName?: string } = {}
) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      // Ưu tiên X-Real-IP do nginx đặt (người dùng không giả mạo được)
      ip = (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim().slice(0, 64) || null;
      userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
    } catch {
      // ngoài ngữ cảnh request (vd. tác vụ nền) — bỏ qua IP
    }
    await db.insert(auditLogs).values({
      actorId: actor?.userId ?? null,
      actorName: opts.actorName ?? actor?.fullName ?? null,
      action,
      entityType: action.split(".")[0],
      entityId: opts.entityId != null ? String(opts.entityId) : null,
      summary: summary.slice(0, 1000),
      meta: opts.meta ?? null,
      ip,
      userAgent,
    });
  } catch (e) {
    console.error("audit:fail", action, e);
  }
}
