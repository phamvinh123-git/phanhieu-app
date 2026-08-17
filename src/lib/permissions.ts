import type { SessionPayload } from "./auth";
import { can, type Action, type ModuleCode, type RoleCode } from "./rbac-config";

/**
 * Phạm vi hiệu lực (effective scope) của một người dùng đối với một hành
 * động trên một module, tổng hợp từ TẤT CẢ vai trò họ đang giữ.
 *
 * all = true  -> được xem/thao tác toàn phân hiệu (admin, bgd, tkph...)
 * ngược lại   -> chỉ giới hạn trong danh sách departmentIds bên dưới
 */
export type ScopeFilter = {
  allowed: boolean;
  all: boolean;
  departmentIds: number[];
};

const GLOBAL_ROLES: RoleCode[] = ["admin", "bgd", "tkph"];

export function hasAction(
  session: SessionPayload | null,
  moduleCode: ModuleCode,
  action: Action
): boolean {
  if (!session) return false;
  return session.roles.some((r) => can(r.role, moduleCode, action));
}

export function resolveScope(
  session: SessionPayload | null,
  moduleCode: ModuleCode,
  action: Action
): ScopeFilter {
  const empty: ScopeFilter = { allowed: false, all: false, departmentIds: [] };
  if (!session) return empty;

  const grantingRoles = session.roles.filter((r) => can(r.role, moduleCode, action));
  if (grantingRoles.length === 0) return empty;

  const all = grantingRoles.some((r) => GLOBAL_ROLES.includes(r.role));
  const departmentIds = grantingRoles
    .map((r) => r.departmentId)
    .filter((id): id is number => id != null);

  return { allowed: true, all, departmentIds };
}
