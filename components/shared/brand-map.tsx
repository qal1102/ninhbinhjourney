"use client";

import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import { useEffect, useId, useRef, useState } from "react";

import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import {
  GHI_CONG_BAN_DO,
  kieuBanDoThuongHieu,
  TAM_NINH_BINH,
  type ToneBanDo,
} from "@/lib/map/brand-style";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Bản đồ dùng chung, vẽ bằng MapLibre trên dữ liệu vector của OpenFreeMap.
 *
 * ## Vì sao thay Leaflet
 *
 * Bản đồ cũ lấy ảnh nền thẳng từ máy chủ miễn phí của OpenStreetMap — nơi
 * **cấm dùng cho mục đích thương mại** và bóp lưu lượng khi bị gọi nhiều. Đó
 * mới là nguyên nhân thật của "bản đồ liên tục bị lỗi": không phải mã sai, mà
 * là chọn sai nhà cung cấp. OpenFreeMap không khoá API, không đăng ký, không
 * giới hạn lượt xem và cho dùng thương mại.
 *
 * Đổi sang dữ liệu vector còn mở ra ba thứ mà ảnh nền dạng ảnh không làm được:
 *
 * 1. **Tự tô màu từng lớp** theo bảng màu thương hiệu (`lib/map/brand-style.ts`)
 *    — bản đồ thôi trông như mọi bản đồ khác trên mạng.
 * 2. **Nghiêng và xoay**, nhà dựng thành khối có chiều cao thật.
 * 3. **Bay tới điểm** mượt thay vì nhảy cóc giữa các khung ảnh.
 *
 * ## Giao kèo giữ nguyên từ bản Leaflet
 *
 * Ghim vẫn mang lớp `nb-marker` / `nb-marker-active` và thuộc tính
 * `data-map-destination` — kiểu dáng trong `globals.css` và các bài kiểm đang
 * bám vào đó. Khung bản đồ mang thêm `data-brand-map` để bài kiểm hỏi được
 * "có bản đồ thật không" mà không phải biết bản đồ chạy bằng thư viện nào.
 */

export type GhimBanDo = {
  id: string;
  /** `[vĩ độ, kinh độ]` — giữ đúng quy ước sẵn có của kho dữ liệu điểm đến. */
  toaDo: readonly [number, number];
  nhan: string;
  /** Số thứ tự in trong ghim; bỏ trống thì ghim là một chấm tròn. */
  thuTu?: number;
  /** Đưa ra `data-map-destination` để bài kiểm và trang danh sách tìm lại. */
  khoa?: string;
  /** Lớp CSS thêm cho ghim, ví dụ `nb-marker-neutral` hay `nb-marker-toi`. */
  lop?: string;
  /**
   * Lớp gốc thay cho `nb-marker` — dùng khi ghim có hình dáng riêng đã tả sẵn
   * trong `globals.css`: `nb-route-pin` của hành trình, `nb-passport-pin` của
   * tấm hộ chiếu.
   */
  goc?: string;
  /** Tên in cạnh ghim, ví dụ "Tràng An" trên tấm hộ chiếu. */
  nhanPhu?: string;
  /** Lớp cho `nhanPhu`, ví dụ `nb-passport-label is-left`. */
  lopNhanPhu?: string;
  /** Thuộc tính `data-*` gắn thêm — kiểu dáng và bài kiểm đang bám vào. */
  thuocTinh?: Readonly<Record<string, string>>;
  /** Ghim chỉ để nhìn, không bấm được. */
  khongBam?: boolean;
  /** Nổi lên trên khi hai ghim sát nhau. */
  noiBat?: boolean;
};

/** Đường nối các ghim — vẽ trên mặt bản đồ, dưới ghim. */
export type DuongNoi = {
  /** Dãy `[vĩ độ, kinh độ]` theo đúng thứ tự đi. */
  diem: readonly (readonly [number, number])[];
  mau: string;
  beRong?: number;
  /** Nét đứt, tính theo bội số bề rộng đường. */
  netDut?: readonly [number, number];
  doMo?: number;
};

