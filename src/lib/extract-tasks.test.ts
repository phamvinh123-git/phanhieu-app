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
const REF = { referenceDate: "2026-08-10" }; // Thứ Hai

const run = (text: string, opts = REF) => extractTasksFromMinutes(text, DEPTS, opts);

test("cách ghi cũ: mã trong ngoặc cuối dòng, ngày không ghi năm", () => {
  const { tasks } = run("1. Rà soát chương trình đào tạo và lịch giảng dạy học kỳ mới trước 25/8 (QLDT).");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Rà soát chương trình đào tạo và lịch giảng dạy học kỳ mới trước 25/8");
  assert.deepEqual(tasks[0].departmentCodes, ["QLDT"]);
  assert.equal(tasks[0].dueDate, "2026-08-25");
  assert.equal(tasks[0].source, "tag");
});

test("nhiều mã trong ngoặc → nhiệm vụ liên phòng", () => {
  const { tasks } = run("2. Chuẩn bị hồ sơ, quy chế chi tiêu nội bộ, phối hợp cung cấp số liệu (TCHCQT, TCKT).");
  assert.deepEqual(tasks[0].departmentCodes, ["TCHCQT", "TCKT"]);
  assert.equal(tasks[0].title, "Chuẩn bị hồ sơ, quy chế chi tiêu nội bộ, phối hợp cung cấp số liệu");
});

test("ngày đầy đủ trong ngoặc cùng mã phòng", () => {
  const { tasks } = run("Hoàn thiện kế hoạch tuyển sinh (QLDT, 05/11/2026)");
  assert.equal(tasks[0].dueDate, "2026-11-05");
  assert.deepEqual(tasks[0].departmentCodes, ["QLDT"]);
});

test("tên Phòng đầy đủ + 'giao … chủ trì, phối hợp với …'", () => {
  const { tasks } = run(
    "Giao Phòng Quản lý Đào tạo chủ trì, phối hợp với Phòng Tài chính - Kế toán xây dựng kế hoạch tuyển sinh năm 2027, hoàn thành trước ngày 30/9/2026."
  );
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].departmentCodes, ["QLDT", "TCKT"]);
  assert.equal(tasks[0].title, "Xây dựng kế hoạch tuyển sinh năm 2027, hoàn thành trước ngày 30/9/2026");
  assert.equal(tasks[0].dueDate, "2026-09-30");
  assert.equal(tasks[0].source, "mention");
});

test("mã có dấu, dạng 'Phòng X: việc 1; việc 2' → tách 2 việc", () => {
  const { tasks } = run("- Phòng QLĐT: tổng hợp đề cương chi tiết các học phần; xếp lịch giảng dạy tránh trùng phòng học.");
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, "Tổng hợp đề cương chi tiết các học phần");
  assert.equal(tasks[1].title, "Xếp lịch giảng dạy tránh trùng phòng học");
  assert.ok(tasks.every((t) => t.departmentCodes.join() === "QLDT"));
});

test("biên bản chia theo mục Phòng, kế thừa Phòng của mục", () => {
  const { tasks, skipped } = run(
    [
      "II. Phòng Tài chính – Kế toán:",
      "- Hoàn thiện báo cáo quyết toán quý III, gửi BGĐ trong tháng 10.",
      "- Rà soát công nợ, phối hợp TCHCQT.",
      "III. Các vấn đề khác:",
      "- Đề nghị các phòng chú ý giữ gìn vệ sinh chung.",
    ].join("\n")
  );
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, "Hoàn thiện báo cáo quyết toán quý III, gửi BGĐ trong tháng 10");
  assert.deepEqual(tasks[0].departmentCodes, ["TCKT"]);
  assert.equal(tasks[0].dueDate, "2026-10-31");
  assert.equal(tasks[0].source, "section");
  assert.equal(tasks[0].section, "Phòng Tài chính – Kế toán");
  assert.deepEqual(tasks[1].departmentCodes, ["TCKT", "TCHCQT"]);
  assert.equal(tasks[1].title, "Rà soát công nợ");
  assert.equal(skipped.length, 1); // mục "Các vấn đề khác" không gắn Phòng
  assert.equal(skipped[0].reason, "no_tag");
});

