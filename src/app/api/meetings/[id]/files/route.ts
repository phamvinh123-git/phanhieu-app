import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { meetingFiles, meetings, users } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { deleteMeetingFile, saveMeetingFile } from "@/lib/meeting-files";
import { canViewMeeting } from "@/lib/meeting-scope";
import { audit } from "@/lib/audit";

/** Danh sách file biên bản gốc của một cuộc họp. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "view")) return jsonError("Không có quyền", 403);
  const { id } = await params;
  if (!(await canViewMeeting(session, Number(id)))) return jsonError("Không có quyền", 403);

  const rows = await db
    .select({
      id: meetingFiles.id,
      originalName: meetingFiles.originalName,
      mimeType: meetingFiles.mimeType,
      size: meetingFiles.size,
      createdAt: meetingFiles.createdAt,
      uploadedByName: users.fullName,
    })
    .from(meetingFiles)
    .leftJoin(users, eq(users.id, meetingFiles.uploadedBy))
    .where(eq(meetingFiles.meetingId, Number(id)))
    .orderBy(asc(meetingFiles.createdAt));
  return NextResponse.json({ files: rows });
}

/** Tải lên file biên bản gốc (multipart/form-data, trường "file", có thể nhiều file). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create")) return jsonError("Không có quyền", 403);
  const { id } = await params;

  const [meeting] = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, Number(id)));
  if (!meeting) return jsonError("Không tìm thấy biên bản họp", 404);

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError("Chưa chọn file");

  const saved: string[] = [];
  try {
    const rows = [];
    for (const f of files) {
      const info = await saveMeetingFile(f);
      saved.push(info.storedName);
      rows.push({ ...info, meetingId: meeting.id, uploadedBy: session.userId });
    }
    const inserted = await db.insert(meetingFiles).values(rows).returning();
    await audit(session, "meeting.file_upload", `Tải lên ${inserted.map((f) => f.originalName).join(", ")} vào biên bản #${meeting.id}`, {
      entityId: meeting.id,
    });
    return NextResponse.json({ files: inserted }, { status: 201 });
  } catch (e) {
    await Promise.all(saved.map(deleteMeetingFile));
    return jsonError((e as Error).message || "Không thể tải file lên");
  }
}
