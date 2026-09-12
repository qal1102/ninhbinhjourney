import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Bộ smoke production KHÔNG chạy trên máy, nên nó mục mà không ai biết.
 *
 * Chuyện đã xảy ra thật ngày 12/09/2026. Một lượt sửa chữ bóc "proxy" và "T8"
 * khỏi màn hình sức chứa — đúng luật cấm chữ kỹ thuật lọt ra mặt người dùng.
 * Toàn bộ kiểm cục bộ xanh: `tsc`, lint, 1007 bài đơn vị, 210 bài giao diện.
 * Rồi deploy. Rồi bộ smoke production đỏ **4 bài**, vì nó vẫn đang chờ câu cũ
 * "Tín hiệu đầu vào hiện tại là proxy:".
 *
 * Không có gì cục bộ bắt được chuyện đó: bài smoke chỉ chạy khi có
 * `PLAYWRIGHT_BASE_URL` trỏ production cùng mật khẩu giám đốc, tức là sau khi
 * đã đẩy mã lên rồi. Người sửa chữ thì không có lý do gì để nghĩ tới một tệp
 * trong `tests/e2e/prod-smoke-*`.
 *
 * Bài này đóng đúng khe đó, và chạy trong bộ đơn vị nên ai cũng gặp nó: mọi
 * chuỗi chữ mà bài smoke đang chờ thấy đều phải còn tồn tại ở đâu đó trong mã
 * nguồn hoặc trong migration. Mất một chuỗi là đỏ ngay tại máy, trước khi
 * deploy — thay vì đỏ trên production sau khi deploy.
 *
 * Bài này KHÔNG chứng minh bài smoke sẽ xanh: chuỗi còn trong mã không có
 * nghĩa là nó hiện ra đúng màn hình ấy, đúng vai ấy, đúng lúc ấy. Nó chỉ chặn
 * đúng một kiểu hỏng — kiểu đã xảy ra.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SPEC_DIR = path.join(REPO_ROOT, "tests", "e2e");

/** Nơi chữ hiện ra cho người dùng có thể sinh ra: mã ứng dụng và migration. */
const HAYSTACK_ROOTS = [
  "app",
  "components",
  "content",
  "lib",
  "domain",
  path.join("supabase", "migrations"),
];

const HAYSTACK_EXTENSIONS = /\.(ts|tsx|css|sql)$/;

/**
 * Chuỗi được miễn, kèm LÝ DO. Miễn mà không nêu lý do thì lần sau không ai
 * dám xoá, nên mỗi dòng ở đây phải trả lời được câu "vì sao nó không nằm
 * trong mã nguồn".
 *
 * Ba nhóm hợp lệ, không có nhóm thứ tư:
 *   1. Chính bài kiểm gõ ra (dữ liệu nó tự tạo trên production).
 *   2. Ghép lúc chạy từ nhiều mảnh, nên không mảnh nào chứa cả câu.
 *   3. Sinh từ dữ liệu nghiệp vụ chứ không từ một câu chữ cố định.
 */
const MIEN_TRU: ReadonlyMap<string, string> = new Map([
  [
    "PROD-SMOKE-CODE",
    "Mã do chính bài smoke tạo ra trên production, không phải chữ của sản phẩm.",
  ],
  [
    "Ảnh test smoke production, có thể bỏ qua.",
    "Ghi chú do chính bài smoke gõ vào ô nhập khi tạo phiếu thử.",
  ],
  [
    "13/15 nghiệp vụ",
    "Ghép lúc chạy: `{đã cấp}/{tổng} nghiệp vụ` trong staff-access-manager.",
  ],
  [
    "Đội ngũ Tràng An",
    "Ghép lúc chạy: `Đội ngũ {site.shortName}` trong staff-access-manager.",
  ],
  [
    "nguồn: ước-lượng",
    "Ghép lúc chạy từ nhãn nguồn sức chứa trong capacity-workspace.",
  ],
  [
    "SOP-CMD-03 · Chỉ huy và bàn giao đầu ngày",
    "Ghép lúc chạy: `{mã SOP} · {tiêu đề}`, cả hai đọc từ hồ sơ SOP trong kho.",
  ],
]);

/**
 * Bắt ba lối khẳng định chữ mà bộ smoke đang dùng. Chỉ nhận chuỗi trong nháy
 * kép và dài từ 8 ký tự — ngắn hơn thì trùng lặp vu vơ khắp nơi, canh cũng
 * không nói lên điều gì.
 */