test("tiêu đề mục viết HOA", () => {
  const { tasks } = run("PHÒNG QUẢN LÝ ĐÀO TẠO\n- Cập nhật thời khoá biểu học kỳ I.");
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].departmentCodes, ["QLDT"]);
});

test("câu bị xuống dòng được ghép lại", () => {
  const { tasks } = run(
    "1. Xây dựng kế hoạch tự đánh giá chất lượng giáo dục năm học mới,\nbáo cáo Ban Giám đốc trước 15/9 (KTDBCL)."
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Xây dựng kế hoạch tự đánh giá chất lượng giáo dục năm học mới, báo cáo Ban Giám đốc trước 15/9");
  assert.equal(tasks[0].dueDate, "2026-09-15");
});

test("mức ưu tiên — 'khẩn trương' là Cao, 'hoả tốc' là Khẩn cấp, 'gặp' không phải 'gấp'", () => {
  assert.equal(run("Khẩn trương hoàn thiện hồ sơ kiểm định (KTDBCL)").tasks[0].priority, "high");
  assert.equal(run("Gửi văn bản hoả tốc lên Bộ Y tế (TCHCQT)").tasks[0].priority, "urgent");
  assert.equal(run("Gặp gỡ đoàn kiểm tra của Bộ (TCHCQT)").tasks[0].priority, "normal");
  assert.equal(run("Cần làm gấp báo cáo tuyển sinh (QLDT)").tasks[0].priority, "high");
});

test("dòng thông tin hành chính bị bỏ qua, 'Sơ kết…' vẫn là việc", () => {
  const { tasks, skipped } = run(
    "Thời gian: 8h00 ngày 10/8/2026\nThành phần: Ban Giám đốc, các Trưởng phòng\nSơ kết công tác tuyển sinh năm 2026 (QLDT)"
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Sơ kết công tác tuyển sinh năm 2026");
  assert.equal(skipped.length, 0);
});

test("hạn không ghi năm, họp cuối năm → hiểu là năm sau", () => {
  const { tasks } = run("Nộp báo cáo tổng kết trước 15/1 (QLDT)", { referenceDate: "2026-12-20" });
  assert.equal(tasks[0].dueDate, "2027-01-15");
});

test("mã lạ được báo lại, '(hạn 30/9)' không bị coi là mã", () => {
  const r1 = run("Chuẩn bị hội trường cho lễ khai giảng (ABC)");
  assert.equal(r1.tasks.length, 0);
  assert.deepEqual(r1.skipped[0].unmatchedCodes, ["ABC"]);

  const r2 = run("Phòng TCKT lập dự toán ngân sách năm 2027 (hạn 30/9)");
  assert.equal(r2.tasks.length, 1);
  assert.deepEqual(r2.tasks[0].departmentCodes, ["TCKT"]);
  assert.equal(r2.tasks[0].title, "Lập dự toán ngân sách năm 2027 (hạn 30/9)");
  assert.equal(r2.tasks[0].dueDate, "2026-09-30");
});

test("tên đơn vị không có chữ 'Phòng' + hạn 'tuần sau'", () => {
  const { tasks } = run("Liên chi đoàn tổ chức hoạt động chào tân sinh viên trong tuần sau.");
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].departmentCodes, ["LCD"]);
  assert.equal(tasks[0].title, "Tổ chức hoạt động chào tân sinh viên trong tuần sau");
  assert.equal(tasks[0].dueDate, "2026-08-23");
});

