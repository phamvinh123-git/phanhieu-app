/**
 * Trích xuất đầu việc từ nội dung biên bản họp — RULE-BASED (không gọi mô
 * hình AI/LLM nào): chạy tức thời, miễn phí, giải thích được, không "bịa"
 * nội dung. Thư ký Phân hiệu luôn rà soát lại kết quả trước khi gửi.
 *
 * Các cách ghi Phòng phụ trách được nhận diện:
 *   1. Mã trong ngoặc ở cuối dòng (cách cũ, vẫn ưu tiên cao nhất):
 *        "Rà soát chương trình đào tạo trước 25/8 (QLDT, TCKT)."
 *   2. Nhắc tới Phòng ngay trong câu — bằng mã (QLDT, QLĐT, TC-KT, P.QLĐT)
 *      hoặc tên đầy đủ ("Phòng Quản lý Đào tạo", "Bộ môn Y học Cơ sở"):
 *        "Giao Phòng Quản lý Đào tạo chủ trì, phối hợp TCKT xây dựng kế hoạch…"
 *        "Phòng TCKT: lập dự toán ngân sách năm 2027."
 *   3. Biên bản chia theo MỤC Phòng — các gạch đầu dòng bên dưới tiêu đề mục
 *      tự gắn cho Phòng của mục đó (tới khi gặp tiêu đề mục khác):
 *        "II. Phòng Tài chính – Kế toán:"
 *        "  - Hoàn thiện báo cáo quyết toán quý III."
 *
 *   4. Biên bản theo mẫu hành chính của Phân hiệu: chỉ đọc phần sau "NỘI DUNG"
 *      (bỏ phần Thời gian / Thành phần và phần Thư ký / Nơi nhận); mỗi Phòng là
 *      một mục đánh số ("1. Phòng Tổ chức - Hành chính - Quản trị"); trong mục,
 *      "x.2. Chỉ đạo của BGĐ" → mọi gạch đầu dòng là việc; "x.1. … báo cáo tình
 *      hình hoạt động" → chỉ lấy các ý còn phải làm (sẽ / đang / cần / dự kiến /
 *      trước ngày…), bỏ các ý đã xong. Gạch đầu dòng cấp 2 ("+") giữ chủ đề của
 *      dòng "-" phía trên ("Cải tạo, sửa chữa nhà A: Tăng cường bạt chắn bụi").
 *
 * Ngoài ra:
 *   - Câu dài bị xuống dòng (dán từ Word) được ghép lại thành một đầu việc.
 *   - Một dòng chứa nhiều việc ngăn cách bởi dấu ";" được tách thành nhiều việc.
 *   - Hạn hoàn thành: 25/08/2026, 25/8 (lấy năm theo ngày họp), 25-8-26,
 *     "ngày 25 tháng 8 năm 2026", "trong tháng 9", "trước quý IV",
 *     "trong tuần", "tuần sau".
 *   - Mức ưu tiên: "khẩn", "khẩn cấp", "hoả tốc" → Khẩn cấp; "khẩn trương",
 *     "gấp", "ưu tiên", "ngay lập tức", "sớm nhất" → Cao.
 *   - Tiêu đề được làm sạch: bỏ số thứ tự và cụm giao việc cho Phòng ở đầu/cuối
 *     câu; cụm hạn hoàn thành được giữ nguyên trong tiêu đề.
 */

export type DepartmentRef = { id: number; code: string; name: string };

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type ExtractedTask = {
  line: string; // đoạn gốc trong biên bản (đã ghép dòng nếu bị xuống dòng)
  title: string; // tiêu đề đã làm sạch
  departmentIds: number[];
  departmentCodes: string[];
  dueDate: string | null; // yyyy-mm-dd
  priority: TaskPriority;
  /** Cách xác định Phòng: mã trong ngoặc | nhắc trong câu | theo tiêu đề mục */
  source: "tag" | "mention" | "section";
  /** Tiêu đề mục mà việc này kế thừa Phòng (khi source = "section") */
  section?: string;
};

