import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import type { RoleCode } from "./rbac-config";

const SESSION_COOKIE = "phanhieu_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export type SessionRole = {
  role: RoleCode;
  departmentId: number | null;
};

export type SessionPayload = {
  userId: string;
  fullName: string;
  email: string;
  roles: SessionRole[];
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Chỉ đánh dấu "secure" khi app chạy qua HTTPS (APP_URL https://…). Nếu bật
    // secure trên địa chỉ http://IP:cổng thì trình duyệt bỏ cookie → không đăng nhập được.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const session = payload as unknown as SessionPayload;
    // Đọc lại trạng thái + vai trò mới nhất: tài khoản bị tạm khoá hoặc bị gỡ
    // hết vai trò (thôi kiêm nhiệm) mất quyền truy cập NGAY, không phải chờ
    // phiên đăng nhập (7 ngày) hết hạn; đổi vai trò cũng có hiệu lực ngay.
    const [user] = await db
      .select({ isActive: users.isActive, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user || !user.isActive) return null;
    const roles = await db
      .select({ role: userRoles.role, departmentId: userRoles.departmentId })
      .from(userRoles)
      .where(eq(userRoles.userId, session.userId));
    if (roles.length === 0) return null;
    return { userId: session.userId, fullName: user.fullName, email: user.email, roles };
  } catch {
    return null;
  }
}
