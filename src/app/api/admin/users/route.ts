import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { ROLE_CODES, ROLE_SCOPE } from "@/lib/rbac-config";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "users", "view")) return jsonError("Không có quyền", 403);

  const allUsers = await db.select().from(users);
  const allRoles = await db.select().from(userRoles);
  const roleByUser = new Map<string, typeof allRoles>();
  for (const r of allRoles) {
    roleByUser.set(r.userId, [...(roleByUser.get(r.userId) ?? []), r]);
  }

  return NextResponse.json({
    users: allUsers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      roles: roleByUser.get(u.id) ?? [],
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "users", "create")) return jsonError("Không có quyền", 403);

  const body = await req.json().catch(() => null);
  if (!body?.fullName || !body?.email || !body?.password) {
    return jsonError("Thiếu họ tên / email / mật khẩu");
  }
  const roleAssignments = Array.isArray(body.roles) ? body.roles : [];
  if (roleAssignments.length === 0) return jsonError("Phải gán ít nhất 1 vai trò");

  for (const ra of roleAssignments) {
    if (!ROLE_CODES.includes(ra.role)) return jsonError(`Vai trò không hợp lệ: ${ra.role}`);
    const scopeKind = ROLE_SCOPE[ra.role as (typeof ROLE_CODES)[number]];
    if (scopeKind === "department" && !ra.departmentId) return jsonError(`Vai trò ${ra.role} cần chọn phòng ban`);
  }

  const passwordHash = await hashPassword(String(body.password));
  const [user] = await db
    .insert(users)
    .values({
      fullName: String(body.fullName),
      email: String(body.email).toLowerCase().trim(),
      phone: body.phone ? String(body.phone) : null,
      passwordHash,
    })
    .returning();

  await db.insert(userRoles).values(
    roleAssignments.map((ra: { role: string; departmentId?: number }) => ({
      userId: user.id,
      role: ra.role as (typeof ROLE_CODES)[number],
      departmentId: ra.departmentId ?? null,
    }))
  );

  const { passwordHash: _omit, ...safeUser } = user;
  return NextResponse.json({ user: safeUser }, { status: 201 });
}
