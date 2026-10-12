"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  baoKhanCapAction,
  ghiDaGoiAction,
  nhacLaiBaoDongAction,
  xemBaoDongAction,
} from "@/app/erp/khan-cap-actions";
import {
  GIAY_CHO_TRUOC_KHI_GOI,
  LOAI_KHAN_CAP,
  SO_KHAN_CAP_QUOC_GIA,
  duongGoi,
  giayDaQua,
  nguoiSeGoi,
  tenLoaiKhanCap,
  type BaoDong,
  type LoaiKhanCap,
} from "@/domain/khan-cap";

/**
 * Báo khẩn cấp từ hiện trường (12/10/2026, migration 121): một nút đỏ trên
 * thanh đầu ERP. Mở ra là máy tự lấy vị trí; chạm một loại việc, chụp ảnh nếu
 * kịp, gửi. Sau đó máy đếm 2 phút: cấp trên chưa bấm "Đã nhận" thì máy tự mở
 * cuộc gọi tới quản lý cơ sở (hay giám đốc) có số trong Hồ sơ. Đóng hộp vẫn
 * theo dõi, và đổi trang vẫn theo dõi (mã báo động giữ trong sessionStorage).
 */

const KHOA_PHIEN = "nbj-khan-cap-dang-cho";
const HOI_MS = 4000;

type Vitri = { trangThai: "dang-lay" | "co" | "khong"; viDo?: number; kinhDo?: number; saiSo?: number };

