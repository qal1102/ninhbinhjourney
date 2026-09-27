import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mọi server action ERP phải tự kiểm quyền ở máy chủ.
 *
 * Server action là một điểm cuối HTTP công khai: ẩn nút trên màn hình không
 * ngăn được ai gửi thẳng biểu mẫu tới nó. Ngày 28/09/2026 soát tay cả 79 hàm
 * trong `app/erp/*-actions.ts` và `app/erp/actions.ts`: hàm nào cũng đọc người
 * dùng hiện hành rồi kiểm vai. Bốn hàm nhận `siteId` mà không tự kiểm cơ sở ở
 * TypeScript đều được hàm SQL chặn theo đúng cơ sở (`erp_gate_actor_can_scan`,
 * `erp_counter_actor_can_void`, người nhận ca phải là `incoming_account_id`);
 * hàm đặt giá vé quầy chỉ cho giám đốc, vốn được mọi cơ sở.
 *
 * Bài này là hàng rào cho lần sau: thêm một action mà quên kiểm quyền thì đỏ.
 * Nó đọc mã nguồn, không chứng minh phép kiểm đúng; đúng hay sai thuộc về bài
 * kiểm của từng module. Đăng nhập thật bằng tài khoản cấp thấp (A15-QUYEN-01)
 * vẫn chưa làm.
 */

const GUARD =
  /getCurrentErpUser|require[A-Z]\w*\(|accountCanAccess|assert\w*Access|canView\w*\(|canManage\w*\(|canModerate\w*\(/;

/** Hàm không cần người dùng đã đăng nhập, hoặc kiểm ở tầng dưới đã soát tay. */
const MIEN = new Map<string, string>([
  ["loginErpAction", "chính là cửa đăng nhập"],
  ["switchDemoRoleAction", "startRoleSwitch() kiểm chủ thật của phiên là giám đốc"],
  ["endRoleSwitchAction", "endRoleSwitch() chỉ trả phiên về giám đốc đã mở nó"],
]);

function tepServerAction(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) ra.push(...tepServerAction(duong));
    else if (ten.endsWith(".ts") && readFileSync(duong, "utf8").startsWith('"use server"')) ra.push(duong);
  }
  return ra;
}

function cacHam(nguon: string) {
  const khop = [...nguon.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)];
  return khop.map((m, i) => ({
    ten: m[1],
    than: nguon.slice(m.index, khop[i + 1]?.index ?? nguon.length),
    xuat: nguon.includes(`export async function ${m[1]}(`),
  }));
}

describe("server action ERP tự kiểm quyền", () => {
  const tep = tepServerAction("app/erp");

  it("tìm thấy các tệp server action để soát", () => {
    expect(tep.length).toBeGreaterThanOrEqual(10);
  });

  it("mọi hàm xuất ra đều kiểm người dùng, trực tiếp hoặc qua hàm phụ trong cùng tệp", () => {
    const thieu: string[] = [];
    for (const duong of tep) {
      const ham = cacHam(readFileSync(duong, "utf8"));
      const phuCoKiem = ham.filter((h) => GUARD.test(h.than)).map((h) => h.ten);
      for (const h of ham.filter((x) => x.xuat)) {
        if (MIEN.has(h.ten)) continue;
        const coKiem = GUARD.test(h.than) || phuCoKiem.some((p) => p !== h.ten && h.than.includes(`${p}(`));
        if (!coKiem) thieu.push(`${duong}: ${h.ten}`);
      }
    }
    expect(thieu, "Server action không tự kiểm quyền. Thêm phép kiểm, hoặc ghi vào MIEN kèm lý do đã soát.").toEqual([]);
  });

  it("các hàm miễn trừ vẫn còn tồn tại, để danh sách miễn không mục dần", () => {
    const tatCa = tep.flatMap((duong) => cacHam(readFileSync(duong, "utf8")).filter((h) => h.xuat).map((h) => h.ten));
    for (const ten of MIEN.keys()) expect(tatCa).toContain(ten);
  });
});
