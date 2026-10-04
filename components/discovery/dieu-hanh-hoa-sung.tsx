import { DUONG_TAM_COC } from "@/domain/thuyen-duong-song";
import { TUYEN_THUYEN } from "@/domain/thuyen-song";
import { DungChuyenDongSvg } from "./dung-chuyen-dong-svg";

/**
 * Đoàn thuyền hoa súng diễu qua ba hang, vẽ trên đúng đường đò Tam Cốc mà
 * bản đồ thuyền trong ERP đang dùng (`domain/thuyen-duong-song.ts`, dựng từ
 * OpenStreetMap). Lễ Sắc Hồng 2025 có "hàng trăm chiếc thuyền được trang trí
 * thành những đóa hoa súng khổng lồ" đi qua Hang Cả, Hang Hai, Hang Ba; hình
 * này vẽ một đoàn nhỏ tượng trưng, không nói con số.
 *
 * Dựng hẳn trên máy chủ bằng SVG có chuyển động sẵn (SMIL), không cần mã
 * phía trình duyệt; khách bật giảm chuyển động thì `DungChuyenDongSvg` dừng
 * đoàn thuyền tại chỗ.
 */

const RONG = 1000;
const CAO = 560;
const LE = 60;

function chieu(): { duong: string; moc: { ten: string; x: number; y: number }[] } {
  const diem = [...DUONG_TAM_COC];
  const lons = diem.map((p) => p[0]);
  const lats = diem.map((p) => p[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const minX = Math.min(...lons) * kx;
  const maxX = Math.max(...lons) * kx;
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const tiLe = Math.min((RONG - 2 * LE) / (maxX - minX), (CAO - 2 * LE) / (maxY - minY));
  const lechX = (RONG - (maxX - minX) * tiLe) / 2;
  const lechY = (CAO - (maxY - minY) * tiLe) / 2;
  const ra = (lon: number, lat: number) => ({
    x: lechX + (lon * kx - minX) * tiLe,
    y: lechY + (maxY - lat) * tiLe,
  });
  const duong = diem
    .map((p, i) => {
      const { x, y } = ra(p[0], p[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const moc = TUYEN_THUYEN["tam-coc"].moc.map((m) => ({ ten: m.ten, ...ra(m.lonLat[0], m.lonLat[1]) }));
  return { duong, moc };
}

const THUYEN = 7;
const VONG_GIAY = 48;

export function DieuHanhHoaSung({ lang }: { lang: "vi" | "en" }) {
  const { duong, moc } = chieu();
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  return (
    <figure className="relative overflow-hidden rounded-[28px] border border-[#e3d6e6] bg-[#f6f0f3]" data-testid="dieu-hanh-hoa-sung">
      <DungChuyenDongSvg id="svg-dieu-hanh" />
      <svg
        id="svg-dieu-hanh"
        viewBox={`0 0 ${RONG} ${CAO}`}
        className="block h-auto w-full"
        role="img"
        aria-label={t(
          "Đường đò Tam Cốc từ bến Văn Lâm qua Hang Cả, Hang Hai tới Hang Ba rồi quay về, đoàn thuyền kết hoa súng đi trên đó.",
          "The Tam Coc boat route from Van Lam pier through Hang Ca and Hang Hai to Hang Ba and back, with lily-decked boats on it.",
        )}
      >
        <defs>
          <radialGradient id="thuyen-hoa" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffe9f2" />
            <stop offset="0.6" stopColor="#e39abb" />
            <stop offset="1" stopColor="#9a5fb8" />
          </radialGradient>
        </defs>
        {/* Dòng sông: nét rộng màu nước, nét mảnh ở giữa là đường đò. */}
        <path d={duong} fill="none" stroke="#bcd3cf" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        <path d={duong} fill="none" stroke="#e8f0ee" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        <path d={duong} fill="none" stroke="#7b9a93" strokeWidth={1.6} strokeDasharray="6 7" />
        {Array.from({ length: THUYEN }, (_, i) => (
          <g key={i}>
            <circle r={13} fill="url(#thuyen-hoa)" stroke="#ffffff" strokeWidth={2} />
            {Array.from({ length: 8 }, (__, k) => (
              <ellipse key={k} cx={0} cy={-9} rx={3.2} ry={7} fill="#f7d3e4" transform={`rotate(${k * 45})`} opacity={0.9} />
            ))}
            <circle r={3.4} fill="#f5c84c" />
            {/* Đi hết đường tới Hang Ba rồi quay về bến, mỗi thuyền xuất phát lệch nhau. */}
            <animateMotion
              dur={`${VONG_GIAY}s`}
              repeatCount="indefinite"
              keyPoints="0;1;0"
              keyTimes="0;0.5;1"
              calcMode="linear"
              begin={`${(-i * VONG_GIAY) / THUYEN / 2.6}s`}
              path={duong}
            />
          </g>
        ))}
        {moc.map((m) => (
          <g key={m.ten}>
            <circle cx={m.x} cy={m.y} r={7} fill="#ffffff" stroke="#183f34" strokeWidth={2.5} />
            <text x={m.x + 12} y={m.y + 5} fontSize={20} fontWeight={700} fill="#183f34" stroke="#f6f0f3" strokeWidth={4} paintOrder="stroke">
              {m.ten}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="border-t border-[#e3d6e6] px-5 py-3 text-xs leading-5 text-[#6b5f70]">
        {t(
          "Đường đò thật dựng từ OpenStreetMap. Hình chỉ tượng trưng cho đoàn diễu hành, không phải số thuyền thật.",
          "The real boat route, traced from OpenStreetMap. The procession is illustrative, not the real number of boats.",
        )}
      </figcaption>
    </figure>
  );
}
