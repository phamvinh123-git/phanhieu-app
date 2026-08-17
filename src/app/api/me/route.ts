import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { ROLE_LABELS, ROLE_NAV_ITEMS, type NavItem } from "@/lib/rbac-config";
import { inArray } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const deptIds = [...new Set(session.roles.map((r) => r.departmentId).filter((x): x is number => x != null))];
  const depts = deptIds.length ? await db.select().from(departments).where(inArray(departments.id, deptIds)) : [];

  const roles = session.roles.map((r) => ({
    role: r.role,
    label: ROLE_LABELS[r.role],
    departmentId: r.departmentId,
    departmentName: r.departmentId ? depts.find((d) => d.id === r.departmentId)?.name ?? null : null,
  }));

  // Gộp (union) menu của tất cả vai trò, không lặp lại route trùng nhau.
  const navMap = new Map<string, NavItem>();
  for (const r of session.roles) {
    for (const item of ROLE_NAV_ITEMS[r.role] ?? []) {
      navMap.set(item.href, item);
    }
  }

  return NextResponse.json({
    user: { id: session.userId, fullName: session.fullName, email: session.email },
    roles,
    nav: Array.from(navMap.values()),
  });
}