function khoaYeuCau() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `kc-${crypto.randomUUID()}` : `kc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mmss(giay: number) {
  const g = Math.max(0, giay);
  return `${Math.floor(g / 60)}:${String(g % 60).padStart(2, "0")}`;
}

function gio(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

/** Thu ảnh về JPEG cạnh dài 1280px để gửi nhanh qua 3G/4G yếu. */
async function thuNhoAnh(tep: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(tep);
    const tiLe = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * tiLe);
    c.height = Math.round(bmp.height * tiLe);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    return blob ? new File([blob], "hien-truong.jpg", { type: "image/jpeg" }) : tep;
  } catch {
    return tep;
  }
}

export function BaoKhanCap({
  sites,
  siteMacDinh,
}: {
  sites: { id: string; name: string }[];
  siteMacDinh?: string;
}) {
  const hop = useRef<HTMLDialogElement>(null);
  const [siteId, setSiteId] = useState(siteMacDinh && sites.some((s) => s.id === siteMacDinh) ? siteMacDinh : sites[0]?.id ?? "");
  const [loai, setLoai] = useState<LoaiKhanCap | null>(null);
  const [ghiChu, setGhiChu] = useState("");
  const [anh, setAnh] = useState<File | null>(null);
  const [vitri, setVitri] = useState<Vitri>({ trangThai: "dang-lay" });
  const [loi, setLoi] = useState("");
  const [dangGui, batDauGui] = useTransition();
  const [baoDong, setBaoDong] = useState<BaoDong | null>(null);
  const [lech, setLech] = useState(0);
  const [bayGio, setBayGio] = useState(0);
  const [khoa, setKhoa] = useState(khoaYeuCau);
  const daGoi = useRef(false);
  const daNhac = useRef(false);
  const theoDoi = useRef<number | null>(null);

  // Lấy vị trí ngay khi mở hộp; GPS tốt dần thì giữ bản chính xác nhất.
  const layViTri = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setVitri({ trangThai: "khong" });
      return;
    }
    setVitri((v) => (v.trangThai === "co" ? v : { trangThai: "dang-lay" }));
    if (theoDoi.current !== null) navigator.geolocation.clearWatch(theoDoi.current);
    theoDoi.current = navigator.geolocation.watchPosition(
      (p) =>
        setVitri((v) =>
          v.trangThai === "co" && (v.saiSo ?? Infinity) <= p.coords.accuracy
            ? v
            : { trangThai: "co", viDo: p.coords.latitude, kinhDo: p.coords.longitude, saiSo: Math.round(p.coords.accuracy) },
        ),
      () => setVitri((v) => (v.trangThai === "co" ? v : { trangThai: "khong" })),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (theoDoi.current !== null) navigator.geolocation.clearWatch(theoDoi.current);
    },
    [],
  );

  // Đổi trang giữa lúc chờ: đọc lại báo động đang chờ của phiên này.
  useEffect(() => {
    let ma: string | null = null;
    try {
      ma = window.sessionStorage.getItem(KHOA_PHIEN);
    } catch {
      ma = null;
    }
    if (!ma) return;
    void xemBaoDongAction(ma).then((kq) => {
      if (kq.ok && kq.baoDong && !kq.baoDong.nhanLuc) {
        setLech(Date.parse(kq.bayGio) - Date.now());
        setBaoDong(kq.baoDong);
        daGoi.current = Boolean(kq.baoDong.goiLuc);
      } else {
        try {
          window.sessionStorage.removeItem(KHOA_PHIEN);
        } catch {
          /* bỏ qua */
        }
      }
    });
  }, []);

  const goi = useCallback(
    (so: string, ten: string, tuDong: boolean) => {
      if (baoDong && !daGoi.current) {
        daGoi.current = true;
        void ghiDaGoiAction(baoDong.ma, ten);
      }
      if (tuDong && "vibrate" in navigator) navigator.vibrate([300, 150, 300]);
      window.location.href = duongGoi(so);
    },
    [baoDong],
  );

  // Đang chờ: hỏi kho mỗi 4 giây; 60 giây nhắc lại; 120 giây tự gọi.
  useEffect(() => {
    if (!baoDong || baoDong.nhanLuc) return;
    const ma = baoDong.ma;
    const nhip = window.setInterval(() => {
      setBayGio(Date.now() + lech);
      const daQua = giayDaQua(baoDong.baoLuc, Date.now() + lech);
      if (daQua >= 60 && !daNhac.current) {
        daNhac.current = true;
        void nhacLaiBaoDongAction(ma);
      }
      if (daQua >= GIAY_CHO_TRUOC_KHI_GOI && !daGoi.current) {
        const nguoi = nguoiSeGoi(baoDong.capTren);
        if (nguoi?.dienThoai) goi(nguoi.dienThoai, nguoi.ten, true);
        else daGoi.current = true;
      }
    }, 1000);
    const hoi = window.setInterval(() => {
      void xemBaoDongAction(ma).then((kq) => {
        if (!kq.ok || !kq.baoDong) return;
        setLech(Date.parse(kq.bayGio) - Date.now());
        setBaoDong(kq.baoDong);
        if (kq.baoDong.nhanLuc) {
          if ("vibrate" in navigator) navigator.vibrate(200);
          try {
            window.sessionStorage.removeItem(KHOA_PHIEN);
          } catch {
            /* bỏ qua */
          }
        }
      });
    }, HOI_MS);
    return () => {
      window.clearInterval(nhip);
      window.clearInterval(hoi);
    };
  }, [baoDong, lech, goi]);

  function mo() {
    setLoi("");
    const d = hop.current;
    if (d && !d.open) d.showModal();
    if (!baoDong || baoDong.nhanLuc) layViTri();
  }

  function dong() {
    hop.current?.close();
  }

  function gui() {
    if (!loai) {
      setLoi("Chạm một loại việc trước.");
      return;
    }
    setLoi("");
    batDauGui(async () => {
      const f = new FormData();
      f.set("siteId", siteId);
      f.set("loai", loai);
      f.set("ghiChu", ghiChu);
      f.set("requestKey", khoa);
      if (vitri.trangThai === "co") {
        f.set("viDo", String(vitri.viDo));
        f.set("kinhDo", String(vitri.kinhDo));
        f.set("saiSoM", String(vitri.saiSo ?? ""));
      }
      if (anh) f.set("anh", await thuNhoAnh(anh));
      const kq = await baoKhanCapAction(f);
      if (!kq.ok) {
        setLoi(kq.message);
        return;
      }
      daGoi.current = false;
      daNhac.current = false;
      setLech(0);
      setBayGio(Date.now());
      setBaoDong(kq.baoDong);
      setKhoa(khoaYeuCau());
      setLoai(null);
      setGhiChu("");
      setAnh(null);
      try {
        window.sessionStorage.setItem(KHOA_PHIEN, kq.baoDong.ma);
      } catch {
        /* bỏ qua */
      }
    });
  }

  const dangCho = baoDong && !baoDong.nhanLuc;
  const daQua = baoDong && bayGio ? giayDaQua(baoDong.baoLuc, bayGio) : 0;
  const conLai = GIAY_CHO_TRUOC_KHI_GOI - daQua;
  const nguoiGoi = baoDong ? nguoiSeGoi(baoDong.capTren) : null;

  if (sites.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={mo}
        aria-label={dangCho ? `Báo khẩn cấp đang chờ cấp trên nhận, còn ${mmss(conLai)}` : "Báo khẩn cấp"}
        title="Báo khẩn cấp"
        data-testid="nut-bao-khan-cap"
        data-chi="bao-khan-cap"
        data-chi-loi="Nút đỏ này mở báo khẩn cấp: máy tự lấy vị trí, chạm một loại việc, gửi."
        className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-black text-white shadow-sm ${
          dangCho ? "animate-pulse bg-[#b3261e] motion-reduce:animate-none" : "bg-[#c62828] hover:bg-[#a51f1f]"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.5h.01" />
        </svg>
        <span className="hidden whitespace-nowrap sm:inline">{dangCho ? mmss(conLai) : "SOS"}</span>
      </button>

      <dialog
        ref={hop}
        aria-labelledby="bao-khan-cap-tieu-de"
        onClick={(e) => {
          if (e.target === e.currentTarget) dong();
        }}
        className="m-auto w-[min(30rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-white p-0 text-[#20342c] shadow-2xl backdrop:bg-[#2a0b08]/70"
        data-testid="hop-bao-khan-cap"
      >
        <div className="flex items-center justify-between gap-3 bg-[#c62828] px-5 py-4 text-white">
          <h2 id="bao-khan-cap-tieu-de" className="text-lg font-black">
            {baoDong ? (baoDong.nhanLuc ? "Cấp trên đã nhận" : "Đã báo, đang chờ cấp trên nhận") : "Báo khẩn cấp"}
          </h2>
          <button type="button" onClick={dong} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-xl font-black" aria-label="Đóng">
            ×
          </button>
        </div>

        {baoDong ? (
          <div className="space-y-4 p-5" data-testid="khan-cap-da-gui">
            <p className="text-sm leading-6 text-[#42554c]">
              <strong>{tenLoaiKhanCap(baoDong.loai)}</strong> · {baoDong.siteName} · báo lúc {gio(baoDong.baoLuc)} · mã {baoDong.ma}
            </p>
            {baoDong.nhanLuc ? (
              <p className="rounded-2xl bg-[#e3f1ea] p-4 text-base font-black text-[#1f5a3f]" role="status">
                {baoDong.nhanBoiTen} đã nhận lúc {gio(baoDong.nhanLuc)}. Giữ máy, cấp trên sẽ gọi lại hoặc tới ngay.
              </p>
            ) : (
              <div className="rounded-2xl bg-[#fdecea] p-4" role="status" aria-live="polite">
                <p className="text-sm font-bold text-[#8b1f1a]">
                  {conLai > 0
                    ? nguoiGoi
                      ? `Chưa ai nhận. Còn ${mmss(conLai)} máy sẽ tự gọi ${nguoiGoi.ten}.`
                      : `Chưa ai nhận. Cấp trên chưa ghi số điện thoại trong Hồ sơ, nên máy không tự gọi được: gọi số khẩn cấp bên dưới nếu cần.`
                    : baoDong.goiLuc
                      ? `Đã mở cuộc gọi tới ${baoDong.goiToiTen ?? nguoiGoi?.ten ?? "cấp trên"}. Không nghe máy thì gọi người kế tiếp.`
                      : "Đã quá 2 phút. Bấm gọi ngay."}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" aria-hidden="true">
                  <div className="h-full bg-[#c62828] transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, (daQua / GIAY_CHO_TRUOC_KHI_GOI) * 100)}%` }} />
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {baoDong.capTren.map((c) => (
                <li key={c.accountId} className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8e5] px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-black">{c.ten}</span>
                    <span className="text-xs text-[#6e7b75]">{c.vai === "manager" ? "Quản lý cơ sở" : "Giám đốc"}</span>
                  </span>
                  {c.dienThoai ? (
                    <button type="button" onClick={() => goi(c.dienThoai!, c.ten, false)} className="min-h-11 shrink-0 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white">
                      Gọi
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-[#8a6d3b]">Chưa ghi số</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              {SO_KHAN_CAP_QUOC_GIA.map((s) => (
                <a key={s.so} href={duongGoi(s.so)} className="flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-[#c62828] text-[#c62828]">
                  <span className="text-lg font-black leading-none">{s.so}</span>
                  <span className="text-[0.65rem] font-bold">{s.ten}</span>
                </a>
              ))}
            </div>
            {baoDong.nhanLuc ? (
              <button
                type="button"
                onClick={() => {
                  setBaoDong(null);
                  layViTri();
                }}
                className="min-h-11 w-full rounded-xl border border-[#ccd8d1] text-sm font-black text-[#42574e]"
              >
                Báo việc khác
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-sm font-bold" data-testid="khan-cap-vi-tri" aria-live="polite">
              {vitri.trangThai === "co" ? (
                <span className="text-[#1f5a3f]">✓ Đã lấy vị trí, sai số {(vitri.saiSo ?? 0) < 5 ? "dưới 5 m" : `khoảng ${vitri.saiSo} m`}</span>
              ) : vitri.trangThai === "dang-lay" ? (
                <span className="text-[#7a5520]">Đang lấy vị trí…</span>
              ) : (
                <span className="text-[#8b1f1a]">
                  Chưa lấy được vị trí (máy chưa cho phép). Vẫn gửi được.{" "}
                  <button type="button" onClick={layViTri} className="underline">
                    Thử lại
                  </button>
                </span>
              )}
            </p>
            {sites.length > 1 ? (
              <label className="block text-xs font-bold text-[#53675e]">
                Ở đâu
                <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm">
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <fieldset>
              <legend className="text-xs font-bold text-[#53675e]">Chuyện gì (chạm một ô)</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {LOAI_KHAN_CAP.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={loai === l.id}
                    onClick={() => setLoai(l.id)}
                    className={`min-h-16 rounded-2xl border-2 px-3 py-2 text-left ${
                      loai === l.id ? "border-[#c62828] bg-[#fdecea]" : "border-[#e3e8e5] bg-white"
                    }`}
                  >
                    <span className="block text-sm font-black text-[#20342c]">{l.ten}</span>
                    <span className="block text-[0.7rem] leading-4 text-[#6e7b75]">{l.goiY}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#ccd8d1] px-3 text-sm font-bold text-[#42574e]">
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setAnh(e.target.files?.[0] ?? null)} />
                {anh ? "✓ Đã có ảnh · chụp lại" : "Chụp ảnh (nếu kịp)"}
              </label>
              {anh ? (
                <button type="button" onClick={() => setAnh(null)} className="text-xs font-bold text-[#8b1f1a] underline">
                  Bỏ ảnh
                </button>
              ) : null}
            </div>
            <label className="block text-xs font-bold text-[#53675e]">
              Một dòng nếu kịp (không bắt buộc)
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} maxLength={300} placeholder="Khách rơi xuống nước gần bến 3" className="mt-1 min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 text-sm" />
            </label>
            {loi ? (
              <p role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm font-bold text-[#8b1f1a]">
                {loi}
              </p>
            ) : null}
            <button
              type="button"
              onClick={gui}
              disabled={dangGui || !loai}
              className="min-h-14 w-full rounded-2xl bg-[#c62828] text-lg font-black text-white disabled:opacity-50"
              data-testid="gui-bao-khan-cap"
            >
              {dangGui ? "Đang gửi…" : "GỬI BÁO KHẨN CẤP"}
            </button>
            <p className="text-xs leading-5 text-[#6e7b75]">
              Gửi xong, máy giám đốc và quản lý cơ sở rung, hiện cảnh báo tới khi có người bấm Đã nhận. Quá 2 phút chưa ai nhận
              thì máy này tự gọi cấp trên.
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
