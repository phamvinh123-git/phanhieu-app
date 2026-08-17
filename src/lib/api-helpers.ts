import { NextResponse } from "next/server";
import { db } from "@/db";
import { userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession, type SessionPayload } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return jsonError("Chưa đăng nhập", 401);
  return session;
}

export function isSession(x: SessionPayload | NextResponse): x is SessionPayload {
  return !(x instanceof NextResponse);
}

/** Đọc lại vai trò mới nhất từ DB (dùng khi cấp/đổi quyền cần hiệu lực ngay). */
export async function loadRolesForUser(userId: string) {
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}
