import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hashPassword, verifyPassword } from "@/lib/auth";

/**
 * Tự đổi mật khẩu — dùng ngay sau khi đăng nhập lần đầu bằng mật khẩu khởi
 * tạo chung (được cấp lúc seed dữ liệu), hoặc bất cứ khi nào người dùng muốn
 * đổi mật khẩu của chính mình. Yêu cầu nhập đúng mật khẩu hiện tại.
 */
export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  const currentPassword = body?.currentPassword?.toString() ?? "";
  const newPassword = body?.newPassword?.toString() ?? "";

  if (!currentPassword || !newPassword) {
    return jsonError("Thiếu mật khẩu hiện tại hoặc mật khẩu mới");
  }
  if (newPassword.length < 8) {
    return jsonError("Mật khẩu mới phải có ít nhất 8 ký tự");
  }
  if (newPassword === currentPassword) {
    return jsonError("Mật khẩu mới phải khác mật khẩu hiện tại");
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) return jsonError("Không tìm thấy tài khoản", 404);

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return jsonError("Mật khẩu hiện tại không đúng", 403);

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.userId));

  return NextResponse.json({ ok: true });
}
