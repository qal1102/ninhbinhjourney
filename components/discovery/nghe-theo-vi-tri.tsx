"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ThuyetMinh } from "@/components/discovery/thuyet-minh";
import {
  BAN_KINH_DANG_O_M,
  docKhoangCach,
  noiDangO,
  xepTheoKhoangCach,
  type DiemNghe,
} from "@/domain/thuyet-minh-vi-tri";
import type { NgonNgu } from "@/lib/ngon-ngu";

type DinhVi =
  | { loai: "chua" }
  | { loai: "dang-tim" }
  | { loai: "co"; viTri: readonly [number, number]; saiSo: number }
  | { loai: "tu-choi" }
  | { loai: "loi" };

/**
 * Thuyết minh theo vị trí. Khách bấm "Bật định vị" một lần (cú bấm ấy cũng là
 * điều kiện để trình duyệt cho phép đọc thành tiếng); từ đó, bước vào vùng
 * 1,5 km quanh nơi nào thì máy đọc câu chuyện nơi ấy, mỗi nơi một lần. Toạ độ
 * chỉ nằm trên máy khách: trang không gửi vị trí đi đâu cả.
 */
export function NgheTheoViTri({ diem, lang, children }: { diem: DiemNghe[]; lang: NgonNgu; children?: ReactNode }) {
  const t = useCallback((vi: string, en: string) => (lang === "en" ? en : vi), [lang]);
  const [dinhVi, setDinhVi] = useState<DinhVi>({ loai: "chua" });
  const [chonTay, setChonTay] = useState<string | null>(null);
  const [tuDoc, setTuDoc] = useState(true);
  const [tuDocId, setTuDocId] = useState<string | null>(null);
  const noiTruoc = useRef<string | null>(null);
  const theoDoi = useRef<number | null>(null);
  const tuDocRef = useRef(tuDoc);
  useEffect(() => {
    tuDocRef.current = tuDoc;
  }, [tuDoc]);

  useEffect(
    () => () => {
      if (theoDoi.current !== null) navigator.geolocation?.clearWatch(theoDoi.current);
    },
    [],
  );

  function batDinhVi() {
    if (!("geolocation" in navigator)) return setDinhVi({ loai: "loi" });
    setDinhVi({ loai: "dang-tim" });
    if (theoDoi.current !== null) navigator.geolocation.clearWatch(theoDoi.current);
    theoDoi.current = navigator.geolocation.watchPosition(
      (pos) => {
        const viTri = [pos.coords.latitude, pos.coords.longitude] as const;
        setDinhVi({ loai: "co", viTri, saiSo: pos.coords.accuracy });
        const noi = noiDangO(diem, viTri);
        const id = noi?.diem.id ?? null;
        if (id !== noiTruoc.current) {
          noiTruoc.current = id;
          // Tới nơi mới: bỏ lựa chọn tay để thuyết minh theo chân khách.
          setChonTay(null);
          setTuDocId(id && tuDocRef.current ? id : null);
        }
      },
      (err) => setDinhVi({ loai: err.code === err.PERMISSION_DENIED ? "tu-choi" : "loi" }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }

  const viTri = dinhVi.loai === "co" ? dinhVi.viTri : null;
  const danhSach = viTri ? xepTheoKhoangCach(diem, viTri) : diem.map((d) => ({ diem: d, met: null as number | null }));
  const dangO = viTri ? noiDangO(diem, viTri) : null;
  const idHien = chonTay ?? dangO?.diem.id ?? null;
  const hien = idHien ? diem.find((d) => d.id === idHien) ?? null : null;

  return (
    <div className="mx-auto max-w-2xl" data-testid="nghe-theo-vi-tri">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
          {t("Ninh Bình Journey · Thuyết minh", "Ninh Binh Journey · Audio guide")}
        </p>
        {children}
      </div>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
        {t("Tới nơi nào, nghe chuyện nơi ấy", "Hear each place as you arrive")}
      </h1>
      <p className="mt-3 leading-7 text-[#4d5b55]">
        {t(
          "Bật định vị rồi cứ đi. Bước vào khu nào trong mười lăm điểm đến, máy đọc câu chuyện của nơi đó. Đeo tai nghe là nghe được trên thuyền, trên đường lên chùa.",
          "Turn on location and keep walking. Step into any of the fifteen places and your phone tells its story. Put in earphones and listen on the boat or on the climb.",
        )}
      </p>

      <section className="mt-6 rounded-3xl border border-[#d7d5cd] bg-white p-5" aria-label={t("Định vị", "Location")}>
        {dinhVi.loai === "chua" || dinhVi.loai === "tu-choi" || dinhVi.loai === "loi" ? (
          <>
            <button
              type="button"
              onClick={batDinhVi}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#183f34] px-6 font-extrabold text-white"
            >
              {t("Bật định vị", "Turn on location")}
            </button>
            <p role="status" className="mt-3 text-sm leading-6 text-[#59654b]">
              {dinhVi.loai === "tu-choi"
                ? t(
                    "Máy chưa cho trang dùng vị trí. Bạn mở quyền vị trí cho trình duyệt rồi bấm lại, hoặc chọn nơi bạn đang đứng ở danh sách dưới.",
                    "Location access is off. Allow it for your browser and tap again, or pick where you are from the list below.",
                  )
                : dinhVi.loai === "loi"
                  ? t("Chưa lấy được vị trí. Bạn thử lại, hoặc chọn nơi ở danh sách dưới.", "Couldn't get your location. Try again, or pick a place below.")
                  : t("Vị trí chỉ dùng trên máy bạn để tìm nơi gần nhất, không gửi đi đâu.", "Your location stays on your phone; it is only used to find the nearest place.")}
            </p>
          </>
        ) : dinhVi.loai === "dang-tim" ? (
          <p role="status" className="font-bold text-[#183f34]">{t("Đang tìm vị trí của bạn…", "Finding your location…")}</p>
        ) : (
          <div role="status" data-testid="dang-o">
            <p className="font-bold text-[#183f34]">
              {dangO
                ? t(`Bạn đang ở ${dangO.diem.ten}`, `You're at ${dangO.diem.ten}`)
                : t(
                    `Chưa ở trong khu nào (gần nhất: ${danhSach[0]?.diem.ten}, ${docKhoangCach(danhSach[0]?.met ?? 0, lang)})`,
                    `Not inside any place yet (nearest: ${danhSach[0]?.diem.ten}, ${docKhoangCach(danhSach[0]?.met ?? 0, lang)})`,
                  )}
            </p>
            <p className="mt-1 text-sm text-[#59654b]">
              {dangO
                ? t(`Cách tâm khu ${docKhoangCach(dangO.met, lang)}.`, `${docKhoangCach(dangO.met, lang)} from its centre.`)
                : t(
                    `Bước vào vùng ${docKhoangCach(BAN_KINH_DANG_O_M, lang)} quanh một nơi là máy đọc.`,
                    `Come within ${docKhoangCach(BAN_KINH_DANG_O_M, lang)} of a place and it starts.`,
                  )}
            </p>
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold text-[#42554c]">
              <input type="checkbox" checked={tuDoc} onChange={(e) => setTuDoc(e.target.checked)} className="h-5 w-5 accent-[#183f34]" />
              {t("Tới nơi mới thì tự đọc", "Read automatically at each new place")}
            </label>
          </div>
        )}
      </section>

      {hien ? (
        <div data-testid="dang-nghe" data-diem={hien.id}>
          <ThuyetMinh key={hien.id} ten={hien.ten} doan={hien.doan} lang={lang} tuDong={tuDocId === hien.id} loiNghe={false} />
          <Link href={`/destination/${hien.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#245b45] underline underline-offset-4">
            {t(`Xem trang ${hien.ten} →`, `Open the ${hien.ten} page →`)}
          </Link>
        </div>
      ) : null}

      <section className="mt-8" aria-labelledby="cac-noi">
        <h2 id="cac-noi" className="text-lg font-extrabold text-[#183f34]">
          {viTri ? t("Các nơi quanh bạn", "Places around you") : t("Hoặc chọn nơi bạn đang đứng", "Or pick where you are")}
        </h2>
        <ul className="mt-3 divide-y divide-[#e3e0d8] rounded-2xl border border-[#d7d5cd] bg-white">
          {danhSach.map(({ diem: d, met }) => (
            <li key={d.id}>
              <button
                type="button"
                aria-pressed={idHien === d.id}
                onClick={() => {
                  setChonTay(d.id);
                  setTuDocId(null);
                }}
                className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left ${idHien === d.id ? "bg-[#edf3f0]" : ""}`}
              >
                <span className="font-bold text-[#183f34]">{d.ten}</span>
                {met !== null ? <span className="shrink-0 text-sm text-[#59654b]">{docKhoangCach(met, lang)}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
