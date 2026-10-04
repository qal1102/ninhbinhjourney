"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BEN_CO_HANG_CHO,
  laTongQuan,
  soHienThi,
  uocPhutCho,
  type LuotCuaKhach,
  type MaBen,
  type TongQuanHangCho,
} from "@/domain/hang-cho";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Hàng chờ ảo ở bến đò, phía khách. Lấy số, rồi trang tự hỏi lại mỗi 15 giây:
 * còn mấy nhóm trước mình, chờ chừng bao lâu. Tới lượt thì máy rung, kêu một
 * tiếng ngắn và tiêu đề thẻ đổi, để khách đang đi dạo liếc là thấy.
 *
 * Chuỗi bí mật của lượt nằm trong bộ nhớ trình duyệt: đóng trang mở lại vẫn
 * thấy đúng số của mình.
 */

const HOI_LAI_MS = 15_000;

type TrangThaiTrang =
  | { loai: "dang-tai" }
  | { loai: "chua-mo" }
  | { loai: "loi" }
  | { loai: "chua-lay"; tongQuan: TongQuanHangCho }
  | { loai: "co-luot"; luot: LuotCuaKhach };

function khoaLuot(ben: MaBen) {
  return `nbj-hang-cho:${ben}`;
}

function docBoNho(khoa: string): string | null {
  try {
    return window.localStorage.getItem(khoa);
  } catch {
    return null;
  }
}

function ghiBoNho(khoa: string, giaTri: string | null) {
  try {
    if (giaTri === null) window.localStorage.removeItem(khoa);
    else window.localStorage.setItem(khoa, giaTri);
  } catch {
    // Trình duyệt chặn bộ nhớ: lượt vẫn chạy tới khi đóng trang.
  }
}

function maMay(): string {
  const cu = docBoNho("nbj-ma-may");
  if (cu && /^[A-Za-z0-9_-]{16,64}$/.test(cu)) return cu;
  const moi = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
  ghiBoNho("nbj-ma-may", moi);
  return moi;
}

function baoToiLuot() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600]);
  } catch {
    // Máy không rung được thì thôi.
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const dao = ctx.createOscillator();
    const am = ctx.createGain();
    dao.frequency.value = 880;
    am.gain.setValueAtTime(0.0001, ctx.currentTime);
    am.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    am.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    dao.connect(am).connect(ctx.destination);
    dao.start();
    dao.stop(ctx.currentTime + 0.9);
  } catch {
    // Trình duyệt chặn âm thanh khi chưa bấm gì: rung và tiêu đề vẫn báo.
  }
}