export type SkippedLine = {
  line: string;
  /** no_tag: không xác định được Phòng; unmatched_codes: mã Phòng lạ;
   *  report: ý báo cáo việc đã làm (không tạo việc) */
  reason: "no_tag" | "unmatched_codes" | "report";
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
// Chuẩn hoá chữ: bỏ dấu tiếng Việt, đ → d, chữ thường — GIỮ NGUYÊN độ dài
// chuỗi để vị trí tìm được trên bản đã chuẩn hoá áp dụng thẳng lên bản gốc.
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

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mã chuẩn hoá: bỏ dấu, viết hoa, bỏ khoảng trắng / gạch / chấm. */
function normCode(s: string) {
  return fold(s).toUpperCase().replace(/[\s.\-–_]/g, "");
}

const UNIT_TYPES = ["phong", "bo mon", "to", "khoa", "ban", "trung tam", "vien", "don vi"];
const UNIT_TYPE_RE = `(?:${UNIT_TYPES.join("|")}|p\\.)`;

// ---------------------------------------------------------------------------
// Bộ nhận diện Phòng
// ---------------------------------------------------------------------------

type Mention = { start: number; end: number; dept: DepartmentRef };

type DeptMatcher = {
  /** mã chuẩn hoá → Phòng (mã chính + chữ viết tắt suy ra từ tên) */
  codeMap: Map<string, DepartmentRef>;
  /** regex tìm tên Phòng trên chuỗi đã fold */
  nameRes: { re: RegExp; dept: DepartmentRef }[];
};

function acronym(words: string[]) {
  return words
    .filter((w) => w.length > 0 && !["va", "-", "–", "&"].includes(w))
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function buildMatcher(departments: DepartmentRef[]): DeptMatcher {
  const codeMap = new Map<string, DepartmentRef>();
  const nameRes: DeptMatcher["nameRes"] = [];

  for (const d of departments) {
    codeMap.set(normCode(d.code), d);

    // Tên chuẩn hoá, bỏ đuôi "Phân hiệu Thanh Hoá" nếu có.
    let name = fold(d.name.normalize("NFC")).replace(/\s+/g, " ").trim();
    name = name.replace(/\s*[-–]?\s*phan hieu( thanh hoa)?$/, "").trim();

    const type = UNIT_TYPES.find((t) => name.startsWith(t + " "));
    const core = type ? name.slice(type.length + 1).trim() : name;
    const coreWords = core.split(/[\s\-–]+/).filter(Boolean);

    // Chữ viết tắt suy ra từ tên (vd. Quản lý Đào tạo → QLDT) — chỉ dùng khi đủ dài
    // để tránh trùng nhầm với từ thường.
    const acr = acronym(coreWords);
    if (acr.length >= 3 && !codeMap.has(acr)) codeMap.set(acr, d);

    // Tên: cho phép các dấu "-", "–", "," hoặc khoảng trắng giữa các từ.
    // "và" trong tên cũng khớp "&" ("Khảo thí & Đảm bảo chất lượng").
    const corePattern = coreWords.map((w) => (w === "va" ? "(?:va|&)" : escapeRe(w))).join("[\\s\\-–,]*");
    const pattern = type
      ? `${UNIT_TYPE_RE}\\s*${corePattern}` // "Phòng Quản lý Đào tạo", "P. Quản lý Đào tạo"
      : corePattern; // "Liên chi đoàn"
    nameRes.push({ re: new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "g"), dept: d });
    // Liên chi đoàn thường được ghi là "Đoàn Thanh niên" / "Đoàn TN" / "LCĐ".
    if (/chi doan/.test(name)) {
      nameRes.push({ re: /(?<![a-z0-9])doan (?:thanh nien|tn)(?![a-z0-9])/g, dept: d });
      if (!codeMap.has("LCD")) codeMap.set("LCD", d);
    }
  }
  return { codeMap, nameRes };
}

/** Tìm mọi lần nhắc tới Phòng trong `text` (NFC), sắp theo vị trí. */
function findMentions(text: string, m: DeptMatcher): Mention[] {
  const folded = fold(text);
  const found: Mention[] = [];

  for (const { re, dept } of m.nameRes) {
    re.lastIndex = 0;
    for (const x of folded.matchAll(re)) {
      found.push({ start: x.index!, end: x.index! + x[0].length, dept });
    }
  }

  // Mã viết HOA trong văn bản gốc: QLDT, QLĐT, TC-KT, P.QLĐT, (TCKT)…
  const CODE_TOKEN = /(?<![\p{L}\p{N}])(?:P\.\s?)?(\p{Lu}[\p{Lu}\p{N}]*(?:[-.]\p{Lu}[\p{Lu}\p{N}]*)*)(?![\p{L}\p{N}])/gu;
  for (const x of text.matchAll(CODE_TOKEN)) {
    const token = x[1];
    if (token.replace(/[-.]/g, "").length < 2) continue;
    const dept = m.codeMap.get(normCode(token));
    if (!dept) continue;
    if (/\bclb\s*$/.test(folded.slice(0, x.index!))) continue; // "CLB NCKH" là CLB sinh viên
    let start = x.index!;
    // Gộp chữ "Phòng"/"Bộ môn"… đứng ngay trước mã vào cùng một cụm.
    const before = folded.slice(0, start);
    const typeBefore = before.match(new RegExp(`${UNIT_TYPE_RE}\\s*$`));
    if (typeBefore) start -= typeBefore[0].length;
    found.push({ start, end: x.index! + x[0].length, dept });
  }

  // Bỏ các cụm chồng lấn (giữ cụm dài hơn).
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Mention[] = [];
  for (const f of found) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) continue;
    out.push(f);
  }
  return out;
}

