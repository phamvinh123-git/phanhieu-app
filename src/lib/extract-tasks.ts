/**
 * Trích xuất đầu việc từ nội dung biên bản họp — RULE-BASED (không gọi mô
 * hình AI/LLM nào). Quy tắc do người dùng đặt ra và cố định, dễ giải thích,
 * chạy tức thời, không tốn phí, không có rủi ro "bịa" nội dung.
 *
 * Quy tắc:
 * - Mỗi DÒNG trong biên bản là một đầu việc tiềm năng.
 * - Nếu dòng đó kết thúc bằng một cụm trong ngoặc đơn — ví dụ "...(DT)."
 *   hoặc "...(DT, HCTH)" — thì cụm trong ngoặc chứa MÃ PHÒNG (viết tắt,
 *   trùng với cột `code` của bảng departments) phụ trách việc đó.
 * - Nhiều mã cách nhau bởi dấu phẩy / dấu gạch chéo / dấu "&" / chữ "và"
 *   nghĩa là nhiều Phòng cùng phối hợp thực hiện việc đó.
 * - Dòng không có ngoặc, hoặc ngoặc không chứa mã phòng hợp lệ nào, sẽ
 *   KHÔNG được coi là đầu việc (có thể là tiêu đề mục, ghi chú chung...).
 * - Tiêu đề giữ nguyên câu chữ (chỉ bỏ số thứ tự và phần ngoặc mã phòng).
 *
 * Hạn hoàn thành được TỰ TÁCH ra trường dueDate (yyyy-mm-dd), nhận các dạng:
 *   25/08/2026, 25-8-2026, 25.08.2026, 25/8/26, 25/8 (không ghi năm → lấy năm
 *   của ngày họp; nếu khi đó rơi quá xa về trước ngày họp thì hiểu là năm sau),
 *   "ngày 25 tháng 8 (năm 2026)", "trong/trước/cuối tháng 9(/2026)" → ngày cuối
 *   tháng, "Tháng 10/2026: …", "trước quý IV" → ngày cuối quý, "trong tuần
 *   (này)" / "tuần sau" → Chủ nhật của tuần đó. Ngày đứng sau "trước / chậm
 *   nhất / hạn / hoàn thành…" được ưu tiên; ngày ghi trong ngoặc cùng mã phòng
 *   như "(DT, 05/11/2026)" cũng được nhận. Ngày không hợp lệ bị bỏ qua.
 */

export type DepartmentRef = { id: number; code: string; name: string };

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type ExtractedTask = {
  line: string; // dòng gốc trong biên bản
  title: string; // tiêu đề đã làm sạch (bỏ số thứ tự + phần trong ngoặc)
  departmentIds: number[];
  departmentCodes: string[];
  dueDate: string | null; // yyyy-mm-dd, null nếu dòng không ghi hạn
  priority: TaskPriority; // luôn "normal" — Thư ký tự chọn khi rà soát
  source: "tag";
};

export type SkippedLine = {
  line: string;
  reason: "no_tag" | "unmatched_codes";
  unmatchedCodes?: string[];
};

export type ExtractResult = {
  tasks: ExtractedTask[];
  skipped: SkippedLine[];
};

export type ExtractOptions = {
  /** Ngày họp (yyyy-mm-dd) — dùng để suy ra năm khi hạn chỉ ghi ngày/tháng. */
  referenceDate?: string | Date;
};

// ---------------------------------------------------------------------------
// Chuẩn hoá chữ: bỏ dấu tiếng Việt, đ → d, chữ thường — giữ nguyên độ dài.
// ---------------------------------------------------------------------------

function foldChar(c: string): string {
  if (c === "đ" || c === "Đ") return "d";
  const base = c.normalize("NFD")[0] ?? c;
  return base.toLowerCase().length === 1 ? base.toLowerCase() : base;
}

