/**
 * BẢNG PHÂN QUYỀN (RBAC) — nguồn duy nhất cho toàn hệ thống.
 *
 * Mọi kiểm tra quyền trên server (API routes) và mọi hiển thị menu trên
 * sidebar đều đọc từ đây, để tài liệu và code không bao giờ lệch nhau.
 *
 * Phiên bản rút gọn: chỉ còn 4 vai trò (đã bỏ Thư kí phòng, Trưởng nhóm,
 * Chuyên viên). Trưởng phòng giờ tự chia nhỏ & tự quản lý toàn bộ công
 * việc của phòng mình bằng Kanban cấp Phòng, không cần bước duyệt nữa vì
 * không còn ai nộp việc lên để chờ duyệt.
 */

export const ROLE_CODES = ["admin", "bgd", "tkph", "truong_phong"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  admin: "Quản trị hệ thống",
  bgd: "Ban giám đốc",
  tkph: "Thư kí phân hiệu",
  truong_phong: "Trưởng phòng",
};

// Vai trò có gắn phạm vi (scope) theo phòng hay không.
export const ROLE_SCOPE: Record<RoleCode, "none" | "department"> = {
  admin: "none",
  bgd: "none",
  tkph: "none",
  truong_phong: "department",
};

export const MODULE_CODES = [
  "users", // Quản lý người dùng & phân quyền
  "meetings", // Biên bản họp chủ chốt
  "branch_tasks", // Nhiệm vụ cấp Phân hiệu
  "department_tasks", // Nhiệm vụ cấp Phòng
  "reports", // Báo cáo & thống kê
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export type Action = "create" | "view" | "assign" | "update_status" | "comment";

export const MODULE_LABELS: Record<ModuleCode, string> = {
  users: "Quản lý người dùng & phân quyền",
  meetings: "Biên bản họp chủ chốt",
  branch_tasks: "Nhiệm vụ cấp Phân hiệu",
  department_tasks: "Nhiệm vụ cấp Phòng",
  reports: "Báo cáo & Thống kê",
};

/**
 * Ma trận quyền: role -> module -> danh sách action được phép.
 * "view" luôn ngầm định là "view trong phạm vi của mình" (xem code
 * scope-resolver trong lib/permissions.ts để biết phạm vi cụ thể).
 */
export const PERMISSION_MATRIX: Record<RoleCode, Record<ModuleCode, Action[]>> = {
  admin: {
    users: ["create", "view", "assign"],
    meetings: ["view"],
    branch_tasks: ["view"],
    department_tasks: ["view"],
    reports: ["view"],
  },
  bgd: {
    users: [],
    meetings: ["view", "comment"],
    branch_tasks: ["view", "comment"],
    department_tasks: ["view"],
    reports: ["view"],
  },
  tkph: {
    users: [],
    meetings: ["create", "view", "comment"],
    branch_tasks: ["create", "view", "assign", "comment"],
    department_tasks: ["view"],
    reports: ["view"],
  },
  truong_phong: {
    users: [],
    meetings: [],
    branch_tasks: ["view", "update_status", "comment"],
    department_tasks: ["create", "view", "assign", "update_status", "comment"],
    reports: ["view"],
  },
};

export function can(role: RoleCode, moduleCode: ModuleCode, action: Action): boolean {
  return PERMISSION_MATRIX[role]?.[moduleCode]?.includes(action) ?? false;
}

/** Sidebar: mục menu do mỗi vai trò "mở khoá". Người có nhiều vai trò sẽ
 * thấy HỢP (union) các mục bên dưới, gộp theo route để không lặp lại. */
export type NavItem = {
  href: string;
  label: string;
  icon: string; // tên icon lucide-react
  module: ModuleCode;
};

export const ROLE_NAV_ITEMS: Record<RoleCode, NavItem[]> = {
  admin: [
    { href: "/dashboard/admin/users", label: "Quản lý người dùng", icon: "Users", module: "users" },
    { href: "/dashboard/reports", label: "Báo cáo tổng thể", icon: "BarChart3", module: "reports" },
  ],
  bgd: [
    { href: "/dashboard/branch-tasks", label: "Tiến độ Phân hiệu", icon: "Building2", module: "branch_tasks" },
    { href: "/dashboard/meetings", label: "Biên bản họp", icon: "FileText", module: "meetings" },
    { href: "/dashboard/reports", label: "Báo cáo & Thống kê", icon: "BarChart3", module: "reports" },
  ],
  tkph: [
    { href: "/dashboard/meetings", label: "Biên bản họp", icon: "FileText", module: "meetings" },
    { href: "/dashboard/branch-tasks", label: "Phân bổ cấp Phân hiệu", icon: "Building2", module: "branch_tasks" },
    { href: "/dashboard/reports", label: "Báo cáo & Thống kê", icon: "BarChart3", module: "reports" },
  ],
  truong_phong: [
    { href: "/dashboard/branch-tasks", label: "Nhiệm vụ Phân hiệu giao", icon: "Building2", module: "branch_tasks" },
    { href: "/dashboard/department-tasks", label: "Kanban cấp Phòng", icon: "KanbanSquare", module: "department_tasks" },
    { href: "/dashboard/reports", label: "Báo cáo & Thống kê", icon: "BarChart3", module: "reports" },
  ],
};