function uniqueDepts(ms: { dept: DepartmentRef }[]) {
  const seen = new Set<number>();
  const out: DepartmentRef[] = [];
  for (const { dept } of ms) {
    if (seen.has(dept.id)) continue;
    seen.add(dept.id);
    out.push(dept);
  }
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
// Mức ưu tiên (đọc trên chữ CÓ dấu để không nhầm "gặp" với "gấp")
// ---------------------------------------------------------------------------

function detectPriority(text: string): TaskPriority {
  const t = text.toLowerCase();
  if (/(khẩn cấp|hỏa tốc|hoả tốc|khẩn(?! trương))/.test(t)) return "urgent";
  if (/(khẩn trương|gấp|ưu tiên|ngay lập tức|sớm nhất|càng sớm càng tốt|đẩy nhanh|dứt điểm)/.test(t)) return "high";
  return "normal";
}

// ---------------------------------------------------------------------------
// Cấu trúc dòng
// ---------------------------------------------------------------------------

const BULLET_PREFIX =
  /^\s*(?:[-*•+–—·▪►✓○●]+|\(?\d{1,2}(?:\.\d{1,2})*[.)]|\(\d{1,2}\)|\(?[a-zđ][.)]|[IVXLC]{1,5}[.)]|(?:Mục|Điều)\s+\d+[.:)]?)(?=\s|$)\s*/u;

/** Dòng thông tin hành chính của biên bản — không bao giờ là đầu việc. */
const METADATA =
  /^(thoi gian|dia diem|thanh phan|chu tri|thu ky|nguoi ghi|ghi bien ban|tham du|vang mat|vang|khach moi|noi nhan|ngay hop|so|v\/v|kinh gui|can cu|luu)\b[^:]{0,25}:/;

/** Các từ "đệm" thường có trong tiêu đề mục Phòng, không phải nội dung việc. */
const HEADING_FILLER = new Set(
  "doi voi giao cho nhiem vu cua cong viec y kien chi dao phan cong ket luan cac va voi phoi hop chu tri thuc hien phu trach yeu cau de nghi".split(" ")
);