export function HangChoKhach({
  ben,
  ten,
  lang,
  children,
}: {
  ben: MaBen;
  ten: string;
  lang: NgonNgu;
  children?: ReactNode;
}) {
  const t = useCallback((vi: string, en: string) => (lang === "en" ? en : vi), [lang]);
  const [trang, setTrang] = useState<TrangThaiTrang>({ loai: "dang-tai" });
  const [soKhach, setSoKhach] = useState(2);
  const [dangGui, setDangGui] = useState(false);
  const [loiNhan, setLoiNhan] = useState<string | null>(null);
  const [hoiHuy, setHoiHuy] = useState(false);
  const daBao = useRef<number | null>(null);

  const taiTongQuan = useCallback(async () => {
    const res = await fetch(`/api/hang-cho?ben=${ben}`, { cache: "no-store" }).catch(() => null);
    if (!res) return setTrang({ loai: "loi" });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; ma?: string; tong_quan?: unknown } | null;
    if (res.status === 503 || res.status === 404) return setTrang({ loai: "chua-mo" });
    if (!res.ok || !body?.ok) return setTrang({ loai: "loi" });
    // Máy chủ đã đọc số liệu kho thành `TongQuanHangCho` (camelCase) rồi.
    const tq = laTongQuan(body.tong_quan) ? body.tong_quan : null;
    setTrang(tq ? { loai: "chua-lay", tongQuan: tq } : { loai: "chua-mo" });
  }, [ben]);

  const taiLuot = useCallback(
    async (biMat: string) => {
      const res = await fetch("/api/hang-cho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hanh_dong: "xem", bi_mat: biMat }),
        cache: "no-store",
      }).catch(() => null);
      if (!res) return;
      if (res.status === 404) {
        ghiBoNho(khoaLuot(ben), null);
        return taiTongQuan();
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean; luot?: LuotCuaKhach } | null;
      if (!res.ok || !body?.ok || !body.luot) return;
      const luot = body.luot;
      if (luot.trangThai === "khach-huy" || luot.trangThai === "het-ngay") {
        ghiBoNho(khoaLuot(ben), null);
        return setTrang({ loai: "chua-lay", tongQuan: luot.tongQuan });
      }
      setTrang({ loai: "co-luot", luot });
    },
    [ben, taiTongQuan],
  );

  const tai = useCallback(() => {
    const biMat = docBoNho(khoaLuot(ben));
    return biMat ? taiLuot(biMat) : taiTongQuan();
  }, [ben, taiLuot, taiTongQuan]);

  useEffect(() => {
    // Số lấy trên kiosk tại bến: kiosk cho khách quét mã `/xep-hang/<bến>?luot=…`
    // để điện thoại nhận lượt. Ghi vào bộ nhớ máy khách rồi xoá khỏi đường dẫn,
    // để lỡ chia sẻ đường dẫn cũng không lộ chuỗi bí mật.
    const url = new URL(window.location.href);
    const luot = url.searchParams.get("luot");
    if (luot && /^[A-Za-z0-9_-]{32}$/.test(luot)) {
      ghiBoNho(khoaLuot(ben), luot);
      url.searchParams.delete("luot");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, [ben]);

  useEffect(() => {
    // Lần đầu và mỗi 15 giây; khép lượt rồi thì chỉ còn hỏi hàng chung.
    let dung = false;
    const chay = () => {
      if (!dung) void tai();
    };
    const dau = window.setTimeout(chay, 0);
    const hen = window.setInterval(chay, HOI_LAI_MS);
    const khiHien = () => {
      if (document.visibilityState === "visible") chay();
    };
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      dung = true;
      window.clearTimeout(dau);
      window.clearInterval(hen);
      document.removeEventListener("visibilitychange", khiHien);
    };
  }, [tai]);

  const luotHienTai = trang.loai === "co-luot" ? trang.luot : null;
  const toiLuot = luotHienTai?.trangThai === "da-goi";
  const soToiLuot = toiLuot ? luotHienTai.soThuTu : null;
  useEffect(() => {
    if (soToiLuot === null) return;
    const cu = document.title;
    document.title = t(`🔔 Tới lượt ${soHienThi(soToiLuot)}`, `🔔 Your turn ${soHienThi(soToiLuot)}`);
    if (daBao.current !== soToiLuot) {
      daBao.current = soToiLuot;
      baoToiLuot();
    }
    return () => {
      document.title = cu;
    };
  }, [soToiLuot, t]);

  async function laySo() {
    setDangGui(true);
    setLoiNhan(null);
    try {
      const res = await fetch("/api/hang-cho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hanh_dong: "lay-so", ben, so_khach: soKhach, ngon_ngu: lang, ma_may: maMay() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; ma?: string; bi_mat?: string | null; so_thu_tu?: number; da_co?: boolean }
        | null;
      if (!res.ok || !body?.ok) {
        setLoiNhan(
          body?.ma === "TAM_DUNG"
            ? t("Bến vừa tạm dừng nhận số. Mời bạn xem lời nhắn bên trên.", "The pier has just paused the queue. See the note above.")
            : body?.ma === "DAY"
              ? t("Hàng chờ hôm nay đã đầy. Mời bạn tới quầy bến hỏi nhân viên.", "Today's queue is full. Please ask staff at the pier.")
              : t("Chưa lấy được số. Bạn thử lại.", "Couldn't get a number. Please try again."),
        );
        if (body?.ma === "TAM_DUNG") void taiTongQuan();
        return;
      }
      if (body.bi_mat) {
        ghiBoNho(khoaLuot(ben), body.bi_mat);
        await taiLuot(body.bi_mat);
      } else if (body.da_co) {
        const cu = docBoNho(khoaLuot(ben));
        if (cu) await taiLuot(cu);
        else
          setLoiNhan(
            t(
              `Máy này đã giữ số ${soHienThi(body.so_thu_tu ?? 0)} từ trước. Mở lại trang lúc lấy số, hoặc đọc số ấy cho nhân viên bến.`,
              `This phone already holds number ${soHienThi(body.so_thu_tu ?? 0)}. Reopen the page you used, or tell staff that number.`,
            ),
          );
      }
    } finally {
      setDangGui(false);
    }
  }

  async function huy() {
    const biMat = docBoNho(khoaLuot(ben));
    setHoiHuy(false);
    if (!biMat) return taiTongQuan();
    await fetch("/api/hang-cho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hanh_dong: "huy", bi_mat: biMat }),
    }).catch(() => null);
    ghiBoNho(khoaLuot(ben), null);
    await taiTongQuan();
  }

  const tongQuan = trang.loai === "chua-lay" ? trang.tongQuan : trang.loai === "co-luot" ? trang.luot.tongQuan : null;

  return (
    <div className="mx-auto max-w-xl" data-testid="hang-cho">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
          {t("Hàng chờ ảo", "Virtual queue")} · {ten}
        </p>
        {children}
      </div>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
        {t("Lấy số trên điện thoại, khỏi đứng xếp hàng", "Take a number on your phone, skip the line")}
      </h1>

      {trang.loai === "dang-tai" ? (
        <p role="status" className="mt-8 text-[#59654b]">{t("Đang xem hàng chờ…", "Checking the queue…")}</p>
      ) : null}

      {trang.loai === "chua-mo" || trang.loai === "loi" ? (
        <div role="status" className="mt-8 rounded-3xl border border-[#d7d5cd] bg-white p-6">
          <p className="font-bold text-[#183f34]">
            {trang.loai === "chua-mo"
              ? t("Hàng chờ ảo chưa mở ở bến này.", "The virtual queue isn't open at this pier.")
              : t("Chưa kết nối được hàng chờ.", "Couldn't reach the queue.")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#59654b]">
            {t("Bạn xếp hàng tại quầy bến như thường, nhân viên sẽ hướng dẫn.", "Queue at the pier desk as usual; staff will guide you.")}
          </p>
        </div>
      ) : null}

      {tongQuan ? <TinhHinh tongQuan={tongQuan} lang={lang} /> : null}

      {trang.loai === "chua-lay" ? (
        trang.tongQuan.dangNhan ? (
          <section className="mt-6 rounded-3xl border border-[#d7d5cd] bg-white p-5 sm:p-6" aria-labelledby="lay-so-tieu-de">
            <h2 id="lay-so-tieu-de" className="text-lg font-extrabold text-[#183f34]">
              {t("Nhóm bạn mấy người?", "How many in your group?")}
            </h2>
            <div role="radiogroup" aria-label={t("Số người", "Group size")} className="mt-3 grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={soKhach === n}
                  onClick={() => setSoKhach(n)}
                  className={`min-h-12 rounded-xl border text-lg font-extrabold ${soKhach === n ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#183f34]"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-[#59654b]">
              {t(
                "Mỗi đò chở tối đa 4 khách; nhóm 5–6 người được xếp hai đò liền nhau.",
                "Each boat takes up to 4 guests; groups of 5–6 get two boats back to back.",
              )}
            </p>
            <button
              type="button"
              onClick={laySo}
              disabled={dangGui}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#183f34] px-6 text-base font-extrabold text-white disabled:opacity-60"
            >
              {dangGui ? t("Đang lấy số…", "Getting a number…") : t("Lấy số", "Take a number")}
            </button>
            {loiNhan ? <p role="alert" className="mt-3 text-sm font-bold text-[#9b2c1f]">{loiNhan}</p> : null}
            <p className="mt-4 text-xs leading-5 text-[#6b746e]">
              {t(
                `Số này giữ chỗ của bạn trong hàng, không thay vé đò: vé mua ở quầy bến hoặc đặt trước trên web. Tới lượt, bạn có ${trang.tongQuan.phutGiuLuot} phút ra bến.`,
                `Your number holds your place in line; it is not a boat ticket. Buy tickets at the pier desk or book online. When called, you have ${trang.tongQuan.phutGiuLuot} minutes to reach the pier.`,
              )}
            </p>
          </section>
        ) : (
          <div role="status" className="mt-6 rounded-3xl border border-[#e3c48a] bg-[#fff8e8] p-5">
            <p className="font-extrabold text-[#8a5a14]">{t("Bến đang tạm dừng nhận số", "The pier has paused the queue")}</p>
            {trang.tongQuan.loiTamDung ? <p className="mt-2 text-sm leading-6 text-[#6b5320]">{trang.tongQuan.loiTamDung}</p> : null}
          </div>
        )
      ) : null}

      {luotHienTai ? (
        <LuotCuaToi ben={ben} luot={luotHienTai} lang={lang} hoiHuy={hoiHuy} setHoiHuy={setHoiHuy} huy={huy} lamMoi={() => void tai()} />
      ) : null}
    </div>
  );
}

function TinhHinh({ tongQuan, lang }: { tongQuan: TongQuanHangCho; lang: NgonNgu }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const phut = uocPhutCho(tongQuan.soKhachCho, tongQuan);
  return (
    <dl className="mt-6 grid grid-cols-3 gap-2 text-center" data-testid="hang-cho-tinh-hinh">
      <div className="rounded-2xl bg-[#e8efe9] p-3">
        <dt className="text-xs font-bold text-[#42554c]">{t("Đang gọi tới", "Now calling")}</dt>
        <dd className="mt-1 text-2xl font-extrabold text-[#183f34]">{tongQuan.goiToiSo ? soHienThi(tongQuan.goiToiSo) : "—"}</dd>
      </div>
      <div className="rounded-2xl bg-[#e8efe9] p-3">
        <dt className="text-xs font-bold text-[#42554c]">{t("Nhóm đang chờ", "Groups waiting")}</dt>
        <dd className="mt-1 text-2xl font-extrabold text-[#183f34]">{tongQuan.soNhomCho}</dd>
      </div>
      <div className="rounded-2xl bg-[#e8efe9] p-3">
        <dt className="text-xs font-bold text-[#42554c]">{t("Người mới tới chờ", "Wait if you join now")}</dt>
        <dd className="mt-1 text-2xl font-extrabold text-[#183f34]">{phut === 0 ? t("Ngay", "None") : `~${phut}′`}</dd>
      </div>
    </dl>
  );
}

function LuotCuaToi({
  ben,
  luot,
  lang,
  hoiHuy,
  setHoiHuy,
  huy,
  lamMoi,
}: {
  ben: MaBen;
  luot: LuotCuaKhach;
  lang: NgonNgu;
  hoiHuy: boolean;
  setHoiHuy: (x: boolean) => void;
  huy: () => void;
  lamMoi: () => void;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const so = soHienThi(luot.soThuTu);
  const phut = uocPhutCho(luot.khachTruoc, luot.tongQuan);
  const toiLuot = luot.trangThai === "da-goi";
  const conHieuLuc = luot.trangThai === "cho" || toiLuot;
  return (
    <section
      data-testid="luot-cua-toi"
      data-trang-thai={luot.trangThai}
      className={`mt-6 rounded-3xl p-6 text-center ${toiLuot ? "bg-[#c77b25] text-white" : "border border-[#d7d5cd] bg-white text-[#183f34]"}`}
    >
      <p className={`text-sm font-bold ${toiLuot ? "text-white/85" : "text-[#59654b]"}`}>
        {t("Số của bạn", "Your number")} · {t(`${luot.soKhach} người`, `${luot.soKhach} ${luot.soKhach === 1 ? "guest" : "guests"}`)}
      </p>
      <p className="font-display mt-1 text-7xl leading-none tracking-tight" aria-label={t(`Số ${so}`, `Number ${so}`)}>{so}</p>
      <div role="status" aria-live="assertive" className="mt-4">
        {luot.trangThai === "cho" ? (
          <>
            <p className="text-xl font-extrabold">
              {luot.nhomTruoc === 0
                ? t("Bạn đứng đầu hàng", "You're next in line")
                : t(`Còn ${luot.nhomTruoc} nhóm trước bạn`, `${luot.nhomTruoc} ${luot.nhomTruoc === 1 ? "group" : "groups"} ahead of you`)}
            </p>
            <p className="mt-1 text-[#59654b]">
              {phut === 0 ? t("Sắp được gọi.", "You'll be called shortly.") : t(`Chờ khoảng ${phut} phút.`, `About ${phut} minutes.`)}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#59654b]">
              {t(
                "Cứ đi dạo, uống nước quanh bến. Để trang này mở: tới lượt máy sẽ rung, kêu một tiếng và đổi màu.",
                "Wander around the pier. Keep this page open: when it's your turn your phone buzzes, beeps and the page turns orange.",
              )}
            </p>
          </>
        ) : toiLuot ? (
          <>
            <p className="text-2xl font-extrabold">{t("Tới lượt bạn!", "It's your turn!")}</p>
            <p className="mt-2 leading-7 text-white/90">
              {t(
                `Mời ra bến đò trong ${luot.tongQuan.phutGiuLuot} phút, đọc số ${so} và đưa vé cho nhân viên.`,
                `Please come to the pier within ${luot.tongQuan.phutGiuLuot} minutes, say number ${so} and show your ticket.`,
              )}
            </p>
          </>
        ) : luot.trangThai === "da-len" ? (
          <>
            <p className="text-xl font-extrabold">{t("Chúc bạn một chuyến đò thật đẹp", "Enjoy the boat ride")}</p>
            <p className="mt-2 text-[#59654b]">
              {t("Trên đò, bạn nghe thuyết minh về nơi này ngay trên máy.", "On the boat, listen to the audio guide on your phone.")}
            </p>
            <Link href={`/destination/${BEN_CO_HANG_CHO[ben].slugDiemDen}#thuyet-minh`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 font-bold text-white">
              {t("Nghe thuyết minh", "Audio guide")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-xl font-extrabold">{t("Lượt đã qua", "Your turn has passed")}</p>
            <p className="mt-2 text-[#59654b]">
              {t(
                "Bạn chưa ra bến kịp nên lượt được nhường cho nhóm sau. Tới quầy bến đọc số này, nhân viên gọi lại được; hoặc huỷ và lấy số mới.",
                "You didn't reach the pier in time, so the next group went ahead. Tell staff this number and they can call you again, or cancel and take a new one.",
              )}
            </p>
          </>
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={lamMoi}
          className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${toiLuot ? "bg-white text-[#8a4d10]" : "border border-[#b9c4bd]"}`}
        >
          {t("Làm mới", "Refresh")}
        </button>
        {luot.trangThai !== "da-len" ? (
          hoiHuy ? (
            <span className="inline-flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-bold">{conHieuLuc ? t("Nhường lượt này?", "Give up this spot?") : t("Bỏ số này?", "Discard this number?")}</span>
              <button type="button" onClick={huy} className="inline-flex min-h-11 items-center rounded-full bg-[#9b2c1f] px-4 text-sm font-bold text-white">
                {t("Đồng ý huỷ", "Yes, cancel")}
              </button>
              <button type="button" onClick={() => setHoiHuy(false)} className="inline-flex min-h-11 items-center rounded-full border border-current px-4 text-sm font-bold">
                {t("Giữ lại", "Keep it")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setHoiHuy(true)}
              className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${toiLuot ? "border border-white/60" : "border border-[#b9c4bd]"}`}
            >
              {conHieuLuc ? t("Huỷ lượt", "Cancel") : t("Lấy số mới", "Take a new number")}
            </button>
          )
        ) : (
          <button type="button" onClick={huy} className="inline-flex min-h-11 items-center rounded-full border border-[#b9c4bd] px-5 text-sm font-bold">
            {t("Xong", "Done")}
          </button>
        )}
      </div>
    </section>
  );
}
