import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-12 mục 2 — hợp đồng của `202609200080_bang_diem_cho_dieu_hanh.sql`.
 *
 * Bài đọc chuỗi SQL, không chứng minh gì về PostgreSQL thật. Nó canh hai chỗ:
 * hàm phục vụ người điều hành **không** vì thế mà mở thêm dữ liệu cá nhân, và
 * nó vẫn chỉ là một hàm đọc.
 */

const TEP = "supabase/migrations/202609200080_bang_diem_cho_dieu_hanh.sql";

const compact = readFileSync(TEP, "utf8")
  .split("\n")
  .map((dong) => {
    const viTri = dong.indexOf("--");
    return viTri === -1 ? dong : dong.slice(0, viTri);
  })
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const than = compact.slice(compact.indexOf("as $$"), compact.lastIndexOf("$$;"));

describe("TC-12 mục 2: bảng điểm cho người điều hành", () => {
  it("chỉ đọc: không ghi, không đổi bảng", () => {
    for (const cam of ["insert into", "update ", "delete from", "drop ", "alter table", "truncate"]) {
      expect(than).not.toContain(cam);
    }
  });

  it("không trả một trường nào lần ra được người viết", () => {
    for (const cam of ["member_id", "member_code", "display_name", "leader", "scanned_at'", "ticket_id"]) {
      expect(than).not.toContain(cam);
    }
  });

  it("bỏ qua lời đã ẩn", () => {
    expect(than).toContain("hidden_at is null");
  });

  it("đếm lượt vào bằng đúng lượt quét được nhận", () => {
    expect(than).toContain("event.result = 'accepted'");
  });

  it("cắt ngày theo giờ Việt Nam, không theo giờ UTC", () => {
    expect(than).toContain("at time zone 'asia/ho_chi_minh'");
    expect(than).not.toContain("current_date between");
  });

  it("chặn khoảng ngày ngược và số cơ sở hỏi quá nhiều", () => {
    expect(than).toContain("p_to < p_from");
    expect(than).toContain("review_too_many_sites");
  });

  it("chỉ service_role gọi được", () => {
    const chuKy = "public.erp_site_review_overview(uuid, uuid[], date, date)";
    expect(compact).toContain(`revoke all on function ${chuKy} from public, anon, authenticated`);
    expect(compact).toContain(`grant execute on function ${chuKy} to service_role`);
  });

  it("nằm trong một transaction", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });
});
