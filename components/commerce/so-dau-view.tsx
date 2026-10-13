"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chiaSe } from "@/components/commerce/chia-se";
import {
  diemConThieu,
  docSoDau,
  KHOA_LUU_SO_DAU,
  SO_DAU,
  soDauDaCo,
  themDau,
  type Dau,
  type MaDau,
  type SoDau,
} from "@/domain/so-dau";

type Lang = "vi" | "en";

function ngayHomNayVN() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function ngayThang(iso: string) {
  const [nam, thang, ngay] = iso.slice(0, 10).split("-");
  return { ngayThang: `${ngay}.${thang}`, nam };
}

/** Con dấu son tròn, cùng kiểu dấu mộc trên hộ chiếu (D1). */
export function DauSon({ dau, ngay, dapMoi = false }: { dau: Dau; ngay: string; dapMoi?: boolean }) {
  const { ngayThang: nt, nam } = ngayThang(ngay);
  const vong = `dau-son-${dau.ma}`;
  return (
    <span className={`dau-son ${dapMoi ? "dau-son-dap" : ""}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <path id={vong} d="M50 50 m-33 0 a33 33 0 1 1 66 0 a33 33 0 1 1 -66 0" />
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <text fontSize="8.2" fontWeight="800" letterSpacing="1.4" fill="currentColor">
          <textPath href={`#${vong}`} textLength="205" lengthAdjust="spacing">NINH BÌNH · {dau.chuDau} · NINH BÌNH ·</textPath>
        </text>
        <text x="50" y="53" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">{nt}</text>
        <text x="50" y="66" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="currentColor">{nam}</text>
      </svg>
    </span>
  );
}

/**
 * Sổ dấu trên máy khách. `dongMa`: dấu vừa quét được (trang `/dau/<mã>`) hay
 * vừa hứa (trang lời hứa); đóng vào sổ rồi hiện cả sổ cùng điểm còn thiếu.
 */
export function SoDauView({ lang = "vi", dongMa }: { lang?: Lang; dongMa?: MaDau }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [so, setSo] = useState<SoDau | null>(null);
  const [vuaDong, setVuaDong] = useState<{ ma: MaDau; moi: boolean } | null>(null);

  useEffect(() => {
    let soDoc: SoDau = {};
    let ketQua: { ma: MaDau; moi: boolean } | null = null;
    try {
      soDoc = docSoDau(window.localStorage.getItem(KHOA_LUU_SO_DAU));
      if (dongMa) {
        const sau = themDau(soDoc, dongMa, ngayHomNayVN());
        soDoc = sau.so;
        ketQua = { ma: dongMa, moi: sau.moi };
        if (sau.moi) window.localStorage.setItem(KHOA_LUU_SO_DAU, JSON.stringify(soDoc));
      }
    } catch {
      // Trình duyệt chặn bộ nhớ (cửa sổ ẩn danh…): vẫn hiện dấu vừa đóng, không lưu được.
      if (dongMa) {
        soDoc = { [dongMa]: ngayHomNayVN() };
        ketQua = { ma: dongMa, moi: true };
      }
    }
    // Đọc bộ nhớ trình duyệt xong mới vẽ, tránh lệch với bản dựng ở máy chủ.
    const hen = window.setTimeout(() => {
      setSo(soDoc);
      setVuaDong(ketQua);
    }, 0);
    return () => window.clearTimeout(hen);
  }, [dongMa]);

  const duoi = lang === "en" ? "?lang=en" : "";
  const daCo = so ? soDauDaCo(so) : 0;
  const conThieu = so ? diemConThieu(so) : [];
  const dauVua = vuaDong ? SO_DAU.find((d) => d.ma === vuaDong.ma) : undefined;

  return (
    <section data-testid="so-dau" className="mx-auto max-w-3xl">
      {dauVua && so ? (
        <div data-testid="dau-vua-dong" className="mb-6 flex flex-col items-center rounded-3xl bg-[#183f34] p-6 text-center text-white">
          <span className="text-[#b23a24]">
            <DauSon dau={dauVua} ngay={so[dauVua.ma] ?? ngayHomNayVN()} dapMoi={vuaDong?.moi} />
          </span>
          <h1 className="font-display mt-4 text-3xl leading-tight">
            {vuaDong?.moi
              ? t(`Đã đóng dấu ${dauVua.ten.vi}`, `Stamped: ${dauVua.ten.en}`)
              : t(`Bạn đã có dấu ${dauVua.ten.vi} từ trước`, `You already have the ${dauVua.ten.en} stamp`)}
          </h1>
          <p className="mt-2 text-sm text-white/70">{t(`${daCo} trên ${SO_DAU.length} dấu trong sổ của bạn.`, `${daCo} of ${SO_DAU.length} stamps in your book.`)}</p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">{t("Không cần đăng nhập", "No sign-in needed")}</p>
          <h1 className="font-display mt-2 text-4xl leading-tight text-[#183f34]">{t("Sổ dấu Ninh Bình", "Ninh Binh stamp book")}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#4a554e]">
            {t(
              "Mỗi điểm có một mã QR đóng dấu ở cổng hay quầy đón khách, cả Cố đô Hoa Lư. Quét bằng camera điện thoại là dấu vào sổ. Thêm một dấu khi bạn hứa giữ gìn di sản Tràng An.",
              "Each site has a stamp QR code at the gate or visitor desk, Hoa Lu Ancient Capital included. Scan it with your phone camera to stamp your book. One more stamp for the Trang An heritage promise.",
            )}
          </p>
          {so ? <p className="mt-2 font-bold text-[#183f34]" data-testid="so-dau-dem">{t(`Bạn có ${daCo} trên ${SO_DAU.length} dấu.`, `You have ${daCo} of ${SO_DAU.length} stamps.`)}</p> : null}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="so-dau-luoi">
        {SO_DAU.map((dau) => {
          const ngay = so?.[dau.ma];
          return (
            <li key={dau.ma} data-co-dau={ngay ? "co" : "chua"} className="flex flex-col items-center rounded-2xl border border-[#e2d3b4] bg-[#fbf7ee] p-4 text-center">
              {ngay ? (
                <span className="text-[#b23a24]"><DauSon dau={dau} ngay={ngay} /></span>
              ) : (
                <span className="grid size-[4.6rem] place-items-center rounded-full border-2 border-dashed border-[#d3c4a5] text-xs font-bold text-[#a8987a]" aria-hidden="true">
                  {t("Chưa có", "Not yet")}
                </span>
              )}
              <p className="mt-2 text-sm font-bold leading-tight text-[#183f34]">{dau.ten[lang]}</p>
              {ngay && dau.diemDen ? (
                <button
                  type="button"
                  data-testid={`khoe-${dau.ma}`}
                  onClick={() =>
                    void chiaSe(
                      `${window.location.origin}/ban-da-di/${dau.ma}`,
                      t(`Mình vừa đóng dấu ${dau.ten.vi} ở Ninh Bình. Bạn đi thử không?`, `I just got the ${dau.ten.en} stamp in Ninh Binh. Fancy going?`),
                    )
                  }
                  className="mt-2 inline-flex min-h-10 items-center rounded-full border border-[#183f34] px-4 text-xs font-extrabold text-[#183f34]"
                >
                  {t("Khoe với bạn", "Share")}
                </button>
              ) : null}
              {!ngay && dau.veSlug ? (
                <Link href={`/packages/${dau.veSlug}${duoi}`} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-[#183f34] px-4 text-xs font-extrabold text-white">
                  {t("Mua vé", "Buy ticket")}
                </Link>
              ) : null}
              {!ngay && dau.ma === "loi-hua" ? (
                <Link href={`/loi-hua${duoi}`} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-[#183f34] px-4 text-xs font-extrabold text-white">
                  {t("Đọc và hứa", "Read and promise")}
                </Link>
              ) : null}
              {!ngay && dau.ma === "hoa-lu" && dau.diemDen ? (
                <Link href={`/destination/${dau.diemDen}${duoi}`} className="mt-2 inline-flex min-h-10 items-center rounded-full border border-[#183f34] px-4 text-xs font-extrabold text-[#183f34]">
                  {t("Xem điểm", "See the site")}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {so && conThieu.length > 0 && daCo > 0 ? (
        <p className="mt-6 rounded-2xl bg-[#fff8eb] p-4 text-sm leading-6 text-[#6c4b1f]">
          {t(
            `Còn ${conThieu.map((d) => d.ten.vi).join(", ")} chưa có dấu. Gói hai điểm rẻ hơn mua lẻ 10%.`,
            `Still missing: ${conThieu.map((d) => d.ten.en).join(", ")}. Two-site plans are 10% less than single tickets.`,
          )}{" "}
          <Link href={`/packages${duoi}`} className="font-bold underline underline-offset-2">{t("Xem vé và gói", "See tickets and plans")}</Link>
        </p>
      ) : null}

      <p className="mt-6 text-xs leading-5 text-[#6b786f]">
        {t(
          "Sổ dấu nằm trên trình duyệt của máy này, không gửi về đâu, không cần số điện thoại. Xoá dữ liệu trình duyệt hay đổi máy thì sổ trống. Dấu để lưu niệm; quà và vé miễn phí tính theo lượt qua cổng của vé đã gắn số (thẻ Lượt đi & quà).",
          "The stamp book lives in this browser only. Nothing is sent anywhere and no phone number is needed. Clearing browser data or switching phones empties it. Stamps are keepsakes; rewards and free tickets come from gate entries on tickets linked to your phone (Visits & rewards tab).",
        )}
      </p>
    </section>
  );
}