export type BrandMapProps = {
  ghim: readonly GhimBanDo[];
  /** `id` của ghim đang chọn. */
  dangChon?: string | null;
  onChonGhim?: (id: string, phanTu: HTMLElement) => void;
  nhanVung: string;
  className?: string;
  tone?: ToneBanDo;
  /** Khoá mọi thao tác — dùng cho bản đồ nhỏ chỉ để ghim vị trí. */
  tinh?: boolean;
  /** Đường nối các ghim, nếu có. */
  duongNoi?: DuongNoi | null;
  /**
   * Lề khi ôm trọn bộ ghim vào khung, tính bằng pixel.
   *
   * Nhận cả bốn phía riêng vì có bản đồ phải chừa mép dưới rộng hơn: đó là chỗ
   * dòng ghi nguồn, và là chỗ dải nhắn "bản đồ chưa về kịp" hiện lên — dải ấy
   * không được đè lên ghim nào ở phía nam.
   */
  le?: number | { top: number; bottom: number; left: number; right: number };
  /** Mức phóng lớn nhất khi ôm trọn bộ ghim. */
  zoomToiDa?: number;
  tamMacDinh?: readonly [number, number];
  zoomMacDinh?: number;
  /** Lời nhắn khi bản đồ không tải được. `null` thì không hiện chữ nào. */
  loiNhanHong?: string | null;
  /**
   * Độ lệch (pixel) của điểm được chọn so với tâm khung, khi bay tới.
   *
   * Có tấm thiệp nổi đè lên bản đồ thì điểm vừa chọn hay nằm đúng sau tấm
   * thiệp ấy — khách bấm một ghim rồi không còn thấy cái ghim mình vừa bấm.
   * Đẩy tâm sang chỗ trống là xong.
   */
  doiTamKhiChon?: readonly [number, number];
};

export const LOI_NHAN_HONG_TUONG_TAC =
  "Bản đồ chưa về kịp. Các điểm vẫn ghim đúng chỗ, mời bạn chọn thử một nơi.";
export const LOI_NHAN_HONG_TINH =
  "Bản đồ chưa về kịp. Vị trí các điểm vẫn ghim đúng chỗ.";

/**
 * Chữ của chính MapLibre, dịch sang tiếng Việt.
 *
 * Bỏ qua chỗ này là trên một trang tiếng Việt bỗng hiện "Use ctrl + scroll to
 * zoom the map" và nút điều khiển đọc lên thành "Zoom in" trong trình đọc màn
 * hình. Không ai để ý cho tới khi nó nằm giữa màn hình.
 */
const CHU_MAPLIBRE = {
  "AttributionControl.ToggleAttribution": "Nguồn dữ liệu bản đồ",
  "AttributionControl.MapFeedback": "Góp ý về bản đồ",
  "NavigationControl.ZoomIn": "Phóng to",
  "NavigationControl.ZoomOut": "Thu nhỏ",
  "NavigationControl.ResetBearing": "Xoay lại hướng bắc",
  "CooperativeGesturesHandler.WindowsHelpText": "Giữ Ctrl rồi cuộn để phóng to bản đồ",
  "CooperativeGesturesHandler.MacHelpText": "Giữ ⌘ rồi cuộn để phóng to bản đồ",
  "CooperativeGesturesHandler.MobileHelpText": "Dùng hai ngón để di chuyển bản đồ",
};

function camUng() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/** Độ nghiêng khi bay tới một điểm — vừa đủ thấy khối, không tới mức chóng mặt. */
const NGHIENG_KHI_CHON = 48;
const ZOOM_KHI_CHON = 14.2;

