"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import { DUONG_TAM_COC } from "@/domain/thuyen-duong-song";
import { diemTaiQuang, doDaiTuyen, khoangCachMet, TUYEN_THUYEN } from "@/domain/thuyen-song";
import { CHU_MAPLIBRE, GHI_CONG_BAN_DO, kieuBanDoThuongHieu } from "@/lib/map/brand-style";

/**
 * Bản đồ đường đò Tam Cốc mùa hoa súng, trên nền bản đồ thương hiệu
 * (OpenFreeMap, không khoá). Đường đò là tuyến dựng từ OpenStreetMap mà bản
 * đồ thuyền trong ERP đang dùng (`domain/thuyen-duong-song.ts`).
 *
 * - Đoạn giữa Hang Cả và Hang Hai tô hồng: báo chí tả đây là đoạn hoa dày.
 * - Thuyền hoa trôi đi rồi quay về như đoàn diễu trong lễ Sắc Hồng; đây là
 *   minh hoạ, không phải vị trí thuyền thật. Giảm chuyển động thì đứng yên.
 * - Chỉ chạy khi bản đồ nằm trong khung nhìn và tab đang mở.
 */

type LonLat = readonly [number, number];

const TUYEN = TUYEN_THUYEN["tam-coc"];
const MOC = TUYEN.moc;
const DAI_TUYEN_M = doDaiTuyen(TUYEN);
const SO_THUYEN = 9;
const GIAY_MOT_VONG = 70;

function chiSoGan(diem: LonLat) {
  let tot = 0;
  let min = Infinity;
  DUONG_TAM_COC.forEach((p, i) => {
    const d = khoangCachMet(p, diem);
    if (d < min) {
      min = d;
      tot = i;
    }
  });
  return tot;
}

function doanHoaDay(): LonLat[] {
  const i = chiSoGan(MOC.find((m) => m.ten === "Hang Cả")!.lonLat);
  const j = chiSoGan(MOC.find((m) => m.ten === "Hang Hai")!.lonLat);
  return DUONG_TAM_COC.slice(Math.min(i, j), Math.max(i, j) + 1);
}

function viTriThuyen(giay: number) {
  return Array.from({ length: SO_THUYEN }, (_, k) => {
    // Đi hết tuyến rồi quay về, các thuyền cách đều nhau trên vòng.
    const pha = (((giay / GIAY_MOT_VONG + k / SO_THUYEN) % 1) + 1) % 1;
    const m = (pha < 0.5 ? pha * 2 : (1 - pha) * 2) * DAI_TUYEN_M;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [...diemTaiQuang(TUYEN, m).lonLat] },
    };
  });
}

