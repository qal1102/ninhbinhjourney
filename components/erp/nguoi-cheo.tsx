"use client";

import { useEffect, useRef, useState } from "react";
import type { CoSoThuyen } from "@/domain/thuyen-song";

/**
 * Trang người chèo: bắt đầu chuyến, gửi vị trí, về bến.
 *
 * Điện thoại báo vị trí qua `watchPosition`; trang gửi lên máy chủ tối đa
 * 5 giây một lần. Trình duyệt dừng gửi khi tắt màn hình, nên trang xin giữ màn
 * hình sáng (Wake Lock) trong lúc chuyến mở, và nói thẳng khi máy không cho.
 */

type Chuyen = { id: string; coSo: CoSoThuyen; soThuyen: string; soKhach: number; batDau: string };
type WakeLockLike = { release(): Promise<void> };

const GUI_MOI_MS = 5000;

async function goi(body: unknown) {
  const res = await fetch("/api/erp/thuyen", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; loi?: string; ma?: string; chuyen?: Chuyen; da_ghi?: boolean } | null;
  return { ok: res.ok && Boolean(data?.ok), data };
}

export function NguoiCheo({
  coSo,
  chuyenDangMo,
}: {
  coSo: { id: CoSoThuyen; ten: string }[];
  chuyenDangMo: Chuyen | null;
}) {
  const [chuyen, setChuyen] = useState<Chuyen | null>(chuyenDangMo);
  const [chonCoSo, setChonCoSo] = useState<CoSoThuyen>(chuyenDangMo?.coSo ?? coSo[0].id);
  const [soThuyen, setSoThuyen] = useState("");
  const [soKhach, setSoKhach] = useState("4");
  const [dangBam, setDangBam] = useState(false);
  const [loi, setLoi] = useState("");
  const [tinhTrang, setTinhTrang] = useState<{ lanGui: number | null; saiSo: number | null; soDiem: number; giuSang: boolean | null }>({
    lanGui: null,
    saiSo: null,
    soDiem: 0,
    giuSang: null,
  });
  const [bayGio, setBayGio] = useState(() => Date.now());
  const lanGuiRef = useRef(0);

  // Đồng hồ cho dòng "lần gửi cuối … giây trước".
  useEffect(() => {
    if (!chuyen) return;
    const id = window.setInterval(() => setBayGio(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [chuyen]);

  // Theo dõi vị trí và giữ màn hình sáng khi chuyến đang mở.
  useEffect(() => {
    if (!chuyen) return;
    // Máy không có định vị đã bị chặn từ lúc bấm "Bắt đầu chuyến".
    if (!("geolocation" in navigator)) return;
    let khoaMan: WakeLockLike | null = null;
    let huy = false;
    const giuMan = async () => {
      const wl = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockLike> } }).wakeLock;
      if (!wl) {
        setTinhTrang((t) => ({ ...t, giuSang: false }));
        return;
      }
      try {
        khoaMan = await wl.request("screen");
        if (!huy) setTinhTrang((t) => ({ ...t, giuSang: true }));
      } catch {
        if (!huy) setTinhTrang((t) => ({ ...t, giuSang: false }));
      }
    };
    void giuMan();
    const khiHien = () => {
      if (document.visibilityState === "visible") void giuMan();
    };
    document.addEventListener("visibilitychange", khiHien);

    const theoDoi = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lanGuiRef.current < GUI_MOI_MS) return;
        lanGuiRef.current = now;
        const { ok, data } = await goi({
          hanh_dong: "vi-tri",
          chuyen_id: chuyen.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          do_chinh_xac: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          toc_do: pos.coords.speed ?? null,
          huong: pos.coords.heading ?? null,
        }).catch(() => ({ ok: false, data: null }));
        if (huy) return;
        if (!ok) {
          if (data?.ma === "DA_DONG") {
            setChuyen(null);
            setLoi("Chuyến đã quá 6 giờ nên tự đóng. Bắt đầu chuyến mới nhé.");
          } else {
            setLoi(data?.loi ?? "Chưa gửi được vị trí, đang thử lại.");
          }
          return;
        }
        setLoi("");
        setTinhTrang((t) => ({
          ...t,
          lanGui: now,
          saiSo: Math.round(pos.coords.accuracy),
          soDiem: t.soDiem + (data?.da_ghi ? 1 : 0),
        }));
      },
      (err) => {
        if (huy) return;
        setLoi(
          err.code === err.PERMISSION_DENIED
            ? "Bạn chưa cho trang này đọc vị trí. Mở cài đặt trang (biểu tượng ổ khoá cạnh địa chỉ), cho phép Vị trí rồi tải lại."
            : "Chưa bắt được tín hiệu GPS. Ra chỗ thoáng trời một chút, máy sẽ tự thử lại.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );

    return () => {
      huy = true;
      navigator.geolocation.clearWatch(theoDoi);
      document.removeEventListener("visibilitychange", khiHien);
      void khoaMan?.release().catch(() => undefined);
    };
  }, [chuyen]);

  async function batDau(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!("geolocation" in navigator)) {
      setLoi("Máy này không cho trình duyệt đọc vị trí, nên chưa gửi được thuyền lên bản đồ.");
      return;
    }
    setDangBam(true);
    setLoi("");
    const { ok, data } = await goi({ hanh_dong: "bat-dau", co_so: chonCoSo, so_thuyen: soThuyen, so_khach: Number(soKhach) }).catch(() => ({
      ok: false,
      data: null,
    }));
    setDangBam(false);
    if (!ok || !data?.chuyen) {
      setLoi(data?.loi ?? "Chưa mở được chuyến. Xin thử lại.");
      return;
    }
    lanGuiRef.current = 0;
    setTinhTrang({ lanGui: null, saiSo: null, soDiem: 0, giuSang: null });
    setChuyen(data.chuyen);
  }

  async function veBen() {
    if (!chuyen) return;
    setDangBam(true);
    const { ok, data } = await goi({ hanh_dong: "ve-ben", chuyen_id: chuyen.id }).catch(() => ({ ok: false, data: null }));
    setDangBam(false);
    if (!ok) {
      setLoi(data?.loi ?? "Chưa ghi được về bến. Xin thử lại.");
      return;
    }
    setChuyen(null);
  }

  if (chuyen) {
    const giay = tinhTrang.lanGui ? Math.round((bayGio - tinhTrang.lanGui) / 1000) : null;
    const phut = Math.max(0, Math.floor((bayGio - Date.parse(chuyen.batDau)) / 60000));
    return (
      <section className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8" data-testid="chuyen-dang-mo">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e7c78d]">Đang chèo · {coSo.find((c) => c.id === chuyen.coSo)?.ten}</p>
        <p className="font-display mt-2 text-4xl">Thuyền {chuyen.soThuyen}</p>
        <p className="mt-2 text-white/80">{chuyen.soKhach} khách · đã đi {phut} phút</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="text-xs text-white/60">Lần gửi vị trí cuối</dt>
            <dd className="mt-1 text-xl font-bold" data-testid="lan-gui-cuoi">{giay === null ? "Đang chờ GPS…" : `${giay} giây trước`}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="text-xs text-white/60">Sai số GPS</dt>
            <dd className="mt-1 text-xl font-bold">{tinhTrang.saiSo === null ? "—" : `${tinhTrang.saiSo} m`}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="text-xs text-white/60">Màn hình</dt>
            <dd className="mt-1 text-sm font-bold leading-6">
              {tinhTrang.giuSang === null ? "…" : tinhTrang.giuSang ? "Đang giữ sáng" : "Máy không cho giữ sáng: đừng tắt màn hình khi chèo"}
            </dd>
          </div>
        </dl>
        {loi ? <p role="alert" className="mt-4 rounded-xl bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">{loi}</p> : null}
        <button
          type="button"
          onClick={veBen}
          disabled={dangBam}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#e7b96a] px-6 text-lg font-extrabold text-[#183f34] disabled:opacity-60 sm:w-auto"
        >
          Về bến, dừng gửi vị trí
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={batDau} className="rounded-3xl border border-[#d8e0db] bg-white p-6 sm:p-8" data-testid="bat-dau-chuyen">
      {coSo.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-bold text-[#27362f]">Bến</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {coSo.map((c) => (
              <label key={c.id} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-bold ${chonCoSo === c.id ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#cbd7d1] text-[#183f34]"}`}>
                <input type="radio" name="coSo" value={c.id} checked={chonCoSo === c.id} onChange={() => setChonCoSo(c.id)} className="sr-only" />
                {c.ten}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm font-bold text-[#27362f]">{coSo[0].ten}</p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-[#27362f]">
          Số thuyền
          <input
            required
            value={soThuyen}
            onChange={(e) => setSoThuyen(e.target.value)}
            maxLength={20}
            placeholder="Ví dụ 128"
            inputMode="text"
            className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 text-lg font-medium"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-[#27362f]">
          Số khách trên thuyền
          <input
            type="number"
            min={0}
            max={12}
            value={soKhach}
            onChange={(e) => setSoKhach(e.target.value)}
            className="min-h-12 rounded-xl border border-[#cbd7d1] px-4 text-lg font-medium"
          />
        </label>
      </div>
      {loi ? <p role="alert" className="mt-4 rounded-xl bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">{loi}</p> : null}
      <button
        type="submit"
        disabled={dangBam || soThuyen.trim() === ""}
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#183f34] px-6 text-lg font-extrabold text-white disabled:opacity-50 sm:w-auto"
      >
        Bắt đầu chuyến
      </button>
      <p className="mt-3 text-xs leading-5 text-[#6b786f]">
        Máy sẽ hỏi quyền đọc vị trí. Vị trí chỉ gửi trong lúc chuyến mở, quản lý cơ sở và giám đốc xem được; điểm cũ hơn hai ngày tự xoá.
      </p>
    </form>
  );
}
