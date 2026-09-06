import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, tasks } from "@/db/schema";

/**
 * Xoá toàn bộ dữ liệu "công việc đang chạy" (biên bản họp + công việc được
 * giao), GIỮ NGUYÊN cơ cấu Phòng ban và tài khoản người dùng — dùng khi
 * muốn dọn sạch dữ liệu thử nghiệm/demo trên production trước khi vận hành
 * thật, mà không phải tạo lại tài khoản hay phân quyền.
 *
 * Xoá theo thứ tự an toàn khoá ngoại:
 *   - Xoá `tasks` trước — các bảng con (task_comments, task_departments,
 *     task_status_history) đều có onDelete: "cascade" theo tasks.id nên tự
 *     động bị xoá theo, không cần xoá riêng.
 *   - Xoá `meetings` sau.
 * KHÔNG đụng đến users, user_roles, departments.
 *
 * Bảo vệ 2 lớp:
 *   1. Header Authorization: Bearer <BOOTSTRAP_SEED_SECRET> (dùng chung
 *      secret với endpoint bootstrap-seed, đã có sẵn trên môi trường).
 *   2. Body phải có { "confirm": "XOA_BIEN_BAN_VA_CONG_VIEC" } — tránh gọi
 *      nhầm/tự động hoá ngoài ý muốn vì đây là thao tác không thể hoàn tác.
 */
const CONFIRM_PHRASE = "XOA_BIEN_BAN_VA_CONG_VIEC";

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

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `Thiếu xác nhận. Gửi body { "confirm": "${CONFIRM_PHRASE}" } để xác nhận muốn xoá (không thể hoàn tác).`,
      },
      { status: 400 }
    );
  }

  const deletedTasks = await db.delete(tasks).returning({ id: tasks.id });
  const deletedMeetings = await db.delete(meetings).returning({ id: meetings.id });

  return NextResponse.json({
    ok: true,
    deletedTaskCount: deletedTasks.length,
    deletedMeetingCount: deletedMeetings.length,
  });
}
