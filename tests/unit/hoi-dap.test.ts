import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CAU_GOI_Y } from "@/domain/hoi-dap-goi-y";
import { coYDatVe, mucTheoId, timMuc, traLoiThang } from "@/domain/hoi-dap";
import { GIOI_HAN_AI, kiemBanNhapDatVe, layLuotAi, traLoiCauHoi } from "@/lib/hoi-dap/tra-loi";

const aiTraLoi = (traLoi: string, datVe: unknown = null) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ traLoi, datVe }) } }] }));

describe("sổ hỏi đáp", () => {
  it("mọi câu gợi ý đều có mục trong sổ", () => {
    for (const g of CAU_GOI_Y) expect(mucTheoId(g.id)?.hoi.vi).toBe(g.hoi.vi);
  });

  it("câu rõ ý trả lời thẳng, không cần AI", () => {
    expect(traLoiThang("Trẻ em có mất vé không?")?.id).toBe("tre-em");
    expect(traLoiThang("do children need a ticket")?.id).toBe("tre-em");
    expect(traLoiThang("thanh toán bằng QR được không")?.id).toBe("thanh-toan");
  });

  it("câu về một nơi tìm đúng điểm đến nhưng để AI trả lời cho đúng ý", () => {
    expect(timMuc("Đi Tràng An mất bao lâu?")[0]?.muc.id).toBe("diem-trang_an");
    expect(traLoiThang("Đi Tràng An mất bao lâu?")).toBeNull();
  });
});

describe("trả lời câu hỏi", () => {
  beforeEach(() => vi.stubEnv("AI_API_KEY", "khoa-thu"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("bấm câu gợi ý không gọi ra ngoài", async () => {
    const fetchGia = vi.fn();
    vi.stubGlobal("fetch", fetchGia);
    const kq = await traLoiCauHoi({ cau: "Đặt vé thế nào?", lang: "vi", mucId: "dat-ve", khoaKhach: "a" });
    expect(kq.nguon).toBe("so");
    expect(kq.lienKet[0]?.href).toBe("/packages");
    expect(fetchGia).not.toHaveBeenCalled();
  });

  it("câu lạ hỏi AI kèm tư liệu khớp, rồi nhớ câu trả lời", async () => {
    const fetchGia = vi.fn(async () => aiTraLoi("Tuyến thuyền thường khoảng 3 giờ."));
    vi.stubGlobal("fetch", fetchGia);
    const kq = await traLoiCauHoi({ cau: "Đi Tràng An mất bao lâu?", lang: "vi", khoaKhach: "b" });
    expect(kq).toMatchObject({ nguon: "ai", traLoi: "Tuyến thuyền thường khoảng 3 giờ." });
    const body = JSON.parse(String((fetchGia.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.messages[0].content).toContain("Tràng An");

    const lanHai = await traLoiCauHoi({ cau: "đi tràng an mất bao lâu", lang: "vi", khoaKhach: "c" });
    expect(lanHai.nguon).toBe("nho");
    expect(fetchGia).toHaveBeenCalledTimes(1);
  });

  it("AI lỗi thì trả mục khớp nhất trong sổ", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const kq = await traLoiCauHoi({ cau: "Bái Đính có gì hay hôm thứ ba?", lang: "vi", khoaKhach: "d" });
    expect(kq.nguon).toBe("so");
    expect(kq.lienKet[0]?.href).toContain("/destination/");
  });

  it("câu nhờ đặt không trả lời thẳng từ sổ mà để AI điền đơn", async () => {
    expect(coYDatVe("Đặt vé thế nào?")).toBe(false);
    expect(coYDatVe("Đặt giúp mình gói gia đình thứ bảy này, 2 người lớn 1 bé")).toBe(true);
    const fetchGia = vi.fn(async () =>
      aiTraLoi("Đã điền gói Gia đình khám phá thứ bảy 10/10.", { goi: "family-discovery", ngay: "2026-10-10", gio: null, nguoiLon: 2, treEm: 1 }),
    );
    vi.stubGlobal("fetch", fetchGia);
    const kq = await traLoiCauHoi({
      cau: "Đặt giúp mình gói gia đình thứ bảy này, 2 người lớn 1 bé",
      lang: "vi",
      khoaKhach: "f",
      bayGio: new Date("2026-10-08T05:00:00Z"),
    });
    expect(kq.nguon).toBe("ai");
    expect(kq.datVe?.href).toBe("/checkout?package=family-discovery&nguoiLon=2&treEm=1&lang=vi&ngay=2026-10-10");
  });

  it("bản nháp đơn bỏ gói không có, ngày đã qua và số người quá giới hạn", () => {
    const bayGio = new Date("2026-10-08T05:00:00Z");
    expect(kiemBanNhapDatVe({ goi: "khong-co", ngay: null, gio: null, nguoiLon: 2, treEm: 0 }, "vi", bayGio)).toBeUndefined();
    const d = kiemBanNhapDatVe({ goi: "slow-ninh-binh", ngay: "2026-10-01", gio: "25:00", nguoiLon: 80, treEm: 9 }, "vi", bayGio);
    expect(d).toMatchObject({ ngay: null, gio: null, nguoiLon: 45, treEm: 0 });
  });

  it("mỗi khách chỉ được vài lượt AI mỗi phút", () => {
    const t = 1_000_000;
    for (let i = 0; i < GIOI_HAN_AI.moiPhut; i += 1) expect(layLuotAi("e", t + i)).toBe(true);
    expect(layLuotAi("e", t + 10)).toBe(false);
    expect(layLuotAi("e", t + 61_000)).toBe(true);
  });
});
