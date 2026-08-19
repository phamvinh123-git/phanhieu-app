import { randomBytes } from "crypto";
import { db } from "./index";
import { departments, users, userRoles, meetings, tasks, taskDepartments } from "./schema";
import { hashPassword } from "../lib/auth";
import type { RoleCode } from "../lib/rbac-config";

function genPassword(): string {
  // 10 ký tự dễ đọc (bỏ ký tự dễ nhầm lẫn 0/O, 1/l/I) + 1 số + 1 ký tự đặc biệt
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[randomBytes(1)[0] % chars.length];
  return `${out}!${randomBytes(1)[0] % 10}`;
}

type SeedUser = { fullName: string; email: string; title: string };
export type SeedCredential = { fullName: string; email: string; title: string; password: string };
export type SeedResult = { skipped: boolean; createdUsers: SeedCredential[] };

/**
 * Tạo cơ cấu Phòng/Bộ môn/Tổ thật + 13 tài khoản cán bộ + dữ liệu mẫu minh
 * hoạ luồng nghiệp vụ. AN TOÀN GỌI NHIỀU LẦN (idempotent): nếu đã có ít nhất
 * 1 người dùng trong hệ thống thì bỏ qua hoàn toàn, không tạo trùng — nhờ
 * vậy hàm này dùng được cả cho script CLI (seed.ts) lẫn 1 API endpoint chạy
 * trên server đã deploy (bootstrap-seed) mà không sợ gọi nhầm lần 2 làm hỏng
 * dữ liệu.
 *
 * @param defaultPassword Nếu có, TẤT CẢ tài khoản dùng chung mật khẩu này
 *   (dùng khi seed môi trường production — mỗi người tự đổi mật khẩu ngay
 *   sau lần đăng nhập đầu qua trang /dashboard/change-password). Nếu không
 *   truyền, mỗi người được sinh 1 mật khẩu ngẫu nhiên riêng (dùng cho dev/local).
 */
