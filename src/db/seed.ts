import "dotenv/config";
import { writeFileSync } from "fs";
import { runSeed } from "./seed-logic";

async function main() {
  console.log("Seeding database (cơ cấu thật Phân hiệu Thanh Hóa)...");

  // Khi SEED_DEFAULT_PASSWORD được đặt (dùng lúc seed môi trường production),
  // TẤT CẢ tài khoản dùng chung 1 mật khẩu khởi tạo này thay vì mật khẩu
  // ngẫu nhiên riêng — vì hệ thống đã có trang tự đổi mật khẩu
  // (/dashboard/change-password), mỗi người đăng nhập lần đầu bằng mật khẩu
  // chung rồi tự đặt mật khẩu riêng ngay. Không đặt biến này thì hành vi cũ
  // giữ nguyên: sinh mật khẩu ngẫu nhiên riêng cho từng người (dev/local).
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD?.trim() || null;

  const result = await runSeed(defaultPassword);

  if (result.skipped) {
    console.log("Đã có dữ liệu người dùng trong database — bỏ qua seed (an toàn khi chạy lại).");
    process.exit(0);
  }

  // ---- Xuất danh sách tài khoản ra file (không in mật khẩu ra log CI) ---------
  const lines = [
    "Họ tên,Chức vụ,Email,Mật khẩu tạm thời",
    ...result.createdUsers.map((c) => `${c.fullName},${c.title},${c.email},${c.password}`),
  ];
  writeFileSync("credentials.generated.csv", lines.join("\n"), "utf8");

  console.log(`Seed hoàn tất. Đã tạo ${result.createdUsers.length} tài khoản.`);
  console.log("Danh sách email + mật khẩu tạm thời đã ghi vào: credentials.generated.csv");
  console.log("(File này đã được .gitignore — không commit lên kho mã nguồn dùng chung.)");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
