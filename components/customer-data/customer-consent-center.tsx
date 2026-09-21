"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOATING_YIELD_CLASS, useFloatingYield } from "@/lib/use-floating-yield";
import {
  CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
  CUSTOMER_CONSENT_CHANGED_EVENT,
  getOrCreateCustomerAnonymousId,
  isCustomerConsentSurface,
  parseCustomerConsentPreferences,
} from "@/lib/customer-data/browser-tracking";

type ConsentResponse = {
  accepted?: boolean;
  consent?: Record<string, string>;
  error?: { message?: string };
};

export function CustomerConsentCenter() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<"en" | "vi">("vi");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const nhuongCho = useFloatingYield();
  const bannerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLanguage(document.documentElement.lang === "en" ? "en" : "vi");
      const stored = parseCustomerConsentPreferences(
        window.localStorage.getItem(CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY),
      );
      if (stored) {
        setHasDecision(true);
        setAnalytics(stored.product_analytics === "granted");
        setMarketing(stored.marketing_communications === "granted");
      } else {
        setOpen(true);
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setLanguage(root.lang === "en" ? "en" : "vi");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open || !hasDecision) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasDecision, open]);

  async function save(nextAnalytics: boolean, nextMarketing: boolean) {
    setPending(true);
    setMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-consents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous_id: anonymousId,
          product_analytics: nextAnalytics,
          marketing_communications: nextMarketing,
        }),
      });
      const payload = (await response.json()) as ConsentResponse;
      if (!response.ok || !payload.accepted || !payload.consent) {
        throw new Error(
          payload.error?.message ??
            (language === "en"
              ? "We could not save your privacy choice."
              : "Chưa thể lưu lựa chọn quyền riêng tư."),
        );
      }
      window.localStorage.setItem(
        CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
        JSON.stringify(payload.consent),
      );
      setAnalytics(nextAnalytics);
      setMarketing(nextMarketing);
      setHasDecision(true);
      setOpen(false);
      window.dispatchEvent(new Event(CUSTOMER_CONSENT_CHANGED_EVENT));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : language === "en"
            ? "We could not save your privacy choice."
            : "Chưa thể lưu lựa chọn quyền riêng tư.",
      );
    } finally {
      setPending(false);
    }
  }

  /*
   * Dải quyền riêng tư nằm đè lên trang, nên phải chừa chỗ cho nó ở cuối
   * trang — nếu không, thứ nằm dưới cùng vĩnh viễn bị nó che.
   *
   * Đây là lỗi ĐO ĐƯỢC trên production 06/09/2026, không phải phòng xa: ở khổ
   * điện thoại, nút "Giữ chỗ 15 phút" của trang đặt chỗ nằm đúng dưới dải này
   * và bấm không ăn. Trang đặt chỗ vừa cao thêm vì có thêm phần chọn trả tại
   * điểm, thế là nút tụt xuống vừa đủ để lọt vào vùng bị che. Khách trên điện
   * thoại bấm mãi không được, mà **cửa duy nhất để đặt chỗ là cái nút ấy**.
   *
   * Đo chiều cao thật rồi chừa, chứ không đoán một con số: dải này cao thấp
   * khác nhau tuỳ khổ màn hình và tuỳ có dòng báo lỗi hay không.
   */
  useEffect(() => {
    const node = bannerRef.current;
    if (!node) return;
    const previous = document.body.style.paddingBottom;
    const root = document.documentElement;
    const previousBannerVisible = root.getAttribute(
      "data-nbj-consent-banner-visible",
    );
    root.setAttribute("data-nbj-consent-banner-visible", "true");
    const apply = () => {
      const offset = `${node.offsetHeight + 24}px`;
      document.body.style.paddingBottom = offset;
      // QA-P2-09: màn đầu trang chủ cao đúng một màn hình và dồn nút xuống đáy,
      // nên chừa ở cuối trang không cứu được nút "Lập hành trình" bị dải này
      // đè. Công bố chiều cao dải để màn đầu tự chừa chỗ.
      root.style.setProperty("--nbj-consent-offset", offset);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = previous;
      root.style.removeProperty("--nbj-consent-offset");
      if (previousBannerVisible === null) {
        root.removeAttribute("data-nbj-consent-banner-visible");
      } else {
        root.setAttribute(
          "data-nbj-consent-banner-visible",
          previousBannerVisible,
        );
      }
    };
  }, [ready, hasDecision, pathname]);

  if (!ready || !isCustomerConsentSurface(pathname)) return null;

  if (!hasDecision) {
    /*
      Dải mỏng, không phải tấm thẻ.
      Bản cũ là một thẻ ba tầng — nhãn in hoa, tiêu đề serif cỡ lớn, rồi một
      đoạn văn — cao gần 150px, nằm đè lên ảnh đầu trang ở cả desktop lẫn
      điện thoại, và theo suốt lúc cuộn. Soi ảnh chụp thật 21/09: thứ đầu
      tiên khách nhìn thấy khi mở web là một hộp xin phép, không phải Ninh
      Bình. Nội dung pháp lý giữ nguyên ý — vẫn nói rõ chỉ ghi nhận khi được
      đồng ý và đổi được bất cứ lúc nào — nhưng gói trong một dòng.
    */
    return (
      <aside ref={bannerRef} className="fixed inset-x-2 bottom-2 z-[1300] mx-auto max-w-3xl rounded-[22px] border border-white/16 bg-[#0f2a22]/92 px-4 py-3 text-white shadow-[0_18px_44px_rgba(3,16,12,.34)] backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:rounded-full sm:px-5 sm:py-2.5" aria-label={language === "en" ? "Privacy choice" : "Lựa chọn quyền riêng tư"}>
        {/*
          Tiêu đề giữ lại cho trình đọc màn hình. Bản rút gọn đầu tiên gỡ hẳn
          thẻ `h2` và thế là dải mất tên gọi trong cây trợ năng — bài
          `customer-progressive-identity.spec.ts` bắt đỏ ngay. Thu gọn phần
          NHÌN THẤY là một chuyện; bỏ luôn cái tên của một vùng giao diện lại
          là chuyện khác.
        */}
        <h2 className="sr-only">
          {language === "en" ? "May we learn what is useful?" : "Cho phép ghi nhận nội dung hữu ích?"}
        </h2>
        {/* Ở 390px, để chữ và nút cùng một hàng thì chữ chỉ còn ~90px và vỡ
            thành bốn dòng chen giữa hai nút. Xếp dọc ở khổ hẹp, ngang từ `sm`. */}
        <div className="flex min-w-0 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-x-3">
          <p className="min-w-0 flex-1 text-center text-[0.78rem] leading-5 text-white/80 sm:text-left sm:text-sm">
            {language === "en"
              ? "We only record how this site is used if you allow it."
              : "Chỉ khi bạn đồng ý, website mới ghi nhận cách nội dung được dùng."}{" "}
            <Link href="/quyen-rieng-tu" className="font-semibold text-white/92 underline underline-offset-2">
              {language === "en" ? "Details" : "Chi tiết"}
            </Link>
          </p>
          <span className="flex shrink-0 items-center justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => void save(false, false)} className="min-h-10 rounded-full border border-white/30 px-3.5 text-xs font-bold disabled:opacity-50 sm:text-sm">
              {language === "en" ? "Essential only" : "Chỉ cần thiết"}
            </button>
            <button type="button" disabled={pending} onClick={() => void save(true, false)} className="min-h-10 rounded-full bg-[#e7c78d] px-4 text-xs font-extrabold text-[#183f34] disabled:opacity-50 sm:text-sm">
              {pending ? (language === "en" ? "Saving…" : "Đang lưu…") : language === "en" ? "Allow" : "Đồng ý"}
            </button>
          </span>
        </div>
        {message ? <p className="mt-2 text-center text-sm text-[#ffd9d1]" role="alert">{message}</p> : null}
      </aside>
    );
  }

  return (
    <>
      {/* QA-P2-09: nút nổi nhường chỗ khi đang cuộn xuống đọc hoặc đang gõ. */}
      <button type="button" onClick={() => setOpen(true)} aria-hidden={nhuongCho && !open ? true : undefined} tabIndex={nhuongCho && !open ? -1 : undefined} className={`fixed bottom-3 left-3 z-[1200] min-h-9 rounded-full border border-[#b9c5bf] bg-white/92 px-3 text-[0.68rem] font-bold text-[#29463b] shadow-md backdrop-blur transition duration-200 motion-reduce:transition-none ${nhuongCho && !open ? FLOATING_YIELD_CLASS : ""}`} aria-label={language === "en" ? "Open privacy settings" : "Mở trung tâm quyền riêng tư"}>
        {language === "en" ? "Privacy" : "Riêng tư"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-[#0f1b17]/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-consent-title" className="w-full max-w-xl rounded-3xl bg-[#fbfaf6] p-6 text-[#17251f] shadow-2xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#5b766b]">{language === "en" ? "Change this at any time" : "Có thể đổi bất cứ lúc nào"}</p>
                <h2 id="customer-consent-title" className="font-display mt-2 text-3xl text-[#183f34]">{language === "en" ? "Your privacy" : "Quyền riêng tư của bạn"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-[#cbd2cd]" aria-label={language === "en" ? "Close" : "Đóng"}>×</button>
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex gap-4 rounded-2xl border border-[#d8ded9] bg-white p-4">
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-5 w-5 accent-[#27634f]" />
                <span><strong className="block">{language === "en" ? "Improve the experience" : "Giúp cải thiện trải nghiệm"}</strong><span className="mt-1 block text-sm leading-6 text-[#637068]">{language === "en" ? "Shows us which content is useful so we can organise the website and suggestions better." : "Cho biết nội dung nào hữu ích để chúng tôi sắp xếp website và gợi ý tốt hơn."}</span></span>
              </label>
              <label className="flex gap-4 rounded-2xl border border-[#d8ded9] bg-white p-4">
                <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 h-5 w-5 accent-[#27634f]" />
                <span><strong className="block">{language === "en" ? "Receive relevant suggestions" : "Nhận gợi ý phù hợp"}</strong><span className="mt-1 block text-sm leading-6 text-[#637068]">{language === "en" ? "Used only when you actively leave contact details and enable this choice." : "Chỉ dùng khi bạn chủ động để lại liên hệ và bật lựa chọn này."}</span></span>
              </label>
            </div>
            {message ? <p className="mt-4 rounded-xl bg-[#fff0ef] p-3 text-sm text-[#8f2f2c]" role="alert">{message}</p> : null}
            <Link href="/quyen-rieng-tu" className="mt-4 inline-block text-xs font-bold text-[#456257] underline underline-offset-2">{language === "en" ? "Read the data notice" : "Xem thông báo xử lý dữ liệu"}</Link>
            <button type="button" disabled={pending} onClick={() => void save(analytics, marketing)} className="mt-6 min-h-12 w-full rounded-full bg-[#183f34] px-5 font-extrabold text-white disabled:opacity-50">
              {pending ? (language === "en" ? "Saving…" : "Đang lưu…") : language === "en" ? "Save choices" : "Lưu lựa chọn"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
