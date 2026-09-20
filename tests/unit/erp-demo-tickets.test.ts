import { describe, expect, it } from "vitest";

import {
  DEMO_TICKETS_DISABLED_MESSAGE,
  resolveDemoTicketsEnabled,
} from "@/domain/erp-demo-tickets";

/**
 * A15-ERP-07 — cờ vé mẫu.
 *
 * Bài canh đúng một điều dễ bị đảo ngược trong lúc dọn mã: **mặc định là
 * hiện**. Production hôm nay là bản trình diễn cho khách xem, và giám đốc
 * đang dùng nút kéo vé mẫu để chạy thử vòng quét. Đổi mặc định thành tắt là
 * lấy mất một công cụ đang chạy mà không ai báo.
 */
describe("A15-ERP-07: cờ vé mẫu", () => {
  it("không đặt gì thì vé mẫu vẫn hiện", () => {
    expect(resolveDemoTicketsEnabled(undefined)).toBe(true);
    expect(resolveDemoTicketsEnabled("")).toBe(true);
    expect(resolveDemoTicketsEnabled("   ")).toBe(true);
  });

  it("chỉ tắt khi nói thẳng là tắt", () => {
    expect(resolveDemoTicketsEnabled("false")).toBe(false);
    expect(resolveDemoTicketsEnabled("FALSE")).toBe(false);
    expect(resolveDemoTicketsEnabled(" off ")).toBe(false);
    expect(resolveDemoTicketsEnabled("0")).toBe(false);
  });

  it("chuỗi lạ thì giữ nguyên hiện, không tự suy diễn", () => {
    expect(resolveDemoTicketsEnabled("true")).toBe(true);
    expect(resolveDemoTicketsEnabled("bật")).toBe(true);
    expect(resolveDemoTicketsEnabled("no")).toBe(true);
  });

  it("câu từ chối nói bằng tiếng người, không nói tên biến môi trường", () => {
    expect(DEMO_TICKETS_DISABLED_MESSAGE).not.toContain("ERP_DEMO");
    expect(DEMO_TICKETS_DISABLED_MESSAGE).toContain("vận hành thật");
  });
});
