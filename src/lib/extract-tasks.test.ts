import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTasksFromMinutes, type DepartmentRef } from "./extract-tasks";

// Cơ cấu Phòng giống dữ liệu khởi tạo (src/db/seed-logic.ts)
const DEPTS: DepartmentRef[] = [
  { id: 1, code: "TCHCQT", name: "Phòng Tổ chức - Hành chính - Quản trị" },
  { id: 2, code: "TCKT", name: "Phòng Tài chính - Kế toán" },
  { id: 3, code: "KTDBCL", name: "Phòng Khảo thí và Đảm bảo Chất lượng giáo dục" },
  { id: 4, code: "QLDT", name: "Phòng Quản lý Đào tạo" },
  { id: 5, code: "YHCS", name: "Bộ môn Y học Cơ sở" },
  { id: 6, code: "TTRA", name: "Tổ Thanh tra" },
  { id: 7, code: "LCD", name: "Liên chi đoàn Phân Hiệu Thanh Hóa" },
  { id: 8, code: "NCKH", name: "Tổ Nghiên cứu khoa học và Hợp tác quốc tế" },
];
const REF = { referenceDate: "2026-09-07" }; // Thứ Hai

const run = (text: string, opts = REF) => extractTasksFromMinutes(text, DEPTS, opts);

// ---- Quy tắc tách việc (giữ nguyên như bản ban đầu) --------------------------

test("mỗi dòng có mã trong ngoặc là một việc, giữ nguyên câu chữ", () => {
  const { tasks } = run(
    [
      "1. Đẩy nhanh tiến độ cải tạo nhà A, đảm bảo an toàn thi công; tăng cường bạt chắn bụi (TCHCQT).",
      "2. Giao Phòng Quản lý Đào tạo trao đổi với phụ huynh về nguyện vọng rút học phí (QLDT, TCKT).",
    ].join("\n")
  );
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, "Đẩy nhanh tiến độ cải tạo nhà A, đảm bảo an toàn thi công; tăng cường bạt chắn bụi");
  assert.deepEqual(tasks[0].departmentCodes, ["TCHCQT"]);
  assert.equal(tasks[1].title, "Giao Phòng Quản lý Đào tạo trao đổi với phụ huynh về nguyện vọng rút học phí");
  assert.deepEqual(tasks[1].departmentCodes, ["QLDT", "TCKT"]);
  assert.ok(tasks.every((t) => t.priority === "normal"));
});

test("nhiều mã cách nhau bởi , / & 'và'; mã trùng bị gộp", () => {
  const { tasks } = run("Việc phối hợp (TCKT / QLDT & TCHCQT và KTDBCL, TCKT)");
  assert.deepEqual(tasks[0].departmentCodes, ["TCKT", "QLDT", "TCHCQT", "KTDBCL"]);
});

test("dòng không có ngoặc hoặc mã lạ bị bỏ qua và báo lại", () => {
  const { tasks, skipped } = run("II. CÁC VẤN ĐỀ KHÁC\nChuẩn bị hội trường cho lễ khai giảng (ABC)");
  assert.equal(tasks.length, 0);
  assert.equal(skipped[0].reason, "no_tag");
  assert.equal(skipped[1].reason, "unmatched_codes");
  assert.deepEqual(skipped[1].unmatchedCodes, ["ABC"]);
});

// ---- Tự tách hạn hoàn thành ------------------------------------------------

const due = (line: string, opts = REF) => run(line, opts).tasks[0]?.dueDate ?? null;

test("hạn dạng ngày/tháng/năm đầy đủ và viết tắt", () => {
  assert.equal(due("Hoàn thành sửa chữa logo trước ngày 10/09/2026 (TCHCQT)."), "2026-09-10");
  assert.equal(due("Nộp báo cáo trước 5-10-2026 (TCKT)"), "2026-10-05");
  assert.equal(due("Nộp báo cáo trước 05.10.2026 (TCKT)"), "2026-10-05");
  assert.equal(due("Nộp báo cáo trước 5/10/26 (TCKT)"), "2026-10-05");
});

test("hạn không ghi năm → năm của ngày họp; họp cuối năm, hạn tháng 1 → năm sau", () => {
  assert.equal(due("Chuẩn bị áo blouse trước ngày 20/09 (QLDT)."), "2026-09-20");
  assert.equal(due("Nộp báo cáo tổng kết trước 15/1 (QLDT)", { referenceDate: "2026-12-20" }), "2027-01-15");
});

test("hạn viết bằng chữ, theo tháng, quý, tuần", () => {
  assert.equal(due("Nộp đề tài trước ngày 20 tháng 10 năm 2026 (NCKH)"), "2026-10-20");
  assert.equal(due("Hoàn thiện dứt điểm các hạng mục trong tháng 9/2026 (TCHCQT)."), "2026-09-30");
  assert.equal(due("Xây dựng kế hoạch rà soát minh chứng trong tháng 10/2026 (KTDBCL)."), "2026-10-31");
  assert.equal(due("Kiểm kê tài sản trước quý IV (TCHCQT)"), "2026-12-31");
  assert.equal(due("Hoàn thiện dự thảo quy định trong tuần này (KTDBCL)."), "2026-09-13");
  assert.equal(due("Tổ chức gặp mặt tân sinh viên tuần sau (LCD)"), "2026-09-20");
});

test("ưu tiên ngày đứng sau 'trước / chậm nhất / hạn'; ngày trong ngoặc cùng mã phòng", () => {
  assert.equal(due("Họp ngày 08/09/2026, nộp kết quả chậm nhất 25/09/2026 (QLDT)"), "2026-09-25");
  assert.equal(due("Hoàn thiện kế hoạch tuyển sinh (QLDT, 05/11/2026)"), "2026-11-05");
});

test("không có hạn / số thập phân / ngày sai → không điền hạn", () => {
  assert.equal(due("Rà soát cơ cấu tổ chức, mạng lưới tổ đội nhóm (LCD)."), null);
  assert.equal(due("Giải ngân 2.5 tỷ đồng kinh phí sửa chữa (TCKT)"), null);
  assert.equal(due("Nộp hồ sơ trước 31/02/2026 (TCKT)"), null);
});
