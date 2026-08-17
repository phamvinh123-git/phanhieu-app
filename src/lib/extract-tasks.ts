/**
 * Trích xuất đầu việc từ nội dung biên bản họp — RULE-BASED (không gọi mô
 * hình AI/LLM nào). Quy tắc do người dùng đặt ra và cố định, dễ giải thích,
 * chạy tức thời, không tốn phí, không có rủi ro "bịa" nội dung — nên một bộ
 * phân tích theo luật (regex + khớp mã phòng) đáng tin cậy hơn một lệnh gọi
 * AI cho đúng nhu cầu này.
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
 */

export type DepartmentRef = { id: number; code: string; name: string };

export type ExtractedTask = {
  line: string; // dòng gốc trong biên bản
  title: string; // tiêu đề đã làm sạch (bỏ số thứ tự + phần trong ngoặc)
  departmentIds: number[];
  departmentCodes: string[];
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

const BULLET_PREFIX = /^\s*(?:[-*•]|\d+[.)]|\(\d+\))\s*/;
const TRAILING_TAG = /^(.*?)\s*\(([^()]{1,120})\)\s*[.;:!?]*\s*$/;
const TOKEN_SPLIT = /[,/;&]+|\s+(?:va|và)\s+/i;

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/[\s.,;:\-–—]+$/g, "").trim();
  if (t.length === 0) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function extractTasksFromMinutes(content: string, departments: DepartmentRef[]): ExtractResult {
  const codeMap = new Map<string, DepartmentRef>();
  for (const d of departments) codeMap.set(d.code.trim().toUpperCase(), d);

  const tasks: ExtractedTask[] = [];
  const skipped: SkippedLine[] = [];

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const rawLine of lines) {
    const line = rawLine.replace(BULLET_PREFIX, "").trim();
    const match = line.match(TRAILING_TAG);
    if (!match) {
      skipped.push({ line: rawLine, reason: "no_tag" });
      continue;
    }

    const [, titlePart, tagPart] = match;
    const tokens = tagPart
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
    const uniqueDepts = matchedDepts.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));

    tasks.push({
      line: rawLine,
      title,
      departmentIds: uniqueDepts.map((d) => d.id),
      departmentCodes: uniqueDepts.map((d) => d.code),
    });
  }

  return { tasks, skipped };
}
