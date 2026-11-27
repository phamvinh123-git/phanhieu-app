import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meetingFiles } from "@/db/schema";
import { requireSession, isSession, jsonError } from "@/lib/api-helpers";
import { hasAction } from "@/lib/permissions";
import { deleteMeetingFile, readMeetingFile } from "@/lib/meeting-files";
import { canViewMeeting } from "@/lib/meeting-scope";

/** Xem (?download=1 để tải về) một file biên bản gốc. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "view")) return jsonError("Không có quyền", 403);
  const { fileId } = await params;

  const [f] = await db.select().from(meetingFiles).where(eq(meetingFiles.id, Number(fileId)));
  if (!f) return jsonError("Không tìm thấy file", 404);
  if (!(await canViewMeeting(session, f.meetingId))) return jsonError("Không có quyền", 403);
  let data: Buffer;
  try {
    data = await readMeetingFile(f.storedName);
  } catch {
    return jsonError("File không còn trên máy chủ", 404);
  }
  const download = req.nextUrl.searchParams.get("download") === "1";
  const inlineOk = f.mimeType === "application/pdf" || f.mimeType.startsWith("image/");
  const disposition = download || !inlineOk ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  if (!hasAction(session, "meetings", "create")) return jsonError("Không có quyền", 403);
  const { fileId } = await params;
  const [f] = await db.delete(meetingFiles).where(eq(meetingFiles.id, Number(fileId))).returning();
  if (!f) return jsonError("Không tìm thấy file", 404);
  await deleteMeetingFile(f.storedName);
  return NextResponse.json({ ok: true });
}
