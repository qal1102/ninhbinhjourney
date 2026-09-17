import { describe, expect, it, vi } from "vitest";
import { erpLoginState, ERP_LOGIN_STATE_LABELS } from "@/domain/erp-account-roles";

vi.mock("server-only", () => ({}));

import {
  TEMPORARY_PASSWORD_ALPHABET,
  generateTemporaryPassword,
} from "@/lib/erp/account-registry-repository";

/*
 * A15-ACC-01 — audit 15/09/2026, TK-06 và TK-07.
 */

describe("TK-07 — bộ sinh mật khẩu tạm không lệch phân phối", () => {
  it("luôn đủ 16 ký tự, chỉ lấy trong bảng chữ không gây nhầm", () => {
    for (let lan = 0; lan < 200; lan++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(16);
      for (const ch of password) expect(TEMPORARY_PASSWORD_ALPHABET).toContain(ch);
    }
  });

  it("bỏ các byte từ bội số lớn nhất của cỡ bảng trở lên, thay vì gập chúng vào 20 chữ đầu bảng", () => {
    const size = TEMPORARY_PASSWORD_ALPHABET.length;
    const limit = 256 - (256 % size);
    // Nguồn giả chỉ trả byte "thừa" trước, rồi mới tới byte hợp lệ: byte thừa
    // mà bị dùng (byte % size) thì chữ đầu bảng sẽ xuất hiện.
    let goi = 0;
    const nguon = (n: number) => {
      goi += 1;
      return Uint8Array.from({ length: n }, (_, i) => (goi === 1 ? limit + (i % (256 - limit)) : size - 1));
    };
    const password = generateTemporaryPassword(nguon);
    expect(password).toBe(TEMPORARY_PASSWORD_ALPHABET[size - 1].repeat(16));
    expect(goi).toBe(2);
  });

  it("mọi ký tự trong bảng có đúng số byte ánh xạ tới như nhau", () => {
    const size = TEMPORARY_PASSWORD_ALPHABET.length;
    const limit = 256 - (256 % size);
    const dem = new Map<string, number>();
    for (let byte = 0; byte < 256; byte++) {
      if (byte >= limit) continue;
      const ch = TEMPORARY_PASSWORD_ALPHABET[byte % size];
      dem.set(ch, (dem.get(ch) ?? 0) + 1);
    }
    expect(new Set(dem.values()).size).toBe(1);
    expect(dem.size).toBe(size);
  });
});

describe("TK-06 — trạng thái đăng nhập nhìn ra được", () => {
  it("phân biệt chưa cấp, đã cấp chưa đổi mật khẩu, và đang dùng", () => {
    expect(erpLoginState({ hasAuthUser: false, mustChangePassword: true })).toBe("no-login");
    expect(erpLoginState({ hasAuthUser: false, mustChangePassword: false })).toBe("no-login");
    expect(erpLoginState({ hasAuthUser: true, mustChangePassword: true })).toBe("awaiting-first-change");
    expect(erpLoginState({ hasAuthUser: true, mustChangePassword: false })).toBe("in-use");
    expect(new Set(Object.values(ERP_LOGIN_STATE_LABELS)).size).toBe(3);
  });
});
