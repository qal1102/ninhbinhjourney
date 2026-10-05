"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  bangBen,
  chuyenTuLuotVao,
  dauNgayVietNam,
  docBenTuApi,
  docChuyenTuApi,
  ganNguoiCheo,
  GIO_CHAY,
  gioVietNam,
  ngayCuaLuc,
  phutChu,
  thuyenLucNay,
  trongGioChay,
  uocPhutVeBen,
  TUYEN_THUYEN,
  viTriNoiSuy,
  type BangBen,
  type ChuyenThuyenThat,
  type ChuyenUocTinh,
  type CoSoThuyen,
  type DuLieuBen,
  type NguoiCheo,
  type ThuyenTrenBanDo,
} from "@/domain/thuyen-song";
import { ngayVietNam } from "@/domain/thoi-luong";
import { CHU_MAPLIBRE, GHI_CONG_BAN_DO, kieuBanDoThuongHieu } from "@/lib/map/brand-style";

/**
 * Bản đồ sống thuyền trên sông và bảng bến (Tràng An, Tam Cốc).
 *
 * Hai loại thuyền:
 * - **Ước từ lượt qua cổng** (`chuyenTuLuotVao`): mỗi nhóm khách qua cổng là
 *   một thuyền rời bến vài phút sau, đi đúng lịch tuyến. Đó là con số thật
 *   duy nhất kho có cho mọi thuyền, nên bảng bến (còn ở bến, đang trên sông,
 *   sắp về) dựng từ nó, cộng thêm thuyền có định vị.
 * - **Có định vị**: người chèo mở `/erp/thuyen` trên điện thoại. Hỏi máy chủ
 *   4 giây một lần, vẽ trễ 6 giây và nội suy giữa hai lần báo vị trí nên trượt
 *   đều. Kèm vệt 20 phút gần nhất.
 *
 * Ngoài giờ thuyền chạy, bản đồ mở sẵn phần **xem lại**: tua cả ngày bằng
 * thanh kéo giờ, phát nhanh ×30, cũng từ chính các lượt qua cổng ấy.
 *
 * Toạ độ nhân viên chỉ đi giữa máy chủ của mình và trình duyệt người xem; nền
 * bản đồ tải theo ô vuông vùng Ninh Bình, không gửi toạ độ thuyền cho bên nào.
 */

const TRE_HIEN_THI_MS = 6000;
const HOI_THUYEN_MS = 4000;
const HOI_BEN_MS = 60_000;
const TUA_NHANH = 30;
/** Vệt nước sau thuyền ước tính: vị trí 2 phút trước, lấy 6 mốc. */
const VET_MS = 120_000;
const GIO_MO_XEM_LAI = 10;
const PHUT = 60_000;

/** 6,5 → "6:30". */
function gioChu(gio: number) {
  return `${Math.floor(gio)}:${String(Math.round((gio % 1) * 60)).padStart(2, "0")}`;
}

/** Màu riêng cho bản đồ này: nước xanh trong, đất và rừng nhạt, để tuyến và thuyền nổi lên. */
const MAU = {
  nuoc: "#a9d6df",
  vienNuoc: "#7fb8c6",
  song: "#8cc4d2",
  rung: "#e3ead9",
  dat: "#f3efe5",
  tuyen: "#1f5a4a",
  thuyenUoc: "#1f5a4a",
  nonUoc: "#f3e3bf",
  thuyenThat: "#e48a2a",
  nonThat: "#183f34",
} as const;

type ThuyenThatHienThi = ThuyenTrenBanDo & {
  nguoiCheo: string;
  soKhach: number;
  giayTruoc: number;
  /** Giờ ước về bến (ms), `null` khi thuyền lệch xa tuyến. */
  veBenLuc: number | null;
};

/**
 * Thẻ một thuyền trên bản đồ. Gán chữ thuần, không chèn HTML: tên và số điện
 * thoại người chèo do người dùng nhập.
 */