test("cụm 'thanh tra' thông thường không bị nhận nhầm là Tổ Thanh tra", () => {
  const { tasks } = run("Phòng KTDBCL chuẩn bị công tác thanh tra thi học kỳ.");
  assert.deepEqual(tasks[0].departmentCodes, ["KTDBCL"]);
});

test("hạn theo quý và ngày viết bằng chữ", () => {
  assert.equal(run("Hoàn thành kiểm kê tài sản trước quý IV (TCHCQT)").tasks[0].dueDate, "2026-12-31");
  assert.equal(
    run("Nộp đề tài cấp cơ sở trước ngày 20 tháng 10 năm 2026 (NCKH)").tasks[0].dueDate,
    "2026-10-20"
  );
});

test("số thập phân không bị hiểu là ngày", () => {
  const { tasks } = run("Giải ngân 2.5 tỷ đồng kinh phí sửa chữa (TCKT)");
  assert.equal(tasks[0].dueDate, null);
});

test("mọi việc có ghi hạn đều được điền hạn, cụm hạn vẫn giữ trong tiêu đề", () => {
  const text = [
    "1. Nộp kế hoạch năm học trước 30/9 (QLDT).",
    "2. Phòng TCKT hoàn thành quyết toán chậm nhất ngày 15/10/2026.",
    "3. Tổ chức hội nghị cán bộ viên chức trong tháng 11 (TCHCQT).",
    "4. Báo cáo tự đánh giá trước ngày 5 tháng 12 (KTDBCL).",
    "5. Rà soát đề cương học phần (YHCS).",
  ].join("\n");
  const due = run(text).tasks.map((t) => t.dueDate);
  assert.deepEqual(due, ["2026-09-30", "2026-10-15", "2026-11-30", "2026-12-05", null]);
  assert.match(run(text).tasks[0].title, /trước 30\/9$/);
});

test("biên bản theo mẫu hành chính: chỉ đọc phần NỘI DUNG, mục con báo cáo / chỉ đạo, gạch đầu dòng 2 cấp", () => {
  const text = [
    "TRƯỜNG ĐẠI HỌC Y HÀ NỘI",
    "BIÊN BẢN",
    "Thời gian: Từ 8h00 ngày 10/08/2026",
    "Thành phần tham dự",
    "- ThS. Nguyễn Văn A - Trưởng Phòng TC-HC-QT;",
    "- ThS. Trần Thị B - Trưởng Phòng TCKT;",
    "NỘI DUNG",
    "1. Phòng Tổ chức - Hành chính - Quản trị",
    "1.1. Đ/c Nguyễn Văn A - Trưởng phòng báo cáo tình hình hoạt động",
    "* Công tác cơ sở vật chất",
    "- Phòng đã hoàn tất sơn sửa hội trường.",
    "- Sửa chữa cổng chính: Nhà thầu sẽ hoàn thành trước ngày 20/08/2026.",
    "- Cơ sở vật chất:",
    "+ Phối hợp với Phòng TCKT thống nhất phương án thuê dịch vụ vệ sinh.",
    "1.2. Chỉ đạo của BGĐ",
    "- Cải tạo nhà A:",
    "+ Đảm bảo tiến độ và an toàn thi công.",
    "+ Tăng cường bạt chắn bụi.",
    "- Khu đất mới: Yêu cầu đẩy nhanh tiến độ, hoàn thiện dứt điểm trong tháng 9/2026.",
    "2. Phòng Khảo thí & Đảm bảo chất lượng giáo dục",
    "2.1. Đ/c Lê Thị C - Trưởng Phòng báo cáo tình hình hoạt động",
    "- Các hoạt động của Phòng diễn ra bình thường.",
    "2.2. Chỉ đạo của BGĐ",
    "- Hoàn thiện cơ cấu nhân sự (phối hợp với Phòng TCHCQT).",
    "3. Đoàn Thanh niên",
    "3.1. Chỉ đạo của BGĐ",
    "- Hoàn trả học phí cho sinh viên: Giao Phòng QLĐT trao đổi với phụ huynh để tìm hiểu nguyên nhân.",
    "- Bổ sung các CLB thể thao cho sinh viên.",
    "Giao đ/c phụ trách thể thao theo dõi hoạt động này.",
    "Cuộc họp kết thúc vào 10 giờ cùng ngày./.",
    "Nơi nhận:",
    "- Lưu: VT, TCHCQT.",
  ].join("\n");
  const { tasks, skipped } = run(text);
  const rows = tasks.map((t) => `${t.departmentCodes.join("+")} | ${t.dueDate ?? "-"} | ${t.title}`);
  assert.deepEqual(rows, [
    "TCHCQT | 2026-08-20 | Sửa chữa cổng chính: nhà thầu sẽ hoàn thành trước ngày 20/08/2026",
    "TCHCQT+TCKT | - | Cơ sở vật chất: phối hợp với Phòng TCKT thống nhất phương án thuê dịch vụ vệ sinh",
    "TCHCQT | - | Cải tạo nhà A: đảm bảo tiến độ và an toàn thi công",
    "TCHCQT | - | Cải tạo nhà A: tăng cường bạt chắn bụi",
    "TCHCQT | 2026-09-30 | Khu đất mới: yêu cầu đẩy nhanh tiến độ, hoàn thiện dứt điểm trong tháng 9/2026",
    "KTDBCL+TCHCQT | - | Hoàn thiện cơ cấu nhân sự",
    "QLDT | - | Hoàn trả học phí cho sinh viên: trao đổi với phụ huynh để tìm hiểu nguyên nhân",
    "LCD | - | Bổ sung các CLB thể thao cho sinh viên. Giao đ/c phụ trách thể thao theo dõi hoạt động này",
  ]);
  assert.equal(tasks[4].priority, "high");
  // Ý báo cáo đã xong không tạo việc, được đánh dấu "report"
  assert.deepEqual(
    skipped.map((s) => s.reason),
    ["report", "report"]
  );
});

