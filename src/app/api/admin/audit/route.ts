import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { AUDIT_ACTIONS } from "@/lib/audit";

const PAGE_SIZE = 50;

/** yyyy-mm-dd (giờ Việt Nam) → mốc UTC đầu ngày */
function vnDayStart(ymd: string) {
  return new Date(`${ymd}T00:00:00+07:00`);
}

/**
 * Lịch sử truy vết — chỉ quản trị hệ thống.
 * Lọc: q (nội dung / người / IP), action, entity, actor, from, to (yyyy-mm-dd), page.
 * format=csv để tải về toàn bộ kết quả đã lọc (tối đa 20.000 dòng).
 */
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!session.roles.some((r) => r.role === "admin") || !hasAction(session, "users", "view")) {
    return jsonError("Chỉ quản trị hệ thống được xem lịch sử truy vết", 403);
  }

  const sp = req.nextUrl.searchParams;
  const where: SQL[] = [];
  const q = sp.get("q")?.trim();
  if (q) {
    const like = `%${q}%`;
    where.push(or(ilike(auditLogs.summary, like), ilike(auditLogs.actorName, like), ilike(auditLogs.ip, like))!);
  }
  const action = sp.get("action");
  if (action) where.push(eq(auditLogs.action, action));
  const entity = sp.get("entity");
  if (entity) where.push(eq(auditLogs.entityType, entity));
  const actor = sp.get("actor");
  if (actor) where.push(eq(auditLogs.actorId, actor));
  const entityId = sp.get("entityId");
  if (entityId) where.push(eq(auditLogs.entityId, entityId));
  const from = sp.get("from");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.push(gte(auditLogs.createdAt, vnDayStart(from)));
  const to = sp.get("to");
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const end = vnDayStart(to);
    end.setUTCDate(end.getUTCDate() + 1);
    where.push(lt(auditLogs.createdAt, end));
  }
  const cond = where.length ? and(...where) : undefined;

  if (sp.get("format") === "csv") {
    const rows = await db.select().from(auditLogs).where(cond).orderBy(desc(auditLogs.createdAt)).limit(20000);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const fmt = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "medium",
    });
    const lines = [
      ["Thời gian", "Người thao tác", "Hành động", "Nội dung", "IP", "Thiết bị"].map(esc).join(","),
      ...rows.map((r) =>
        [
          fmt.format(r.createdAt),
          r.actorName ?? "",
          AUDIT_ACTIONS[r.action as keyof typeof AUDIT_ACTIONS] ?? r.action,
          r.summary,
          r.ip ?? "",
          r.userAgent ?? "",
        ]
          .map(esc)
          .join(",")
      ),
    ];
    // BOM để Excel đọc đúng tiếng Việt
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lich-su-truy-vet.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(cond);
  const logs = await db
    .select()
    .from(auditLogs)
    .where(cond)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Danh sách người đã từng thao tác (cho ô lọc)
  const actors = await db
    .selectDistinctOn([auditLogs.actorId], { id: auditLogs.actorId, name: auditLogs.actorName })
    .from(auditLogs)
    .where(sql`${auditLogs.actorId} is not null`)
    .orderBy(auditLogs.actorId, desc(auditLogs.createdAt));

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize: PAGE_SIZE,
    actors: actors.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "vi")),
    actions: AUDIT_ACTIONS,
  });
}