function dungTheThuyen(p: Record<string, unknown>): HTMLElement {
  const the = document.createElement("div");
  the.className = "w-[12rem] text-[#20342c]";
  the.dataset.testid = "the-thuyen";
  const dong = (chu: string, lop: string) => {
    const el = document.createElement("p");
    el.className = lop;
    el.textContent = chu;
    the.append(el);
    return el;
  };
  const uocTinh = p.uocTinh === true || p.uocTinh === "true";
  const soThuyen = String(p.soThuyen ?? "");
  const nguoi = String(p.nguoiCheo ?? "");
  dong(soThuyen ? `Thuyền ${soThuyen}` : `Thuyền rời bến ${String(p.roiBen ?? "")}`, "text-xs font-black uppercase tracking-[0.12em] text-[#5f7d70]");
  if (nguoi) {
    const ten = dong(nguoi, "mt-1 text-base font-black leading-5");
    if (p.laMau === true || p.laMau === "true") {
      const mau = document.createElement("span");
      mau.className = "ml-2 rounded-full bg-[#fff1d6] px-2 py-0.5 align-middle text-[0.65rem] font-black text-[#7a5520]";
      mau.textContent = "mẫu";
      ten.append(mau);
    }
    const sdt = String(p.soDienThoai ?? "");
    if (sdt) {
      const goi = document.createElement("a");
      goi.href = `tel:${sdt.replace(/[^0-9+]/g, "")}`;
      goi.className = "mt-1.5 inline-flex min-h-9 items-center rounded-lg bg-[#183f34] px-3 text-sm font-bold text-white";
      goi.textContent = `Gọi ${sdt}`;
      the.append(goi);
    } else {
      dong("Chưa có số điện thoại trong sổ", "mt-0.5 text-xs text-[#6e7b75]");
    }
  } else {
    dong(
      Number(p.coSo ?? 0) > 0 ? "Lượt này chưa có người chèo rảnh trong sổ" : "Bến chưa có sổ người chèo",
      "mt-1 text-sm font-bold text-[#7a5520]",
    );
  }
  dong(String(p.tinhHinh ?? ""), "mt-2 text-xs leading-5 text-[#42554c]");
  dong(
    uocTinh ? "Ước từ lượt khách qua cổng; người chèo theo lượt gọi xoay vòng trong sổ" : "Theo định vị điện thoại người chèo",
    "mt-1 text-[0.68rem] leading-4 text-[#7d8c84]",
  );
  return the;
}

type CheDo =
  | { kieu: "truc-tiep" }
  | { kieu: "xem-lai"; gocThat: number; gocXem: number; dangChay: boolean };

