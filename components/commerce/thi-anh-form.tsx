"use client";

import { useState } from "react";
import { DIA_DIEM_THI_ANH, tenGiai } from "@/domain/thi-anh";

type AnhCuaToi = { thang: string; dauMa: string; chuThich: string; trangThai: string; giai: string | null; maNhan: string | null };

type Lang = "vi" | "en";

/** Thu ảnh về cạnh dài 1600px, JPEG 0,85: ảnh điện thoại 8–12 MB còn khoảng 0,5 MB. */
async function thuNho(tep: File): Promise<File> {
  if (!tep.type.startsWith("image/")) return tep;
  try {
    const bitmap = await createImageBitmap(tep);
    const ti = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ti);
    canvas.height = Math.round(bitmap.height * ti);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "anh.jpg", { type: "image/jpeg" }) : tep;
  } catch {
    return tep;
  }
}

export function ThiAnhForm({ lang = "vi" }: { lang?: Lang }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [tep, setTep] = useState<File | null>(null);
  const [xem, setXem] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [soTra, setSoTra] = useState("");
  const [cuaToi, setCuaToi] = useState<AnhCuaToi[] | null>(null);

  async function chonAnh(f: File | undefined) {
    if (!f) return;
    const nho = await thuNho(f);
    setTep(nho);
    setXem(URL.createObjectURL(nho));
  }

  async function gui(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setThongBao(null);
    // Giữ lại thẻ form: sau await, React đã nhả sự kiện nên e.currentTarget là null.
    const theForm = e.currentTarget;
    // Ô chọn ảnh không có name: chỉ gửi ảnh đã thu nhỏ, không kèm ảnh gốc (Vercel nhận tối đa 4,5 MB mỗi yêu cầu).
    const form = new FormData(theForm);
    if (!tep) {
      setThongBao({ ok: false, chu: t("Mời bạn chọn một ảnh.", "Please pick a photo.") });
      return;
    }
    form.set("anh", tep);
    setDang(true);
    try {
      const res = await fetch("/api/thi-anh", { method: "POST", credentials: "same-origin", body: form });
      const json = (await res.json().catch(() => ({}))) as { accepted?: boolean; error?: { message?: string } };
      if (res.status === 413) throw new Error(t("Ảnh lớn quá, chọn ảnh dưới 4 MB.", "The photo is too large; pick one under 4 MB."));
      if (!res.ok || !json.accepted) throw new Error(json.error?.message ?? t("Chưa gửi được, xin thử lại.", "Could not send, please try again."));
      setThongBao({ ok: true, chu: t("Đã nhận ảnh. Ảnh hiện ở trang này sau khi ban tổ chức duyệt.", "Photo received. It appears here once approved.") });
      theForm.reset();
      setTep(null);
      setXem(null);
    } catch (error) {
      setThongBao({ ok: false, chu: error instanceof Error ? error.message : String(error) });
    } finally {
      setDang(false);
    }
  }

  async function tra(e: React.FormEvent) {
    e.preventDefault();
    setCuaToi(null);
    const res = await fetch("/api/thi-anh", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hanh_dong: "cua-toi", so_dien_thoai: soTra }),
    });
    const json = (await res.json().catch(() => ({}))) as { accepted?: boolean; anh?: AnhCuaToi[]; error?: { message?: string } };
    if (json.accepted) setCuaToi(json.anh ?? []);
    else setThongBao({ ok: false, chu: json.error?.message ?? t("Chưa tra được.", "Could not look up.") });
  }

  const nhanTrangThai = (s: string) =>
    s === "da-duyet" ? t("Đã duyệt", "Approved") : s === "tu-choi" ? t("Không dùng", "Not used") : t("Chờ duyệt", "Awaiting review");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <form onSubmit={gui} className="rounded-3xl bg-white p-6 shadow-sm" data-testid="form-thi-anh">
        <h2 className="font-display text-2xl text-[#183f34]">{t("Gửi ảnh dự thi", "Enter a photo")}</h2>
        <label className="mt-4 block text-sm font-bold text-[#27362f]">
          {t("Ảnh", "Photo")}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chonAnh(e.target.files?.[0])} className="mt-1 block w-full rounded-xl border border-[#bec7bf] p-2 text-sm" />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước tạo tại chỗ */}
        {xem ? <img src={xem} alt={t("Ảnh sắp gửi", "Photo to send")} className="mt-3 max-h-64 rounded-xl object-contain" /> : null}
        <label className="mt-3 block text-sm font-bold text-[#27362f]">
          {t("Chụp ở đâu", "Where")}
          <select name="dau_ma" required className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-3 font-normal">
            {DIA_DIEM_THI_ANH.map((d) => <option key={d.ma} value={d.ma}>{d[lang]}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-bold text-[#27362f]">
          {t("Tên hiển thị dưới ảnh", "Name shown under the photo")}
          <input name="ten" required maxLength={60} className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] px-4 font-normal" />
        </label>
        <label className="mt-3 block text-sm font-bold text-[#27362f]">
          {t("Vài dòng về ảnh (không bắt buộc)", "A line about the photo (optional)")}
          <input name="chu_thich" maxLength={300} className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] px-4 font-normal" />
        </label>
        <label className="mt-3 block text-sm font-bold text-[#27362f]">
          {t("Số điện thoại (để báo giải, không hiện công khai)", "Phone number (to notify winners, never shown)")}
          <input name="so_dien_thoai" inputMode="tel" required className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] px-4 font-normal" />
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-[#27362f]">
          <input type="checkbox" name="dong_y_the_le" value="co" required className="mt-1 size-5 shrink-0" />
          <span>{t("Tôi đồng ý thể lệ và cho dùng số này để liên hệ khi trúng giải.", "I accept the rules and agree to be contacted on this number if I win.")}</span>
        </label>
        <label className="mt-2 flex items-start gap-3 text-sm leading-6 text-[#27362f]">
          <input type="checkbox" name="dong_y_tiep_thi" value="co" className="mt-1 size-5 shrink-0" />
          <span>{t("Báo tôi các cuộc thi và ưu đãi sau này (không bắt buộc).", "Tell me about future contests and offers (optional).")}</span>
        </label>
        <button type="submit" disabled={dang} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#183f34] px-6 font-extrabold text-white disabled:opacity-60 sm:w-auto">
          {dang ? t("Đang gửi…", "Sending…") : t("Gửi ảnh", "Send photo")}
        </button>
        {thongBao ? (
          <p role="status" data-testid="thong-bao-thi-anh" className={`mt-3 rounded-xl p-3 text-sm font-bold ${thongBao.ok ? "bg-[#dceadd] text-[#183f34]" : "bg-[#f6d2be] text-[#8a3a12]"}`}>{thongBao.chu}</p>
        ) : null}
      </form>

      <form onSubmit={tra} className="h-fit rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6">
        <h2 className="font-display text-2xl text-[#183f34]">{t("Ảnh của tôi, mã nhận giải", "My photos and claim code")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={soTra} onChange={(e) => setSoTra(e.target.value)} inputMode="tel" required aria-label={t("Số điện thoại đã gửi ảnh", "Phone number used")} className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bec7bf] bg-white px-4" />
          <button type="submit" className="min-h-12 rounded-full border border-[#183f34] px-5 font-extrabold text-[#183f34]">{t("Tra", "Check")}</button>
        </div>
        {cuaToi ? (
          cuaToi.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b786f]">{t("Số này chưa gửi ảnh nào.", "No photos from this number yet.")}</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm" data-testid="anh-cua-toi">
              {cuaToi.map((a, i) => (
                <li key={`${a.thang}-${i}`} className="rounded-xl bg-white p-3">
                  <span className="font-bold">{a.thang}</span> · {DIA_DIEM_THI_ANH.find((d) => d.ma === a.dauMa)?.[lang] ?? a.dauMa} · {nhanTrangThai(a.trangThai)}
                  {a.giai ? (
                    <span className="mt-1 block font-bold text-[#8a5a1f]">
                      {tenGiai(a.giai, lang)} · {t("mã nhận giải", "claim code")} <span className="font-mono">{a.maNhan}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </form>
    </div>
  );
}
