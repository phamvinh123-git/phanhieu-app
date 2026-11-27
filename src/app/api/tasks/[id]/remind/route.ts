import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, taskComments, tasks, users } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { isLeader } from "@/lib/insights";
import { recipientsForTask } from "@/lib/notifications";
import { todayVN } from "@/lib/role-expiry";
import { sendReminderEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

/**
 * Lãnh đạo / Thư ký bấm "Nhắc" một nhiệm vụ: gửi thông báo (và email nếu đã cấu
 * hình) tới Phòng phụ trách, đồng thời ghi lời nhắc vào phần trao đổi của nhiệm
 * vụ để lưu vết. Mỗi người chỉ nhắc một nhiệm vụ một lần mỗi ngày.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!isLeader(session)) return jsonError("Chỉ lãnh đạo / Thư ký Phân hiệu được nhắc nhiệm vụ", 403);
  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, Number(id)));
  if (!task) return jsonError("Không tìm thấy nhiệm vụ", 404);
  if (task.status === "done") return jsonError("Nhiệm vụ đã hoàn thành");

  const body = await req.json().catch(() => ({}));
  const note = String(body?.message ?? "").trim().slice(0, 300) || "Đề nghị đơn vị khẩn trương triển khai và cập nhật tiến độ.";
  const to = await recipientsForTask(task, session.userId);
  if (to.length === 0) return jsonError("Chưa có tài khoản nào thuộc Phòng phụ trách nhiệm vụ này");

  const today = todayVN();
  const inserted = await db
    .insert(notifications)
    .values(
      to.map((userId) => ({
        userId,
        type: "reminder" as const,
        taskId: task.id,
        actorId: session.userId,
        message: `${session.fullName} nhắc: ${note}`,
        dedupeKey: `remind:${task.id}:${today}:${session.userId}`,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (inserted.length === 0) return jsonError("Bạn đã nhắc nhiệm vụ này hôm nay rồi");

  await db.insert(taskComments).values({ taskId: task.id, userId: session.userId, content: `🔔 Nhắc nhở: ${note}` });

  const emails = (await db.select({ email: users.email }).from(users).where(inArray(users.id, to))).map((u) => u.email);
  void sendReminderEmail(emails, { id: task.id, title: task.title, dueDate: task.dueDate }, session.fullName, note);

  await audit(session, "task.remind", `Nhắc nhiệm vụ "${task.title}" (${to.length} người nhận): ${note}`, {
    entityId: task.id,
  });
  return NextResponse.json({ ok: true, notified: to.length });
}
