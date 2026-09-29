"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { endRoleSwitchAction } from "@/app/erp/actions";
import { DIEM_SAU_KHI_BAM, duongDenBuoc, timMucDangChi } from "@/domain/huong-dan";
import { ghiDaMo } from "@/lib/huong-dan-da-mo";

/**
 * Khoanh đúng chỗ cần bấm khi người dùng tới từ màn Hướng dẫn (`?chi=<việc>`),
 * cùng một thẻ nhỏ ở góc: bây giờ bấm gì, về hướng dẫn, sang bước tiếp.
 *
 * Phần tử đích tự khai bằng `data-chi="<điểm>"`, có thể kèm `data-chi-loi` là
 * câu "bây giờ bấm gì" của đúng trạng thái đó. Màn đổi trạng thái (giữ chỗ,
 * lấy QR, trả tiền…) thì `data-chi` dời sang nút mới, và thẻ theo sang nhờ
 * một `MutationObserver`. Không trỏ theo toạ độ, nên đổi bố cục không vỡ.
 *
 * Kịch bản ở `domain/huong-dan.ts`.
 */

const LOP_SANG = "chi-diem-sang";
const DIEM_HOP_LE = /^[a-z0-9-]{1,40}$/;
/** Chờ bao lâu mới nói "chưa thấy": dữ liệu một số màn tải sau lượt vẽ đầu. */
const CHO_TIM_MS = 5000;

