"use client";

import { useId, useMemo, useState } from "react";

import {
  heSoBongTrang,
  phaTrang,
  TEN_PHA_EN,
  TEN_PHA_VI,
} from "@/domain/lunar-phase";
import { loiTinhTrang, tinhTrangMua } from "@/domain/mua-trang";
import { MoonWater } from "@/components/discovery/moon-water";

/**
 * Vòng trăng của mùa — ba đêm, ba mặt trăng khác nhau, bấm được.
 *
 * ## Thứ này thay cái gì
 *
 * Chỗ này từng là hai hình tròn tô đặc màu be, hai chấm quay quanh tâm ở hai
 * bán kính khác nhau, và một dòng chữ `Ngo Dong / Moon orbit` — in hoa, không
 * dấu, tiếng Anh lẫn tiếng Việt — đặt đè lên để **giải thích** rằng đó là mặt
 * trăng. Một hình cần chú thích mới hiểu là một hình đã hỏng. Nó cũng không
 * mang thông tin nào: cả ba đêm của mùa đều tròn y hệt nhau.
 *
 * ## Thứ nó làm được
 *
 * Mỗi đêm trong mùa có một pha trăng **tính thật** (`domain/lunar-phase.ts`),
 * và hình vẽ đổi theo: độ đầy, chiều khuyết, tên gọi. Đêm mở mùa là trăng
 * khuyết đầu tháng, đêm rằm gần trọn đĩa, đêm khép mùa đã bắt đầu xuống. Bấm
 * hoặc dùng phím mũi tên để đi giữa ba đêm.
 *
 * Vòng trăng **tự biết hôm nay là ngày nào trong mùa**: quanh mùa thì nó mở
 * sẵn ở đêm "tối nay" và tính trăng thật của đêm ấy, kèm một dòng đếm ngược
 * tới mốc kế tiếp; ngoài mùa thì lùi về đêm rằm. Bản đầu luôn mở ở đêm rằm bất
 * kể hôm nay là ngày nào — chủ dự án mở web trước rằm ba đêm và bắt ngay.
 *
 * Đây là **kỹ năng riêng của thế giới Trung thu**, đúng như ma trận chỉ đạo
 * sáng tạo yêu cầu: lịch–quỹ đạo–vật liệu, không mượn bộ hiệu ứng của trang
 * du lịch hay trang thương hiệu.
 *
 * ## Vẽ đúng chiều khuyết
 *
 * Phần sáng được dựng bằng **nửa đường tròn + một cung elip**. Bề rộng cung
 * elip là `|cos(2πp)|`; dấu của nó quyết định cung phình ra hay lõm vào — đó
 * chính là chỗ phân biệt một lưỡi liềm với một vầng trăng gần đầy, và cũng là
 * chỗ hầu hết mặt trăng vẽ tay bị sai. Nửa sau tuần trăng chỉ việc **lật
 * gương** hình của nửa đầu, nên không có cơ hội sai dấu hai lần.
 */

export type DemTrang = {
  /** Ngày dương, dạng `YYYY-MM-DD`. */
  ngay: string;
  nhan: { vi: string; en: string };
  loi: { vi: string; en: string };
};

const R = 150;
const TAM = 200;

function duongSang(pha: number) {
  const k = heSoBongTrang(pha);
  const rx = Math.abs(k) * R;
  // Đi từ đỉnh xuống đáy theo nửa đường tròn bên phải, rồi vòng lại bằng cung
  // elip. `sweep = 0` cho cung phình sang phải (lưỡi liềm), `1` cho cung lõm
  // sang trái (gần đầy).
  const sweep = k > 0 ? 0 : 1;
  return [
    `M ${TAM} ${TAM - R}`,
    `A ${R} ${R} 0 0 1 ${TAM} ${TAM + R}`,
    `A ${rx} ${R} 0 0 ${sweep} ${TAM} ${TAM - R}`,
    "Z",
  ].join(" ");
}