export async function runSeed(defaultPassword?: string | null): Promise<SeedResult> {
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    return { skipped: true, createdUsers: [] };
  }

  const credentials: SeedCredential[] = [];

  async function mkUser(u: SeedUser) {
    const password = defaultPassword ?? genPassword();
    const passwordHash = await hashPassword(password);
    const [row] = await db
      .insert(users)
      .values({ fullName: u.fullName, email: u.email.toLowerCase().trim(), passwordHash })
      .returning();
    credentials.push({ fullName: u.fullName, email: u.email, title: u.title, password });
    return row;
  }

  // ---- Cơ cấu tổ chức -------------------------------------------------------
  const deptDefs = [
    { code: "TCHCQT", name: "Phòng Tổ chức - Hành chính - Quản trị" },
    { code: "TCKT", name: "Phòng Tài chính - Kế toán" },
    { code: "KTDBCL", name: "Phòng Khảo thí và Đảm bảo Chất lượng giáo dục" },
    { code: "QLDT", name: "Phòng Quản lý Đào tạo" },
    { code: "YHCS", name: "Bộ môn Y học Cơ sở" },
    { code: "TTRA", name: "Tổ Thanh tra" },
    { code: "LCD", name: "Liên chi đoàn Phân hiệu Thanh Hóa" },
    { code: "NCKH", name: "Tổ Nghiên cứu khoa học và Hợp tác quốc tế" },
  ];
  const dept: Record<string, typeof departments.$inferSelect> = {};
  for (const d of deptDefs) {
    const [row] = await db.insert(departments).values(d).returning();
    dept[d.code] = row;
  }

  // ---- Tài khoản kỹ thuật (quản trị hệ thống) --------------------------------
  const admin = await mkUser({
    fullName: "Quản trị hệ thống",
    email: "admin@hmu.edu.vn",
    title: "Quản trị kỹ thuật (đề nghị giao cho bộ phận CNTT)",
  });

  // ---- Ban giám đốc -----------------------------------------------------------
  const tung = await mkUser({
    fullName: "PGS.TS. Lê Đình Tùng",
    email: "tung@hmu.edu.vn",
    title: "Phụ trách Phân hiệu",
  });
  const thuc = await mkUser({
    fullName: "TS. Cầm Bá Thức",
    email: "cambathuc@hmu.edu.vn",
    title: "Phó Giám đốc Phân hiệu",
  });

  // ---- Thư kí phân hiệu ---------------------------------------------------------
  const linh = await mkUser({
    fullName: "Hoàng Thùy Linh",
    email: "hoangthuylinh@hmu.edu.vn",
    title: "Thư kí Phân hiệu",
  });
  const minh = await mkUser({
    fullName: "Lê Thị Minh",
    email: "lethiminh@hmu.edu.vn",
    title: "Thư kí Phân hiệu",
  });

  // ---- Trưởng phòng / phụ trách các đơn vị ------------------------------------
  const ngoc = await mkUser({
    fullName: "ThS. Bùi Lương Vũ Ngọc",
    email: "ngocblv@hmu.edu.vn",
    title: "Trưởng phòng TC-HC-QT",
  });
  const nguyet = await mkUser({
    fullName: "ThS. Trịnh Thị Nguyệt",
    email: "trinhthinguyet@hmu.edu.vn",
    title: "Kế toán trưởng, Trưởng phòng TCKT",
  });
  const le = await mkUser({
    fullName: "ThS. Nguyễn Thị Lệ",
    email: "lenguyen@hmu.edu.vn",
    title: "Trưởng phòng Khảo thí và Đảm bảo Chất lượng giáo dục",
  });
  const trang = await mkUser({
    fullName: "ThS. Đỗ Thị Huyền Trang",
    email: "huyentrangyhn@hmu.edu.vn",
    title: "Phó trưởng phòng - Phụ trách Phòng QLĐT",
  });
  const hanh = await mkUser({
    fullName: "ThS. Lê Thị Hạnh",
    email: "lethihanhyhn@hmu.edu.vn",
    title: "Phó trưởng Bộ môn - Phụ trách Bộ môn Y học Cơ sở",
  });
  const quang = await mkUser({
    fullName: "TS. Lê Minh Quang",
    email: "leminhquang@hmu.edu.vn",
    title: "Tổ trưởng Tổ Thanh tra",
  });
  const chung = await mkUser({
    fullName: "ThS. Nguyễn Thành Chung",
    email: "nguyenthanhchung@hmu.edu.vn",
    title: "Bí thư Liên chi đoàn PHTH",
  });
  const hue = await mkUser({
    fullName: "TS. Mai Thị Huệ",
    email: "maithihue@hmu.edu.vn",
    title: "Tổ trưởng Tổ Nghiên cứu khoa học và Hợp tác quốc tế",
  });

  // ---- Gán vai trò (bảng phân quyền) ------------------------------------------
  const roleRows: { userId: string; role: RoleCode; departmentId: number | null }[] = [
    { userId: admin.id, role: "admin", departmentId: null },
    { userId: tung.id, role: "bgd", departmentId: null },
    { userId: thuc.id, role: "bgd", departmentId: null },
    { userId: linh.id, role: "tkph", departmentId: null },
    { userId: minh.id, role: "tkph", departmentId: null },
    { userId: ngoc.id, role: "truong_phong", departmentId: dept.TCHCQT.id },
    { userId: nguyet.id, role: "truong_phong", departmentId: dept.TCKT.id },
    { userId: le.id, role: "truong_phong", departmentId: dept.KTDBCL.id },
    { userId: trang.id, role: "truong_phong", departmentId: dept.QLDT.id },
    { userId: hanh.id, role: "truong_phong", departmentId: dept.YHCS.id },
    { userId: quang.id, role: "truong_phong", departmentId: dept.TTRA.id },
    { userId: chung.id, role: "truong_phong", departmentId: dept.LCD.id },
    { userId: hue.id, role: "truong_phong", departmentId: dept.NCKH.id },
  ];
  await db.insert(userRoles).values(roleRows);

  // ---- Biên bản họp + luồng công việc mẫu -------------------------------------
  const meetingContent = [
    "1. Rà soát chương trình đào tạo và lịch giảng dạy học kỳ mới trước 25/8 (QLDT).",
    "2. Chuẩn bị hồ sơ, quy chế chi tiêu nội bộ phối hợp cung cấp số liệu (TCHCQT, TCKT).",
    "3. Xây dựng kế hoạch tự đánh giá chất lượng giáo dục năm học mới (KTDBCL).",
  ].join("\n");

  const [meeting] = await db
    .insert(meetings)
    .values({
      title: "Họp giao ban Phân hiệu quý III/2026",
      meetingDate: new Date("2026-08-10"),
      content: meetingContent,
      status: "reviewed",
      createdBy: linh.id,
    })
    .returning();

  const [branchTask] = await db
    .insert(tasks)
    .values({
      title: "Rà soát chương trình đào tạo và lịch giảng dạy học kỳ mới",
      description: "Theo kết luận cuộc họp giao ban quý III/2026, mục 1.",
      level: "branch",
      status: "in_progress",
      priority: "high",
      meetingId: meeting.id,
      createdBy: linh.id,
      dueDate: new Date("2026-08-25"),
    })
    .returning();
  await db.insert(taskDepartments).values([{ taskId: branchTask.id, departmentId: dept.QLDT.id }]);

  // Nhiệm vụ liên phòng: TC-HC-QT và TCKT cùng phối hợp.
  const [jointTask] = await db
    .insert(tasks)
    .values({
      title: "Chuẩn bị hồ sơ, quy chế chi tiêu nội bộ phối hợp cung cấp số liệu",
      level: "branch",
      status: "todo",
      priority: "normal",
      meetingId: meeting.id,
      createdBy: linh.id,
      dueDate: new Date("2026-08-28"),
    })
    .returning();
  await db.insert(taskDepartments).values([
    { taskId: jointTask.id, departmentId: dept.TCHCQT.id },
    { taskId: jointTask.id, departmentId: dept.TCKT.id },
  ]);

  await db.insert(tasks).values([
    {
      title: "Tổng hợp đề cương chi tiết các học phần học kỳ mới",
      level: "department",
      status: "in_progress",
      priority: "high",
      parentTaskId: branchTask.id,
      departmentId: dept.QLDT.id,
      createdBy: trang.id,
      dueDate: new Date("2026-08-22"),
    },
    {
      title: "Xếp lịch giảng dạy, tránh trùng phòng học",
      level: "department",
      status: "todo",
      priority: "normal",
      parentTaskId: branchTask.id,
      departmentId: dept.QLDT.id,
      createdBy: trang.id,
      dueDate: new Date("2026-08-24"),
    },
  ]);

  return { skipped: false, createdUsers: credentials };
}