test("dòng có mã trong ngoặc: giữ nguyên câu, một dòng là một việc (không tách ';', không cắt 'Giao …')", () => {
  const text = [
    "1. Đẩy nhanh tiến độ cải tạo nhà A, đảm bảo an toàn thi công; tăng cường bạt chắn bụi (TCHCQT).",
    "2. Rà soát kết quả KPI 6 tháng đầu năm; đơn vị chưa hoàn thành cần có phương án giải quyết (TCHCQT).",
    "3. Tổ chức chuỗi sự kiện Ngày hội chào năm học mới ngày 26/09/2026; đề xuất Ban Giám Đốc lịch họp Ban Chỉ đạo (QLDT).",
    "4. Giao Phòng Quản lý Đào tạo trao đổi với phụ huynh, sinh viên về nguyện vọng rút học phí (QLDT, TCKT).",
    "5. Hoàn thiện cơ cấu nhân sự đáp ứng nhu cầu công việc (KTDBCL, TCHCQT).",
  ].join("\n");
  const { tasks } = run(text, { referenceDate: "2026-09-07" });
  assert.equal(tasks.length, 5);
  assert.equal(tasks[0].title, "Đẩy nhanh tiến độ cải tạo nhà A, đảm bảo an toàn thi công; tăng cường bạt chắn bụi");
  assert.equal(tasks[1].title, "Rà soát kết quả KPI 6 tháng đầu năm; đơn vị chưa hoàn thành cần có phương án giải quyết");
  assert.equal(tasks[2].dueDate, "2026-09-26");
  assert.equal(tasks[3].title, "Giao Phòng Quản lý Đào tạo trao đổi với phụ huynh, sinh viên về nguyện vọng rút học phí");
  assert.deepEqual(tasks[3].departmentCodes, ["QLDT", "TCKT"]);
  assert.deepEqual(tasks[4].departmentCodes, ["KTDBCL", "TCHCQT"]);
});
