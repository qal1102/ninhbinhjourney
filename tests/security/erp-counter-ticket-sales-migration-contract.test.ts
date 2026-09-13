import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * QA-ERP-POS-04 — hợp đồng của `202609130069_erp_counter_ticket_sales.sql`.
 *
 * Bài này đọc chuỗi SQL, không chạy PostgreSQL. Bằng chứng chạy thật là lượt
 * chạy thử trên production trong một giao dịch rồi cuộn lại ngày 13/09/2026
 * (ghi ở docs/HANDOFF.md). Cái bài này canh là những tính chất về TIỀN và
 * TRÁCH NHIỆM mà một lần "dọn cho gọn" ở phiên sau rất dễ phá mà không ai
 * nhận ra: máy chủ tự tính tiền, chưa tick đã đếm thì không lưu, người bán
 * không tự huỷ phiếu mình, phiếu và nhật ký không sửa không xoá.
 *
 * Như bài hợp đồng TC-18 đã cảnh báo: chú thích đầu tệp nhắc lại nhiều cụm
 * mà thân hàm cũng dùng, nên mọi khẳng định về hành vi đều cắt đúng thân hàm
 * ra trước rồi mới so khớp.
 */

const sql = readFileSync("supabase/migrations/202609130069_erp_counter_ticket_sales.sql", "utf8");
const khongChuThich = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n");
const compact = khongChuThich.replace(/\s+/g, " ").trim().toLowerCase();

function thanHam(ten: string) {
  const dau = compact.indexOf(`create or replace function public.${ten}(`);
  expect(dau, ten).toBeGreaterThan(-1);
  const batDau = compact.indexOf(" as $$", dau);
  const ketThuc = compact.indexOf("$$;", batDau + 6);
  expect(batDau, ten).toBeGreaterThan(-1);
  return compact.slice(batDau, ketThuc);
}

function khoiBang(ten: string) {
  const dau = compact.indexOf(`create table if not exists public.${ten} (`);
  expect(dau, ten).toBeGreaterThan(-1);
  return compact.slice(dau, compact.indexOf(");", dau));
}