const LITERAL_PATTERNS = [
  /(?:getByText|toContainText|getByLabel|getByPlaceholder)\(\s*"([^"]{8,})"/g,
  /getByRole\(\s*"[a-z]+"\s*,\s*\{\s*name:\s*"([^"]{8,})"/g,
];

function chuanHoa(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Bỏ dấu câu ở cuối trước khi so.
 *
 * Bài smoke hay viết trọn câu có dấu chấm, còn dữ liệu gốc thì không — ví dụ
 * "Demo operational summary — requires organizational approval." nằm trong
 * migration mà thiếu dấu chấm cuối. Playwright so theo kiểu chứa-chuỗi nên
 * vẫn khớp trên trình duyệt; bộ canh này phải rộng lượng đúng bằng chừng ấy,
 * không hơn.
 */
function boDauCuoi(text: string) {
  return text.replace(/[.。:：…\s]+$/u, "");
}

function docToanBoNguon() {
  let noiDung = "";
  const diQua = (thuMuc: string) => {
    for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
      const duongDan = path.join(thuMuc, muc.name);
      if (muc.isDirectory()) diQua(duongDan);
      else if (HAYSTACK_EXTENSIONS.test(muc.name)) {
        noiDung += readFileSync(duongDan, "utf8");
      }
    }
  };
  for (const goc of HAYSTACK_ROOTS) diQua(path.join(REPO_ROOT, goc));
  return chuanHoa(noiDung);
}

function gomChuoiSmoke() {
  const ketQua: Array<{ literal: string; spec: string }> = [];
  const daThay = new Set<string>();
  const tepSmoke = readdirSync(SPEC_DIR)
    .filter((ten) => ten.startsWith("prod-smoke-") && ten.endsWith(".spec.ts"))
    .sort();

  for (const ten of tepSmoke) {
    const noiDung = readFileSync(path.join(SPEC_DIR, ten), "utf8");
    for (const mau of LITERAL_PATTERNS) {
      mau.lastIndex = 0;
      let khop: RegExpExecArray | null;
      while ((khop = mau.exec(noiDung)) !== null) {
        const literal = khop[1];
        if (daThay.has(literal)) continue;
        daThay.add(literal);
        ketQua.push({ literal, spec: ten });
      }
    }
  }
  return { chuoi: ketQua, soTep: tepSmoke.length };
}

describe("bộ smoke production không được chờ một câu chữ đã bị xoá", () => {
  const nguon = docToanBoNguon();
  const { chuoi, soTep } = gomChuoiSmoke();

  it("có tệp smoke để canh, và canh được một lượng chuỗi đáng kể", () => {
    // Bộ canh tự hỏng bằng cách không tìm thấy gì thì nó chỉ là một bài xanh
    // vô nghĩa. Hai con số dưới đây là chốt chặn cho chính nó.
    expect(soTep).toBeGreaterThanOrEqual(15);
    expect(chuoi.length).toBeGreaterThanOrEqual(50);
  });

  it("mọi chuỗi bài smoke đang chờ đều còn tồn tại trong mã nguồn hoặc migration", () => {
    const daMat = chuoi
      .filter(({ literal }) => !MIEN_TRU.has(literal))
      .filter(({ literal }) => !nguon.includes(boDauCuoi(chuanHoa(literal))))
      .map(({ literal, spec }) => `${spec}: ${JSON.stringify(literal)}`);

    expect(
      daMat,
      "Chuỗi này không còn ở đâu trong mã nguồn lẫn migration. Hoặc bài smoke " +
        "đang chờ một câu đã bị xoá — sửa bài smoke; hoặc chuỗi ghép lúc chạy " +
        "— thêm vào MIEN_TRU kèm lý do.",
    ).toEqual([]);
  });

  it("danh sách miễn trừ không được giữ chuỗi đã quay lại mã nguồn", () => {
    // Miễn trừ để lâu thành rác: chuỗi quay lại mã nguồn rồi mà vẫn nằm đây
    // thì nó đang che một chỗ đáng lẽ canh được.
    const thuaRa = [...MIEN_TRU.keys()].filter((literal) =>
      nguon.includes(boDauCuoi(chuanHoa(literal))),
    );
    expect(
      thuaRa,
      "Chuỗi này đã có trong mã nguồn, bỏ khỏi MIEN_TRU để nó được canh thật.",
    ).toEqual([]);
  });

  it("mỗi dòng miễn trừ đều nêu được lý do", () => {
    const khongCoLyDo = [...MIEN_TRU.entries()]
      .filter(([, lyDo]) => lyDo.trim().length < 20)
      .map(([literal]) => literal);
    expect(khongCoLyDo).toEqual([]);
  });
});
