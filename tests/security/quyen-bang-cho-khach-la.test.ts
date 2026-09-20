import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-08 — canh cánh cửa dữ liệu, trong lúc chờ làm RLS thật.
 *
 * ## Đo trên production ngày 21/09/2026, bằng cách đóng vai ngay trong cơ sở dữ liệu
 *
 * Chạy `set local role anon` rồi `set local role authenticated` (kèm một
 * `auth.uid()` giả nhưng hợp lệ) và đếm thử trên mười lăm bảng, kết quả:
 *
 *   - `anon` — khoá công khai nằm trong mã nguồn trang web — **không đọc được
 *     một dòng nào**. Vé, đơn, hồ sơ khách, nhật ký quét, đánh giá, thành viên
 *     đoàn: đều dừng ở `permission denied`, tức là chặn ngay ở tầng GRANT,
 *     chưa cần tới RLS.
 *   - `authenticated` — một người lạ đăng ký một tài khoản thật — cũng
 *     `permission denied` ở toàn bộ bảng khách hàng và bảng ERP nghiệp vụ.
 *     Sáu bảng có GRANT thì RLS lọc về **0 dòng**.
 *   - 121/121 bảng trong `public` đều đã bật RLS.
 *
 * Nói cho gọn: **tầng dữ liệu không hở.** Việc còn lại của TC-08 không phải
 * "đóng một cánh cửa đang mở", mà là chuyển ranh giới vai–cơ sở của nhân viên
 * từ mã nguồn xuống cơ sở dữ liệu, để một lỗi mã không thể cho quản lý Tam Cốc
 * đọc số của Tràng An. Đó là việc lớn và phải làm trọn một lượt.
 *
 * ## Bài này giữ cái gì
 *
 * Giữ đúng kết luận trên khỏi mục ruỗng lặng lẽ. Cách duy nhất để một bảng
 * khách hàng lọt ra ngoài là ai đó viết thêm một dòng GRANT cho `anon` hoặc
 * `authenticated`. Danh sách dưới đây là **toàn bộ** ngoại lệ được phép; thêm
 * một cái nữa thì bài này đỏ, và người thêm phải nói ra vì sao.
 */

const THU_MUC = "supabase/migrations";

/**
 * Sáu bảng được phép, và lý do từng cái:
 *
 *   - `erp_site_assignments` — sót lại từ thời `/ops` (migration `002`). Anh em
 *     của nó đã bị gỡ ở `078`; cái này ở lại vì còn hai hàm tham chiếu tới.
 *     RLS chặn `anon` về 0 dòng.
 *   - Năm bảng danh tính còn lại — `202608070039_erp_rls_identity_reads.sql`,
 *     chính là mũi nhọn đầu tiên của TC-08: **chỉ đọc**, và lọc bằng
 *     `erp_rls_can_view_account` / `erp_rls_has_active_role`, nên người lạ
 *     thấy 0 dòng.
 */
const DUOC_PHEP = new Set([
  "erp_site_assignments",
  "erp_account_registry",
  "erp_account_role_assignments",
  "erp_account_admin_audit",
  "erp_employee_access",
  "erp_employee_access_audit",
]);

function boChuThich(sql: string) {
  return sql
    .split("\n")
    .map((dong) => {
      const viTri = dong.indexOf("--");
      return viTri === -1 ? dong : dong.slice(0, viTri);
    })
    .join("\n");
}

const TEP_SQL = readdirSync(THU_MUC)
  .filter((ten) => ten.endsWith(".sql"))
  .sort();

/**
 * Những bảng đã bị gỡ khỏi kho.
 *
 * Migration là lịch sử, không phải hiện trạng: `202607270002` có mở quyền cho
 * mười sáu bảng thời `/ops`, nhưng `078` đã gỡ chính những bảng ấy nên quyền
 * cũng đi theo. Không trừ phần này ra thì bài kiểm tố cáo một cánh cửa không
 * còn tồn tại — và một bài kiểm hay kêu oan là bài kiểm sẽ bị tắt.
 */
function bangDaGo(): Set<string> {
  const ra = new Set<string>();
  for (const tep of TEP_SQL) {
    const sql = boChuThich(readFileSync(`${THU_MUC}/${tep}`, "utf8"))
      .replace(/\s+/g, " ")
      .toLowerCase();
    for (const cau of sql.split(";")) {
      const gon = cau.trim();
      if (!gon.startsWith("drop table")) continue;
      for (const khop of gon.matchAll(/public\.([a-z0-9_]+)/g)) ra.add(khop[1]);
    }
  }
  return ra;
}

/** Mọi lượt GRANT **trên bảng** (không phải trên hàm) cho anon/authenticated. */
function timGrantBang(): { tep: string; bang: string }[] {
  const daGo = bangDaGo();
  const ra: { tep: string; bang: string }[] = [];
  for (const tep of TEP_SQL) {
    const sql = boChuThich(readFileSync(`${THU_MUC}/${tep}`, "utf8"));
    for (const cau of sql.split(";")) {
      const gon = cau.replace(/\s+/g, " ").trim().toLowerCase();
      if (!gon.startsWith("grant ")) continue;
      if (gon.includes(" on function ")) continue;
      if (!/\bto\b[^;]*\b(anon|authenticated)\b/.test(gon)) continue;
      for (const khop of gon.matchAll(/public\.((?:erp|customer)_[a-z0-9_]+)/g)) {
        if (daGo.has(khop[1])) continue;
        ra.push({ tep, bang: khop[1] });
      }
    }
  }
  return ra;
}

describe("TC-08: người lạ không chạm được bảng khách hàng", () => {
  const grants = timGrantBang();

  it("không bảng khách hàng hay bảng ERP nghiệp vụ nào được mở cho người lạ", () => {
    const ngoaiDanhSach = grants.filter((g) => !DUOC_PHEP.has(g.bang));
    expect(
      ngoaiDanhSach.map((g) => `${g.bang} (${g.tep})`).sort(),
      "Thêm một GRANT mới cho anon/authenticated là mở một cánh cửa. Nếu thật sự cần, thêm vào DUOC_PHEP kèm lý do và đo lại bằng `set local role`.",
    ).toEqual([]);
  });

  it("danh sách ngoại lệ không phình ra, và vẫn đúng sáu bảng đã đo", () => {
    const daDung = new Set(grants.map((g) => g.bang));
    // Nếu phép quét hỏng và không thấy gì, bài trên sẽ xanh một cách rỗng
    // tuếch. Sáu cái này phải thật sự tìm ra được, đúng như đo trên production.
    expect([...daDung].sort()).toEqual([...DUOC_PHEP].sort());
    expect(DUOC_PHEP.size).toBe(6);
  });

  it("năm bảng danh tính chỉ được mở ở mức ĐỌC, không bao giờ ghi", () => {
    const sql = boChuThich(
      readFileSync(`${THU_MUC}/202608070039_erp_rls_identity_reads.sql`, "utf8"),
    )
      .replace(/\s+/g, " ")
      .toLowerCase();
    for (const bang of [
      "erp_account_registry",
      "erp_account_role_assignments",
      "erp_account_admin_audit",
      "erp_employee_access",
      "erp_employee_access_audit",
    ]) {
      expect(sql).toContain(`grant select on table public.${bang} to authenticated;`);
      expect(sql).not.toMatch(
        new RegExp(`grant[^;]*(insert|update|delete)[^;]*public\\.${bang}[^;]*authenticated`),
      );
    }
  });
});