describe("bán vé tại quầy: tiền", () => {
  it("chạy trọn trong một giao dịch", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("máy chủ tự tính tổng từ bảng giá, không nhận tổng tiền từ màn hình", () => {
    const ban = thanHam("erp_create_counter_sale");
    const chuKy = compact.slice(
      compact.indexOf("create or replace function public.erp_create_counter_sale("),
      compact.indexOf(") returns jsonb", compact.indexOf("create or replace function public.erp_create_counter_sale(")),
    );
    expect(chuKy).not.toMatch(/p_total|p_unit_price|p_price/);
    expect(ban).toContain("from public.erp_counter_price_list list");
    expect(ban).toContain("v_total := v_total + v_price.unit_price_vnd::bigint * v_quantity");
    expect(ban).toContain("counter_sale_cash_short");
  });

  it("chưa tick đã đếm tiền thì không lưu được, ở cả hàm lẫn ràng buộc bảng", () => {
    expect(thanHam("erp_create_counter_sale")).toContain("counter_sale_cash_not_confirmed");
    expect(khoiBang("erp_counter_sales")).toContain(
      "cash_counted_confirmed boolean not null check (cash_counted_confirmed)",
    );
  });

  it("dòng phiếu mang đúng mức giá lúc bán và phải khớp thành tiền", () => {
    const dong = khoiBang("erp_counter_sale_lines");
    expect(dong).toContain("check (line_total_vnd = unit_price_vnd::bigint * quantity)");
    expect(dong).toContain("references public.erp_counter_price_list(id, tenant_id)");
    expect(dong).toContain("references public.erp_tickets(id, tenant_id)");
  });

  it("gửi lại cùng khoá trả đúng phiếu cũ, không bán lần hai", () => {
    expect(khoiBang("erp_counter_sales")).toContain("unique (tenant_id, request_key)");
    const ban = thanHam("erp_create_counter_sale");
    expect(ban).toContain("when unique_violation then");
    expect(ban).toContain("sale.request_key = v_key");
  });
});

describe("bán vé tại quầy: trách nhiệm khi huỷ", () => {
  it("chỉ quản lý cơ sở hoặc giám đốc được huỷ, nhân viên thì không", () => {
    const quyen = thanHam("erp_counter_actor_can_void");
    expect(quyen).toContain("'director'");
    expect(quyen).toContain("'regional-manager', p_site_id");
    expect(quyen).not.toContain("'employee'");
    expect(thanHam("erp_void_counter_sale")).toContain("erp_counter_actor_can_void(p_tenant_id, p_site_id, v_actor_id)");
  });

  it("không ai huỷ được phiếu mình bán, ở cả hàm lẫn ràng buộc bảng", () => {
    expect(thanHam("erp_void_counter_sale")).toContain("counter_sale_void_own_sale");
    expect(khoiBang("erp_counter_sales")).toContain(
      "check (voided_by_account_id is null or voided_by_account_id <> sold_by_account_id)",
    );
  });

  it("huỷ phải có lý do, chỉ trong ngày bán, và không huỷ vé đã qua cổng", () => {
    const huy = thanHam("erp_void_counter_sale");
    expect(huy).toContain("counter_sale_void_reason_required");
    expect(huy).toContain("counter_sale_void_day_closed");
    expect(huy).toContain("ticket.entries_used > 0");
    expect(huy).toContain("counter_sale_already_admitted");
  });

  it("huỷ không xoá hàng nào, chỉ đổi trạng thái và ghi thêm một dòng sự kiện", () => {
    const huy = thanHam("erp_void_counter_sale");
    expect(huy).not.toContain("delete from");
    expect(huy).toContain("set status = 'void'");
    expect(huy).toContain("'counter-sale.voided'");
    expect(compact).not.toMatch(/\b(drop table|truncate|delete from public\.)/);
  });

  it("giữ tên giám đốc thật khi thao tác lúc xem thử", () => {
    expect(khoiBang("erp_counter_sales")).toContain("acting_director_account_id text");
    expect(thanHam("erp_create_counter_sale")).toContain("v_director");
    expect(thanHam("erp_void_counter_sale")).toContain("voided_acting_director_account_id = v_director");
  });
});

describe("bán vé tại quầy: sổ sách không sửa không xoá", () => {
  it("bảng giá, dòng phiếu và sự kiện chặn mọi lệnh sửa và xoá", () => {
    for (const bang of ["erp_counter_price_list", "erp_counter_sale_lines", "erp_counter_sale_events"]) {
      expect(compact, bang).toContain(
        `before update or delete on public.${bang} for each row execute function public.erp_counter_sale_append_only()`,
      );
    }
  });

  it("phiếu chỉ được đi đúng một bước từ đã bán sang đã huỷ, không đổi được tiền", () => {
    const chan = thanHam("erp_counter_sale_guard_update");
    expect(chan).toContain("old.status <> 'completed' or new.status <> 'voided'");
    expect(chan).toContain("new.total_vnd");
    expect(chan).toContain("new.cash_received_vnd");
    expect(chan).toContain("new.sold_by_account_id");
    expect(compact).toContain(
      "before update or delete on public.erp_counter_sales for each row execute function public.erp_counter_sale_guard_update()",
    );
  });

  it("sự kiện chụp danh tính người thao tác bằng đúng trigger của Nhật ký", () => {
    expect(compact).toContain(
      "before insert on public.erp_counter_sale_events for each row execute function public.erp_audit_fill_actor_snapshot()",
    );
  });
});

describe("bán vé tại quầy: khoá cửa và Nhật ký", () => {
  it("bật RLS và thu hết quyền trực tiếp trên cả bốn bảng", () => {
    for (const bang of ["erp_counter_price_list", "erp_counter_sales", "erp_counter_sale_lines", "erp_counter_sale_events"]) {
      expect(compact, bang).toContain(`alter table public.${bang} enable row level security;`);
      expect(compact, bang).toContain(`revoke all on table public.${bang} from public, anon, authenticated, service_role;`);
    }
  });

  it("mọi hàm mới chạy với search_path rỗng và chỉ trao cho service_role", () => {
    for (const ten of [
      "erp_counter_actor_can_void",
      "erp_counter_current_prices",
      "erp_counter_sale_receipt",
      "erp_counter_sales_for_day",
      "erp_shift_counter_cash",
      "erp_create_counter_sale",
      "erp_void_counter_sale",
    ]) {
      const dau = compact.indexOf(`create or replace function public.${ten}(`);
      const doanDau = compact.slice(dau, compact.indexOf(" as $$", dau));
      expect(doanDau, ten).toContain("security definer set search_path = ''");
      expect(compact, ten).toMatch(new RegExp(`revoke all on function public\\.${ten}\\([^)]*\\) from public, anon, authenticated;`));
      expect(compact, ten).toMatch(new RegExp(`grant execute on function public\\.${ten}\\([^)]*\\) to service_role;`));
    }
  });

  it("hàm Nhật ký chép nguyên văn bản 033, chỉ thêm đúng một nhánh bán quầy", () => {
    const lay = (tep: string) => {
      const noiDung = readFileSync(tep, "utf8").split("\r").join("");
      const dau = noiDung.indexOf("create or replace function public.erp_audit_timeline(");
      return noiDung.slice(dau, noiDung.indexOf("\n$$;", dau));
    };
    const cu = lay("supabase/migrations/202608030033_erp_audit_timeline.sql");
    const moi = lay("supabase/migrations/202609130069_erp_counter_ticket_sales.sql");
    const nhanh = moi.slice(
      moi.indexOf("    union all\n    -- QA-ERP-POS-04"),
      moi.indexOf("    where event.tenant_id = p_tenant_id\n  )", moi.indexOf("erp_counter_sale_events event")) +
        "    where event.tenant_id = p_tenant_id\n".length,
    );
    expect(nhanh).toContain("from public.erp_counter_sale_events event");
    // Gỡ đúng nhánh mới ra thì phải trùng khít bản cũ, từng ký tự.
    expect(moi.replace(nhanh, "")).toBe(cu);
  });
});
