import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Bảng vẽ bản đồ riêng của Ninh Bình Journey.
 *
 * ## Vì sao tự vẽ thay vì lấy kiểu có sẵn
 *
 * Một bản đồ lấy nguyên kiểu mặc định thì trang nào cũng giống trang nào —
 * đó chính là chỗ "không khác gì mấy cái cũ". Ở đây từng lớp được tô bằng
 * đúng bảng màu của thương hiệu: nền giấy, nước ngọc bích, đường viền vàng
 * đồng, chữ xanh rêu. Nhìn một giây là biết bản đồ này thuộc về trang này.
 *
 * ## Nguồn dữ liệu
 *
 * OpenFreeMap — **không khoá API, không đăng ký, không cookie, không giới hạn
 * lượt xem, cho dùng thương mại**, đổi lại bắt buộc ghi nguồn và không cam kết
 * uptime. Đây là lý do nó thay được máy chủ ảnh nền miễn phí của OpenStreetMap
 * (nơi *cấm* dùng thương mại và bóp lưu lượng — nguyên nhân thật của chuyện
 * "bản đồ liên tục bị lỗi", chứ không phải lỗi mã).
 *
 * Địa chỉ nguồn trỏ vào `…/planet` dạng TileJSON chứ **không** chép cứng đường
 * dẫn có ngày tháng bên trong nó (`…/planet/20260913_164504_pt/…`): OpenFreeMap
 * dựng lại dữ liệu theo đợt, chép cứng là vài tuần nữa bản đồ đứng hình.
 *
 * Lược đồ dữ liệu là OpenMapTiles, nên tên lớp nguồn (`water`, `waterway`,
 * `transportation`, `building`, `place`…) là tên chuẩn của lược đồ ấy.
 */

export const NGUON_BAN_DO = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/** Ghi nguồn — bắt buộc theo điều kiện dùng của cả ba bên. */
export const GHI_CONG_BAN_DO =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · dữ liệu <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Tâm vùng Ninh Bình, dạng MapLibre `[kinh độ, vĩ độ]`. */
export const TAM_NINH_BINH: [number, number] = [105.897, 20.2503];

export type ToneBanDo = "giay" | "dem";

type Bang = {
  nen: string;
  datTrong: string;
  rung: string;
  cong_vien: string;
  dan_cu: string;
  nuoc: string;
  vienNuoc: string;
  song: string;
  nha: string;
  duongChinh: string;
  vienDuong: string;
  duongPhu: string;
  ranh: string;
  chu: string;
  vienChu: string;
  chuNuoc: string;
};

const BANG: Record<ToneBanDo, Bang> = {
  // Giấy dó ngả vàng, nước ngọc bích — bảng màu của chính trang chủ.
  giay: {
    nen: "#F4EFE3",
    datTrong: "#EFE9DA",
    rung: "#CFE0C9",
    cong_vien: "#D3E3D4",
    dan_cu: "#EDE6D6",
    nuoc: "#7FB2A1",
    vienNuoc: "#5A9483",
    song: "#6FA795",
    nha: "#E2D9C6",
    duongChinh: "#E8C88E",
    vienDuong: "#FBF7EE",
    duongPhu: "#F6EFE1",
    ranh: "#B9AE96",
    chu: "#25453A",
    vienChu: "rgba(251,247,238,.92)",
    chuNuoc: "#3D6B5C",
  },
  // Dùng cho chương tối (Trung thu): cùng hình, khác ánh sáng.
  dem: {
    nen: "#101C18",
    datTrong: "#152220",
    rung: "#16261F",
    cong_vien: "#172A22",
    dan_cu: "#14211D",
    nuoc: "#163534",
    vienNuoc: "#2C5A4E",
    song: "#245046",
    nha: "#1B2A25",
    duongChinh: "#6B5528",
    vienDuong: "#0C1512",
    duongPhu: "#1E2A25",
    ranh: "#33463E",
    chu: "#E6DFCD",
    vienChu: "rgba(10,18,15,.9)",
    chuNuoc: "#89B2A2",
  },
};

/** Tên tiếng Việt nếu dữ liệu có, không thì lấy tên gốc. */
const TEN_DIA_DANH: ExpressionSpecification = [
  "coalesce",
  ["get", "name:vi"],
  ["get", "name"],
];

/**
 * Dựng kiểu bản đồ.
 *
 * Trả về một đối tượng mới mỗi lần gọi: MapLibre **sửa trực tiếp** vào đối
 * tượng kiểu khi chạy, nên dùng chung một hằng số giữa hai bản đồ là hai bản
 * đồ giẫm lên nhau.
 */
