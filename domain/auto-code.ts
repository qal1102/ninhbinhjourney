/**
 * Mã do máy sinh, không bắt người dùng tự nghĩ.
 *
 * Bắt một người quản lý tự gõ `employee-tam-chuc-02` hay `TAMCOC-AUG` là đẩy
 * việc của máy sang cho người. Người gõ sai hoa thường, gõ trùng mã người
 * khác, hoặc bỏ cuộc giữa chừng — trong khi máy có sẵn cả danh sách mã đang
 * dùng và biết chắc mã nào còn trống.
 *
 * Mã sinh ra vẫn phải **đọc được**: `nguyen-van-ba` nói cho người trực biết
 * đó là ai, còn `a7f3c9` thì không. Nên đường đi là bỏ dấu tiếng Việt rồi
 * ghép lại, chứ không phải bốc ngẫu nhiên.
 */

/** Bỏ dấu tiếng Việt và hạ về chữ thường. Giống hệt cách `domain/incident.ts` và `domain/journey.ts` đang làm. */
export function asciiFold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN");
}

/** "Nguyễn Văn Ba" → "nguyen-van-ba". Ký tự lạ gộp thành một gạch nối, không để gạch thừa ở hai đầu. */
export function asciiSlug(text: string): string {
  return asciiFold(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CodeShape = {
  /** Mã tài khoản dùng chữ thường; mã campaign dùng chữ hoa. */
  uppercase?: boolean;
  minLength: number;
  maxLength: number;
  /** Dùng khi tên không còn chữ cái ASCII nào — ví dụ người dùng gõ toàn ký tự lạ. */
  fallback: string;
};

/**
 * Sinh một mã chưa ai dùng, đọc được, từ tên người hoặc tên chiến dịch.
 *
 * `taken` là **bắt buộc**, không phải tuỳ chọn. Chỗ lưu tài khoản là một
 * `upsert`: một mã trùng không báo lỗi mà lặng lẽ **ghi đè lên tài khoản của
 * người khác**. Sinh mã mà không đối chiếu danh sách đang dùng thì tệ hơn hẳn
 * việc bắt người ta tự gõ.
 */
export function generateCode(
  source: string,
  taken: Iterable<string>,
  shape: CodeShape,
): string {
  const { uppercase = false, minLength, maxLength, fallback } = shape;
  const used = new Set<string>();
  for (const item of taken) used.add(asciiFold(String(item)));

  const separator = uppercase ? "-" : "-";
  let base = asciiSlug(source);
  if (uppercase) base = base.toUpperCase();
  if (!base) base = uppercase ? fallback.toUpperCase() : fallback.toLowerCase();

  // Cắt cho vừa trần, chừa chỗ cho hậu tố "-2", "-3"… ở lượt trùng.
  const room = maxLength - 3;
  if (base.length > room) {
    base = base.slice(0, room).replace(/-+$/, "");
  }
  while (base.length < minLength) {
    base = `${base}${uppercase ? "X" : "x"}`;
  }

  if (!used.has(asciiFold(base))) return base;
  // Bắt đầu từ 2 vì bản đầu tiên không mang số: "nguyen-van-ba", rồi "nguyen-van-ba-2".
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}${separator}${index}`;
    if (!used.has(asciiFold(candidate))) return candidate;
  }
  throw new Error("Không sinh được mã còn trống sau 999 lần thử.");
}

export const ACCOUNT_CODE_SHAPE: CodeShape = {
  uppercase: false,
  minLength: 2,
  maxLength: 100,
  fallback: "nhan-vien",
};

export const MARKETING_CODE_SHAPE: CodeShape = {
  uppercase: true,
  minLength: 3,
  maxLength: 48,
  fallback: "CHIEN-DICH",
};