function lopGhim(ghim: GhimBanDo, dangChon: boolean) {
  const goc = ghim.goc ?? "nb-marker";
  // Chỉ ghim mặc định mới có lớp "đang chọn" dựng sẵn. Ghim hình dáng riêng
  // tự nói trạng thái của nó qua `lop` (`is-lit`, `is-fresh`…), đặt thêm một
  // lớp `nb-route-pin-active` không ai tả trong CSS chỉ là rác.
  const chon = dangChon && !ghim.goc ? "nb-marker-active" : "";
  return [goc, chon, ghim.lop ?? ""].filter(Boolean).join(" ");
}

/** Đổ lại phần ruột của ghim: số thứ tự, rồi tên đặt cạnh nếu có. */
function doRuotGhim(el: HTMLElement, ghim: GhimBanDo) {
  el.textContent = ghim.thuTu ? String(ghim.thuTu) : "";
  if (!ghim.nhanPhu) return;
  const ten = document.createElement("span");
  if (ghim.lopNhanPhu) ten.className = ghim.lopNhanPhu;
  ten.textContent = ghim.nhanPhu;
  el.appendChild(ten);
}

function dungPhanTuGhim(ghim: GhimBanDo, dangChon: boolean) {
  // Ghim bấm được là một cái nút thật, để bàn phím tới được. Ghim chỉ để nhìn
  // thì là một cái `div` và **ẩn khỏi trình đọc màn hình**: những trang dùng
  // loại ghim này đều in sẵn danh sách các điểm ngay bên dưới bản đồ, nên đọc
  // lên lần nữa chỉ làm người dùng nghe hai lần cùng một danh sách.
  const bamDuoc = !ghim.khongBam;
  const el = document.createElement(bamDuoc ? "button" : "div");
  if (bamDuoc) {
    (el as HTMLButtonElement).type = "button";
    el.setAttribute("aria-label", ghim.nhan);
  } else {
    el.setAttribute("aria-hidden", "true");
  }
  el.className = lopGhim(ghim, dangChon);
  doRuotGhim(el, ghim);
  if (ghim.khoa) el.setAttribute("data-map-destination", ghim.khoa);
  el.setAttribute("data-map-pin", ghim.id);
  for (const [ten, gia] of Object.entries(ghim.thuocTinh ?? {})) {
    el.setAttribute(ten, gia);
  }
  if (ghim.noiBat) el.style.zIndex = "2";
  return el;
}

const ID_DUONG_NOI = "nb-duong-noi";

/** GeoJSON của đường nối, hoặc một bộ rỗng khi chưa đủ hai điểm. */
function hinhDuong(duong: DuongNoi | null): GeoJSON.FeatureCollection {
  const diem = duong?.diem ?? [];
  if (diem.length < 2) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: diem.map((d) => [d[1], d[0]]),
        },
      },
    ],
  };
}

