import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-01 — hợp đồng của `202608260049_erp_capacity_multi_bottleneck.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy được;
 * việc đó phải làm trên PostgreSQL thật. Cái nó canh giữ là những tính chất mà
 * một lần "dọn dẹp cho gọn" ở phiên sau rất dễ phá mà không ai nhận ra.
 */

const sql = readFileSync(
  "supabase/migrations/202608260049_erp_capacity_multi_bottleneck.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

describe("erp capacity multi-bottleneck migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    expect(compact.startsWith("-- TC-01")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("giữ nguyên ba loại điểm nghẽn cũ khi nới ràng buộc", () => {
    // Bốn hàng seed đang dùng 'boat-pier' và 'electric-shuttle'. Nới `check`
    // mà đánh rơi giá trị cũ là làm hỏng dữ liệu thật đang chạy production.
    for (const kind of ["boat-pier", "ticket-gate", "electric-shuttle"]) {
      expect(compact).toContain(`'${kind}'`);
    }
    for (const kind of [
      "parking",
      "waiting-area",
      "cave-channel",
      "drop-off",
      "rescue",
      "boat-crew",
    ]) {
      expect(compact).toContain(`'${kind}'`);
    }
  });

  it("không xoá và không định nghĩa lại hourly_capacity", () => {
    // `/erp/release` và màn hình T11a đọc cột này như "năng lực vòng quay
    // thuần tuý". Đổi ý nghĩa nó là đổi ý nghĩa một con số đang hiện trên màn
    // hình cho người thật.
    expect(compact).not.toContain("drop column hourly_capacity");
    expect(compact).not.toContain("drop column if exists hourly_capacity");
    expect(compact).not.toContain("hourly_capacity integer generated");
  });

  it("effective_capacity là cột sinh, tính từ đúng nhánh mô hình", () => {
    expect(compact).toContain("effective_capacity integer generated always as");
    expect(compact).toContain("case when capacity_model = 'static'");
    expect(compact).toContain("coalesce(static_capacity, 0)::numeric");
    expect(compact).toContain("* safety_factor");
    expect(compact).toContain(") stored");
  });

  it("hệ số an toàn chỉ hạ được công suất, không nâng", () => {
    expect(compact).toContain("safety_factor numeric(4,3) not null default 1.000");
    expect(compact).toContain("check (safety_factor > 0 and safety_factor <= 1)");
  });

  it("mô hình tĩnh bắt buộc có số chỗ, ép ở cơ sở dữ liệu", () => {
    expect(compact).toContain(
      "check (capacity_model <> 'static' or static_capacity is not null)",
    );
  });

  it("bỏ tường minh bản 10 tham số của RPC sửa ngưỡng", () => {
    // `create or replace` khớp theo kiểu tham số, nên không `drop` thì hai bản
    // hàm cùng tồn tại và lời gọi cũ rơi vào bản cũ — hai nguồn sự thật.
    expect(compact).toContain(
      "drop function if exists public.erp_capacity_update_threshold( uuid, uuid, text, text, integer, integer, integer, numeric, text, text );",
    );
  });

  it("ba tham số mới của RPC sửa đều có mặc định, để lời gọi cũ không gãy", () => {
    expect(compact).toContain("p_capacity_model text default null");
    expect(compact).toContain("p_static_capacity integer default null");
    expect(compact).toContain("p_safety_factor numeric default null");
  });

  it("có RPC tạo ngưỡng, vì trước đó sản phẩm không có đường nào tạo", () => {
    expect(compact).toContain(
      "create or replace function public.erp_capacity_create_threshold(",
    );
    expect(compact).toContain("'threshold.created'");
    expect(compact).toContain("CAPACITY_THRESHOLD_CODE_TAKEN");
  });

  it("cả hai RPC đều security definer, khoá search_path và chỉ director gọi được", () => {
    const definerCount = (sql.match(/security definer/g) ?? []).length;
    expect(definerCount).toBeGreaterThanOrEqual(2);
    const searchPathCount = (sql.match(/set search_path = ''/g) ?? []).length;
    expect(searchPathCount).toBeGreaterThanOrEqual(2);
    const directorGuards = (sql.match(/CAPACITY_DIRECTOR_REQUIRED/g) ?? []).length;
    expect(directorGuards).toBeGreaterThanOrEqual(2);
  });

  it("thu hồi quyền của trình duyệt trên cả hai RPC, chỉ cấp cho service_role", () => {
    const revokes = (sql.match(/from public, anon, authenticated;/g) ?? []).length;
    expect(revokes).toBeGreaterThanOrEqual(2);
    const grants = (sql.match(/to service_role;/g) ?? []).length;
    expect(grants).toBeGreaterThanOrEqual(2);
  });

  it("đường giữ chỗ của khách đọc effective_capacity, không còn hourly_capacity", () => {
    // Đây là tính chất trung tâm của TC-01: MIN điểm nghẽn phải chọn theo con
    // số **đã nhân hệ số an toàn**, nếu không thì hệ số chỉ là trang trí trên
    // màn hình còn máy chủ vẫn bán theo con số cũ.
    const hold = sql.slice(
      sql.indexOf("create or replace function public.customer_create_booking_hold"),
    );
    expect(hold).toContain("order by threshold.effective_capacity asc");
    expect(hold).toContain("v_threshold.effective_capacity, v_threshold.version");
    expect(hold).not.toContain("hourly_capacity");
  });

  it("không seed một hàng ngưỡng nào", () => {
    // QĐ-02: số công suất thật phải do người vận hành nhập qua T11a kèm nguồn.
    // Seed bằng migration là dựng lại đúng loại số bịa mà T13 vừa xoá.
    expect(compact).not.toContain(
      "insert into public.erp_capacity_thresholds ( id,",
    );
    expect(compact).not.toContain("values ( gen_random_uuid()");
  });
});
