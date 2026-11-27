import { describe, expect, it } from "vitest";
import {
  camXucCua,
  cauKetLuan,
  demTheoChuDe,
  diemTrungBinh,
  docDuLieuDanhGia,
  tongTheoCoSo,
  trongKhoang,
  tyLeHaiLong,
  type DanhGiaNgoai,
} from "@/domain/danh-gia-ngoai";
import * as cao from "@/scripts/danh-gia-ngoai/cao.mjs";

const cauHinhChuDe = { "canh-quan": "Cảnh quan", "cheo-keo": "Chèo kéo, xin tip" };

function bg(phan: Partial<DanhGiaNgoai>): DanhGiaNgoai {
  return {
    id: phan.id ?? `google:${Math.random()}`,
    nguon: "google",
    coSo: "trang-an",
    sao: 5,
    ngay: "2026-11-20T03:00:00.000Z",
    ngonNgu: "vi",
    noiDung: "Đẹp",
    ...phan,
  };
}

describe("đánh giá ngoài: số gộp", () => {
  const ds = [
    bg({ sao: 5, chuDe: [{ k: "canh-quan", tot: true }] }),
    bg({ sao: 2, chuDe: [{ k: "cheo-keo", tot: false }, { k: "canh-quan", tot: true }] }),
    bg({ sao: 4, ngonNgu: "en", coSo: "tam-coc", chuDe: [{ k: "cheo-keo", tot: false }] }),
    bg({ sao: null, ngonNgu: "en", coSo: "tam-coc", camXuc: "tich-cuc" }),
  ];

  it("cảm xúc lấy kết quả AI trước, thiếu thì suy từ sao", () => {
    expect(camXucCua({ sao: 1, camXuc: "tich-cuc" })).toBe("tich-cuc");
    expect(camXucCua({ sao: 3 })).toBe("trung-lap");
    expect(camXucCua({ sao: null })).toBeNull();
  });

  it("điểm trung bình bỏ lời không có sao, hài lòng tính theo cảm xúc", () => {
    expect(diemTrungBinh(ds)).toBe(3.7);
    expect(tyLeHaiLong(ds)).toBe(75);
    expect(tyLeHaiLong([])).toBeNull();
  });

  it("đếm chủ đề và xếp theo số lượt", () => {
    expect(demTheoChuDe(ds).map((c) => [c.ma, c.khen, c.che])).toEqual([
      ["canh-quan", 2, 0],
      ["cheo-keo", 0, 2],
    ]);
  });

  it("tổng theo cơ sở có chủ đề bị chê nhất", () => {
    const [ta, tc] = tongTheoCoSo(ds, ["trang-an", "tam-coc"]);
    expect(ta.soLoi).toBe(2);
    expect(tc.biCheNhieuNhat?.ma).toBe("cheo-keo");
  });

  it("câu kết luận nói khen gì, chê gì và khách nào hài lòng hơn", () => {
    expect(cauKetLuan(ds)).toBe(
      "Được khen nhiều nhất về cảnh quan (2 lượt), bị chê nhiều nhất về chèo kéo, xin tip (2 lượt). Khách quốc tế hài lòng hơn 50 điểm phần trăm.",
    );
    expect(cauKetLuan([bg({})])).toBeNull();
  });

  it("lọc theo khoảng ngày", () => {
    const bayGio = new Date("2026-11-27T00:00:00.000Z");
    expect(trongKhoang([bg({ ngay: "2026-11-01T00:00:00.000Z" }), bg({})], 7, bayGio)).toHaveLength(1);
  });

  it("đọc tệp: dòng hỏng bị bỏ riêng, tệp sai khuôn trả null", () => {
    const ra = docDuLieuDanhGia({ capNhat: null, banGhi: [bg({}), { id: "x" }], lanChay: [] });
    expect(ra?.banGhi).toHaveLength(1);
    expect(docDuLieuDanhGia({ banGhi: "x" })).toBeNull();
  });
});

