import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { ROLE_CODES, ROLE_SCOPE } from "@/lib/rbac-config";

/**
 * Admin sửa phân quyền của một tài khoản đã có: thay TOÀN BỘ danh sách vai
 * trò bằng danh sách mới được gửi lên (đơn giản & không sợ lệch trạng thái
 * so với việc thêm/xoá từng dòng). Có thể kèm khoá/mở tài khoản.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "users", "assign")) return jsonError("Không có quyền", 403);

  const { id } = await params;
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) return jsonError("Không tìm thấy tài khoản", 404);

  const body = await req.json().catch(() => null);
  const roleAssignments = Array.isArray(body?.roles) ? body.roles : null;

  if (roleAssignments) {
    if (roleAssignments.length === 0) return jsonError("Phải giữ ít nhất 1 vai trò");
    for (const ra of roleAssignments) {
      if (!ROLE_CODES.includes(ra.role)) return jsonError(`Vai trò không hợp lệ: ${ra.role}`);
      const scopeKind = ROLE_SCOPE[ra.role as (typeof ROLE_CODES)[number]];
      if (scopeKind === "department" && !ra.departmentId) {
        return jsonError(`Vai trò ${ra.role} cần chọn phòng ban`);
      }
    }
  }

  await db.transaction(async (tx) => {
    if (typeof body?.isActive === "boolean") {
      await tx.update(users).set({ isActive: body.isActive }).where(eq(users.id, id));
    }
    if (roleAssignments) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx.insert(userRoles).values(
        roleAssignments.map((ra: { role: string; departmentId?: number }) => ({
          userId: id,
          role: ra.role as (typeof ROLE_CODES)[number],
          departmentId: ra.departmentId ?? null,
        }))
      );
    }
  });

  const [updatedUser] = await db.select().from(users).where(eq(users.id, id));
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, id));
  const { passwordHash: _omit, ...safeUser } = updatedUser;

  return NextResponse.json({ user: { ...safeUser, roles } });
}