/** Chuỗi đã bỏ dấu, chữ thường, cùng độ dài với `s` (s phải ở dạng NFC). */
function fold(s: string): string {
  let out = "";
  for (const c of s) out += c.length === 1 ? foldChar(c) : c;
  return out;
}

// ---------------------------------------------------------------------------
// Hạn hoàn thành
// ---------------------------------------------------------------------------

function toRefDate(ref?: string | Date): Date {
  const d = ref ? new Date(ref) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function makeDate(y: number, mo: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

function fullYear(y: string | undefined): number | null {
  if (!y) return null;
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

/** Không ghi năm → lấy năm của ngày họp; nếu khi đó hạn rơi quá xa về trước
 *  ngày họp (vd. họp tháng 12, hạn 15/1) thì hiểu là năm sau. */
function inferYear(mo: number, d: number, ref: Date): Date | null {
  const y = ref.getUTCFullYear();
  const dt = makeDate(y, mo, d);
  if (!dt) return null;
  if (dt.getTime() < ref.getTime() - 60 * 86400000) return makeDate(y + 1, mo, d);
  return dt;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
const DEADLINE_WORD = /(truoc|cham nhat|han|thoi han|hoan thanh|xong|trong|cuoi|het|den)\s*(ngay\s*)?:?\s*$/;

type DateHit = { date: Date; start: number; end: number; deadline: boolean; precise: boolean };

function findDates(folded: string, ref: Date): DateHit[] {
  const hits: DateHit[] = [];
  const push = (date: Date | null, start: number, end: number, precise: boolean) => {
    if (!date) return;
    const before = folded.slice(Math.max(0, start - 25), start);
    hits.push({ date, start, end, deadline: DEADLINE_WORD.test(before), precise });
  };

  // 25/08/2026, 25-8-26, 25.08.2026, 25/8
  for (const x of folded.matchAll(/(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\d/-])/g)) {
    const [, d, sep, mo, y] = x;
    if (sep === "." && !y) continue; // "2.5" (số thập phân) — không phải ngày
    const year = fullYear(y);
    const date = year ? makeDate(year, Number(mo), Number(d)) : inferYear(Number(mo), Number(d), ref);
    push(date, x.index!, x.index! + x[0].length, true);
  }

  // ngày 25 tháng 8 (năm 2026)
  for (const x of folded.matchAll(/ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?/g)) {
    const [, d, mo, y] = x;
    const date = y ? makeDate(Number(y), Number(mo), Number(d)) : inferYear(Number(mo), Number(d), ref);
    push(date, x.index!, x.index! + x[0].length, true);
  }

  // trong/trước/cuối tháng 9 (/2026 | năm 2026) → ngày cuối tháng
  for (const x of folded.matchAll(/(?:^|(?:trong|truoc|cuoi|het|xong trong|hoan thanh trong)\s+)thang\s+(\d{1,2})(?:\s*[/-]\s*(\d{4})|\s+nam\s+(\d{4}))?/g)) {
    const mo = Number(x[1]);
    if (mo < 1 || mo > 12) continue;
    let y = Number(x[2] ?? x[3] ?? ref.getUTCFullYear());
    if (!x[2] && !x[3] && Date.UTC(y, mo, 0) < ref.getTime() - 60 * 86400000) y++;
    push(new Date(Date.UTC(y, mo, 0)), x.index!, x.index! + x[0].length, false);
  }

  // trong/trước/cuối quý III (năm 2026) → ngày cuối quý
  for (const x of folded.matchAll(/(?:trong|truoc|cuoi|het)\s+quy\s+(iv|i{1,3}|[1-4])(?![a-z])(?:\s*[/-]\s*(\d{4})|\s+nam\s+(\d{4}))?/g)) {
    const q = ROMAN[x[1]] ?? Number(x[1]);
    const y = Number(x[2] ?? x[3] ?? ref.getUTCFullYear());
    push(new Date(Date.UTC(y, q * 3, 0)), x.index!, x.index! + x[0].length, false);
  }

  // trong tuần (này) / tuần sau / tuần tới → Chủ nhật của tuần đó
  for (const x of folded.matchAll(/(?:trong\s+)?tuan\s+(nay|sau|toi)|trong\s+tuan(?![a-z])/g)) {
    const next = x[1] === "sau" || x[1] === "toi";
    const dow = ref.getUTCDay() === 0 ? 7 : ref.getUTCDay(); // Thứ 2 = 1 … CN = 7
    const sunday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + (7 - dow) + (next ? 7 : 0)));
    push(sunday, x.index!, x.index! + x[0].length, false);
  }

  return hits.sort((a, b) => a.start - b.start);
}

/** Chọn hạn: ưu tiên ngày đứng sau "trước/chậm nhất/hạn…", ngày chính xác hơn
 *  tháng/quý; nếu không có thì lấy ngày cuối cùng trong câu. */
function pickDeadline(hits: DateHit[]): DateHit | null {
  if (hits.length === 0) return null;
  const score = (h: DateHit) => (h.deadline ? 2 : 0) + (h.precise ? 1 : 0);
  return [...hits].sort((a, b) => score(b) - score(a) || b.start - a.start)[0];
}

// ---------------------------------------------------------------------------
// Tách đầu việc
// ---------------------------------------------------------------------------

const BULLET_PREFIX = /^\s*(?:[-*•]|\d+[.)]|\(\d+\))\s*/;
const TRAILING_TAG = /^(.*?)\s*\(([^()]{1,120})\)\s*[.;:!?]*\s*$/;
const TOKEN_SPLIT = /[,/;&]+|\s+(?:va|và)\s+/i;
const DATE_IN_TAG = /\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?/g;

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/[\s.,;:\-–—]+$/g, "").trim();
  if (t.length === 0) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function extractTasksFromMinutes(
  content: string,
  departments: DepartmentRef[],
  options: ExtractOptions = {}
): ExtractResult {
  const codeMap = new Map<string, DepartmentRef>();
  for (const d of departments) codeMap.set(d.code.trim().toUpperCase(), d);
  const ref = toRefDate(options.referenceDate);

  const tasks: ExtractedTask[] = [];
  const skipped: SkippedLine[] = [];

  const lines = content
    .normalize("NFC")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const rawLine of lines) {
    const line = rawLine.replace(BULLET_PREFIX, "").trim();
    const deadline = pickDeadline(findDates(fold(line), ref));
    const dueDate = deadline ? ymd(deadline.date) : null;
    const match = line.match(TRAILING_TAG);
    if (!match) {
      skipped.push({ line: rawLine, reason: "no_tag" });
      continue;
    }

    const [, titlePart, tagPart] = match;
    const tokens = tagPart
      .replace(DATE_IN_TAG, " ") // ngày trong ngoặc không phải mã phòng
      .split(TOKEN_SPLIT)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const matchedDepts: DepartmentRef[] = [];
    const unmatchedCodes: string[] = [];
    for (const tok of tokens) {
      const dept = codeMap.get(tok.toUpperCase());
      if (dept) matchedDepts.push(dept);
      else unmatchedCodes.push(tok);
    }

    if (matchedDepts.length === 0) {
      skipped.push({ line: rawLine, reason: "unmatched_codes", unmatchedCodes });
      continue;
    }

    const title = cleanTitle(titlePart);
    if (!title) {
      skipped.push({ line: rawLine, reason: "no_tag" });
      continue;
    }

    // Loại trùng phòng nếu người soạn lỡ gõ lặp mã trong cùng 1 ngoặc.
    const seen = new Set<number>();
    const uniqueDepts = matchedDepts.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    tasks.push({
      line: rawLine,
      title,
      departmentIds: uniqueDepts.map((d) => d.id),
      departmentCodes: uniqueDepts.map((d) => d.code),
      dueDate,
      priority: "normal",
      source: "tag",
    });
  }

  return { tasks, skipped };
}
