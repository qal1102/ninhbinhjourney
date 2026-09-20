import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-12 mục 3–4 — hợp đồng của `202609200083_kiem_duyet_danh_gia.sql`.
 *
 * Bài đọc chuỗi SQL, không chứng minh gì về PostgreSQL thật. Nó canh ba luật mà
 * một lần "cho tiện" rất dễ gỡ ra: hạn mức theo vai, giới hạn toàn 5 sao, và
 * nhật ký đi cùng giao dịch. Gỡ bất cứ cái nào thì bảng điểm mất giá trị mà
 * không ai thấy ngay.
 */

const TEP = "supabase/migrations/202609200083_kiem_duyet_danh_gia.sql";

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

function than(tenHam: string) {
  const dau = compact.indexOf(`function public.${tenHam}`);
  expect(dau).toBeGreaterThan(-1);
  const batDau = compact.indexOf("as $$", dau);
  return compact.slice(batDau, compact.indexOf("$$;", batDau));
}

const thanAn = than("erp_hide_visit_review");

describe("TC-12 mục 3: hạn mức theo vai", () => {
  it("giám đốc không hạn mức, quản lý 20, còn lại 0", () => {
    expect(thanAn).toContain("when 'director' then null");
    expect(thanAn).toContain("when 'manager' then 20");
    expect(thanAn).toContain("else 0");
  });

  it("hết hạn mức thì dừng, không ẩn", () => {
    expect(thanAn).toContain("review_moderation_quota_exhausted");
    expect(thanAn).toContain("v_da_dung >= v_han_muc");
  });

  it("vai không có quyền thì dừng ngay", () => {
    expect(thanAn).toContain("review_moderation_role_required");
  });
});

describe("TC-12 mục 4: không được ẩn tới mức toàn 5 sao", () => {
  it("chặn đúng khi lời bị ẩn không phải 5 sao và không còn lời khác dưới 5 sao", () => {
    expect(thanAn).toContain("v_review.rating <> 5");
    expect(thanAn).toContain("r.rating <> 5");
    expect(thanAn).toContain("review_moderation_toan_nam_sao");
  });

  it("nơi có dưới ba lời thì miễn luật, để còn dọn được spam thật", () => {
    expect(thanAn).toContain("v_dang_hien >= 3");
  });
});

describe("TC-12: nhật ký và giới hạn của cả tính năng", () => {
  it("mỗi lượt ẩn và hiện lại đều ghi nhật ký", () => {
    expect(thanAn).toContain("insert into public.erp_visit_review_moderation_audit");
    expect(than("erp_unhide_visit_review")).toContain(
      "insert into public.erp_visit_review_moderation_audit",
    );
  });

  it("lý do là bắt buộc, có độ dài tối thiểu", () => {
    expect(compact).toContain("char_length(trim(reason)) between 5 and 400");
    expect(thanAn).toContain("review_moderation_reason_required");
  });

  it("KHÔNG có lối nào xoá hẳn một lời khách", () => {
    expect(compact).not.toContain("delete from public.erp_visit_reviews");
  });

  it("chỉ service_role gọi được cả ba hàm", () => {
    for (const chuKy of [
      "public.erp_hide_visit_review(uuid, text, text, uuid, text)",
      "public.erp_unhide_visit_review(uuid, text, text, uuid, text)",
      "public.erp_visit_review_hide_quota_used(uuid, text)",
    ]) {
      expect(compact).toContain(`revoke all on function ${chuKy} from public, anon, authenticated`);
      expect(compact).toContain(`grant execute on function ${chuKy} to service_role`);
    }
  });

  it("bật RLS cho bảng nhật ký, và không ai sửa được nhật ký", () => {
    expect(compact).toContain(
      "alter table public.erp_visit_review_moderation_audit enable row level security",
    );
    expect(compact).toContain(
      "grant select, insert on table public.erp_visit_review_moderation_audit to service_role",
    );
    expect(compact).not.toContain("grant update on table public.erp_visit_review_moderation_audit");
    expect(compact).not.toContain("grant delete on table public.erp_visit_review_moderation_audit");
  });

  it("nằm trong một transaction", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });
});