function wordCount(s: string) {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Ghép câu bị xuống dòng: dòng sau bắt đầu bằng chữ thường, hoặc dòng trước
 *  dừng ở dấu phẩy / từ nối. */
function joinWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const startsLower = /^\p{Ll}/u.test(line) && !BULLET_PREFIX.test(line);
    const prevOpen = prev !== undefined && /(,|\(|\bvà|\bcủa|\bvới|\bcho|\bđể|\bcác|–|-)$/u.test(prev.trim());
    if (prev !== undefined && !/:\s*$/.test(prev) && (startsLower || (prevOpen && !BULLET_PREFIX.test(line)))) {
      out[out.length - 1] = `${prev.trim()} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Làm sạch tiêu đề
// ---------------------------------------------------------------------------

/** Thay mỗi cụm Phòng bằng chuỗi \u0001 cùng độ dài trên bản fold — để regex
 *  nhận diện "cụm giao việc" mà vẫn giữ đúng vị trí trên câu gốc. */
function maskMentions(folded: string, ms: Mention[]) {
  let s = folded;
  for (const m of ms) s = s.slice(0, m.start) + "\u0001".repeat(m.end - m.start) + s.slice(m.end);
  return s;
}

const M = "\\u0001+";
const JOIN = "(?:\\s*(?:,|;|&|/|-|–|va|voi|phoi hop voi|phoi hop|cung)\\s*)+";
const ROLE = "(?:chu tri|thuc hien|phu trach|tham muu|khan truong|phoi hop|lam dau moi|dau moi)";
const MENTION_LIST = `${M}(?:\\s*${ROLE})?(?:${JOIN}${M}(?:\\s*${ROLE})?)*`;
const LEAD_RE = new RegExp(
  `^\\s*(?:(?:giao(?: cho)?|de nghi|yeu cau|phan cong|chi dao|dong chi truong)\\s+)?${MENTION_LIST}\\s*(?:${ROLE}\\s*)?[:,\\-–]?\\s*`
);
const TAIL_RE = new RegExp(
  `\\s*(?:[,;:\\-–(]\\s*)?(?:(?:giao(?: cho)?|do|phoi hop(?: voi)?|cung|chu tri|thuc hien|dau moi)\\s*:?\\s*)?${MENTION_LIST}\\s*(?:${ROLE})?\\s*\\)?\\s*[.;:!]*\\s*$`
);
function cleanTitle(text: string, ms: Mention[]): string {
  let t = text;
  let folded = maskMentions(fold(t), ms);

  // Cụm giao việc ở cuối câu: "…, phối hợp với Phòng TCKT." / "… – Phòng QLĐT chủ trì"
  const tail = folded.match(TAIL_RE);
  if (tail && tail.index! > 0 && wordCount(t.slice(0, tail.index)) >= 2) {
    t = t.slice(0, tail.index);
    folded = folded.slice(0, tail.index);
  }
  // Cụm giao việc ở đầu câu: "Giao Phòng QLĐT chủ trì, phối hợp TCKT: …"
  const lead = folded.match(LEAD_RE);
  if (lead && lead[0].includes("\u0001") && wordCount(t.slice(lead[0].length)) >= 2) {
    t = t.slice(lead[0].length);
    folded = folded.slice(lead[0].length);
  }
  // Cụm hạn hoàn thành ("trước 25/8", "trong tháng 9") được GIỮ NGUYÊN trong
  // tiêu đề để không mất thông tin — đồng thời hạn được điền vào trường dueDate.

  t = t.replace(/^[\s.,;:\-–—]+|[\s.,;:\-–—(]+$/g, "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ---------------------------------------------------------------------------
// Hàm chính
// ---------------------------------------------------------------------------

const TRAILING_TAG = /\(([^()]{1,120})\)\s*[.;:!?]*\s*$/;
const TAG_SPLIT = /[,/;&+]+|\s+(?:va|và)\s+/i;

/** Viết thường chữ đầu khi ghép sau "Chủ đề: …", trừ chữ viết tắt (PH, BGĐ, KTX). */
function lowerFirst(s: string) {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Ý trong phần "báo cáo tình hình" còn phải làm (không phải việc đã xong)? */
function isPendingWork(text: string, hasFutureDate: boolean): boolean {
  const t = text.toLowerCase();
  if (/(diễn ra bình thường|không có vấn đề|không phát sinh)/.test(t)) return false;
  if (hasFutureDate) return true; // có ngày sau ngày họp → việc sắp làm
  const future = /(sẽ|đang|dự kiến|đề nghị|đề xuất|cần |cần$|chuẩn bị|tiến hành|tiếp tục|trước ngày|trong tuần|thời gian tới|tìm hiểu|lập kế hoạch|xây dựng kế hoạch|có kế hoạch triển khai)/;
  if (future.test(t)) return true;
  if (/(đã |hoàn tất|diễn ra bình thường|không có vấn đề|theo kế hoạch\.?$)/.test(t)) return false;
  // Câu mở đầu bằng động từ hành động ("Hoàn thiện…", "Phối hợp…") → việc cần làm.
  return /^(hoàn thiện|hoàn tất|hoàn thành|tiến hành|chuẩn bị|tiếp tục|rà soát|xây dựng|lập|tổ chức|triển khai|phối hợp|tổng hợp|thống kê|hướng dẫn|nghiên cứu|đẩy mạnh|tăng cường|bổ sung|thực hiện|đề xuất|tập trung)\b/.test(
    t
  );
}

type Marker = "dash" | "plus" | "star" | "number" | "none";
function markerKind(raw: string): Marker {
  const m = raw.match(BULLET_PREFIX);
  if (!m) return "none";
  const k = m[0].trim();
  if (k.startsWith("+")) return "plus";
  if (k.startsWith("*")) return "star";
  if (/^[\d(IVXLCa-zđ]|^(Mục|Điều)/u.test(k)) return "number";
  return "dash";
}

/** Phần nội dung của biên bản hành chính: sau dòng "NỘI DUNG", trước phần ký
 *  ("Cuộc họp kết thúc…", "Thư ký cuộc họp", "Nơi nhận"). */
function bodyLines(lines: string[]): { lines: string[]; structured: boolean } {
  const start = lines.findIndex((l) => /^noi dung( cuoc hop| bien ban)?:?$/.test(fold(l).trim()));
  if (start < 0) return { lines, structured: false };
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^(cuoc hop ket thuc|thu ky cuoc hop|noi nhan)/.test(fold(l).trim()));
  return { lines: end < 0 ? rest : rest.slice(0, end), structured: true };
}

/** Trong biên bản có gạch đầu dòng: dòng KHÔNG có ký hiệu đầu dòng, không phải
 *  tiêu đề, đứng sau một gạch đầu dòng là phần viết tiếp của ý đó. */
function attachContinuations(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const kind = markerKind(line);
    const prevKind = prev === undefined ? "none" : markerKind(prev);
    if (
      prev !== undefined &&
      kind === "none" &&
      (prevKind === "dash" || prevKind === "plus") &&
      !/:\s*$/.test(prev) &&
      !(line === line.toUpperCase() && /\p{Lu}/u.test(line))
    ) {
      out[out.length - 1] = `${prev.replace(/[\s.;]+$/, "")}. ${line}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

export function extractTasksFromMinutes(
  content: string,
  departments: DepartmentRef[],
  options: ExtractOptions = {}
): ExtractResult {
  const matcher = buildMatcher(departments);
  const ref = toRefDate(options.referenceDate);
  const tasks: ExtractedTask[] = [];
  const skipped: SkippedLine[] = [];

  const allLines = content
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  const { lines: body0, structured } = bodyLines(allLines);
  const lines = attachContinuations(joinWrappedLines(body0));

  let section: { title: string; depts: DepartmentRef[] } | null = null;
  let mode: "any" | "report" | "directive" = "any";
  let topic: string | null = null; // chủ đề của dòng "-" kết thúc bằng ":" cho các ý "+"

  for (const rawLine of lines) {
    const kind = markerKind(rawLine);
    const line = rawLine.replace(BULLET_PREFIX, "").trim();
    if (!line) continue;
    const folded = fold(line);
    const hadBullet = kind !== "none";

    if (METADATA.test(folded)) continue;
    if (kind === "dash" || kind === "number" || kind === "none") topic = null;

    // ---- Mục con: "1.2. Chỉ đạo của BGĐ" / "1.1. Đ/c … báo cáo tình hình hoạt động"
    if ((kind === "number" || kind === "star" || kind === "none") && wordCount(line) <= 25) {
      if (/^(y kien )?chi dao\b|\bchi dao cua (bgd|ban giam doc|giam doc)|^ket luan\b/.test(folded) && !/:\s*\S/.test(line)) {
        mode = "directive";
        continue;
      }
      if (/\bbao cao\b/.test(folded) && /(tinh hinh|d\/c|dong chi)/.test(folded) && !/:\s*\S/.test(line)) {
        mode = "report";
        continue;
      }
    }

    // ---- 1. Mã trong ngoặc ở cuối dòng --------------------------------------
    let body = line;
    let tagDepts: DepartmentRef[] = [];
    let unmatchedCodes: string[] = [];
    const tag = line.match(TRAILING_TAG);
    if (tag) {
      const tokens = tag[1]
        .replace(/\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?/g, " ") // ngày trong ngoặc không phải mã
        .split(TAG_SPLIT)
        .map((x) => x.trim())
        .filter(Boolean);
      const hits = tokens.map((tok) => ({ tok, dept: matcher.codeMap.get(normCode(tok)) ?? findMentions(tok, matcher)[0]?.dept }));
      tagDepts = uniqueDepts(hits.filter((h) => h.dept) as { dept: DepartmentRef }[]);
      // Chỉ báo "mã lạ" với cụm trông giống mã (viết hoa), không báo "(hạn 30/9)".
      unmatchedCodes = hits.filter((h) => !h.dept && /^[\p{Lu}\p{N}.\-]{2,}$/u.test(h.tok)).map((h) => h.tok);
      if (tagDepts.length > 0) body = line.slice(0, tag.index).trim();
    }

    // ---- 2. Nhắc tới Phòng trong câu ----------------------------------------
    const mentions = findMentions(body, matcher);
    const mentionDepts = uniqueDepts(mentions);

    // ---- 3. Tiêu đề mục ("II. Phòng Tài chính – Kế toán:", "5. Đoàn Thanh niên")
    const residue = fold(maskMentions(fold(body), mentions))
      .replace(/\u0001+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !HEADING_FILLER.has(w));
    const endsWithColon = /:\s*$/.test(body);
    const isAllCaps = body === body.toUpperCase() && /\p{Lu}/u.test(body);
    const headingMarker = kind === "none" || kind === "number";
    const looksLikeHeading =
      tagDepts.length === 0 &&
      (endsWithColon || isAllCaps || (headingMarker && residue.length <= 1 && !/[.;]$/.test(body)));

    if (looksLikeHeading && headingMarker && mentionDepts.length > 0 && residue.length <= 2) {
      section = { title: body.replace(/:\s*$/, ""), depts: mentionDepts };
      mode = "any";
      continue;
    }
    if (looksLikeHeading && !headingMarker && mentionDepts.length > 0 && residue.length <= 2 && !hadBullet) {
      section = { title: body.replace(/:\s*$/, ""), depts: mentionDepts };
      mode = "any";
      continue;
    }
    // Dòng chủ đề trong một mục ("- Cải tạo, sửa chữa nhà A:", "* Công tác cán bộ")
    if (hadBullet && kind !== "number" && endsWithColon && wordCount(body) <= 12) {
      if (kind === "dash") topic = body.replace(/:\s*$/, "").trim();
      continue;
    }
    if (kind === "star" && !/:\s*\S/.test(body) && wordCount(body) <= 12 && mentionDepts.length === 0) {
      continue; // nhóm ý ("* Công tác đào tạo:")
    }
    if (looksLikeHeading && mentionDepts.length === 0 && headingMarker && (endsWithColon || isAllCaps) && wordCount(body) <= 10) {
      section = null; // tiêu đề mục không gắn Phòng ("III. Các vấn đề khác:") → hết phạm vi mục trước
      mode = "any";
      continue;
    }

    // ---- Phần báo cáo tình hình: chỉ giữ các ý còn phải làm -------------------
    const futureDate = findDates(folded, ref).some((h) => h.precise && h.date.getTime() > ref.getTime());
    if (mode === "report" && tagDepts.length === 0 && !isPendingWork(body.replace(/^[^:]{1,80}:\s*/, ""), futureDate)) {
      skipped.push({ line: rawLine, reason: "report" });
      continue;
    }

    // ---- "Chủ đề: nội dung" — phân tích giao việc trên phần nội dung ---------
    let lead = "";
    let work = body;
    let workMentions = mentions;
    const colon = body.match(/^([^:]{2,90}):\s+(.+)$/);
    if (colon && tagDepts.length === 0) {
      const leftMentions = findMentions(colon[1], matcher);
      if (leftMentions.length === 0 && wordCount(colon[1]) <= 12 && wordCount(colon[2]) >= 2) {
        lead = colon[1].trim();
        work = colon[2].trim();
        workMentions = findMentions(work, matcher);
      }
    }

    // ---- Xác định Phòng phụ trách -------------------------------------------
    let depts: DepartmentRef[];
    let source: ExtractedTask["source"];
    const tagIsCollab = Boolean(tag && /(phoi hop|cung|ho tro)/.test(fold(tag[1])));
    if (tagDepts.length > 0 && tagIsCollab && section) {
      // "(phối hợp với Phòng TCHCQT)" trong mục của Phòng khác → Phòng của mục chủ trì.
      depts = uniqueDepts([...section.depts, ...tagDepts].map((dept) => ({ dept })));
      source = "section";
    } else if (tagDepts.length > 0) {
      depts = tagDepts;
      source = "tag";
    } else if (mentionDepts.length > 0) {
      // Trong một mục Phòng, câu chỉ nhắc thêm Phòng phối hợp ("…, phối hợp
      // TCKT") thì vẫn giữ Phòng của mục làm Phòng chủ trì. Nếu câu mở đầu
      // bằng việc giao hẳn cho Phòng khác ("Giao Phòng X …") thì theo câu.
      const leadMatch = maskMentions(fold(work), workMentions).match(LEAD_RE);
      const assignedAtStart = Boolean(leadMatch && leadMatch[0].includes("\u0001"));
      if (section && !assignedAtStart) {
        depts = uniqueDepts([...section.depts, ...mentionDepts].map((dept) => ({ dept })));
        source = "section";
      } else {
        depts = assignedAtStart ? uniqueDepts(workMentions) : mentionDepts;
        source = "mention";
      }
    } else if (section) {
      depts = section.depts;
      source = "section";
    } else {
      if (wordCount(line) >= 3) {
        skipped.push(
          unmatchedCodes.length
            ? { line: rawLine, reason: "unmatched_codes", unmatchedCodes }
            : { line: rawLine, reason: "no_tag" }
        );
      }
      continue;
    }

    // ---- Tiêu đề: [chủ đề dòng "-"]: [chủ đề trong câu]: nội dung đã làm sạch --
    const cleanedWork = cleanTitle(work, workMentions);
    const prefixParts = [kind === "plus" ? topic : null, lead || null].filter((x): x is string => Boolean(x));
    const prefix = prefixParts.map((x, i) => (i === 0 ? x : lowerFirst(x))).join(": ");
    const titleSource = prefix ? `${prefix}: ${lowerFirst(cleanedWork)}` : cleanedWork;
    if (wordCount(titleSource) < 3) continue;

    // ---- Tách nhiều việc trên cùng một dòng (ngăn bởi ";") — chỉ ở biên bản
    // viết tự do; biên bản hành chính hay dùng ";" trong cùng một ý.
    const parts = structured ? [] : cleanedWork.split(/\s*;\s*/).filter((p) => wordCount(p) >= 3);
    const pieces = parts.length > 1 ? parts.map((p) => (prefix ? `${prefix}: ${p}` : p)) : [titleSource];
    const lineDeadline = pickDeadline(findDates(fold(line), ref));

    for (const piece of pieces) {
      const title = pieces.length > 1 ? cleanTitle(piece, findMentions(piece, matcher)) : piece;
      if (wordCount(title) < 2) continue;
      const own = pieces.length > 1 ? pickDeadline(findDates(fold(piece), ref)) : null;
      const due = own ?? lineDeadline;
      tasks.push({
        line: rawLine,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        departmentIds: depts.map((d) => d.id),
        departmentCodes: depts.map((d) => d.code),
        dueDate: due ? ymd(due.date) : null,
        priority: detectPriority(pieces.length > 1 ? piece : line),
        source,
        ...(source === "section" && section ? { section: section.title } : {}),
      });
    }
  }

  return { tasks, skipped };
}