export function MoonDial({
  dem,
  lang,
  bayGio,
}: {
  dem: readonly DemTrang[];
  lang: "vi" | "en";
  /**
   * Thời điểm hiện tại, dạng ISO, **do máy chủ truyền xuống**. Không gọi
   * `new Date()` ngay trong lúc dựng: máy chủ và máy khách sẽ ra hai kết quả
   * khác nhau nên React kêu lệch hydrate, và tệ hơn, khách ở múi giờ khác sẽ
   * thấy một mùa trăng không phải của Ninh Bình.
   */
  bayGio: string;
}) {
  const id = useId();

  const { danhSach, macDinh, tinhTrang } = useMemo(() => {
    const iRam = Math.max(0, dem.findIndex((d) => d.nhan.vi.includes("rằm")));
    const tt = tinhTrangMua(new Date(bayGio), dem.map((d) => d.ngay), dem[iRam].ngay);
    if (!tt.hienToiNay) return { danhSach: dem, macDinh: iRam, tinhTrang: tt };
    // Hôm nay trùng đúng một đêm của mùa thì không thêm chip thứ tư — hai chip
    // cùng trỏ vào một đêm chỉ làm khách phân vân.
    const trungDem = dem.findIndex((d) => d.ngay === tt.homNay);
    if (trungDem >= 0) return { danhSach: dem, macDinh: trungDem, tinhTrang: tt };
    const [, thang, ngay] = tt.homNay.split("-");
    const toiNay: DemTrang = {
      ngay: tt.homNay,
      nhan: { vi: `Tối nay · ${ngay}.${thang}`, en: `Tonight · ${ngay}.${thang}` },
      loi: {
        vi: "Trăng đúng đêm nay trên sông Ngô Đồng — tính theo lịch trời, không phải một tấm ảnh chụp sẵn.",
        en: "The moon over the Ngo Dong tonight — computed from the sky, not a stock photo.",
      },
    };
    return { danhSach: [toiNay, ...dem], macDinh: 0, tinhTrang: tt };
  }, [dem, bayGio]);

  const [chon, setChon] = useState(macDinh);
  const demNay = danhSach[chon] ?? danhSach[macDinh];
  // 21 giờ Việt Nam — giờ người ta thật sự ngẩng lên nhìn, không phải 0 giờ.
  const pha = phaTrang(new Date(`${demNay.ngay}T21:00:00+07:00`));
  const tenPha = lang === "vi" ? TEN_PHA_VI[pha.ten] : TEN_PHA_EN[pha.ten];
  const phanTram = Math.round(pha.doSang * 100);

  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div className="relative aspect-square w-full">
        <svg
          viewBox="0 0 400 400"
          // Quầng sáng vẽ tràn ra ngoài khung vuông. Không khoá con trỏ thì
          // chính vòng tròn trong suốt ấy **nuốt cú bấm** của hàng nút ngay
          // bên dưới: chọn đêm khép mùa làm dòng chữ ngắn lại, hàng nút trồi
          // lên nằm dưới quầng, và hai đêm kia hết bấm được.
          className="pointer-events-none h-full w-full overflow-visible"
          role="img"
          aria-label={
            lang === "vi"
              ? `Trăng đêm ${demNay.nhan.vi}: ${tenPha}, sáng ${phanTram}%`
              : `Moon on ${demNay.nhan.en}: ${tenPha}, ${phanTram}% lit`
          }
        >
          <defs>
            {/* Quầng sáng quanh trăng — thứ làm một hình tròn thành mặt trăng. */}
            <radialGradient id={`${id}-quang`}>
              <stop offset="55%" stopColor="#f6e6bd" stopOpacity="0.34" />
              <stop offset="78%" stopColor="#e7b96a" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#e7b96a" stopOpacity="0" />
            </radialGradient>
            {/* Đĩa trăng tối dần về rìa, như một quả cầu nhận nắng xiên. */}
            <radialGradient id={`${id}-dia`} cx="38%" cy="33%" r="78%">
              <stop offset="0%" stopColor="#fffaf0" />
              <stop offset="58%" stopColor="#f3e4c2" />
              <stop offset="100%" stopColor="#cbb894" />
            </radialGradient>
            <clipPath id={`${id}-trong-dia`}>
              <circle cx={TAM} cy={TAM} r={R} />
            </clipPath>
            <path id={`${id}-sang`} d={duongSang(pha.pha)} />
            <clipPath id={`${id}-cat-sang`}>
              <use href={`#${id}-sang`} />
            </clipPath>
          </defs>

          <circle cx={TAM} cy={TAM} r={R * 1.9} fill={`url(#${id}-quang)`} />
          {/* Phần tối của đĩa vẫn hiện rất mờ — đêm rằm thì không thấy, đêm
              khuyết thì thấy được viền tròn, đúng như mắt thường nhìn. */}
          <circle cx={TAM} cy={TAM} r={R} fill="#1b2a25" opacity="0.55" />

          <g
            transform={pha.dangLen ? undefined : `translate(${TAM * 2} 0) scale(-1 1)`}
            className="transition-[transform] duration-700 motion-reduce:transition-none"
          >
            <use href={`#${id}-sang`} fill={`url(#${id}-dia)`} />
            {/* Biển trăng. Cắt theo phần sáng nên chúng khuất dần cùng bóng,
                thay vì trôi lơ lửng trên nền tối. */}
            <g clipPath={`url(#${id}-cat-sang)`} fill="#b9a37f" opacity="0.4">
              <ellipse cx="168" cy="160" rx="42" ry="33" />
              <ellipse cx="232" cy="139" rx="26" ry="21" />
              <ellipse cx="205" cy="241" rx="34" ry="24" />
              <ellipse cx="146" cy="243" rx="17" ry="15" />
              <ellipse cx="253" cy="216" rx="14" ry="12" />
            </g>
          </g>
          <circle
            cx={TAM}
            cy={TAM}
            r={R}
            fill="none"
            stroke="rgba(231,185,106,.3)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/*
        Mặt nước ngay dưới trăng. Vệt sáng rộng hẹp theo đúng pha của đêm đang
        chọn — đêm khuyết vệt hẹp, đêm rằm vệt rộng — nên đổi đêm là đổi cả
        mặt sông, không chỉ đổi cái đĩa tròn phía trên.
      */}
      <MoonWater doSang={pha.doSang} className="-mt-3 h-28 sm:h-32" />

      <p className="mt-2 text-center text-sm text-white/72" data-moon-phase>
        <span className="font-semibold text-[#e7b96a]">{tenPha}</span>
        {lang === "vi" ? ` · sáng ${phanTram}%` : ` · ${phanTram}% lit`}
      </p>
      {/* Chiều cao giữ cố định: lời của mỗi đêm dài ngắn khác nhau, để trôi thì
          hàng nút nhảy lên nhảy xuống ngay dưới ngón tay đang bấm. */}
      <p className="mx-auto mt-1 flex min-h-[5.25rem] max-w-sm items-start justify-center text-center text-sm leading-6 text-white/58 sm:min-h-[3.75rem]">
        {lang === "vi" ? demNay.loi.vi : demNay.loi.en}
      </p>

      <div
        role="radiogroup"
        aria-label={lang === "vi" ? "Các đêm của mùa trăng" : "Nights of the moon season"}
        className="mt-5 flex flex-wrap justify-center gap-2"
        onKeyDown={(su) => {
          if (su.key !== "ArrowRight" && su.key !== "ArrowLeft") return;
          su.preventDefault();
          const buoc = su.key === "ArrowRight" ? 1 : -1;
          setChon((truoc) => (truoc + buoc + danhSach.length) % danhSach.length);
        }}
      >
        {danhSach.map((d, i) => (
          <button
            key={d.ngay}
            type="button"
            role="radio"
            aria-checked={i === chon}
            tabIndex={i === chon ? 0 : -1}
            onClick={() => setChon(i)}
            className={[
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition motion-reduce:transition-none",
              i === chon
                ? "border-[#e7b96a] bg-[#e7b96a]/14 font-bold text-[#f3d9a6]"
                : "border-white/22 text-white/70 hover:border-white/45 hover:text-white",
            ].join(" ")}
          >
            {lang === "vi" ? d.nhan.vi : d.nhan.en}
          </button>
        ))}
      </div>

      {/* Mùa đang ở đâu, tính từ hôm nay. */}
      <p
        data-moon-season={tinhTrang.giaiDoan}
        className="mt-3 text-center text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#e7b96a]/78"
      >
        {loiTinhTrang(tinhTrang, lang)}
      </p>
    </div>
  );
}
