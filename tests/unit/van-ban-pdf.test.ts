import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import { docMaPhatHanh, kyMaPhatHanh, taoMaPhatHanh, KHUON_MA_PHAT_HANH, kyPhieuSoat, docPhieuSoat } from "@/lib/van-ban/ky-so";
import { docTepTaiLen, phatHanhPdf, type DauVaoPhatHanh } from "@/lib/van-ban/pdf-van-ban";

const dauVao = (sua = false, doiTac?: Record<string, string>): DauVaoPhatHanh => ({
  id: "VB-TH7K2M",
  loai: "hop-dong-nguoi-cheo",
  soVanBan: "HĐ-NC-2026-0101",
  heThong: { so_van_ban: "HĐ-NC-2026-0101", co_so: "Tràng An", so_thuyen: "03" },
  doiTac,
  suaDieuKhoan: sua,
  phatHanhLuc: "2026-10-24T03:00:00.000Z",
  phatHanhBoi: "Giám đốc mẫu",
  urlTraMa: "https://ninhbinhjourney.vercel.app/erp/van-ban?ma=VB-TH7K2M",
});

describe("PDF văn bản phát hành", () => {
  it("mã hoá, mở không cần mật khẩu nhưng không mở được bằng mật khẩu khác", async () => {
    const { bytes } = await phatHanhPdf(dauVao());
    const chu = Buffer.from(bytes).toString("latin1");
    expect(chu.startsWith("%PDF-")).toBe(true);
    expect(chu).toMatch(/\/Encrypt\s/);
    await expect(PDFDocument.load(bytes, { password: "khong-phai" })).rejects.toThrow(/password/i);
  });

  it("nộp lại nguyên bản: đọc được mã đã ký, băm nội dung khớp, ô đối tác đọc đúng chữ có dấu", async () => {
    const { bytes, maBamNoiDung } = await phatHanhPdf(dauVao(false, { ho_ten: "Bùi Văn Thắng", tien_cong: "180.000" }));
    const doc = await docTepTaiLen(bytes);
    expect(doc.loai).toBe("doc-duoc");
    if (doc.loai !== "doc-duoc") return;
    expect(doc.coMaHoa).toBe(true);
    expect(doc.maBamNoiDung).toBe(maBamNoiDung);
    expect(doc.giaTri.ho_ten).toBe("Bùi Văn Thắng");
    const ma = docMaPhatHanh(doc.ma);
    expect(ma.hopLe).toBe(true);
    if (ma.hopLe) expect(ma.ma).toMatchObject({ id: "VB-TH7K2M", loai: "hop-dong-nguoi-cheo", maBam: maBamNoiDung });
  });

  it("điền ô (như trình đọc PDF làm) không làm lệch băm nội dung", async () => {
    const { bytes, maBamNoiDung } = await phatHanhPdf(dauVao());
    const mo = await docTepTaiLen(bytes);
    if (mo.loai !== "doc-duoc") throw new Error("không đọc được");
    const dien = await PDFDocument.load(mo.banDoc);
    dien.getForm().getTextField("ho_ten").setText("Nguyen Van A");
    const sau = await docTepTaiLen(await dien.save());
    expect(sau.loai === "doc-duoc" && sau.maBamNoiDung).toBe(maBamNoiDung);
    expect(sau.loai === "doc-duoc" && sau.giaTri.ho_ten).toBe("Nguyen Van A");
  });

  it("bản bị sửa điều khoản mang mã thật nhưng băm nội dung lệch", async () => {
    const { bytes, maBamNoiDung } = await phatHanhPdf(dauVao(true));
    const doc = await docTepTaiLen(bytes);
    if (doc.loai !== "doc-duoc") throw new Error("không đọc được");
    const ma = docMaPhatHanh(doc.ma);
    expect(ma.hopLe && ma.ma.maBam).toBe(maBamNoiDung);
    expect(doc.maBamNoiDung).not.toBe(maBamNoiDung);
  });

  it("vẽ thêm chữ vào trang của bản đã gỡ mã hoá cũng lệch băm", async () => {
    const { bytes, maBamNoiDung } = await phatHanhPdf(dauVao());
    const mo = await docTepTaiLen(bytes);
    if (mo.loai !== "doc-duoc") throw new Error("không đọc được");
    const gia = await PDFDocument.load(mo.banDoc);
    gia.getPage(0).drawRectangle({ x: 10, y: 10, width: 5, height: 5, color: rgb(1, 1, 1) });
    const sau = await docTepTaiLen(await gia.save());
    expect(sau.loai === "doc-duoc" && sau.maBamNoiDung).not.toBe(maBamNoiDung);
  });

  it("PDF ngoài hệ thống không có mã; tệp không phải PDF bị nhận ra", async () => {
    const la = await PDFDocument.create();
    la.addPage();
    const doc = await docTepTaiLen(await la.save());
    expect(doc.loai === "doc-duoc" && doc.ma).toBeNull();
    expect((await docTepTaiLen(new TextEncoder().encode("xin chào"))).loai).toBe("khong-phai-pdf");
  });

  it("PDF mã hoá bằng mật khẩu người khác bị nhận ra", async () => {
    const la = await PDFDocument.create();
    la.addPage();
    la.encrypt({ ownerPassword: "cua-nguoi-khac", userPassword: "" });
    expect((await docTepTaiLen(await la.save())).loai).toBe("ma-hoa-la");
  });
});

describe("Mã phát hành và phiếu soát", () => {
  it("chữ ký sai một ký tự là không hợp lệ", () => {
    const ma = kyMaPhatHanh({ id: "VB-ABCDEF", loai: "bien-ban-nghiem-thu", phienBan: 1, maBam: "a".repeat(64) });
    expect(docMaPhatHanh(ma).hopLe).toBe(true);
    const sai = ma.slice(0, -1) + (ma.endsWith("A") ? "B" : "A");
    expect(docMaPhatHanh(sai)).toEqual({ hopLe: false, lyDo: "sai-chu-ky" });
    // Đổi loại văn bản trong mã mà giữ chữ ký cũ.
    expect(docMaPhatHanh(ma.replace("bien-ban-nghiem-thu", "hop-dong-nguoi-cheo")).hopLe).toBe(false);
    expect(docMaPhatHanh("rác").hopLe).toBe(false);
  });

  it("mã phát hành đúng khuôn", () => {
    for (let i = 0; i < 20; i += 1) expect(taoMaPhatHanh()).toMatch(KHUON_MA_PHAT_HANH);
  });

  it("phiếu soát chỉ dùng được cho đúng tệp, trong hạn", () => {
    const phieu = kyPhieuSoat({ maBamTep: "b".repeat(64), ai: { tomTat: "ổn" }, heThan: Date.now() + 60_000 });
    expect(docPhieuSoat(phieu, "b".repeat(64))).toEqual({ ai: { tomTat: "ổn" } });
    expect(docPhieuSoat(phieu, "c".repeat(64))).toBeNull();
    expect(docPhieuSoat(phieu, "b".repeat(64), Date.now() + 120_000)).toBeNull();
  });
});