export function BrandMap({
  ghim,
  dangChon = null,
  onChonGhim,
  nhanVung,
  className = "",
  tone = "giay",
  tinh = false,
  duongNoi = null,
  le = 56,
  zoomToiDa = 13,
  tamMacDinh,
  zoomMacDinh = 10,
  loiNhanHong = LOI_NHAN_HONG_TUONG_TAC,
  doiTamKhiChon,
}: BrandMapProps) {
  const khung = useRef<HTMLDivElement | null>(null);
  const banDo = useRef<MapLibreMap | null>(null);
  const cacGhim = useRef(new Map<string, Marker>());
  const daBay = useRef(false);
  // Khung ôm trọn bộ ghim của lần dựng gần nhất, để đo lại được khi khung đổi cỡ.
  const khungCuoi = useRef<{
    bien: maplibregl.LngLatBounds;
    padding: BrandMapProps["le"];
    maxZoom: number;
  } | null>(null);
  const itChuyenDong = useReducedMotion();
  const [hong, setHong] = useState(false);
  const idVung = useId();

  // Giữ hàm gọi lại trong ref: MapLibre gắn sự kiện một lần lúc dựng ghim, mà
  // hàm từ trang cha thì đổi mỗi lượt vẽ lại.
  const goiLai = useRef(onChonGhim);
  useEffect(() => {
    goiLai.current = onChonGhim;
  }, [onChonGhim]);

  useEffect(() => {
    if (!khung.current || banDo.current) return;
    // Chép ra biến để hàm dọn dẹp không phải đọc lại `.current` lúc gỡ.
    const boGhim = cacGhim.current;

    const map = new maplibregl.Map({
      container: khung.current,
      style: kieuBanDoThuongHieu(tone),
      center: (tamMacDinh
        ? [tamMacDinh[1], tamMacDinh[0]]
        : TAM_NINH_BINH) as [number, number],
      zoom: zoomMacDinh,
      attributionControl: false,
      // Cuộn chuột KHÔNG phóng to bản đồ: khách đang cuộn trang mà bản đồ
      // nuốt mất cú cuộn là lỗi khó chịu nhất của mọi bản đồ nhúng.
      scrollZoom: false,
      interactive: !tinh,
      // Hai ngón mới di được bản đồ — NHƯNG chỉ trên màn hình cảm ứng. Bật
      // cả trên máy bàn thì MapLibre phủ một tấm màn tối lên bản đồ mỗi lần
      // khách chạm vào, và một tấm màn tối là thứ cuối cùng mình muốn đặt lên
      // chỗ đẹp nhất của trang. Máy bàn đã khoá cuộn-để-phóng rồi nên không
      // cần tới nó.
      cooperativeGestures: !tinh && camUng(),
      locale: CHU_MAPLIBRE,
    });
    banDo.current = map;

    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: GHI_CONG_BAN_DO }),
      "bottom-right",
    );
    // MapLibre bày sẵn cả dòng ghi nguồn ra, mở toang. Trên bản đồ nhỏ, dòng
    // ấy là một thanh trắng dài chiếm trọn mép dưới và **đè lên chính cái ghim
    // ở phía nam** — đo được ở bản đồ cao 254px của trang gói. Thu lại thành
    // một chữ "i"; ghi nguồn vẫn còn nguyên, bấm vào là đọc được, đúng điều
    // kiện bắt buộc của cả ba bên cung cấp dữ liệu.
    const thuGhiCong = () => {
      const o = map
        .getContainer()
        .querySelector<HTMLDetailsElement>("details.maplibregl-ctrl-attrib");
      if (o) o.open = false;
    };
    thuGhiCong();
    map.on("load", thuGhiCong);
    if (!tinh) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
        "top-right",
      );
    }

    map.on("error", (su) => {
      // Lỗi một ô lẻ thì bỏ qua; hỏng nguồn hoặc hỏng kiểu mới là hỏng thật.
      const loi = su?.error as { status?: number } | undefined;
      if (loi?.status && loi.status < 500 && loi.status !== 404) return;
      setHong(true);
    });
    map.on("styleimagemissing", () => undefined);

    return () => {
      boGhim.forEach((m) => m.remove());
      boGhim.clear();
      map.remove();
      banDo.current = null;
    };
    // Dựng đúng một lần. Đổi `tone` giữa chừng không nằm trong nhu cầu hiện có.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vẽ lại bộ ghim mỗi khi danh sách hoặc ghim đang chọn đổi.
  useEffect(() => {
    const map = banDo.current;
    if (!map) return;

    const conLai = new Set(cacGhim.current.keys());
    for (const g of ghim) {
      conLai.delete(g.id);
      const cu = cacGhim.current.get(g.id);
      if (cu) {
        // Đổi lựa chọn thì chỉ sơn lại phần tử đang có. Dựng lại ghim mỗi lượt
        // bấm sẽ làm cả bộ ghim nháy một cái — thấy rõ trên điện thoại.
        const el = cu.getElement();
        el.className = lopGhim(g, g.id === dangChon);
        doRuotGhim(el, g);
        for (const [ten, gia] of Object.entries(g.thuocTinh ?? {})) {
          el.setAttribute(ten, gia);
        }
        cu.setLngLat([g.toaDo[1], g.toaDo[0]]);
        continue;
      }
      const el = dungPhanTuGhim(g, g.id === dangChon);
      el.addEventListener("click", (su) => {
        su.stopPropagation();
        goiLai.current?.(g.id, el);
      });
      const moi = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([g.toaDo[1], g.toaDo[0]])
        .addTo(map);
      cacGhim.current.set(g.id, moi);
    }
    for (const id of conLai) {
      cacGhim.current.get(id)?.remove();
      cacGhim.current.delete(id);
    }
  }, [ghim, dangChon]);

  // Đường nối các điểm. Vẽ bằng một lớp của chính bản đồ chứ không phải một
  // hình SVG chồng lên trên: có thế nó mới nghiêng, xoay và co giãn cùng mặt
  // đất khi khách lái bản đồ.
  useEffect(() => {
    const map = banDo.current;
    if (!map) return;

    const ve = () => {
      if (!banDo.current) return;
      const nguon = map.getSource(ID_DUONG_NOI) as GeoJSONSource | undefined;
      if (nguon) {
        nguon.setData(hinhDuong(duongNoi));
        return;
      }
      if (!duongNoi) return;
      map.addSource(ID_DUONG_NOI, { type: "geojson", data: hinhDuong(duongNoi) });
      map.addLayer({
        id: ID_DUONG_NOI,
        type: "line",
        source: ID_DUONG_NOI,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": duongNoi.mau,
          "line-width": duongNoi.beRong ?? 3,
          "line-opacity": duongNoi.doMo ?? 0.75,
          ...(duongNoi.netDut
            ? { "line-dasharray": [duongNoi.netDut[0], duongNoi.netDut[1]] }
            : {}),
        },
      });
    };

    // Thêm lớp trước khi kiểu vẽ xong là MapLibre ném lỗi "Style is not done
    // loading". Bản đồ nhỏ dựng rất nhanh nên lần nào cũng rơi vào đúng đó.
    if (map.isStyleLoaded()) ve();
    else map.once("load", ve);
  }, [duongNoi]);

  // Khung nhìn: lần đầu ôm trọn bộ ghim, sau đó bay tới ghim được chọn.
  useEffect(() => {
    const map = banDo.current;
    if (!map || ghim.length === 0) return;
    const o = khung.current;
    if (!o || o.clientWidth === 0 || o.clientHeight === 0) return;

    const chon = ghim.find((g) => g.id === dangChon);
    if (chon) {
      const den = {
        center: [chon.toaDo[1], chon.toaDo[0]] as [number, number],
        zoom: ZOOM_KHI_CHON,
        offset: (doiTamKhiChon ? [doiTamKhiChon[0], doiTamKhiChon[1]] : [0, 0]) as [number, number],
      };
      if (itChuyenDong) {
        map.jumpTo({ ...den, pitch: 0 });
      } else {
        // Một cú "chuyển cảnh máy quay": vừa tiến lại gần vừa hạ thấp góc
        // nhìn, nên khối nhà và nếp núi nổi lên đúng lúc khách nhìn tới.
        map.flyTo({ ...den, pitch: NGHIENG_KHI_CHON, bearing: -12, speed: 0.9, curve: 1.42, essential: true });
      }
      daBay.current = true;
      return;
    }

    const bien = ghim.reduce(
      (b, g) => b.extend([g.toaDo[1], g.toaDo[0]] as [number, number]),
      new maplibregl.LngLatBounds(
        [ghim[0].toaDo[1], ghim[0].toaDo[0]],
        [ghim[0].toaDo[1], ghim[0].toaDo[0]],
      ),
    );
    const omTron = { bien, padding: le, maxZoom: zoomToiDa };
    khungCuoi.current = omTron;
    map.fitBounds(bien, {
      padding: le,
      maxZoom: zoomToiDa,
      pitch: 0,
      bearing: 0,
      animate: !itChuyenDong && daBay.current,
      duration: 700,
    });
    daBay.current = true;
  }, [ghim, dangChon, itChuyenDong, doiTamKhiChon, le, zoomToiDa]);

  // MapLibre đo khung một lần lúc dựng. Trang `/explore` giữ bản đồ luôn nằm
  // trong cây nhưng ẩn đi khi khách chuyển sang "Danh sách", nên phải tự đo
  // lại — và phải bỏ qua lúc khung còn 0×0, nếu không phép chiếu ra NaN.
  useEffect(() => {
    const o = khung.current;
    if (!o) return;
    const theoDoi = new ResizeObserver(() => {
      if (o.clientWidth === 0 || o.clientHeight === 0) return;
      banDo.current?.resize();
      // Bản đồ tĩnh là một tấm hình: khách xoay máy hay kéo cửa sổ thì nó phải
      // ôm lại đủ các điểm, chứ không được để một điểm trôi ra ngoài mép — ở
      // bản đồ lái được thì khách tự kéo lại, ở đây thì không.
      const om = khungCuoi.current;
      if (tinh && om) {
        banDo.current?.fitBounds(om.bien, {
          padding: om.padding,
          maxZoom: om.maxZoom,
          animate: false,
        });
      }
    });
    theoDoi.observe(o);
    return () => theoDoi.disconnect();
  }, [tinh]);

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      {/*
        Khung lồng. Không gắn thẳng `absolute inset-0` lên khung bản đồ được:
        MapLibre tự đặt `position: relative` lên chính khung ấy lúc khởi tạo,
        nên lớp định vị của mình bị đè và bản đồ cao 0 pixel — đo ra đúng
        654×0, canvas có mà không ai thấy. Lớp ngoài giữ chỗ, lớp trong cao
        100% của nó.
      */}
      <div className="absolute inset-0">
        <div
          ref={khung}
          data-brand-map={tone}
          role="region"
          aria-label={nhanVung}
          id={`ban-do-${idVung.replace(/[^a-zA-Z0-9]/g, "")}`}
          className="h-full w-full"
        />
      </div>
      {hong ? <MatGiayThayThe loiNhan={loiNhanHong} /> : null}
    </div>
  );
}

