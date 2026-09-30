"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
  CUSTOMER_CONSENT_CHANGED_EVENT,
  parseCustomerConsentPreferences,
} from "@/lib/customer-data/browser-tracking";

type ContactResponse = {
  accepted?: boolean;
  delivery_status?: "staged";
  contact_type?: "email" | "phone";
  marketing_status?: "granted" | "denied" | "revoked";
  marketing_policy_version?: string;
  error?: { message?: string };
};

export function JourneyContactVault({ journeyId, lang = "vi" }: { journeyId: string; lang?: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [contact, setContact] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer-contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          journey_id: journeyId,
          contact,
          marketing_communications: marketing,
        }),
      });
      const payload = (await response.json()) as ContactResponse;
      if (!response.ok || !payload.accepted) {
        throw new Error(payload.error?.message ?? t("Chưa thể lưu cách nhận hành trình.", "Could not save how to get your plan back."));
      }

      const current = parseCustomerConsentPreferences(
        window.localStorage.getItem(CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY),
      );
      if (current && payload.marketing_status) {
        window.localStorage.setItem(
          CUSTOMER_ANALYTICS_CONSENT_STORAGE_KEY,
          JSON.stringify({
            ...current,
            essential_service: "granted",
            marketing_communications: payload.marketing_status,
            marketing_policy_version:
              payload.marketing_policy_version ?? current.marketing_policy_version,
          }),
        );
        window.dispatchEvent(new Event(CUSTOMER_CONSENT_CHANGED_EVENT));
      }
      setSaved(true);
      setContact("");
      setMessage(
        payload.contact_type === "phone"
          ? t("Đã lưu số điện thoại đã bảo vệ cho hành trình này. Bản thử nghiệm chưa gửi SMS thật.", "Saved your protected phone number for this plan. This trial does not send real SMS yet.")
          : t("Đã lưu email đã bảo vệ cho hành trình này. Bản thử nghiệm chưa gửi email thật.", "Saved your protected email for this plan. This trial does not send real email yet."),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Chưa thể lưu cách nhận hành trình.", "Could not save how to get your plan back."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#c8d8d0] bg-[#f7faf8] p-5 sm:p-6" data-customer-section="journey-contact">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#56766a]">{t("Giữ lại hành trình", "Keep this plan")}</p>
      <h3 className="font-display mt-2 text-2xl text-[#183f34]">{t("Một cách liên hệ, do bạn tự chọn.", "One way to reach you, your choice.")}</h3>
      <p className="mt-2 text-sm leading-6 text-[#596b63]">
        {t("Nhập email hoặc số điện thoại để lưu yêu cầu nhận lại hành trình. Liên hệ được bảo vệ riêng; quyền phục vụ không tự biến thành quyền nhận giới thiệu.", "Enter an email or phone number to get this plan back later. It is protected separately; letting us serve you never turns into permission to market to you.")}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-[#29463b]">
          {t("Email hoặc số điện thoại", "Email or phone")}
          <input
            type="text"
            inputMode="email"
            autoComplete="email tel"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder={t("ten@example.com hoặc 09…", "you@example.com or +84…")}
            required
            minLength={6}
            maxLength={254}
            className="mt-2 min-h-12 w-full rounded-2xl border border-[#bdcbc4] bg-white px-4 font-normal outline-none focus:border-[#27634f]"
          />
        </label>
        <label className="flex gap-3 rounded-2xl bg-white p-4 text-sm leading-6 text-[#4f6259]">
          <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#27634f]" />
          <span><strong className="block text-[#29463b]">{t("Tôi muốn nhận thông tin giới thiệu phù hợp", "I would like relevant suggestions")}</strong>{t("Mặc định tắt. Có thể rút lại ở nút “Quyền riêng tư” bất cứ lúc nào.", "Off by default. Withdraw any time with the “Privacy” button.")}</span>
        </label>
        <p className="text-xs leading-5 text-[#687970]">
          {t("Khi lưu, bạn đồng ý Xuân Trường xử lý liên hệ để giữ yêu cầu hành trình này. Xem", "By saving, you agree that Xuan Truong processes this contact to keep your plan. See the")}{" "}
          <Link href="/quyen-rieng-tu" className="font-bold underline underline-offset-2">{t("thông báo xử lý dữ liệu", "data notice")}</Link>.
        </p>
        <button type="submit" disabled={pending || saved || contact.trim().length < 6} className="min-h-12 w-full rounded-full bg-[#183f34] px-5 font-extrabold text-white disabled:opacity-50">
          {pending ? t("Đang bảo vệ và lưu…", "Protecting and saving…") : saved ? t("Đã lưu yêu cầu", "Saved") : t("Lưu cách nhận hành trình", "Save how to reach me")}
        </button>
      </form>
      {message ? <p className={`mt-4 rounded-xl p-3 text-sm ${saved ? "bg-[#e8f3ed] text-[#24513f]" : "bg-[#fff0ef] text-[#8f2f2c]"}`} role="status">{message}</p> : null}
    </section>
  );
}
