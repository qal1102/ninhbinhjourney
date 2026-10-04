import { describe, expect, it } from "vitest";
import { chiaCauDoc, chuanHoaDeDoc, NGHI, soLaMa, tenGiongGon, xepGiong } from "@/domain/thuyet-minh-doc";

describe("chuẩn hoá chữ để giọng máy đọc như người nói", () => {
  it("thế kỷ viết số La Mã đọc thành số", () => {
    expect(chuanHoaDeDoc("Thế kỷ X. Nhà Đinh dựng kinh đô.", "vi")).toBe("Thế kỷ 10. Nhà Đinh dựng kinh đô.");
    expect(chuanHoaDeDoc("từ thế kỷ XIX tới nay", "vi")).toBe("từ thế kỷ 19 tới nay");
    expect(chuanHoaDeDoc("since the XIth century", "en")).toBe("since the 11th century");
    expect(soLaMa("XIV")).toBe(14);
    expect(soLaMa("ABC")).toBeNull();
  });

  it("khoảng năm, đơn vị đo, chữ viết tắt", () => {
    expect(chuanHoaDeDoc("Kinh đô Hoa Lư 968–1010.", "vi")).toBe("Kinh đô Hoa Lư 968 đến 1010.");
    expect(chuanHoaDeDoc("Rộng 6.172 ha, tuyến dài 3 km, hang cao 39 m.", "vi")).toBe(
      "Rộng 6.172 héc-ta, tuyến dài 3 ki-lô-mét, hang cao 39 mét.",
    );
    expect(chuanHoaDeDoc("UNESCO công nhận năm 2014.", "vi")).toBe("U-nét-xcô công nhận năm 2014.");
    expect(chuanHoaDeDoc("The capital from 968–1010, 3 km long.", "en")).toBe("The capital from 968 to 1010, 3 kilometres long.");
  });

  it("ngoặc đơn thành chỗ ngắt, không đọc liền một hơi", () => {
    expect(chuanHoaDeDoc("Ba tiêu chí (v), (vii) và (viii).", "vi")).toBe("Ba tiêu chí, v, vii, và, viii.");
    expect(chuanHoaDeDoc("Quần thể Tràng An (Ninh Bình) rất rộng.", "vi")).toBe("Quần thể Tràng An, Ninh Bình, rất rộng.");
  });

  it("chữ thường không bị đụng tới", () => {
    expect(chuanHoaDeDoc("Mời bạn ngồi thuyền lúc sớm, khi sương còn trên sông.", "vi")).toBe(
      "Mời bạn ngồi thuyền lúc sớm, khi sương còn trên sông.",
    );
    // "I" đứng riêng trong tiếng Anh không phải số La Mã.
    expect(chuanHoaDeDoc("I loved it.", "en")).toBe("I loved it.");
  });

  it("nghỉ dài sau tên nơi và cuối mỗi đoạn, ngắn giữa hai câu", () => {
    const cau = chiaCauDoc("Tràng An", ["Câu một. Câu hai.", "Đoạn hai."], "vi");
    expect(cau.map((c) => c.chu)).toEqual(["Tràng An", "Câu một.", "Câu hai.", "Đoạn hai."]);
    expect(cau.map((c) => c.nghiSau)).toEqual([NGHI.sauTen, NGHI.giuaCau, NGHI.giuaDoan, NGHI.giuaDoan]);
  });
});

describe("chọn giọng đọc", () => {
  const edge = [
    { name: "Microsoft An - Vietnamese (Vietnam)", lang: "vi-VN" },
    { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", lang: "vi-VN" },
    { name: "Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)", lang: "vi-VN" },
    { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB" },
  ];

  it("Edge: giọng tự nhiên HoaiMy đứng đầu, giọng An đời cũ xuống cuối", () => {
    const vi = xepGiong(edge, "vi").map((g) => g.name);
    expect(vi[0]).toContain("HoaiMy");
    expect(vi.at(-1)).toContain("An -");
    expect(vi).toHaveLength(3);
  });

  it("tiếng Anh ưu tiên giọng Anh tự nhiên như phần chữ của trang", () => {
    expect(xepGiong(edge, "en")[0].name).toContain("Sonia");
  });

  it("máy không có giọng hợp ngôn ngữ thì danh sách rỗng", () => {
    expect(xepGiong([{ name: "Samantha", lang: "en-US" }], "vi")).toEqual([]);
  });

  it("tên giọng gọn để hiện trong ô chọn", () => {
    expect(tenGiongGon(edge[2], "vi")).toBe("HoaiMy · tự nhiên");
    expect(tenGiongGon(edge[0], "vi")).toBe("An");
    expect(tenGiongGon({ name: "Linh", lang: "vi-VN" }, "vi")).toBe("Linh");
  });
});
