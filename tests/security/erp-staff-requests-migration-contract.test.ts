import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAFF_REQUEST_DIRECTOR_THRESHOLD_VND, STAFF_REQUEST_TYPES } from "@/domain/erp-staff-requests";

/**
 * ERP-DE-XUAT-01 — hợp đồng của `202609140072_erp_staff_requests.sql`.
 *
 * Đọc chuỗi SQL, không chạy PostgreSQL. Bằng chứng chạy thật là lượt chạy thử
 * trọn vòng đời trong một giao dịch rồi cuộn lại (docs/HANDOFF.md). Bài này canh
 * những tính chất về tiền và trách nhiệm dễ bị "dọn cho gọn" phá mất.
 */

const sql = readFileSync("supabase/migrations/202609140072_erp_staff_requests.sql", "utf8");
const compact = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function thanHam(ten: string) {
  const dau = compact.indexOf(`create or replace function public.${ten}(`);
  expect(dau, ten).toBeGreaterThan(-1);
  const batDau = compact.indexOf(" as $$", dau);
  return compact.slice(batDau, compact.indexOf("$$;", batDau + 6));
}

describe("đề xuất: tiền và ngưỡng", () => {
  it("chạy trọn trong một giao dịch, không xoá bảng hay dữ liệu nào", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/\b(drop table|truncate|delete from public\.)/);
  });

  it("ngưỡng lên giám đốc ở SQL khớp đúng hằng số màn hình dùng", () => {
    expect(thanHam("erp_staff_request_director_threshold_vnd")).toContain(`select ${STAFF_REQUEST_DIRECTOR_THRESHOLD_VND}::bigint;`);
  });

  it("loại đề xuất ở SQL khớp đúng danh sách màn hình", () => {
    const loai = compact.match(/request_type in \(([^)]*)\)/)?.[1] ?? "";
    expect(loai.match(/'([^']+)'/g)?.map((m) => m.slice(1, -1))).toEqual([...STAFF_REQUEST_TYPES]);
  });

  it("quản lý duyệt khoản vượt ngưỡng thì chuyển giám đốc, không tự duyệt xong", () => {
    const quyet = thanHam("erp_decide_staff_request");
    expect(quyet).toContain("and not v_is_director");
    expect(quyet).toContain("> public.erp_staff_request_director_threshold_vnd() then v_to := 'pending-director';");
    expect(quyet).toContain("elsif v_request.status = 'pending-director' then if not v_is_director then");
  });

  it("tạm ứng và mua hàng chỉ kế toán ghi đã chi; sửa chữa chỉ quản lý ghi đã sửa", () => {
    const xong = thanHam("erp_complete_staff_request");
    expect(xong).toContain("request_type in ('tam-ung', 'de-xuat-mua') and not public.erp_staff_request_actor_is_accountant");
    expect(xong).toContain("request_type = 'sua-chua' and not public.erp_staff_request_actor_can_manage");
    expect(thanHam("erp_staff_request_actor_is_accountant")).toContain("'accountant-maker'");
  });
});

describe("đề xuất: trách nhiệm", () => {
  it("không ai tự duyệt hay tự ghi hoàn tất đề xuất của mình", () => {
    expect(thanHam("erp_decide_staff_request")).toContain("if v_request.requested_by_account_id = v_actor_id then raise exception using errcode = '42501', message = 'staff_request_own_request'");
    expect(thanHam("erp_complete_staff_request")).toContain("if v_request.requested_by_account_id = v_actor_id then raise exception using errcode = '42501', message = 'staff_request_own_request'");
  });

  it("giám đốc không gửi đề xuất; chỉ nhân viên, quản lý cơ sở, kế toán gửi", () => {
    const gui = thanHam("erp_staff_request_actor_can_submit");
    expect(gui).not.toContain("'director'");
    expect(gui).toContain("'employee', p_site_id");
    expect(gui).toContain("'regional-manager', p_site_id");
  });

  it("từ chối bắt buộc có lý do", () => {
    expect(thanHam("erp_decide_staff_request")).toContain(
      "if p_decision = 'reject' and char_length(v_note) < 5 then raise exception using errcode = '22023', message = 'staff_request_reason_required'",
    );
  });

  it("duyệt xin huỷ phiếu quầy gọi đúng hàm huỷ phiếu có sẵn, trong cùng giao dịch", () => {
    const quyet = thanHam("erp_decide_staff_request");
    expect(quyet).toContain("if v_to = 'approved' and v_request.request_type = 'huy-phieu-quay' then perform public.erp_void_counter_sale(");
    expect(compact).not.toMatch(/update public\.erp_counter_sales/);
  });
});

