import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/quyen-rieng-tu/page";
import { CONTACT } from "@/content/contact";

/*
 * A15-PHAP-LY-01 · 17/09/2026. Thông báo xử lý dữ liệu phải viện dẫn đúng văn
 * bản đang có hiệu lực, chỉ đúng đầu mối nhận yêu cầu, và nói thật dữ liệu
 * được xử lý ở đâu. Bài này dựng trang như máy chủ dựng, nên nó cũng chặn
 * luôn chuyện địa chỉ thư lọt trần vào HTML (QA-P2-09).
 *
 * Bài này KHÔNG chứng minh bố cục đẹp hay không tràn ở 390px; phần đó thuộc
 * bài Playwright trong `tests/e2e/customer-progressive-identity.spec.ts`.
 */
const html = renderToStaticMarkup(createElement(PrivacyPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("public privacy notice (A15-PHAP-LY-01)", () => {
  it("cites the personal data protection law and decree now in force", () => {
    expect(text).toContain("Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15");
    expect(text).toContain("Nghị định 356/2025/NĐ-CP");
    // Văn bản cũ đã hết hiệu lực từ 01/01/2026 (Điều 42 Nghị định 356/2025/NĐ-CP).
    expect(html).not.toMatch(/13\/2023\/NĐ-CP/);
  });

  it("names the contact channels without printing the email address", () => {
    const address = [CONTACT.emailUser, CONTACT.emailDomain].join("@");
    expect(text).toContain("Gửi yêu cầu về dữ liệu");
    expect(html).toContain(`href="${CONTACT.phoneHref}"`);
    expect(text).toContain(CONTACT.phoneLabel);
    expect(html).not.toContain(address);
    expect(html).not.toContain(CONTACT.emailDomain);
    expect(html).toContain('href="#lien-he"');
    expect(html).toContain('id="lien-he"');
  });

  it("states the verified statutory deadlines and where data is processed", () => {
    expect(text).toContain("02 ngày làm việc");
    for (const days of ["10 ngày", "15 ngày", "20 ngày", "30 ngày"]) {
      expect(text).toContain(days);
    }
    expect(text).toContain("Tokyo, Nhật Bản");
    expect(text).toContain("chuyển dữ liệu cá nhân xuyên biên giới");
  });

  it("shows the bumped notice date", () => {
    expect(text).toContain("phiên bản 17.09.2026");
  });
});
