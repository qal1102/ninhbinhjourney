
/**
 * Dải núi đá vôi và sương, kiểu tranh thuỷ mặc, cho các trang nền giấy sáng
 * (Khám phá, Lập hành trình, Gói, Nghe thuyết minh…). Trang có ảnh lớn dùng
 * sương vén lên ảnh; trang không có ảnh thì tự vẽ lấy cảnh của mình.
 *
 * - Bốn lớp núi vẽ bằng SVG, dáng núi đá vôi Ninh Bình: khối cao, vách gần
 *   dựng đứng, đỉnh bo tròn lệch. Mỗi lớp đậm ở đỉnh, nhạt dần và tan vào
 *   sương ở chân, như nét mực loang trên giấy dó. Mỗi trang một dãy núi riêng
 *   (`hat`), vẽ y hệt ở máy chủ và máy khách nên không lệch hydrate.
 * - Sương (dải màu CSS `.nui-suong-man`, màu giấy) nằm giữa núi xa và núi gần, nên núi gần đứng
 *   trước sương: chiều sâu đến từ lớp, không từ nét kẻ. Mở trang là sương phủ
 *   kín rồi kéo xuống, dãy núi hiện ra.
 * - Một con đò nhỏ trôi chậm qua mặt nước. Cuộn xuống thì các lớp núi trôi
 *   lệch tốc độ (CSS cuộn, không JS).
 *
 * Thuần trang trí: `aria-hidden`.
 */

type Props = {
  /** Chuỗi bất kỳ: mỗi trang một dãy núi khác nhau. */
  hat: string;
  /** `gon` cho trang thao tác (tra vé, hồ sơ): dải thấp hơn. */
  co?: "vua" | "gon";
};

function soNgauNhien(hat: string) {
  let h = 1779033703 ^ hat.length;
  for (let i = 0; i < hat.length; i++) {
    h = Math.imul(h ^ hat.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RONG = 1440;
const CAO = 340;
const MAU_SUONG = "#f1ede4";

/** Một dãy núi: các khối dựng đứng, đỉnh bo lệch, có khe trống giữa các khối. */
function dayNui(ngau: () => number, chan: number, thapNhat: number, caoNhat: number, rongMin: number, rongMax: number) {
  const so = (x: number) => Math.round(x * 10) / 10;
  let d = `M0 ${CAO} L0 ${chan}`;
  let x = -ngau() * rongMax * 0.6;
  while (x < RONG) {
    const w = rongMin + ngau() * (rongMax - rongMin);
    // Vài khối vọt hẳn lên: dáng tháp đá của Tràng An, Tam Cốc.
    const h = (thapNhat + ngau() * (caoNhat - thapNhat)) * (ngau() < 0.28 ? 1.45 : 1);
    const dinh = chan - h;
    const lech = (ngau() - 0.5) * 0.24;
    const cuoi = x + w;
    d +=
      ` L${so(x)} ${chan}` +
      ` C${so(x - w * 0.06)} ${so(chan - h * 0.5)} ${so(x + w * 0.04)} ${so(dinh + h * 0.26)} ${so(x + w * (0.22 + lech))} ${so(dinh + h * 0.07)}` +
      ` C${so(x + w * (0.38 + lech))} ${so(dinh - h * 0.05)} ${so(x + w * (0.6 + lech))} ${so(dinh - h * 0.02)} ${so(x + w * (0.76 + lech))} ${so(dinh + h * 0.09)}` +
      ` C${so(x + w * 0.98)} ${so(dinh + h * 0.24)} ${so(cuoi + w * 0.06)} ${so(chan - h * 0.5)} ${so(cuoi)} ${chan}`;
    x += w * (0.55 + ngau() * 0.6);
  }
  return `${d} L${RONG} ${chan} L${RONG} ${CAO} Z`;
}

const LOP = [
  { muc: "#c3cdc6", chan: 250, thap: 90, cao: 170, rongMin: 70, rongMax: 150, troi: "40px" },
  { muc: "#9fb0a6", chan: 282, thap: 70, cao: 140, rongMin: 56, rongMax: 128, troi: "26px" },
  { muc: "#748a7f", chan: 312, thap: 50, cao: 112, rongMin: 46, rongMax: 104, troi: "14px" },
  { muc: "#4f655a", chan: 340, thap: 36, cao: 92, rongMin: 40, rongMax: 92, troi: "4px" },
] as const;

export function NuiSuong({ hat, co = "vua" }: Props) {
  const ngau = soNgauNhien(hat);
  const duong = LOP.map((lop) => dayNui(ngau, lop.chan, lop.thap, lop.cao, lop.rongMin, lop.rongMax));
  const lopSvg = (i: number) => {
    const lop = LOP[i];
    const id = `nui-${hat}-${i}`;
    return (
      <svg
        key={i}
        className="nui-suong-lop"
        style={{ ["--troi" as string]: lop.troi }}
        viewBox={`0 0 ${RONG} ${CAO}`}
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          {/* Đậm ở đỉnh, tan vào sương ở chân. */}
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={lop.chan - lop.cao * 1.45} x2="0" y2={lop.chan}>
            <stop offset="0" stopColor={lop.muc} />
            <stop offset="0.5" stopColor={lop.muc} stopOpacity="0.92" />
            <stop offset="1" stopColor={MAU_SUONG} />
          </linearGradient>
        </defs>
        <path d={duong[i]} fill={`url(#${id})`} />
      </svg>
    );
  };
  return (
    <div aria-hidden="true" data-nui-suong className={`nui-suong ${co === "gon" ? "nui-suong-gon" : ""}`}>
      {lopSvg(0)}
      {lopSvg(1)}
      <div className="nui-suong-man" />
      {lopSvg(2)}
      {lopSvg(3)}
      <div className="nui-suong-do">
        <svg viewBox="0 0 64 22" aria-hidden="true">
          {/* Đò nan và người chèo đội nón, một nét đậm như mực. */}
          <path d="M2 15 Q32 22 62 15 Q60 18 54 19 L10 19 Q4 18 2 15 Z" fill="#33463c" />
          <path d="M40 15 L42 7 L44 15 Z" fill="#33463c" />
          <path d="M36 7.5 Q42 2 48 7.5 Z" fill="#33463c" />
          <path d="M44 9 L58 21" stroke="#33463c" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
