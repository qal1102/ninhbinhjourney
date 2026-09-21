"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";

import { BrandMap, type GhimBanDo } from "@/components/shared/brand-map";
import type { Destination, DestinationId, Language, MapCopy } from "./ninh-binh-landing";

/**
 * Bản đồ trang chủ.
 *
 * ## Hai thứ đổi so với bản Leaflet
 *
 * 1. **Nguồn dữ liệu.** OpenFreeMap thay máy chủ ảnh nền miễn phí của
 *    OpenStreetMap — chỗ cấm dùng thương mại và bóp lưu lượng, tức nguyên nhân
 *    thật của "bản đồ liên tục bị lỗi". Chi tiết ở `lib/map/brand-style.ts`.
 * 2. **Bong bóng popup của thư viện đổi thành một tấm thiệp của trang.** Popup
 *    mặc định là hình hộp trắng bo góc có cái đuôi nhọn — thứ mà mọi bản đồ
 *    trên mạng đều có, và là chỗ dễ nhận ra nhất rằng trang này đang dùng đồ
 *    mặc định. Tấm thiệp ở đây là một phần của trang: ảnh tràn viền, chữ theo
 *    đúng hệ chữ, hai nút đúng hình dáng nút của trang. Trên điện thoại nó là
 *    một phiếu trượt lên từ mép dưới; trên máy bàn là một thẻ nằm cạnh bản đồ.
 */

type TourismMapProps = {
  activeDestinationId: DestinationId | "welcome";
  copy: MapCopy;
  destinations: Destination[];
  lang: Language;
  onAdd: (id: DestinationId) => void;
  onDiscover: (id: DestinationId) => void;
  selectedIds: DestinationId[];
};

const VUNG_NINH_BINH: [[number, number], [number, number]] = [
  [19.82, 105.42],
  [20.72, 106.28],
];

/**
 * Tấm thiệp nằm ở đâu thì đẩy điểm đang chọn về phía ngược lại.
 *
 * Máy bàn: thiệp bên trái, đẩy điểm sang phải. Điện thoại: thiệp ở mép dưới,
 * đẩy điểm lên trên.
 */
const KHO_HEP = "(max-width: 639px)";

function useKhoHep() {
  return useSyncExternalStore(
    (doiY) => {
      const mq = window.matchMedia(KHO_HEP);
      mq.addEventListener("change", doiY);
      return () => mq.removeEventListener("change", doiY);
    },
    () => window.matchMedia(KHO_HEP).matches,
    () => false,
  );
}

function trongVung(viTri: [number, number]) {
  const [[nam, tay], [bac, dong]] = VUNG_NINH_BINH;
  return viTri[0] >= nam && viTri[0] <= bac && viTri[1] >= tay && viTri[1] <= dong;
}

