import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-12 — hợp đồng của `202609200079_danh_gia_co_dau_chan.sql`.
 *
 * Bài đọc chuỗi SQL, không chứng minh gì về PostgreSQL thật. Nó canh đúng thứ
 * làm nên giá trị của bảng điểm này: **không có dấu chân thì không có lời.**
 * Một lần "cho linh hoạt hơn" mà bỏ ràng buộc lượt quét là bảng điểm tụt
 * xuống ngang mọi bảng điểm ai cũng viết được.
 */

const TEP = "supabase/migrations/202609200079_danh_gia_co_dau_chan.sql";

function boChuThich(sql: string) {
  return sql
    .split("\n")
    .map((dong) => {
      const viTri = dong.indexOf("--");
      return viTri === -1 ? dong : dong.slice(0, viTri);
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const compact = boChuThich(readFileSync(TEP, "utf8"));

function than(tenHam: string) {
  const dau = compact.indexOf(`function public.${tenHam}`);
  expect(dau).toBeGreaterThan(-1);
  const batDau = compact.indexOf("as $$", dau);
  const ketThuc = compact.indexOf("$$;", batDau);
  return compact.slice(batDau, ketThuc);
}

describe("TC-12: kho đánh giá có dấu chân", () => {
  it("mỗi lời phải gắn vào một lượt quét, và lượt quét ấy là bắt buộc", () => {
    expect(compact).toContain("scan_event_id uuid not null references public.erp_gate_scan_events(id)");
  });

  it("một lượt vào chỉ mang được một lời", () => {
    expect(compact).toContain("unique (tenant_id, scan_event_id)");
  });

  it("chỉ nhận 1 tới 5 sao và lời kể có giới hạn độ dài", () => {
    expect(compact).toContain("rating between 1 and 5");
    expect(compact).toContain("char_length(comment) <= 400");
  });

  it("hàm gửi lời chỉ nhận lượt quét 'accepted' của chính người ấy tại chính nơi ấy", () => {
    const thanGui = than("erp_submit_visit_review");
    expect(thanGui).toContain("event.member_id = v_member_id");
    expect(thanGui).toContain("event.site_id = p_site_id");
    expect(thanGui).toContain("event.result = 'accepted'");
    expect(thanGui).toContain("review_khong_co_dau_chan");
  });

  it("không có lối nào chèn thẳng vào bảng mà bỏ qua bước tìm dấu chân", () => {
    const soLanChen = compact.split("insert into public.erp_visit_reviews").length - 1;
    expect(soLanChen).toBe(1);
  });

  it("mọi lối đọc đều bỏ qua lời đã ẩn", () => {
    expect(than("erp_visit_reviews_of_member")).toContain("hidden_at is null");
    expect(than("erp_site_review_summary")).toContain("hidden_at is null");
  });

  it("bảng điểm công khai không trả tên ai, không trả mã ai", () => {
    const thanBang = than("erp_site_review_summary");
    expect(thanBang).not.toContain("display_name");
    expect(thanBang).not.toContain("member_code");
    expect(thanBang).not.toContain("member_id");
    expect(thanBang).not.toContain("leader");
  });

  it("ẩn một lời thì phải ghi ai ẩn và vì sao", () => {
    expect(compact).toContain("hidden_at is not null and hidden_by is not null");
  });

  it("bật RLS và chỉ service_role chạm được bảng cùng ba hàm", () => {
    expect(compact).toContain("alter table public.erp_visit_reviews enable row level security");
    expect(compact).toContain("revoke all on table public.erp_visit_reviews from public, anon, authenticated");
    for (const chuKy of [
      "public.erp_submit_visit_review(uuid, text, uuid, smallint, text)",
      "public.erp_visit_reviews_of_member(uuid, text)",
      "public.erp_site_review_summary(uuid, uuid[])",
    ]) {
      expect(compact).toContain(`revoke all on function ${chuKy} from public, anon, authenticated`);
      expect(compact).toContain(`grant execute on function ${chuKy} to service_role`);
    }
  });

  it("không chạm giấy tờ tuỳ thân niêm phong của TC-17", () => {
    expect(compact).not.toContain("customer_sealed_identity_documents");
  });

  it("nằm trong một transaction", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });
});