function veHinhThuyen(mauThan: string, mauNon: string, vien: string): ImageData {
  // Thuyền nan nhìn từ trên xuống, mũi chỉ lên trên (0°); chấm tròn là nón lá.
  const w = 24;
  const h = 52;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(w / 2 + 1.5, h / 2 + 2, 7, 21, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = mauThan;
  g.strokeStyle = vien;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(w / 2, 2);
  g.bezierCurveTo(w - 2, 13, w - 2, 39, w / 2, h - 2);
  g.bezierCurveTo(2, 39, 2, 13, w / 2, 2);
  g.fill();
  g.stroke();
  g.fillStyle = mauNon;
  g.beginPath();
  g.arc(w / 2, h * 0.58, 4.6, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, w, h);
}

function boundsTuyen(coSo: CoSoThuyen) {
  const b = new maplibregl.LngLatBounds();
  for (const p of TUYEN_THUYEN[coSo].duong) b.extend([p[0], p[1]]);
  return b;
}

/** Khung giờ xem lại của ngày đang dựng: 6:30 tới 17:30, hôm nay thì không quá bây giờ. */
function khungXemLai(ngay: string, bayGio: number) {
  const dau = dauNgayVietNam(ngay);
  const tu = dau + GIO_CHAY.mo * 3_600_000;
  const den = Math.max(tu, Math.min(dau + GIO_CHAY.dong * 3_600_000, bayGio));
  return { tu, den };
}

function gioXem(che: CheDo, bayGio: number, ngay: string): number {
  if (che.kieu === "truc-tiep") return bayGio;
  const { tu, den } = khungXemLai(ngay, bayGio);
  if (!che.dangChay) return Math.min(den, Math.max(tu, che.gocXem));
  const t = che.gocXem + (Date.now() - che.gocThat) * TUA_NHANH;
  if (t <= den) return Math.max(tu, t);
  // Hết ngày thì vòng lại từ đầu, như đoạn phim tua lặp.
  return tu + ((t - tu) % Math.max(PHUT, den - tu));
}

function Bang({ ten, so, phu, nhan }: { ten: string; so: number; phu: string; nhan?: string }) {
  return (
    <div className="rounded-2xl border border-[#dfe6e2] bg-[#f8faf8] p-3 sm:p-4" data-o-ben={nhan}>
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-[#5f7068]">{ten}</dt>
      <dd className="mt-1 text-3xl font-black tabular-nums text-[#183f34] sm:text-4xl">{so.toLocaleString("vi-VN")}</dd>
      <dd className="mt-1 text-xs leading-5 text-[#5f6d66]">{phu}</dd>
    </div>
  );
}

export function BanDoThuyen({ coSo, xemThuyenThat }: { coSo: CoSoThuyen; xemThuyenThat: boolean }) {
  const khung = useRef<HTMLDivElement>(null);
  const banDo = useRef<maplibregl.Map | null>(null);
  const nhanBen = useRef<HTMLElement | null>(null);
  const chuyenThat = useRef<ChuyenThuyenThat[]>([]);
  const lechDongHo = useRef(0);
  const benRef = useRef<{
    ben: DuLieuBen;
    chuyen: ChuyenUocTinh[];
    /** Người chèo của từng chuyến ước tính, theo lượt gọi xoay vòng. */
    gan: Map<string, NguoiCheo>;
    /** Sổ tra theo số thuyền, cho thuyền có định vị. */
    theoSo: Map<string, NguoiCheo>;
  } | null>(null);
  const cheRef = useRef<CheDo | null>(null);
  const [che, setChe] = useState<CheDo | null>(null);
  const [ben, setBen] = useState<DuLieuBen | null>(null);
  const [tomTat, setTomTat] = useState<{ gio: number; bayGio: number; bang: BangBen | null; that: ThuyenThatHienThi[] }>({
    gio: 0,
    bayGio: 0,
    bang: null,
    that: [],
  });
  const [loiThuyen, setLoiThuyen] = useState("");
  const [loiBen, setLoiBen] = useState("");
  const tuyen = TUYEN_THUYEN[coSo];

  function doiCheDo(moi: CheDo) {
    cheRef.current = moi;
    setChe(moi);
  }

  // Hỏi thuyền có định vị mỗi 4 giây.
  useEffect(() => {
    if (!xemThuyenThat) return;
    let huy = false;
    const hoi = async () => {
      try {
        const res = await fetch(`/api/erp/thuyen?coSo=${coSo}`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; bayGio?: string; chuyen?: unknown; ma?: string };
        if (huy) return;
        if (!data.ok) {
          setLoiThuyen(data.ma === "CHUA_NOI_KHO" ? "" : "Chưa đọc được thuyền có định vị, đang thử lại.");
          return;
        }
        setLoiThuyen("");
        if (data.bayGio) lechDongHo.current = Date.parse(data.bayGio) - Date.now();
        chuyenThat.current = docChuyenTuApi(data.chuyen);
      } catch {
        if (!huy) setLoiThuyen("Mạng chập chờn, đang thử lại.");
      }
    };
    void hoi();
    const id = window.setInterval(hoi, HOI_THUYEN_MS);
    return () => {
      huy = true;
      window.clearInterval(id);
    };
  }, [coSo, xemThuyenThat]);

  // Hỏi bến (đội thuyền, lượt qua cổng trong ngày) mỗi phút.
  useEffect(() => {
    let huy = false;
    const hoi = async () => {
      try {
        const res = await fetch(`/api/erp/thuyen?coSo=${coSo}&phan=ben`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; ma?: string } & Record<string, unknown>;
        if (huy) return;
        if (!data.ok) {
          setLoiBen(
            data.ma === "CHUA_NOI_KHO"
              ? "Bản chạy này chưa nối kho, nên chưa có lượt qua cổng để ước số thuyền."
              : "Chưa đọc được số liệu bến, đang thử lại.",
          );
          return;
        }
        const doc = docBenTuApi(data);
        if (!doc) return;
        if (typeof data.bayGio === "string") lechDongHo.current = Date.parse(data.bayGio) - Date.now();
        const chuyen = doc.doi
          ? chuyenTuLuotVao(coSo, doc.luotVao, doc.doi.choMoiThuyen, doc.doi.phutMotVong)
          : chuyenTuLuotVao(coSo, doc.luotVao, 4);
        benRef.current = {
          ben: doc,
          chuyen,
          gan: ganNguoiCheo(chuyen, doc.nguoiCheo),
          theoSo: new Map(doc.nguoiCheo.map((n) => [n.soThuyen.trim().toUpperCase(), n])),
        };
        setBen(doc);
        setLoiBen("");
        // Lần đầu có dữ liệu: trong giờ chạy thì xem trực tiếp, ngoài giờ thì mở sẵn phần xem lại.
        if (!cheRef.current) {
          const bayGio = Date.now() + lechDongHo.current;
          const coThuyenNgay = thuyenLucNay(coSo, chuyen, bayGio, doc.doi?.phutMotVong).length > 0;
          const homNay = doc.ngay === ngayCuaLuc(bayGio);
          if (homNay && (trongGioChay(bayGio) || coThuyenNgay)) {
            cheRef.current = { kieu: "truc-tiep" };
          } else {
            const { tu, den } = khungXemLai(doc.ngay, bayGio);
            const mo = Math.min(den, Math.max(tu, dauNgayVietNam(doc.ngay) + GIO_MO_XEM_LAI * 3_600_000));
            const giam = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            cheRef.current = { kieu: "xem-lai", gocThat: Date.now(), gocXem: mo, dangChay: !giam };
          }
          setChe(cheRef.current);
        }
      } catch {
        if (!huy) setLoiBen("Mạng chập chờn, đang thử lại.");
      }
    };
    void hoi();
    const id = window.setInterval(hoi, HOI_BEN_MS);
    return () => {
      huy = true;
      window.clearInterval(id);
    };
  }, [coSo]);

  // Dựng bản đồ và vòng vẽ.
  useEffect(() => {
    if (!khung.current || banDo.current) return;
    const camUng = window.matchMedia("(pointer: coarse)").matches;
    const map = new maplibregl.Map({
      container: khung.current,
      style: kieuBanDoThuongHieu("giay"),
      bounds: boundsTuyen(coSo),
      // Lề dưới rộng hơn: nhãn bến nằm ngay dưới bến.
      fitBoundsOptions: { padding: { top: 48, right: 56, bottom: 84, left: 40 } },
      attributionControl: false,
      scrollZoom: false,
      cooperativeGestures: camUng,
      locale: CHU_MAPLIBRE,
    });
    banDo.current = map;
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: `${GHI_CONG_BAN_DO} · tuyến sông dựng từ OpenStreetMap`,
      }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.once("idle", () => {
      const o = map.getContainer().querySelector<HTMLDetailsElement>("details.maplibregl-ctrl-attrib");
      if (o) o.open = false;
    });

    // Nhãn bến nằm ngay trên bến: còn bao nhiêu thuyền chờ khách.
    const nhan = document.createElement("div");
    nhan.className =
      "pointer-events-none rounded-xl bg-[#183f34] px-3 py-1.5 text-center text-xs leading-4 text-white shadow-lg ring-2 ring-white";
    nhan.dataset.testid = "nhan-ben";
    const tenBen = document.createElement("span");
    tenBen.className = "block font-bold text-white/80";
    tenBen.textContent = tuyen.moc[0].ten;
    const soBen = document.createElement("span");
    soBen.className = "block font-black";
    nhan.append(tenBen, soBen);
    nhanBen.current = soBen;
    // Hai bến đều ở đầu đông nam của tuyến, tuyến đi lên phía tây bắc: nhãn đứng
    // dưới-trái bến để không che thuyền vừa rời, cũng không tràn mép phải ở 390px.
    const benMarker = new maplibregl.Marker({ element: nhan, anchor: "top-right", offset: [16, 8] })
      .setLngLat([tuyen.moc[0].lonLat[0], tuyen.moc[0].lonLat[1]])
      .addTo(map);

    let frame = 0;
    let lanVe = 0;
    let lanTomTat = 0;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)");

    map.on("load", () => {
      // Nền dịu đi để tuyến và thuyền là thứ nổi nhất.
      const dat = (lop: string, ten: string, gia: unknown) => {
        if (map.getLayer(lop)) map.setPaintProperty(lop, ten, gia);
      };
      dat("nen", "background-color", MAU.dat);
      dat("dat-trong", "fill-color", MAU.dat);
      dat("rung", "fill-color", MAU.rung);
      dat("cong-vien", "fill-color", MAU.rung);
      dat("nuoc", "fill-color", MAU.nuoc);
      dat("nuoc", "fill-outline-color", MAU.vienNuoc);
      dat("song", "line-color", MAU.song);
      for (const lop of ["duong-vien", "duong-phu", "duong-chinh"]) dat(lop, "line-opacity", 0.45);
      if (map.getLayer("khoi-nha")) map.setLayoutProperty("khoi-nha", "visibility", "none");

      map.addImage("thuyen-uoc", veHinhThuyen(MAU.thuyenUoc, MAU.nonUoc, "#ffffff"), { pixelRatio: 1.6 });
      map.addImage("thuyen-that", veHinhThuyen(MAU.thuyenThat, MAU.nonThat, "#183f34"), { pixelRatio: 1.3 });
      map.addSource("tuyen", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: tuyen.duong.map((p) => [p[0], p[1]]) } },
      });
      map.addLayer({ id: "tuyen-vien", type: "line", source: "tuyen", paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "tuyen", type: "line", source: "tuyen", paint: { "line-color": MAU.tuyen, "line-width": 3, "line-opacity": 0.55 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addSource("vet-uoc", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "vet-uoc", type: "line", source: "vet-uoc", paint: { "line-color": "#ffffff", "line-width": 3.5, "line-opacity": 0.95 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addSource("vet", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "vet", type: "line", source: "vet", paint: { "line-color": MAU.thuyenThat, "line-width": 3.5, "line-opacity": 0.85 }, layout: { "line-cap": "round" } });
      map.addSource("thuyen", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "thuyen",
        type: "symbol",
        source: "thuyen",
        layout: {
          "icon-image": ["case", ["get", "uocTinh"], "thuyen-uoc", "thuyen-that"],
          "icon-rotate": ["get", "huong"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": ["case", ["get", "uocTinh"], 0, 1],
        },
      });
      map.addLayer({
        id: "thuyen-chu",
        type: "symbol",
        source: "thuyen",
        minzoom: 15,
        layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.7], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": ["case", ["get", "uocTinh"], MAU.tuyen, "#8a4f12"], "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });

      // Mốc vẽ sau cùng: lớp ký hiệu nằm trên được đặt chỗ trước, nên tên đền,
      // hang không bao giờ bị nhãn thuyền che. Bến có nhãn riêng nên bỏ ra.
      map.addSource("moc", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: tuyen.moc.slice(1).map((m) => ({ type: "Feature", properties: { ten: m.ten }, geometry: { type: "Point", coordinates: [m.lonLat[0], m.lonLat[1]] } })),
        },
      });
      map.addLayer({ id: "moc-cham", type: "circle", source: "moc", paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#183f34", "circle-stroke-width": 2.5 } });
      map.addLayer({
        id: "moc-chu",
        type: "symbol",
        source: "moc",
        layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-offset": [0, 1.1], "text-anchor": "top" },
        paint: { "text-color": "#183f34", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });

      // Rê chuột (máy tính) để xem nhanh; bấm hay chạm (điện thoại) thì thẻ
      // ghim lại kèm nút đóng, để đọc người chèo và gọi điện.
      const theNhanh = new maplibregl.Popup({ closeButton: false, offset: 16, maxWidth: "224px", className: "the-thuyen" });
      const theGhim = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 16, maxWidth: "224px", className: "the-thuyen" });
      const moThe = (e: maplibregl.MapLayerMouseEvent, ghim: boolean) => {
        const f = e.features?.[0];
        if (!f) return;
        const lng = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        if (ghim) {
          theNhanh.remove();
          theGhim.setLngLat(lng).setDOMContent(dungTheThuyen(f.properties ?? {})).addTo(map);
        } else if (!theGhim.isOpen()) {
          theNhanh.setLngLat(lng).setDOMContent(dungTheThuyen(f.properties ?? {})).addTo(map);
        }
      };
      map.on("mouseenter", "thuyen", (e) => {
        map.getCanvas().style.cursor = "pointer";
        moThe(e, false);
      });
      map.on("click", "thuyen", (e) => moThe(e, true));
      map.on("mouseleave", "thuyen", () => {
        map.getCanvas().style.cursor = "";
        theNhanh.remove();
      });

      const ve = (khungGio: number) => {
        frame = requestAnimationFrame(ve);
        const nhip = giamChuyenDong.matches ? 1000 : 40;
        if (khungGio - lanVe < nhip) return;
        lanVe = khungGio;
        const bayGio = Date.now() + lechDongHo.current;
        const duLieu = benRef.current;
        const cheDo = cheRef.current;
        if (!duLieu || !cheDo) return;
        const { ben: b, chuyen, gan, theoSo } = duLieu;
        const vong = b.doi?.phutMotVong;
        const t = gioXem(cheDo, bayGio, b.ngay);
        const nhanh = cheDo.kieu === "xem-lai" && cheDo.dangChay;

        const uoc = thuyenLucNay(coSo, chuyen, t, vong);
        // Vệt nước: vị trí của chính thuyền ấy ở sáu mốc trước, nối lại.
        const vetUoc = new Map<string, number[][]>(uoc.map((x) => [x.id, [[x.lonLat[0], x.lonLat[1]]]]));
        const doDaiVet = VET_MS * (nhanh ? 8 : 1);
        for (let k = 1; k <= 6; k++) {
          for (const x of thuyenLucNay(coSo, chuyen, t - (doDaiVet * k) / 6, vong)) vetUoc.get(x.id)?.push([x.lonLat[0], x.lonLat[1]]);
        }

        // Thuyền có định vị chỉ có nghĩa ở chế độ trực tiếp.
        const that: ThuyenThatHienThi[] =
          cheDo.kieu !== "truc-tiep"
            ? []
            : chuyenThat.current.flatMap((c) => {
                const vt = viTriNoiSuy(c.vet, bayGio - TRE_HIEN_THI_MS);
                if (!vt) return [];
                const cuoi = c.vet[c.vet.length - 1];
                const phutDaDi = (bayGio - c.batDau) / PHUT;
                const ve = uocPhutVeBen(coSo, vt.lonLat, phutDaDi, vong);
                const veBenLuc = ve ? bayGio + ve.phutConLai * PHUT : null;
                return [{
                  id: c.id,
                  nhan: c.soThuyen,
                  uocTinh: false,
                  lonLat: vt.lonLat,
                  huong: vt.huong,
                  phutDaDi: (bayGio - c.batDau) / PHUT,
                  ghiChu: `${c.nguoiCheo} · ${c.soKhach} khách · đã đi ${phutChu(phutDaDi)}${veBenLuc ? ` · về bến khoảng ${gioVietNam(veBenLuc)}` : ""}`,
                  nguoiCheo: c.nguoiCheo,
                  soKhach: c.soKhach,
                  giayTruoc: Math.max(0, Math.round((bayGio - cuoi.luc) / 1000)),
                  veBenLuc,
                }];
              });

        (map.getSource("thuyen") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: [
            ...uoc.map((x) => {
              const nguoi = gan.get(x.id);
              return {
                type: "Feature" as const,
                properties: {
                  nhan: x.nhan,
                  uocTinh: true,
                  huong: x.huong,
                  soThuyen: nguoi?.soThuyen ?? "",
                  nguoiCheo: nguoi?.hoTen ?? "",
                  soDienThoai: nguoi?.soDienThoai ?? "",
                  laMau: nguoi?.laMau ?? false,
                  coSo: b.nguoiCheo.length,
                  roiBen: x.nhan,
                  tinhHinh: `${x.ghiChu} · ${x.soKhach} khách · đã đi ${phutChu(x.phutDaDi)} · về bến khoảng ${gioVietNam(x.veBenLuc)}`,
                },
                geometry: { type: "Point" as const, coordinates: [x.lonLat[0], x.lonLat[1]] },
              };
            }),
            ...that.map((x) => {
              const trongSo = theoSo.get(x.nhan.trim().toUpperCase());
              return {
                type: "Feature" as const,
                properties: {
                  nhan: x.nhan,
                  uocTinh: false,
                  huong: x.huong,
                  soThuyen: x.nhan,
                  nguoiCheo: x.nguoiCheo,
                  soDienThoai: trongSo?.soDienThoai ?? "",
                  laMau: false,
                  coSo: b.nguoiCheo.length,
                  roiBen: "",
                  tinhHinh: x.ghiChu.replace(`${x.nguoiCheo} · `, ""),
                },
                geometry: { type: "Point" as const, coordinates: [x.lonLat[0], x.lonLat[1]] },
              };
            }),
          ],
        });
        (map.getSource("vet-uoc") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: [...vetUoc.values()]
            .filter((diem) => diem.length > 1)
            .map((diem) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: diem } })),
        });
        (map.getSource("vet") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features:
            cheDo.kieu !== "truc-tiep"
              ? []
              : chuyenThat.current
                  .filter((c) => c.vet.length > 1)
                  .map((c) => {
                    const vt = viTriNoiSuy(c.vet, bayGio - TRE_HIEN_THI_MS);
                    return {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "LineString",
                        coordinates: [
                          ...c.vet.filter((p) => p.luc <= bayGio - TRE_HIEN_THI_MS).map((p) => [p.lonLat[0], p.lonLat[1]]),
                          ...(vt ? [[vt.lonLat[0], vt.lonLat[1]]] : []),
                        ],
                      },
                    };
                  }),
        });

        if (khungGio - lanTomTat > 1000 || lanTomTat === 0) {
          lanTomTat = khungGio;
          const bang = b.doi
            ? bangBen({
                doi: b.doi,
                chuyen,
                luotVao: b.luotVao,
                soThuyenCoDinhVi: that.length,
                veBen30PhutCoDinhVi: that.filter((x) => x.veBenLuc !== null && x.veBenLuc - bayGio <= 30 * PHUT).length,
                bayGioMs: t,
              })
            : null;
          if (nhanBen.current) {
            nhanBen.current.textContent = bang ? `${bang.oBen.toLocaleString("vi-VN")} thuyền chờ khách` : "";
          }
          setTomTat({ gio: t, bayGio, bang, that });
        }
      };
      frame = requestAnimationFrame(ve);
    });

    return () => {
      cancelAnimationFrame(frame);
      benMarker.remove();
      map.remove();
      banDo.current = null;
    };
  }, [coSo, tuyen]);

  const bayGioHienThi = tomTat.gio;
  const bang = tomTat.bang;
  const khung2 = ben && tomTat.bayGio ? khungXemLai(ben.ngay, tomTat.bayGio) : null;
  const ngayChu = ben ? ngayVietNam(ben.ngay) : "";
  const laHomNay = ben && tomTat.bayGio ? ben.ngay === ngayCuaLuc(tomTat.bayGio) : true;
  const ngoaiGio = tomTat.bayGio > 0 && !trongGioChay(tomTat.bayGio);

  function batXemLai() {
    if (!ben || !khung2) return;
    const mo = Math.min(khung2.den, Math.max(khung2.tu, dauNgayVietNam(ben.ngay) + GIO_MO_XEM_LAI * 3_600_000));
    doiCheDo({ kieu: "xem-lai", gocThat: Date.now(), gocXem: mo, dangChay: true });
  }

  function doiGio(ms: number) {
    if (che?.kieu !== "xem-lai") return;
    doiCheDo({ ...che, gocThat: Date.now(), gocXem: ms });
  }

  function batTat() {
    if (che?.kieu !== "xem-lai") return;
    const hienTai = gioXem(che, Date.now() + lechDongHo.current, ben?.ngay ?? "");
    doiCheDo({ ...che, gocThat: Date.now(), gocXem: hienTai, dangChay: !che.dangChay });
  }

  return (
    <div className="space-y-4" data-testid="ban-do-thuyen" data-co-so={coSo} data-che-do={che?.kieu ?? "dang-tai"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-bold text-[#20342c]" data-testid="trang-thai-ban-do">
          {!che
            ? "Đang đọc lượt khách qua cổng…"
            : che.kieu === "truc-tiep"
              ? `Trực tiếp · ${bayGioHienThi ? gioVietNam(bayGioHienThi) : "…"}${laHomNay ? "" : ` · ngày ${ngayChu}`}`
              : `Xem lại ${ngayChu} · ${bayGioHienThi ? gioVietNam(bayGioHienThi) : "…"}${che.dangChay ? ` · nhanh ×${TUA_NHANH}` : " · đang dừng"}`}
        </p>
        <div className="flex rounded-full border border-[#cbd7d1] bg-white p-1" role="group" aria-label="Chế độ xem">
          <button
            type="button"
            onClick={() => doiCheDo({ kieu: "truc-tiep" })}
            aria-pressed={che?.kieu === "truc-tiep"}
            disabled={!che}
            className={`min-h-10 rounded-full px-4 text-sm font-bold transition disabled:opacity-40 ${
              che?.kieu === "truc-tiep" ? "bg-[#183f34] text-white" : "text-[#183f34] hover:bg-[#eef3f0]"
            }`}
          >
            Trực tiếp
          </button>
          <button
            type="button"
            onClick={batXemLai}
            aria-pressed={che?.kieu === "xem-lai"}
            disabled={!che}
            data-testid="xem-lai"
            className={`min-h-10 rounded-full px-4 text-sm font-bold transition disabled:opacity-40 ${
              che?.kieu === "xem-lai" ? "bg-[#183f34] text-white" : "text-[#183f34] hover:bg-[#eef3f0]"
            }`}
          >
            Xem lại trong ngày
          </button>
        </div>
      </div>

      {che?.kieu === "xem-lai" && ngoaiGio ? (
        <p className="rounded-2xl bg-[#fff8eb] px-4 py-3 text-sm leading-6 text-[#7a5520]">
          Bây giờ ngoài giờ thuyền chạy ({gioChu(GIO_CHAY.mo)}–{gioChu(GIO_CHAY.dong)}), nên bản đồ mở sẵn phần xem lại{" "}
          {laHomNay ? "hôm nay" : `ngày ${ngayChu}`}, dựng từ đúng các lượt khách đã qua cổng.
        </p>
      ) : null}

      {bang ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="bang-ben">
          <Bang
            nhan="o-ben"
            ten="Còn ở bến"
            so={bang.oBen}
            phu={`thuyền chờ khách, trong ${bang.doiThuyen.toLocaleString("vi-VN")} thuyền chạy cùng lúc`}
          />
          <Bang
            nhan="tren-song"
            ten="Đang trên sông"
            so={bang.trenSong}
            phu={bang.coDinhVi > 0 ? `${bang.coDinhVi} có định vị, còn lại ước từ lượt qua cổng` : "ước từ lượt khách qua cổng"}
          />
          <Bang nhan="xuong-ben" ten="Khách đang xuống bến" so={bang.khachXuongBen} phu="đã qua cổng, thuyền chưa rời bến" />
          <Bang
            nhan="sap-ve"
            ten="Sắp về bến"
            so={bang.veBen30Phut}
            phu={`trong 30 phút tới · ${bang.roiBen30Phut} thuyền vừa rời bến 30 phút qua`}
          />
        </dl>
      ) : loiBen ? (
        <p role="status" className="rounded-2xl border border-[#e3e8e5] bg-white p-4 text-sm text-[#59654b]">{loiBen}</p>
      ) : ben && !ben.doi ? (
        <p role="status" className="rounded-2xl border border-[#e3e8e5] bg-white p-4 text-sm text-[#59654b]">
          Bến này chưa có ngưỡng đội thuyền ở màn Sức chứa, nên chưa tính được số thuyền còn ở bến.
        </p>
      ) : null}

      {bang ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e6ece8]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#1f5a4a]" style={{ width: `${Math.max(0.5, bang.tiLeDung * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#5f6d66]">
            {(bang.tiLeDung * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% đội thuyền đang trên sông. {laHomNay ? "Hôm nay" : `Ngày ${ngayChu}`}, tới{" "}
            {gioVietNam(bayGioHienThi)}: {bang.khachQuaCong.toLocaleString("vi-VN")} lượt khách qua cổng,{" "}
            {bang.daRoiBen.toLocaleString("vi-VN")} chuyến đã rời bến.
          </p>
        </div>
      ) : null}

      <div ref={khung} className="h-[min(64vh,540px)] w-full overflow-hidden rounded-2xl border border-[#d8e0db]" />

      {che?.kieu === "xem-lai" && khung2 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d8e0db] bg-white p-3">
          <button
            type="button"
            onClick={batTat}
            data-testid="phat-xem-lai"
            className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-4 text-sm font-bold text-white"
          >
            {che.dangChay ? "Tạm dừng" : `Phát nhanh ×${TUA_NHANH}`}
          </button>
          <label className="flex min-w-[220px] flex-1 items-center gap-3 text-sm font-bold text-[#20342c]">
            <span className="shrink-0 tabular-nums">{gioVietNam(bayGioHienThi || khung2.tu)}</span>
            <input
              type="range"
              min={khung2.tu}
              max={khung2.den}
              step={5 * PHUT}
              value={Math.min(khung2.den, Math.max(khung2.tu, bayGioHienThi || khung2.tu))}
              onChange={(e) => doiGio(Number(e.target.value))}
              aria-label="Giờ xem lại"
              aria-valuetext={gioVietNam(bayGioHienThi || khung2.tu)}
              className="h-11 w-full accent-[#183f34]"
            />
            <span className="shrink-0 text-xs font-normal text-[#5f6d66]">{gioVietNam(khung2.den)}</span>
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#5f6d66]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#1f5a4a] ring-2 ring-white" /> Thuyền ước từ lượt khách qua cổng (vệt trắng là đường vừa đi)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#e48a2a] ring-2 ring-[#183f34]" /> Thuyền có định vị, theo điện thoại người chèo (vệt cam là 20 phút vừa đi)
        </span>
      </div>

      {loiThuyen ? <p role="status" className="text-sm text-[#8a4f12]">{loiThuyen}</p> : null}
      {tomTat.that.length > 0 ? (
        <ul className="divide-y divide-[#e3e8e5] rounded-2xl border border-[#d8e0db] bg-white" data-testid="thuyen-that">
          {tomTat.that.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-bold text-[#183f34]">{t.nhan} · {t.nguoiCheo}</span>
              <span className="text-[#5f6d66]">
                {t.soKhach} khách · đã đi {phutChu(t.phutDaDi)}
                {t.veBenLuc ? <> · <strong className="text-[#183f34]">về bến khoảng {gioVietNam(t.veBenLuc)}</strong></> : " · lệch xa tuyến, chưa ước được giờ về"} · vị trí {t.giayTruoc <= 15 ? `${t.giayTruoc} giây trước` : `${phutChu(t.giayTruoc / 60)} trước, có thể máy đã tắt màn hình`}
              </span>
            </li>
          ))}
        </ul>
      ) : che?.kieu === "truc-tiep" ? (
        <p className="text-xs text-[#7c8882]">
          Chưa thuyền nào bật định vị. Người chèo mở <strong>/erp/thuyen</strong> trên điện thoại và bấm &quot;Bắt đầu chuyến&quot; là thuyền hiện màu cam ở đây.
        </p>
      ) : null}

      {ben?.doi ? (
        <p className="text-xs leading-5 text-[#7c8882]" data-testid="nguon-doi-thuyen">
          Đội thuyền lấy từ ngưỡng bến ở màn Sức chứa: {ben.doi.soThuyen.toLocaleString("vi-VN")} thuyền chạy cùng lúc,{" "}
          {ben.doi.choMoiThuyen} chỗ mỗi thuyền, {phutChu(ben.doi.phutMotVong)} một vòng
          {ben.doi.loaiNguon === "estimate" ? " (ước tính)" : ""}. {ben.doi.nguon}{" "}
          <Link href={`/erp/${coSo}/suc-chua`} className="font-bold text-[#183f34] underline underline-offset-4">
            Sửa ở màn Sức chứa
          </Link>
        </p>
      ) : null}
    </div>
  );
}
