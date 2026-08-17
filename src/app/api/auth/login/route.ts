import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString();
  if (!email || !password) return jsonError("Thiếu email hoặc mật khẩu");

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.isActive) return jsonError("Sai email hoặc mật khẩu", 401);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return jsonError("Sai email hoặc mật khẩu", 401);

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  if (roles.length === 0) {
    return jsonError("Tài khoản chưa được gán vai trò nào. Liên hệ quản trị viên.", 403);
  }

  const token = await createSessionToken({
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    roles: roles.map((r) => ({
      role: r.role,
      departmentId: r.departmentId,
    })),
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