describe("đề xuất: sổ sách không sửa không xoá", () => {
  it("sự kiện chỉ ghi thêm, và chụp danh tính người thao tác bằng trigger của Nhật ký", () => {
    expect(compact).toContain(
      "before update or delete on public.erp_staff_request_events for each row execute function public.erp_staff_request_append_only()",
    );
    expect(compact).toContain(
      "before insert on public.erp_staff_request_events for each row execute function public.erp_audit_fill_actor_snapshot()",
    );
  });

  it("đề xuất không xoá, không đổi nội dung hay số tiền, chỉ đi đúng các bước cho phép", () => {
    const chan = thanHam("erp_staff_request_guard_update");
    expect(chan).toContain("if tg_op = 'delete' then");
    expect(chan).toContain("new.details");
    expect(chan).toContain("new.amount_vnd");
    expect(chan).toContain("new.requested_by_account_id");
    expect(chan).toContain("(old.status = 'submitted' and new.status in ('pending-director', 'approved', 'rejected', 'cancelled'))");
    expect(chan).toContain("(old.status = 'pending-director' and new.status in ('approved', 'rejected'))");
    expect(chan).toContain("(old.status = 'approved' and new.status = 'completed')");
  });
});

describe("đề xuất: khoá cửa và Nhật ký", () => {
  it("bật RLS và thu hết quyền trực tiếp trên hai bảng", () => {
    for (const bang of ["erp_staff_requests", "erp_staff_request_events"]) {
      expect(compact, bang).toContain(`alter table public.${bang} enable row level security;`);
      expect(compact, bang).toContain(`revoke all on table public.${bang} from public, anon, authenticated, service_role;`);
    }
  });

  it("mọi hàm có quyền đọc ghi chỉ trao cho service_role, chạy với search_path rỗng", () => {
    for (const ten of [
      "erp_staff_request_actor_can_submit",
      "erp_staff_request_actor_can_manage",
      "erp_staff_request_actor_is_accountant",
      "erp_staff_request_json",
      "erp_staff_requests_for_viewer",
      "erp_create_staff_request",
      "erp_decide_staff_request",
      "erp_cancel_staff_request",
      "erp_complete_staff_request",
    ]) {
      const dau = compact.indexOf(`create or replace function public.${ten}(`);
      expect(compact.slice(dau, compact.indexOf(" as $$", dau)), ten).toContain("security definer set search_path = ''");
      expect(compact, ten).toMatch(new RegExp(`revoke all on function public\\.${ten}\\([^)]*\\) from public, anon, authenticated;`));
      expect(compact, ten).toMatch(new RegExp(`grant execute on function public\\.${ten}\\([^)]*\\) to service_role;`));
    }
  });

  it("hàm Nhật ký chép nguyên văn bản 070, chỉ thêm đúng một nhánh đề xuất", () => {
    const lay = (tep: string) => {
      const noiDung = readFileSync(tep, "utf8").split("\r").join("");
      const dau = noiDung.indexOf("create or replace function public.erp_audit_timeline(");
      return noiDung.slice(dau, noiDung.indexOf("\n$$;", dau));
    };
    const cu = lay("supabase/migrations/202609130070_erp_counter_payment_and_price_editing.sql");
    const moi = lay("supabase/migrations/202609140072_erp_staff_requests.sql");
    const dau = moi.indexOf("    union all\n    -- ERP-DE-XUAT-01");
    expect(dau).toBeGreaterThan(-1);
    const cuoi = moi.indexOf("    where event.tenant_id = p_tenant_id\n", moi.indexOf("from public.erp_staff_request_events event")) +
      "    where event.tenant_id = p_tenant_id\n".length;
    const nhanh = moi.slice(dau, cuoi);
    expect(moi.replace(nhanh, "")).toBe(cu);
  });
});