export function kieuBanDoThuongHieu(tone: ToneBanDo = "giay"): StyleSpecification {
  const m = BANG[tone];

  return {
    version: 8,
    name: `Ninh Bình Journey — ${tone}`,
    glyphs: GLYPHS,
    sources: {
      ofm: {
        type: "vector",
        url: NGUON_BAN_DO,
        attribution: GHI_CONG_BAN_DO,
      },
    },
    // Bầu trời chỉ hiện khi bản đồ nghiêng; nằm phẳng thì không thấy gì.
    sky: {
      "sky-color": tone === "dem" ? "#0B1512" : "#CFE1E6",
      "horizon-color": tone === "dem" ? "#1A2C26" : "#EDE6D5",
      "fog-color": tone === "dem" ? "#101C18" : "#F2ECDE",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
    },
    layers: [
      { id: "nen", type: "background", paint: { "background-color": m.nen } },
      {
        id: "dat-trong",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        paint: { "fill-color": m.datTrong, "fill-opacity": 0.85 },
      },
      {
        id: "rung",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "forest", "grass", "scrub"]]],
        paint: { "fill-color": m.rung, "fill-opacity": 0.92 },
      },
      {
        id: "cong-vien",
        type: "fill",
        source: "ofm",
        "source-layer": "park",
        paint: { "fill-color": m.cong_vien, "fill-opacity": 0.8 },
      },
      {
        id: "dan-cu",
        type: "fill",
        source: "ofm",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
        paint: { "fill-color": m.dan_cu },
      },
      // Nước vẽ SAU đất và TRƯỚC đường: ở Ninh Bình nước là nhân vật chính,
      // không phải nền.
      {
        id: "nuoc",
        type: "fill",
        source: "ofm",
        "source-layer": "water",
        paint: { "fill-color": m.nuoc, "fill-outline-color": m.vienNuoc },
      },
      {
        id: "song",
        type: "line",
        source: "ofm",
        "source-layer": "waterway",
        paint: {
          "line-color": m.song,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 12, 2.4, 16, 6],
        },
      },
      {
        id: "duong-vien",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        // Viền trắng dưới chân đường chỉ có nghĩa khi đã phóng đủ gần. Bật từ
        // khổ tỉnh là cả vùng thành một mạng lưới trắng chằng chịt, nuốt mất
        // sông ngòi — thứ đáng nhìn nhất của bản đồ này.
        minzoom: 11.5,
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": m.vienDuong,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3.4, 16, 12],
        },
      },
      {
        id: "duong-phu",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["tertiary", "minor", "service", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": m.duongPhu,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 2, 16, 5],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 12.5, 0.9],
        },
      },
      {
        id: "duong-chinh",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": m.duongChinh,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.55, 12, 2.2, 16, 7],
          // Mờ ở khổ tỉnh, rõ dần khi khách đi sâu vào một điểm.
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.42, 12, 0.85, 14, 1],
        },
      },
      {
        id: "ranh-gioi",
        type: "line",
        source: "ofm",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": m.ranh,
          "line-dasharray": [2, 3],
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 1.2],
        },
      },
      // Nhà dựng khối. Chỉ hiện từ zoom 14 trở lên và chỉ nhìn thấy rõ khi
      // bản đồ nghiêng — đây là thứ biến một tấm bản đồ phẳng thành một chỗ
      // có chiều sâu mà không phải tải thêm một mô hình 3D nào.
      {
        id: "khoi-nha",
        type: "fill-extrusion",
        source: "ofm",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": m.nha,
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.82,
        },
      },
      {
        id: "ten-song",
        type: "symbol",
        source: "ofm",
        "source-layer": "water_name",
        layout: {
          "text-field": TEN_DIA_DANH,
          "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 16, 15],
          "symbol-placement": "line",
        },
        paint: {
          "text-color": m.chuNuoc,
          "text-halo-color": m.vienChu,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "ten-noi",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "suburb"]]],
        layout: {
          "text-field": TEN_DIA_DANH,
          "text-font": ["Noto Sans Bold"],
          // Sàn 12px: đúng luật chữ của dự án, áp cho cả chữ trên bản đồ.
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 12, 14, 16, 18],
          "text-letter-spacing": 0.04,
          "text-max-width": 8,
        },
        paint: {
          "text-color": m.chu,
          "text-halo-color": m.vienChu,
          "text-halo-width": 1.6,
        },
      },
    ],
  };
}
