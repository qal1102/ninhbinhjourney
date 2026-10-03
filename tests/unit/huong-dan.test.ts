import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BAN_DO_CHUC_NANG, CHUC_NANG_MOI, CHUC_NANG_WEB, laDuongDanErpAnToan } from "@/domain/ban-do-chuc-nang";
import {
  DIEM_SAU_KHI_BAM,
  duongDenBuoc,
  duongDenChucNang,
  kemChi,
  timMucDangChi,
  VONG_KHACH,
} from "@/domain/huong-dan";

function tepGiaoDien(thuMuc: string): string[] {
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) return tepGiaoDien(duong);
    return duong.endsWith(".tsx") ? [duong] : [];
  });
}

/** Mọi giá trị `data-chi` có trong mã giao diện, viết dạng thuộc tính hay trong đối tượng rải. */
function diemCoThat(): Set<string> {
  const tap = new Set<string>();
  for (const tep of [...tepGiaoDien("components"), ...tepGiaoDien("app")]) {
    const ma = readFileSync(tep, "utf8");
    for (const khop of ma.matchAll(/data-chi"?\s*[=:]\s*"([a-z0-9-]+)"/g)) tap.add(khop[1]);
    // Trang đặt vé và quầy vé đặt điểm qua hàm `chi(...)` gắn một tên điểm.
    for (const khop of ma.matchAll(/"data-chi": "([a-z0-9-]+)", "data-chi-loi": loi/g)) tap.add(khop[1]);
  }
  return tap;
}

describe("màn Hướng dẫn", () => {
  const tatCaViec = BAN_DO_CHUC_NANG.flatMap((nhom) => nhom.chucNang);

  it("mọi điểm khoanh trong kịch bản đều có phần tử thật trên màn", () => {
    const coThat = diemCoThat();
    const canCo = [
      ...VONG_KHACH.map((b) => b.diem),
      ...tatCaViec.map((c) => c.diem),
      ...Object.values(DIEM_SAU_KHI_BAM),
    ];
    for (const diem of canCo) expect(coThat.has(diem), `thiếu data-chi="${diem}"`).toBe(true);
  });

  it("vòng khách đánh số liền, mã việc không trùng với việc tra cứu", () => {
    expect(VONG_KHACH.map((b) => b.thuTu)).toEqual(VONG_KHACH.map((_, i) => i + 1));
    const ids = [...VONG_KHACH.map((b) => b.id), ...tatCaViec.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gắn chi vào đường dẫn, giữ tham số cũ và phần #", () => {
    expect(kemChi("/erp", "vong-trang-dau")).toBe("/erp?chi=vong-trang-dau");
    expect(kemChi("/erp/marketing?ky=7-ngay#phieu-khach", "vong-kenh-khach")).toBe(
      "/erp/marketing?ky=7-ngay&chi=vong-kenh-khach#phieu-khach",
    );
    expect(kemChi("/erp/khach-hang#khach-thay-gi", "vong-ho-chieu")).toBe("/erp/khach-hang?chi=vong-ho-chieu#khach-thay-gi");
    expect(kemChi("/erp/trang-an/check-in-khach?ma=A", "vong-qua-cong", "quet-ve")).toBe(
      "/erp/trang-an/check-in-khach?ma=A&chi=vong-qua-cong&diem=quet-ve",
    );
  });

  it("mỗi bước biết bước kế; bước cuối không có bước kế", () => {
    const dau = timMucDangChi(VONG_KHACH[0].id);
    expect(dau?.vong).toMatchObject({ thuTu: 1, tong: VONG_KHACH.length });
    expect(dau?.vong?.ke?.id).toBe(VONG_KHACH[1].id);
    expect(timMucDangChi(VONG_KHACH.at(-1)!.id)?.vong?.ke).toBeNull();
    expect(timMucDangChi("quet-cong")?.vong).toBeUndefined();
    expect(timMucDangChi("khong-co")).toBeNull();
    expect(timMucDangChi(null)).toBeNull();
  });

  it("bước 1 mở trang đặt vé gói Nhịp chậm cho hôm nay", () => {
    expect(duongDenBuoc(VONG_KHACH[0])).toBe("/checkout?package=slow-ninh-binh&ngay=hom-nay&chi=vong-dat-ve");
  });

  it("phần mới: ngày gần nhất đứng đầu, ngày hợp lệ, trang web có thật", () => {
    expect(CHUC_NANG_MOI.length).toBeGreaterThan(5);
    const so = CHUC_NANG_MOI.map(({ cn }) => {
      expect(cn.moi, cn.id).toMatch(/^\d{2}\/\d{2}$/);
      const [ngay, thang] = cn.moi!.split("/").map(Number);
      return thang * 100 + ngay;
    });
    expect(so).toEqual([...so].sort((a, b) => b - a));
    // Bản đồ thuyền phải nằm ngay đầu danh sách: đó là thứ chủ dự án tìm không ra.
    expect(CHUC_NANG_MOI.slice(0, 2).map(({ cn }) => cn.id)).toContain("thuyen-tren-song");
    for (const cn of CHUC_NANG_WEB) {
      const duong = cn.duongDan.split(/[?#]/)[0];
      if (duong === "/" || duong.startsWith("/erp")) continue;
      // Kiểm thô theo thư mục đầu: đổi tên route mà quên danh sách là bài này đỏ.
      const thuMuc = join("app", duong.split("/").filter(Boolean)[0]);
      expect(statSync(thuMuc, { throwIfNoEntry: false })?.isDirectory() ?? false, `${cn.id}: ${thuMuc}`).toBe(true);
    }
    const ids = CHUC_NANG_WEB.map((cn) => cn.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lệnh chuyển vai nhận đường dẫn kèm chi của mọi việc tra cứu, không nhận thứ khác", () => {
    for (const cn of tatCaViec) {
      if (!cn.duongDan.includes("#")) expect(laDuongDanErpAnToan(duongDenChucNang(cn)), cn.id).toBe(true);
    }
    for (const xau of ["/erp?chi=x&y=1", "/erp?chi=X", "/erp?chi=a/b", "/checkout?chi=a"]) {
      expect(laDuongDanErpAnToan(xau), xau).toBe(false);
    }
  });
});