describe("đánh giá ngoài: script lấy dữ liệu", () => {
  it("chuẩn hoá Google không giữ tên người viết, bỏ liên kết không phải https", () => {
    const r = cao.chuanHoaGoogle(
      { reviewId: "abc", publishedAtDate: "2026-11-20T01:02:03Z", stars: 4, text: " Đẹp ", originalLanguage: "vi", name: "Nguyễn A", reviewUrl: "http://x" },
      "trang-an",
    );
    expect(r).toEqual({ id: "google:abc", nguon: "google", coSo: "trang-an", sao: 4, ngay: "2026-11-20T01:02:03.000Z", ngonNgu: "vi", noiDung: "Đẹp", lienKet: null });
    expect(JSON.stringify(r)).not.toContain("Nguyễn");
    expect(cao.chuanHoaGoogle({ publishedAtDate: "x" }, "trang-an")).toBeNull();
  });

  it("chuẩn hoá Tripadvisor ghép tiêu đề với nội dung", () => {
    const r = cao.chuanHoaTripadvisor({ id: 9, publishedDate: "2026-11-19", rating: 2, title: "Tip", text: "Asked twice", lang: "en", url: "https://t" }, "tam-coc");
    expect(r).toMatchObject({ noiDung: "Tip. Asked twice", ngonNgu: "en", lienKet: "https://t" });
  });

  it("ngày bắt đầu: lần đầu lùi 14 ngày, sau đó lấy bản mới nhất trừ 2 ngày", () => {
    const bayGio = new Date("2026-11-27T00:00:00Z");
    expect(cao.ngayBatDau([], "trang-an", "google", bayGio)).toBe("2026-11-13");
    expect(cao.ngayBatDau([{ coSo: "trang-an", nguon: "google", ngay: "2026-11-25T10:00:00Z" }], "trang-an", "google", bayGio)).toBe("2026-11-23");
  });

  it("gộp bỏ trùng và giữ phân loại cũ", () => {
    const cu = [{ id: "a", ngay: "2026-11-01T00:00:00Z", camXuc: "tich-cuc" }];
    const { tatCa, themMoi } = cao.gop(cu, [{ id: "a", ngay: "2026-11-01T00:00:00Z" }, { id: "b", ngay: "2026-11-02T00:00:00Z" }, null]);
    expect(themMoi.map((x: { id: string }) => x.id)).toEqual(["b"]);
    expect(tatCa.map((x: { id: string }) => x.id)).toEqual(["b", "a"]);
    expect(tatCa[1].camXuc).toBe("tich-cuc");
  });

  it("chỉ nhận kết quả phân loại hợp lệ", () => {
    const ra = cao.docKetQuaPhanLoai(
      [
        { id: "a", camXuc: "tieu-cuc", chuDe: [{ k: "cheo-keo", tot: false }, { k: "la", tot: true }, { k: "cheo-keo", tot: true }], banDich: " Bị xin tip " },
        { id: "z", camXuc: "tich-cuc", chuDe: [] },
        { id: "b", camXuc: "vui", chuDe: [] },
      ],
      new Set(["a", "b"]),
      cauHinhChuDe,
    );
    expect([...ra.keys()]).toEqual(["a"]);
    expect(ra.get("a")).toEqual({ camXuc: "tieu-cuc", chuDe: [{ k: "cheo-keo", tot: false }], banDich: "Bị xin tip" });
  });

  it("đầu vào Apify tắt dữ liệu cá nhân và lấy mới nhất", () => {
    const g = cao.dauVaoApify({ nguon: "google", timKiem: "Chùa Bái Đính" }, "2026-11-20", 30);
    expect(g).toMatchObject({ reviewsSort: "newest", reviewsStartDate: "2026-11-20", personalData: false, maxReviews: 30 });
    expect(g.startUrls[0].url).toBe(`https://www.google.com/maps/search/${encodeURIComponent("Chùa Bái Đính")}`);
    const t = cao.dauVaoApify({ nguon: "tripadvisor", url: "https://www.tripadvisor.com/x" }, "2026-11-20", 30);
    expect(t).toMatchObject({ scrapeReviewerInfo: false, lastReviewDate: "2026-11-20", maxItemsPerQuery: 30 });
  });

  it("chủ đề trong cấu hình khớp kiểu của màn ERP", async () => {
    const cauHinh = await cao.docCauHinh();
    expect(Object.keys(cauHinh.chuDe).length).toBeGreaterThan(3);
    for (const muc of cauHinh.muc) {
      expect(["trang-an", "tam-coc", "bai-dinh", "tam-chuc"]).toContain(muc.coSo);
      if (muc.url) expect(muc.url.startsWith("https://www.tripadvisor.com/")).toBe(true);
    }
  });
});
