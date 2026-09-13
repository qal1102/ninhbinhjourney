import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DESTINATIONS } from "@/content/destinations";
import {
  DESTINATION_PAGE_SLUGS,
  destinations,
  getLandingDestinationBySlug,
} from "@/content/landing-destinations";

/*
 * Lượt kiểm tay ngày 12/09/2026: sáu trong mười lăm điểm đến không có trang
 * riêng, `/robots.txt` và `/sitemap.xml` đều 404, không trang nào có ảnh xem
 * trước khi chia sẻ. Các bài dưới đây khoá đúng ba điều ấy.
 */

const tatCaSlug = Object.values(DESTINATION_PAGE_SLUGS);

describe("mười lăm điểm đến, mỗi điểm một trang", () => {
  it("điểm nào trên trang chủ cũng có địa chỉ, và không hai điểm chung một địa chỉ", () => {
    expect(destinations).toHaveLength(15);
    for (const destination of destinations) {
      expect(DESTINATION_PAGE_SLUGS[destination.id], destination.id).toBeTruthy();
    }
    expect(new Set(tatCaSlug).size).toBe(tatCaSlug.length);
  });

  it("điểm đã có hồ sơ sâu thì trỏ đúng hồ sơ ấy, không đẻ trang thứ hai", () => {
    const hoSoSau = new Set(DESTINATIONS.map((item) => item.slug));
    const trungTen = tatCaSlug.filter((slug) => hoSoSau.has(slug));
    // Chín hồ sơ sâu, chín địa chỉ trùng khít.
    expect(trungTen).toHaveLength(DESTINATIONS.length);
  });

  it("sáu điểm chưa có hồ sơ sâu vẫn tra ra được nội dung đã biên tập", () => {
    const hoSoSau = new Set(DESTINATIONS.map((item) => item.slug));
    const conLai = tatCaSlug.filter((slug) => !hoSoSau.has(slug));
    expect(conLai).toHaveLength(6);
    for (const slug of conLai) {
      const trang = getLandingDestinationBySlug(slug);
      expect(trang, slug).toBeDefined();
      expect(trang!.destination.description.vi.length, slug).toBeGreaterThan(20);
      expect(trang!.facts.significance.vi.length, slug).toBeGreaterThan(20);
    }
    expect(getLandingDestinationBySlug("khong-co-noi-nay")).toBeUndefined();
  });

  it("mỗi địa chỉ có một ảnh chia sẻ đã dựng sẵn, đủ nhẹ để Zalo và Facebook tải được", () => {
    for (const slug of tatCaSlug) {
      const tep = `public/images/og/destination-${slug}.jpg`;
      expect(existsSync(tep), tep).toBe(true);
      expect(statSync(tep).size, tep).toBeLessThan(300 * 1024);
    }
    expect(existsSync("public/images/og/ninh-binh-journey.jpg")).toBe(true);
  });
});

describe("robots.txt và sitemap.xml", () => {
  it("sitemap có đủ mười lăm trang điểm đến, dùng địa chỉ tuyệt đối https", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const slug of tatCaSlug) {
      expect(urls.some((url) => url.endsWith(`/destination/${slug}`)), slug).toBe(true);
    }
    for (const url of urls) expect(url).toMatch(/^https:\/\//);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("sitemap không lọt trang điều hành hay trang của riêng từng khách", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const path of urls) {
      expect(path).not.toMatch(/^\/(erp|api|checkout|booking|pass|doan|journey|tra-cuu-ve)(\/|$)/);
    }
  });

  it("robots chặn hệ thống điều hành và chỉ về sitemap", () => {
    const ketQua = robots();
    const luat = Array.isArray(ketQua.rules) ? ketQua.rules[0] : ketQua.rules;
    const chan = Array.isArray(luat.disallow) ? luat.disallow : [luat.disallow];
    expect(chan).toContain("/erp");
    expect(chan).toContain("/api");
    expect(String(ketQua.sitemap)).toMatch(/^https:\/\/.+\/sitemap\.xml$/);
  });
});
