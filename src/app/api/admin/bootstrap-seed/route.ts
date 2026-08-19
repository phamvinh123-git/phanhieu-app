import { NextRequest, NextResponse } from "next/server";
import { runSeed } from "@/db/seed-logic";

/**
 * Khởi tạo dữ liệu (cơ cấu Phòng + tài khoản cán bộ) cho môi trường đã
 * deploy, KHÔNG cần thêm 1 job/service riêng trên Render (tránh phát sinh
 * chi phí ngoài dự tính) — chỉ cần gọi POST 1 lần tới endpoint này sau khi
 * app đã deploy thành công.
 *
 * An toàn gọi nhiều lần: nếu database đã có người dùng thì bỏ qua
 * (skipped: true), không tạo trùng.
 *
 * Bảo vệ bằng BOOTSTRAP_SEED_SECRET — request phải có header:
 *   Authorization: Bearer <BOOTSTRAP_SEED_SECRET>
 *
 * Không trả về mật khẩu trong response (mọi tài khoản dùng chung
 * SEED_DEFAULT_PASSWORD, không cần "lấy lại" mật khẩu qua API).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.BOOTSTRAP_SEED_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "BOOTSTRAP_SEED_SECRET chưa được cấu hình trên server" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD?.trim() || null;
  const result = await runSeed(defaultPassword);

  return NextResponse.json({
    skipped: result.skipped,
    createdUserCount: result.createdUsers.length,
  });
}
