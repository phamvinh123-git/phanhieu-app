import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { userRoles, users } from "@/db/schema";
import { audit } from "./audit";

/**
 * Vai trò có thời hạn ("Quyền …"): hiệu lực đến HẾT ngày expiresAt (giờ Việt
 * Nam). Hết hạn thì vai trò không còn tác dụng; người không còn vai trò nào
 * hiệu lực thì tài khoản tự chuyển sang Tạm khoá.
 */

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd. */
export function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** Mốc 00:00 UTC của hôm nay (VN) — vai trò còn hiệu lực nếu expiresAt ≥ mốc này. */
function todayStart() {
  return new Date(`${todayVN()}T00:00:00Z`);
}

/** Điều kiện SQL: vai trò còn hiệu lực. */
export function roleIsActive() {
  return or(isNull(userRoles.expiresAt), gte(userRoles.expiresAt, todayStart()))!;
}

/** "yyyy-mm-dd" → Date lưu vào expires_at (null nếu trống). Ném lỗi nếu sai/đã qua. */
export function parseExpiry(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw new Error("Ngày hết hiệu lực không hợp lệ");
  if (s < todayVN()) throw new Error("Ngày hết hiệu lực phải từ hôm nay trở đi");
  return new Date(`${s}T00:00:00Z`);
}

/** Khoá các tài khoản đang hoạt động mà mọi vai trò đều đã hết hạn. Trả về số tài khoản bị khoá. */
export async function lockExpiredAccounts(onlyUserId?: string): Promise<number> {
  const start = todayStart();
  const candidates = await db
    .select({ userId: userRoles.userId, fullName: users.fullName })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(users.isActive, true),
        onlyUserId ? eq(userRoles.userId, onlyUserId) : undefined
      )
    )
    .groupBy(userRoles.userId, users.fullName)
    .having(sql`bool_and(${userRoles.expiresAt} is not null and ${userRoles.expiresAt} < ${start})`);
  const ids = candidates.map((c) => c.userId);
  if (ids.length) {
    await db.update(users).set({ isActive: false }).where(inArray(users.id, ids));
    for (const c of candidates) {
      await audit(null, "user.auto_lock", `Tự động tạm khoá tài khoản ${c.fullName} vì mọi quyền đã hết thời hạn`, {
        entityId: c.userId,
        actorName: "Hệ thống",
      });
    }
  }
  return ids.length;
}