export default function TourismMap({
  activeDestinationId,
  copy,
  destinations,
  lang,
  onAdd,
  onDiscover,
  selectedIds,
}: TourismMapProps) {
  const [dangMo, setDangMo] = useState<string | null>(
    activeDestinationId === "welcome" ? null : activeDestinationId,
  );
  const [viTriKhach, setViTriKhach] = useState<[number, number] | null>(null);
  const khoHep = useKhoHep();
  const [anLoiChao, setAnLoiChao] = useState(false);
  const [tinhTrangViTri, setTinhTrangViTri] = useState("");
  const [dangDo, setDangDo] = useState(false);

  // Trang cha đổi điểm đang xem (khi khách bấm trong danh sách) thì bản đồ
  // phải bay theo, không đợi ai bấm lên ghim. Chỉnh thẳng trong lúc dựng chứ
  // không đặt vào `useEffect`: đặt vào effect là dựng hai lượt mỗi lần đổi,
  // và React đã có đúng khuôn cho việc này.
  const [chonTruocDo, setChonTruocDo] = useState(activeDestinationId);
  if (chonTruocDo !== activeDestinationId) {
    setChonTruocDo(activeDestinationId);
    setDangMo(activeDestinationId === "welcome" ? null : activeDestinationId);
  }

  const ghim = useMemo<GhimBanDo[]>(() => {
    const ds: GhimBanDo[] = destinations.map((d, i) => ({
      id: d.id,
      toaDo: d.position,
      nhan: d.name[lang],
      thuTu: i + 1,
      khoa: d.id,
    }));
    // KHÔNG ghim "điểm chào đón" ở tâm vùng nữa. Tâm vùng rơi gần như trùng
    // toạ độ Tràng An, nên cái ghim ấy nằm đè lên ghim Tràng An và **nuốt cú
    // bấm** — bài kiểm bắt được đúng lúc nó chặn. Lời chào chuyển thành tấm
    // thiệp mở sẵn ở dưới, nói được nhiều hơn mà không chắn ai.
    if (viTriKhach) {
      ds.push({ id: "toi-dang-o-day", toaDo: viTriKhach, nhan: copy.youAreHere, lop: "nb-marker-toi" });
    }
    return ds;
  }, [copy.youAreHere, destinations, lang, viTriKhach]);

  const moRa = destinations.find((d) => d.id === dangMo) ?? null;

  function baoTinhTrang(loi: string) {
    setTinhTrangViTri(loi);
    window.setTimeout(() => {
      setTinhTrangViTri((hienTai) => (hienTai === loi ? "" : hienTai));
    }, 4500);
  }

  function doViTri() {
    if (!navigator.geolocation) {
      baoTinhTrang(copy.locationDenied);
      return;
    }
    setDangDo(true);
    baoTinhTrang(copy.locating);
    navigator.geolocation.getCurrentPosition(
      (ket) => {
        const viTri: [number, number] = [ket.coords.latitude, ket.coords.longitude];
        if (trongVung(viTri)) {
          setViTriKhach(viTri);
          setDangMo("toi-dang-o-day");
          baoTinhTrang(copy.locationFound);
        } else {
          setViTriKhach(null);
          setDangMo(null);
          baoTinhTrang(copy.locationOutside);
        }
        setDangDo(false);
      },
      () => {
        setViTriKhach(null);
        setDangMo(null);
        baoTinhTrang(copy.locationDenied);
        setDangDo(false);
      },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 },
    );
  }

  return (
    <div className="relative h-[560px] min-h-[70vh] w-full">
      <BrandMap
        ghim={ghim}
        dangChon={dangMo}
        nhanVung="Bản đồ điểm đến Ninh Bình"
        className="h-full w-full rounded-[8px]"
        doiTamKhiChon={khoHep ? [0, -150] : [170, 0]}
        onChonGhim={(id) => setDangMo(id)}
      />

      {/* Nút "gần tôi" — đặt ngoài bản đồ nên nó là một nút thật của trang,
          có chữ tiếng Việt và vùng chạm đủ lớn, không phải một ô vuông nhỏ
          kiểu điều khiển mặc định. */}
      <div className="pointer-events-none absolute left-3 top-3 z-[5] flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
        <button
          type="button"
          onClick={doViTri}
          disabled={dangDo}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-[#FBFAF6]/94 px-4 text-sm font-bold text-[#183F34] shadow-lg shadow-[#183F34]/15 backdrop-blur transition hover:bg-white disabled:opacity-70 motion-reduce:transition-none"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-[#2f80ed]" />
          {dangDo ? copy.locating : copy.nearMe}
        </button>
        {tinhTrangViTri ? (
          <p
            role="status"
            className="pointer-events-none rounded-2xl bg-[#183F34]/92 px-3 py-2 text-xs font-medium text-[#F6F2E7]"
          >
            {tinhTrangViTri}
          </p>
        ) : null}
      </div>

      {/* Chưa chọn gì thì bản đồ tự giới thiệu. Bấm một ghim là tấm thiệp này
          nhường chỗ cho điểm đến. */}
      {dangMo === null ? (
        <ThiepBanDo onDong={() => setAnLoiChao(true)} an={anLoiChao} nhanDong="Đóng lời giới thiệu bản đồ">
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">
              {copy.welcome}
            </p>
            <h3 className="font-display mt-1 text-2xl text-[#183F34]">Ninh Bình</h3>
            <p className="mt-2 text-sm leading-6 text-[#6D756F]">{copy.welcomeDescription}</p>
          </div>
        </ThiepBanDo>
      ) : null}

      {dangMo === "toi-dang-o-day" ? (
        <ThiepBanDo onDong={() => setDangMo(null)} nhanDong="Đóng thẻ vị trí của bạn">
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">
              {copy.youAreHere}
            </p>
          </div>
        </ThiepBanDo>
      ) : null}

      {moRa ? (
        <ThiepBanDo onDong={() => setDangMo(null)}>
          <article>
            <div className="relative h-36 w-full">
              <Image
                src={moRa.image}
                alt={moRa.name[lang]}
                fill
                sizes="320px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(24,63,52,.45))]" />
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">
                {moRa.category[lang]} · {moRa.duration[lang]}
              </p>
              <h3 className="font-display mt-1 text-2xl text-[#183F34]">{moRa.name[lang]}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6D756F]">
                {moRa.shortDescription[lang]}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDiscover(moRa.id)}
                  className="min-h-11 rounded-full bg-[#183F34] px-3 text-[0.82rem] font-bold leading-4 text-white"
                >
                  {copy.discover}
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(moRa.id)}
                  className="min-h-11 rounded-full border border-[#A8CEC1] px-3 text-[0.82rem] font-bold leading-4 text-[#183F34]"
                >
                  {selectedIds.includes(moRa.id) ? copy.added : copy.add}
                </button>
              </div>
            </div>
          </article>
        </ThiepBanDo>
      ) : null}
    </div>
  );
}

/**
 * Tấm thiệp nổi trên bản đồ.
 *
 * Điện thoại: trượt lên từ mép dưới, rộng hết bề ngang — ngón cái với tới
 * được. Máy bàn: thẻ đứng bên trái, không che phần bản đồ đang có ghim.
 */
function ThiepBanDo({
  children,
  onDong,
  an = false,
  nhanDong = "Đóng thẻ điểm đến",
}: {
  children: React.ReactNode;
  onDong: () => void;
  an?: boolean;
  /** Mỗi tấm thiệp một tên nút đóng riêng: hai nút cùng tên là trình đọc màn
   * hình đọc lên giống hệt nhau, và bài kiểm cũng không phân biệt nổi. */
  nhanDong?: string;
}) {
  if (an) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] p-3 sm:inset-auto sm:bottom-4 sm:left-4 sm:w-80 sm:p-0">
      <div className="pointer-events-auto relative overflow-hidden rounded-2xl bg-[#FBFAF6] shadow-2xl shadow-[#183F34]/25 motion-safe:animate-[nbThiepLen_.32s_ease-out]">
        <button
          type="button"
          onClick={onDong}
          aria-label={nhanDong}
          className="absolute right-2 top-2 z-[1] grid h-9 w-9 place-items-center rounded-full bg-[#183F34]/78 text-[#FBFAF6] backdrop-blur transition hover:bg-[#183F34] motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