export default function BanDoHoaSung({ lang }: { lang: "vi" | "en" }) {
  const khung = useRef<HTMLDivElement | null>(null);
  const giamChuyenDong = useReducedMotion();
  const giamRef = useRef(giamChuyenDong);
  // Máy không có WebGL thì nói thẳng thay vì để khung trống.
  const [hong, setHong] = useState(() => {
    try {
      const c = document.createElement("canvas");
      return !(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return true;
    }
  });

  useEffect(() => {
    giamRef.current = giamChuyenDong;
  }, [giamChuyenDong]);

  useEffect(() => {
    const el = khung.current;
    if (!el || hong) return;
    let map: maplibregl.Map;
    // Đường đò chạy từ bến Văn Lâm (đông nam) lên Hang Ba (tây bắc, hướng
    // khoảng 300°). Khung ngang thì xoay cho tuyến nằm ngang, bến bên phải;
    // khung dọc (điện thoại) thì xoay cho tuyến dựng đứng, bến ở dưới.
    const ngang = el.clientWidth > el.clientHeight * 1.1;
    const huong = ngang ? 30 : -60;
    try {
      const b = new maplibregl.LngLatBounds();
      DUONG_TAM_COC.forEach((p) => b.extend([p[0], p[1]]));
      map = new maplibregl.Map({
        container: el,
        style: kieuBanDoThuongHieu("giay"),
        bounds: b,
        fitBoundsOptions: { padding: 40 },
        maxPitch: 60,
        attributionControl: false,
        cooperativeGestures: true,
        locale: lang === "vi" ? CHU_MAPLIBRE : undefined,
      });
    } catch {
      // Dựng bản đồ hỏng ngay lúc khởi tạo: chỉ biết được ở đây.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHong(true);
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: GHI_CONG_BAN_DO }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
    map.once("idle", () => {
      const o = map.getContainer().querySelector<HTMLDetailsElement>("details.maplibregl-ctrl-attrib");
      if (o) o.open = false;
    });

    const nhanCacMoc: maplibregl.Marker[] = [];
    let khungHinh = 0;
    let dangThay = true;
    let cuoi = 0;
    const batDau = performance.now();

    map.on("load", () => {
      map.fitBounds(
        new maplibregl.LngLatBounds(
          [Math.min(...DUONG_TAM_COC.map((p) => p[0])), Math.min(...DUONG_TAM_COC.map((p) => p[1]))],
          [Math.max(...DUONG_TAM_COC.map((p) => p[0])), Math.max(...DUONG_TAM_COC.map((p) => p[1]))],
        ),
        {
          padding: ngang ? { top: 60, right: 90, bottom: 60, left: 80 } : { top: 40, right: 70, bottom: 40, left: 30 },
          bearing: huong,
          pitch: 42,
          duration: 0,
        },
      );
      map.addSource("tuyen", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: DUONG_TAM_COC.map((p) => [...p]) } },
      });
      map.addSource("hoa-day", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: doanHoaDay().map((p) => [...p]) } },
      });
      map.addSource("thuyen", { type: "geojson", data: { type: "FeatureCollection", features: viTriThuyen(0) } });

      map.addLayer({
        id: "hoa-day",
        type: "line",
        source: "hoa-day",
        paint: { "line-color": "#e07aa8", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 18, 16, 44], "line-opacity": 0.72, "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "tuyen-vien",
        type: "line",
        source: "tuyen",
        paint: { "line-color": "#fbf7ee", "line-width": 7, "line-opacity": 0.95 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "tuyen",
        type: "line",
        source: "tuyen",
        paint: { "line-color": "#183f34", "line-width": 2.2, "line-dasharray": [2, 1.6] },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "thuyen-quang",
        type: "circle",
        source: "thuyen",
        paint: { "circle-radius": 13, "circle-color": "#f4b8d1", "circle-opacity": 0.35, "circle-blur": 0.6 },
      });
      map.addLayer({
        id: "thuyen",
        type: "circle",
        source: "thuyen",
        paint: { "circle-radius": 6.5, "circle-color": "#c75b8f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 },
      });

      for (const moc of MOC) {
        const dau = moc.ten === "Bến Văn Lâm";
        // Hang Ba và Hang Hai chỉ cách nhau vài trăm mét: Hang Ba đứng phía trên.
        const tren = moc.ten === "Hang Ba";
        const nut = document.createElement("div");
        nut.className = dau
          ? "pointer-events-none rounded-full bg-[#183f34] px-3 py-1.5 text-xs font-bold text-white shadow-lg ring-2 ring-white"
          : "pointer-events-none rounded-full bg-[#fbf7ee] px-3 py-1 text-xs font-bold text-[#183f34] shadow ring-1 ring-[#183f34]/15";
        nut.textContent = moc.ten;
        nhanCacMoc.push(
          new maplibregl.Marker({
            element: nut,
            anchor: dau ? "top" : tren ? "bottom" : ngang ? "top" : "left",
            offset: dau ? [0, 12] : tren ? [0, -10] : ngang ? [0, 10] : [10, 0],
          })
            .setLngLat([moc.lonLat[0], moc.lonLat[1]])
            .addTo(map),
        );
      }
      const giua = doanHoaDay();
      const nhanHoa = document.createElement("div");
      nhanHoa.className =
        "pointer-events-none max-w-[9rem] rounded-2xl bg-[#c75b8f] px-3 py-1.5 text-center text-[0.7rem] font-bold leading-4 text-white shadow-lg";
      nhanHoa.textContent = lang === "vi" ? "Đoạn hoa dày nhất" : "Thickest lilies";
      nhanCacMoc.push(
        new maplibregl.Marker({ element: nhanHoa, anchor: ngang ? "bottom" : "right", offset: ngang ? [0, -16] : [-16, 0] })
          .setLngLat([...giua[Math.floor(giua.length / 2)]] as [number, number])
          .addTo(map),
      );

      const ve = (bayGio: number) => {
        khungHinh = 0;
        if (!dangThay || document.hidden) return;
        if (bayGio - cuoi >= 33) {
          cuoi = bayGio;
          const giay = giamRef.current ? 12 : (bayGio - batDau) / 1000;
          (map.getSource("thuyen") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: viTriThuyen(giay) });
        }
        if (!giamRef.current) khungHinh = requestAnimationFrame(ve);
      };
      khungHinh = requestAnimationFrame(ve);

      const io = new IntersectionObserver(([muc]) => {
        dangThay = muc.isIntersecting;
        if (dangThay && !khungHinh) khungHinh = requestAnimationFrame(ve);
      });
      io.observe(el);
      const hienLai = () => {
        if (!document.hidden && !khungHinh) khungHinh = requestAnimationFrame(ve);
      };
      document.addEventListener("visibilitychange", hienLai);
      map.once("remove", () => {
        io.disconnect();
        document.removeEventListener("visibilitychange", hienLai);
      });
    });
    map.on("error", (e) => {
      if (!map.loaded() && String(e.error?.message ?? "").includes("WebGL")) setHong(true);
    });

    return () => {
      if (khungHinh) cancelAnimationFrame(khungHinh);
      nhanCacMoc.forEach((m) => m.remove());
      map.remove();
    };
  }, [lang, hong]);

  if (hong) {
    return (
      <div className="grid h-full place-items-center bg-[#f3eef0] p-6 text-center text-sm leading-6 text-[#6b5f70]">
        {lang === "vi"
          ? "Máy này chưa vẽ được bản đồ. Đường đò đi từ bến Văn Lâm qua Hang Cả, Hang Hai tới Hang Ba rồi quay về."
          : "This device cannot draw the map. The route runs from Van Lam pier through Hang Ca and Hang Hai to Hang Ba and back."}
      </div>
    );
  }
  return <div ref={khung} className="h-full w-full" data-brand-map="hoa-sung" />;
}
