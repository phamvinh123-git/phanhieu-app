import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskDepartments } from "@/db/schema";
import { notifyDueSoon } from "@/lib/email";

/**
 * Endpoint để một scheduler BÊN NGOÀI (vd. Render Cron Job, hoặc cron trên
 * VPS gọi `curl`) gọi định kỳ (khuyến nghị: mỗi ngày 1 lần, buổi sáng) —
 * quét các nhiệm vụ sắp đến hạn trong N ngày tới (mặc định 2 ngày) mà chưa
 * "Hoàn thành", rồi gửi email nhắc cho Trưởng phòng phụ trách.
 *
 * Bảo vệ bằng CRON_SECRET (đặt trong .env / Render Environment) — request
 * phải có header:  Authorization: Bearer <CRON_SECRET>
 *
 * Ví dụ cấu hình Render Cron Job (render.yaml):
 *   - type: cron
 *     name: due-date-reminders
 *     schedule: "0 1 * * *"   # 08:00 giờ VN (UTC+7)
 *     dockerCommand: >
 *       curl -fsS -X POST https://<app>.onrender.com/api/cron/due-date-reminders
 *       -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET chưa được cấu hình trên server" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  const daysAhead = Number(req.nextUrl.searchParams.get("days") ?? 2);
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const dueSoonTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, now),
        lte(tasks.dueDate, until),
        ne(tasks.status, "done")
      )
    );

  const items: {
    taskId: number;
    title: string;
    dueDate: Date;
    level: "branch" | "department";
    departmentIds: number[];
  }[] = [];

  for (const t of dueSoonTasks) {
    if (!t.dueDate) continue;
    let departmentIds: number[] = [];
    if (t.level === "department" && t.departmentId) {
      departmentIds = [t.departmentId];
    } else if (t.level === "branch") {
      const links = await db
        .select({ departmentId: taskDepartments.departmentId })
        .from(taskDepartments)
        .where(eq(taskDepartments.taskId, t.id));
      departmentIds = links.map((l) => l.departmentId);
    }
    if (departmentIds.length === 0) continue;
    items.push({ taskId: t.id, title: t.title, dueDate: t.dueDate, level: t.level, departmentIds });
  }

  await notifyDueSoon(items);

  return NextResponse.json({ checked: dueSoonTasks.length, notified: items.length });
}
