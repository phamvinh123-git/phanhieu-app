import nodemailer from "nodemailer";
import { db } from "@/db";
import { departments, users, userRoles } from "@/db/schema";
import { roleIsActive } from "./role-expiry";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Gửi email qua SMTP thông thường — dùng được với SMTP nội bộ của trường,
 * Gmail/Google Workspace (App Password), hoặc bất kỳ dịch vụ SMTP nào khác.
 * Cấu hình hoàn toàn qua biến môi trường, không hard-code nhà cung cấp nào.
 *
 * Biến môi trường cần thiết (đặt trong .env / Render Environment):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false          (true nếu dùng cổng 465)
 *   SMTP_USER=xxx@gmail.com
 *   SMTP_PASS=app-password
 *   SMTP_FROM="Phân Hiệu Thanh Hóa <no-reply@phanhieu.edu.vn>"
 *   APP_URL=https://your-app.onrender.com   (để chèn link vào email)
 *
 * Nếu chưa cấu hình SMTP_HOST, hệ thống sẽ CHỈ log ra console thay vì gửi —
 * để không làm vỡ luồng chính (tạo nhiệm vụ / báo cáo) khi email lỗi hoặc
 * chưa cấu hình trong môi trường dev.
 */

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendMail(to: string[], subject: string, html: string) {
  if (to.length === 0) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[email:skip - chưa cấu hình SMTP_HOST] to=${to.join(",")} subject="${subject}"`);
    return;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "Phân Hiệu Thanh Hóa <no-reply@phanhieu.edu.vn>",
      to: to.join(","),
      subject,
      html,
    });
  } catch (err) {
    // Không throw — lỗi gửi email không được phép làm hỏng luồng nghiệp vụ chính.
    console.error("[email:error]", err);
  }
}

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Lấy email của tất cả Trưởng phòng thuộc các Phòng cho trước. */
async function getDepartmentLeadEmails(departmentIds: number[]): Promise<string[]> {
  if (departmentIds.length === 0) return [];
  const rows = await db
    .select({ email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(inArray(userRoles.departmentId, departmentIds), eq(users.isActive, true), roleIsActive()));
  return [...new Set(rows.map((r) => r.email))];
}

/**
 * Gửi thông báo khi Thư ký Phân Hiệu vừa giao nhiệm vụ cấp Phân Hiệu cho
 * các Phòng (sau bước "Gửi cho các phòng ban" trong luồng biên bản họp).
 */
export async function notifyBranchTasksAssigned(
  createdTasks: { id: number; title: string; dueDate: Date | null; departmentIds: number[] }[]
) {
  if (createdTasks.length === 0) return;
  const allDeptIds = [...new Set(createdTasks.flatMap((t) => t.departmentIds))];
  const deptRows = await db.select().from(departments).where(inArray(departments.id, allDeptIds));
  const deptNameById = new Map(deptRows.map((d) => [d.id, d.name]));

  for (const task of createdTasks) {
    const to = await getDepartmentLeadEmails(task.departmentIds);
    const deptNames = task.departmentIds.map((id) => deptNameById.get(id) ?? "").filter(Boolean);
    const dueText = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString("vi-VN")
      : "chưa đặt hạn";
    await sendMail(
      to,
      `[Phân Hiệu Thanh Hóa] Nhiệm vụ mới: ${task.title}`,
      `<p>Phòng của bạn (${deptNames.join(", ")}) vừa được Thư ký Phân Hiệu giao nhiệm vụ mới sau cuộc họp:</p>
       <p style="font-size:16px;font-weight:600">${task.title}</p>
       <p>Hạn hoàn thành: <b>${dueText}</b></p>
       <p><a href="${appUrl()}/dashboard/branch-tasks">Xem chi tiết trong hệ thống</a></p>`
    );
  }
}

/**
 * Gửi nhắc hạn cho các nhiệm vụ (cấp Phân Hiệu hoặc cấp Phòng) sắp đến hạn
 * mà chưa hoàn thành. Được gọi từ endpoint /api/cron/due-date-reminders,
 * dự kiến do một scheduler bên ngoài (vd. Render Cron Job) gọi định kỳ.
 */
export async function notifyDueSoon(
  items: {
    taskId: number;
    title: string;
    dueDate: Date;
    level: "branch" | "department";
    departmentIds: number[];
  }[]
) {
  for (const item of items) {
    const to = await getDepartmentLeadEmails(item.departmentIds);
    const dueText = new Date(item.dueDate).toLocaleDateString("vi-VN");
    await sendMail(
      to,
      `[Nhắc hạn] Sắp đến hạn: ${item.title}`,
      `<p>Nhiệm vụ sau sắp đến hạn hoàn thành (${dueText}) nhưng chưa đánh dấu Hoàn thành:</p>
       <p style="font-size:16px;font-weight:600">${item.title}</p>
       <p><a href="${appUrl()}/dashboard/${item.level === "branch" ? "branch-tasks" : "department-tasks"}">Xem chi tiết trong hệ thống</a></p>`
    );
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Email khi lãnh đạo / Thư ký bấm "Nhắc" một nhiệm vụ. */
export async function sendReminderEmail(
  to: string[],
  task: { id: number; title: string; dueDate: Date | null },
  actorName: string,
  note: string
) {
  const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString("vi-VN") : "chưa đặt hạn";
  await sendMail(
    to,
    `[Nhắc nhở] ${task.title}`,
    `<p><b>${esc(actorName)}</b> nhắc nhiệm vụ:</p>
     <p style="font-size:16px;font-weight:600">${esc(task.title)}</p>
     <p>Hạn hoàn thành: <b>${dueText}</b></p>
     <p style="padding:8px 12px;background:#fceBED;border-radius:8px">${esc(note)}</p>
     <p><a href="${appUrl()}/dashboard/branch-tasks?task=${task.id}">Mở nhiệm vụ trong hệ thống</a></p>`
  );
}

type DigestTask = { title: string; dueDate: string | null; departments: { code: string }[] };

/** Bản tin tuần gửi qua email (sáng thứ Hai). */
export async function sendWeeklyDigestEmail(
  to: string,
  name: string,
  d: {
    week: { thisMon: string; thisSun: string };
    doneLastWeek: DigestTask[];
    dueThisWeek: DigestTask[];
    overdue: DigestTask[];
    newLastWeek: DigestTask[];
  }
) {
  const vn = (s: string | null) => (s ? s.split("-").reverse().join("/") : "");
  const list = (title: string, items: DigestTask[], color: string) =>
    items.length
      ? `<h3 style="margin:16px 0 6px;color:${color}">${title} (${items.length})</h3><ul>${items
          .slice(0, 15)
          .map((t) => `<li>${esc(t.title)}${t.departments.length ? ` — <i>${t.departments.map((x) => x.code).join(", ")}</i>` : ""}${t.dueDate ? ` · hạn ${vn(t.dueDate)}` : ""}</li>`)
          .join("")}${items.length > 15 ? `<li>… và ${items.length - 15} việc khác</li>` : ""}</ul>`
      : "";
  await sendMail(
    [to],
    `[Bản tin tuần ${vn(d.week.thisMon)}–${vn(d.week.thisSun)}] Tình hình thực hiện nhiệm vụ`,
    `<p>Kính gửi ${esc(name)},</p>
     <p>Tổng hợp nhiệm vụ trong phạm vi của bạn:</p>
     ${list("Quá hạn", d.overdue, "#B91C1C")}
     ${list("Đến hạn trong 7 ngày tới", d.dueThisWeek, "#B45309")}
     ${list("Mới được giao tuần trước", d.newLastWeek, "#1D4ED8")}
     ${list("Hoàn thành tuần trước", d.doneLastWeek, "#15803D")}
     <p><a href="${appUrl()}/dashboard/weekly">Xem bản tin đầy đủ trong hệ thống</a></p>`
  );
}