function hienTrenMan(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function ChiDiem({ dangChuyenVai = false }: { dangChuyenVai?: boolean }) {
  const params = useSearchParams();
  const chi = params.get("chi");
  // Ghi nhớ theo chuỗi `chi`: mỗi lượt dựng mà ra đối tượng mới thì effect
  // khoanh chạy lại liên tục và trang cứ bị cuộn về điểm khoanh.
  const muc = useMemo(() => timMucDangChi(chi), [chi]);
  const diemXin = params.get("diem");
  const diem = muc ? (diemXin && DIEM_HOP_LE.test(diemXin) ? diemXin : muc.diem) : null;

  const [dong, setDong] = useState(false);
  const [moRong, setMoRong] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [thay, setThay] = useState<"dang-tim" | "thay" | "khong-thay">("dang-tim");
  const [thuGon, setThuGon] = useState(false);
  const dangSang = useRef<Element | null>(null);

  // Đổi việc (bấm "Bước tiếp") thì mở lại thẻ. Đặt state khi đang dựng theo
  // mẫu "lưu giá trị trước" của React, không cần effect.
  const khoaViec = `${muc?.id ?? ""}|${diem ?? ""}`;
  const [khoaCu, setKhoaCu] = useState(khoaViec);
  if (khoaCu !== khoaViec) {
    setKhoaCu(khoaViec);
    setDong(false);
    setMoRong(false);
    setThuGon(false);
    setLoi(null);
    setThay("dang-tim");
  }

  useEffect(() => {
    if (muc) ghiDaMo(muc.id);
  }, [muc]);

  useEffect(() => {
    if (!diem || dong) return;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let khung = 0;

    const tat = () => {
      dangSang.current?.classList.remove(LOP_SANG);
      dangSang.current = null;
    };

    const tim = () => {
      khung = 0;
      const ungVien = [...document.querySelectorAll(`[data-chi="${diem}"]`)].find(hienTrenMan) ?? null;
      if (ungVien === dangSang.current) {
        // Cùng phần tử nhưng câu dặn có thể đã đổi theo trạng thái.
        if (ungVien) setLoi(ungVien.getAttribute("data-chi-loi"));
        return;
      }
      tat();
      if (!ungVien) return;
      ungVien.classList.add(LOP_SANG);
      dangSang.current = ungVien;
      setLoi(ungVien.getAttribute("data-chi-loi"));
      setThay("thay");
      ungVien.scrollIntoView({ block: "center", behavior: giamChuyenDong ? "auto" : "smooth" });
    };

    const hen = () => {
      if (!khung) khung = window.requestAnimationFrame(tim);
    };
    tim();
    const quanSat = new MutationObserver(hen);
    quanSat.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-chi", "data-chi-loi"],
    });
    const hetCho = window.setTimeout(() => {
      if (!dangSang.current) setThay("khong-thay");
    }, CHO_TIM_MS);

    // Bấm vào đúng đường dẫn đang khoanh mà màn kế tiếp còn điểm cần khoanh
    // (mã vé → nút xác thực ở màn soát vé): gửi kèm việc đang làm theo.
    const diemKe = DIEM_SAU_KHI_BAM[diem];
    const khiBam = (event: MouseEvent) => {
      if (!diemKe || !muc || !dangSang.current) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !dangSang.current.contains(link)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      url.searchParams.set("chi", muc.id);
      url.searchParams.set("diem", diemKe);
      link.href = url.toString();
    };
    document.addEventListener("click", khiBam, true);

    return () => {
      if (khung) window.cancelAnimationFrame(khung);
      quanSat.disconnect();
      window.clearTimeout(hetCho);
      document.removeEventListener("click", khiBam, true);
      tat();
    };
  }, [diem, dong, muc]);

  if (!muc || dong) return null;

  const cauBayGio =
    thay === "khong-thay"
      ? "Chưa thấy chỗ cần bấm trên màn này, có thể vì chưa có dữ liệu. Mời bạn làm theo các bước bên dưới."
      : (loi ?? muc.cacViec[0]);
  // Không thấy điểm thì các bước là thứ duy nhất còn dẫn đường: mở sẵn.
  const hienCacBuoc = moRong || thay === "khong-thay";
  const ke = muc.vong?.ke ?? null;
  const nutPhu =
    "inline-flex min-h-11 items-center rounded-lg border border-[#ced8d1] bg-white px-3 text-sm font-black text-[#35594b]";

  return (
    <aside
      data-testid="chi-diem"
      data-thay={thay}
      aria-label={`Hướng dẫn: ${muc.ten}`}
      className="fixed inset-x-3 bottom-3 z-[45] rounded-2xl border-2 border-[#d58c35] bg-white p-3 text-[#20342c] shadow-2xl shadow-[#0d2a22]/25 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[23rem] sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Chạm tiêu đề là thu thẻ về một dòng, chạm lần nữa là mở lại: thẻ
            đè lên chỗ cần đọc thì người dùng tự dẹp được, không phải tắt hẳn. */}
        <button
          type="button"
          onClick={() => setThuGon((truoc) => !truoc)}
          aria-expanded={!thuGon}
          className="min-h-11 min-w-0 flex-1 text-left"
        >
          <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#9a6328]">
            Hướng dẫn{muc.vong ? ` · Bước ${muc.vong.thuTu}/${muc.vong.tong}` : ""}
            <span aria-hidden="true" className="ml-1.5">{thuGon ? "▴" : "▾"}</span>
          </span>
          <span className="block truncate font-black">{muc.ten}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDong(true);
            const url = new URL(window.location.href);
            url.searchParams.delete("chi");
            url.searchParams.delete("diem");
            window.history.replaceState(null, "", url.toString());
          }}
          aria-label="Tắt hướng dẫn"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d4ddd7] text-xl text-[#42554c]"
        >
          ×
        </button>
      </div>

      {thuGon ? null : (
        <>
          <p role="status" className="mt-1 rounded-xl bg-[#fff6e8] px-3 py-2 text-sm leading-6 text-[#5d4420]">
            <span className="font-black">Bây giờ: </span>
            {cauBayGio}
          </p>
          {hienCacBuoc ? (
            <ol className="mt-2 space-y-1.5 text-sm leading-6 text-[#34483f]">
              {muc.cacViec.map((viec, index) => (
                <li key={viec} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#183f34] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>{viec}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dangChuyenVai ? (
              <form action={endRoleSwitchAction}>
                <input type="hidden" name="next" value="/erp/huong-dan" />
                <button type="submit" className={nutPhu}>
                  ← Về giám đốc, mở hướng dẫn
                </button>
              </form>
            ) : (
              <Link href="/erp/huong-dan" className={nutPhu}>
                ← Hướng dẫn
              </Link>
            )}
            {ke ? (
              <Link
                href={duongDenBuoc(ke)}
                className="inline-flex min-h-11 items-center rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
              >
                Sang bước {ke.thuTu} →
              </Link>
            ) : muc.vong ? (
              <Link
                href="/erp/huong-dan"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
              >
                Xong vòng khách ✓
              </Link>
            ) : null}
            {hienCacBuoc ? null : (
              <button
                type="button"
                onClick={() => setMoRong(true)}
                className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-[#5f7068] underline underline-offset-4"
              >
                Đủ các bước
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