/**
 * Mặt giấy thay thế khi bản đồ không về được.
 *
 * Giữ nguyên tinh thần bản Leaflet cũ: nằm **dưới** ghim nên ghim vẫn thấy và
 * vẫn bấm được, và lời nhắn là một dải sát mép dưới chứ không phải thẻ nổi
 * giữa khung — bản đồ nhỏ chỉ cao chừng 158px, thẻ nổi che mất đúng cái ghim
 * mà câu chữ đang bảo khách nhìn.
 */
function MatGiayThayThe({ loiNhan }: { loiNhan: string | null }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,#F4F0E7,#E2ECE5)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_82%_at_18%_12%,rgba(168,206,193,0.58),transparent_60%),radial-gradient(115%_92%_at_86%_84%,rgba(231,199,141,0.32),transparent_62%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(24,63,52,0.055)_0px,rgba(24,63,52,0.055)_1px,transparent_1px,transparent_26px)]" />
      </div>
      {loiNhan ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-[linear-gradient(to_top,rgba(24,63,52,0.96),rgba(24,63,52,0.88)_58%,rgba(24,63,52,0))] px-4 pb-6 pt-4">
          <p
            role="status"
            className="mx-auto max-w-[24rem] text-center text-xs font-medium leading-5 text-[#F6F2E7]"
          >
            {loiNhan}
          </p>
        </div>
      ) : null}
    </>
  );
}
