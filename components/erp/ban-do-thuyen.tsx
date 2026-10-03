"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  docChuyenTrenSong,
  phutChu,
  thuyenMoPhong,
  TUYEN_THUYEN,
  viTriNoiSuy,
  type ChuyenThuyenThat,
  type CoSoThuyen,
  type ThuyenTrenBanDo,
} from "@/domain/thuyen-song";
import { GHI_CONG_BAN_DO, kieuBanDoThuongHieu } from "@/lib/map/brand-style";

/**
 * Bản đồ sống thuyền trên sông (màn Sức chứa của Tràng An, Tam Cốc).
 *
 * Thuyền di chuyển liên tục: mỗi khung hình (tối đa ~25 lần/giây) tính lại vị
 * trí mọi thuyền rồi vẽ.
 * - Thuyền mô phỏng: vị trí là hàm thuần của đồng hồ dọc tuyến sông thật
 *   (`domain/thuyen-song.ts`), nên trượt mượt và ai mở cũng thấy cùng chỗ.
 * - Thuyền thật: hỏi máy chủ 4 giây một lần; vẽ trễ 6 giây so với hiện tại và
 *   nội suy giữa hai lần điện thoại báo vị trí, nên thuyền trượt đều chứ không
 *   nhảy mỗi khi có điểm mới. Kèm vệt 20 phút gần nhất.
 *
 * Toạ độ nhân viên chỉ đi giữa máy chủ của mình và trình duyệt người xem; nền
 * bản đồ tải theo ô vuông vùng Ninh Bình, không gửi toạ độ thuyền cho bên nào.
 */

const TRE_HIEN_THI_MS = 6000;
const HOI_LAI_MS = 4000;
const TUA_NHANH = 30;
/** Vệt nước sau thuyền mô phỏng: vị trí 2 phút trước, lấy 6 mốc. */
const VET_MO_PHONG_MS = 120_000;

type ThuyenThatHienThi = ThuyenTrenBanDo & { nguoiCheo: string; soKhach: number; giayTruoc: number };

function veHinhThuyen(mauThan: string, mauNon: string): ImageData {
  // Thuyền nan nhìn từ trên xuống, mũi chỉ lên trên (0°); chấm tròn là nón lá.
  const w = 22;
  const h = 48;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(w / 2 + 1.5, h / 2 + 2, 6.5, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = mauThan;
  g.strokeStyle = "#183f34";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(w / 2, 2);
  g.bezierCurveTo(w - 2, 12, w - 2, 36, w / 2, h - 2);
  g.bezierCurveTo(2, 36, 2, 12, w / 2, 2);
  g.fill();
  g.stroke();
  g.fillStyle = mauNon;
  g.beginPath();
  g.arc(w / 2, h * 0.58, 4.2, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, w, h);
}

function boundsTuyen(coSo: CoSoThuyen) {
  const b = new maplibregl.LngLatBounds();
  for (const p of TUYEN_THUYEN[coSo].duong) b.extend([p[0], p[1]]);
  return b;
}

export function BanDoThuyen({ coSo, xemThuyenThat }: { coSo: CoSoThuyen; xemThuyenThat: boolean }) {
  const khung = useRef<HTMLDivElement>(null);
  const banDo = useRef<maplibregl.Map | null>(null);
  const chuyenThat = useRef<ChuyenThuyenThat[]>([]);
  const lechDongHo = useRef(0);
  const hienMoPhongRef = useRef(true);
  const [hienMoPhong, setHienMoPhong] = useState(true);
  // Xem nhanh chỉ áp cho thuyền mô phỏng. Giữ mốc để bật/tắt không làm thuyền nhảy.
  const tuaRef = useRef({ tocDo: 1, gocThat: 0, gocMoPhong: 0 });
  const [xemNhanh, setXemNhanh] = useState(false);
  const [tomTat, setTomTat] = useState<{ moPhong: number; that: ThuyenThatHienThi[] }>({ moPhong: 0, that: [] });
  const [loiHoi, setLoiHoi] = useState("");
  const tuyen = TUYEN_THUYEN[coSo];

  useEffect(() => {
    hienMoPhongRef.current = hienMoPhong;
  }, [hienMoPhong]);

  function doiXemNhanh(bat: boolean) {
    const t = tuaRef.current;
    const now = Date.now();
    const moPhongNay = t.gocMoPhong + (now - t.gocThat) * t.tocDo;
    tuaRef.current = { tocDo: bat ? TUA_NHANH : 1, gocThat: now, gocMoPhong: t.gocThat === 0 ? now : moPhongNay };
    setXemNhanh(bat);
  }

  // Hỏi thuyền thật mỗi 4 giây.
  useEffect(() => {
    if (!xemThuyenThat) return;
    let huy = false;
    const hoi = async () => {
      try {
        const res = await fetch(`/api/erp/thuyen?coSo=${coSo}`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; bayGio?: string; chuyen?: unknown; ma?: string };
        if (huy) return;
        if (!data.ok) {
          setLoiHoi(data.ma === "CHUA_NOI_KHO" ? "Bản này chưa nối kho, chỉ có thuyền mô phỏng." : "Chưa đọc được thuyền thật, đang thử lại.");
          return;
        }
        setLoiHoi("");
        if (data.bayGio) lechDongHo.current = Date.parse(data.bayGio) - Date.now();
        chuyenThat.current = docChuyenTrenSong(data.chuyen);
      } catch {
        if (!huy) setLoiHoi("Mạng chập chờn, đang thử lại.");
      }
    };
    void hoi();
    const id = window.setInterval(hoi, HOI_LAI_MS);
    return () => {
      huy = true;
      window.clearInterval(id);
    };
  }, [coSo, xemThuyenThat]);

  // Dựng bản đồ và vòng vẽ.
  useEffect(() => {
    if (!khung.current || banDo.current) return;
    const camUng = window.matchMedia("(pointer: coarse)").matches;
    const map = new maplibregl.Map({
      container: khung.current,
      style: kieuBanDoThuongHieu("giay"),
      bounds: boundsTuyen(coSo),
      fitBoundsOptions: { padding: { top: 40, right: 56, bottom: 64, left: 40 } },
      attributionControl: false,
      scrollZoom: false,
      cooperativeGestures: camUng,
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

    let frame = 0;
    let lanVe = 0;
    let lanTomTat = 0;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)");

    map.on("load", () => {
      map.addImage("thuyen-mo-phong", veHinhThuyen("#fbf7ee", "#c9a15c"), { pixelRatio: 1.6 });
      map.addImage("thuyen-that", veHinhThuyen("#e7b96a", "#183f34"), { pixelRatio: 1.5 });
      map.addSource("tuyen", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: tuyen.duong.map((p) => [p[0], p[1]]) } },
      });
      map.addLayer({ id: "tuyen-vien", type: "line", source: "tuyen", paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.8 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "tuyen", type: "line", source: "tuyen", paint: { "line-color": "#3f7568", "line-width": 2.4, "line-dasharray": [2, 1.4] }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addSource("vet-mo-phong", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "vet-mo-phong", type: "line", source: "vet-mo-phong", paint: { "line-color": "#ffffff", "line-width": 3, "line-opacity": 0.85 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addSource("vet", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "vet", type: "line", source: "vet", paint: { "line-color": "#d58c35", "line-width": 3, "line-opacity": 0.75 }, layout: { "line-cap": "round" } });
      map.addSource("thuyen", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "thuyen",
        type: "symbol",
        source: "thuyen",
        layout: {
          "icon-image": ["case", ["get", "moPhong"], "thuyen-mo-phong", "thuyen-that"],
          "icon-rotate": ["get", "huong"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": ["case", ["get", "moPhong"], 0, 1],
        },
      });
      map.addLayer({
        id: "thuyen-chu",
        type: "symbol",
        source: "thuyen",
        minzoom: 15,
        layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 1.6], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": ["case", ["get", "moPhong"], "#56645e", "#8a4f12"], "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
      });

      // Mốc vẽ sau cùng: lớp ký hiệu nằm trên được đặt chỗ trước, nên tên đền,
      // hang không bao giờ bị nhãn thuyền che.
      map.addSource("moc", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: tuyen.moc.map((m) => ({ type: "Feature", properties: { ten: m.ten }, geometry: { type: "Point", coordinates: [m.lonLat[0], m.lonLat[1]] } })),
        },
      });
      map.addLayer({ id: "moc-cham", type: "circle", source: "moc", paint: { "circle-radius": 5, "circle-color": "#183f34", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      map.addLayer({
        id: "moc-chu",
        type: "symbol",
        source: "moc",
        layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.2], "text-anchor": "top" },
        paint: { "text-color": "#183f34", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });
      const popup = new maplibregl.Popup({ closeButton: false, offset: 14 });
      map.on("mouseenter", "thuyen", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        // Gán chữ thuần, không chèn HTML: tên người chèo do người dùng nhập.
        const the = document.createElement("div");
        const ten = document.createElement("strong");
        ten.textContent = String(f.properties?.ten ?? "");
        const dong = document.createElement("div");
        dong.textContent = String(f.properties?.ghiChu ?? "");
        the.append(ten, dong);
        popup.setLngLat(e.lngLat).setDOMContent(the).addTo(map);
      });
      map.on("mouseleave", "thuyen", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      const ve = (bayGio: number) => {
        frame = requestAnimationFrame(ve);
        const nhip = giamChuyenDong.matches ? 1000 : 40;
        if (bayGio - lanVe < nhip) return;
        lanVe = bayGio;
        const now = Date.now() + lechDongHo.current;
        const tua = tuaRef.current;
        const gioMoPhong = tua.gocThat === 0 ? now : tua.gocMoPhong + (Date.now() - tua.gocThat) * tua.tocDo + lechDongHo.current;
        const moPhong = hienMoPhongRef.current ? thuyenMoPhong(coSo, gioMoPhong) : [];
        // Vệt nước: vị trí của chính thuyền ấy ở sáu mốc trước, nối lại.
        const vetMoPhong = new Map<string, number[][]>(moPhong.map((t) => [t.id, [[t.lonLat[0], t.lonLat[1]]]]));
        if (moPhong.length > 0) {
          const doDaiVet = VET_MO_PHONG_MS * (tua.tocDo > 1 ? 8 : 1);
          for (let k = 1; k <= 6; k++) {
            for (const t of thuyenMoPhong(coSo, gioMoPhong - (doDaiVet * k) / 6)) vetMoPhong.get(t.id)?.push([t.lonLat[0], t.lonLat[1]]);
          }
        }
        const that: ThuyenThatHienThi[] = chuyenThat.current.flatMap((c) => {
          const vt = viTriNoiSuy(c.vet, now - TRE_HIEN_THI_MS);
          if (!vt) return [];
          const cuoi = c.vet[c.vet.length - 1];
          return [{
            id: c.id,
            nhan: c.soThuyen,
            moPhong: false,
            lonLat: vt.lonLat,
            huong: vt.huong,
            phutDaDi: (now - c.batDau) / 60000,
            ghiChu: `${c.nguoiCheo} · ${c.soKhach} khách · đã đi ${phutChu((now - c.batDau) / 60000)}`,
            nguoiCheo: c.nguoiCheo,
            soKhach: c.soKhach,
            giayTruoc: Math.max(0, Math.round((now - cuoi.luc) / 1000)),
          }];
        });
        const tatCa = [...moPhong, ...that];
        (map.getSource("thuyen") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: tatCa.map((t) => ({
            type: "Feature",
            properties: {
              nhan: t.nhan,
              ten: t.moPhong ? `Thuyền ${t.nhan} (mô phỏng)` : `Thuyền ${t.nhan}`,
              moPhong: t.moPhong,
              huong: t.huong,
              ghiChu: t.moPhong ? `${t.ghiChu} · đã đi ${phutChu(t.phutDaDi)}` : t.ghiChu,
            },
            geometry: { type: "Point", coordinates: [t.lonLat[0], t.lonLat[1]] },
          })),
        });
        (map.getSource("vet-mo-phong") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: [...vetMoPhong.values()]
            .filter((diem) => diem.length > 1)
            .map((diem) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: diem } })),
        });
        (map.getSource("vet") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: chuyenThat.current
            .filter((c) => c.vet.length > 1)
            .map((c) => ({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  ...c.vet.filter((p) => p.luc <= now - TRE_HIEN_THI_MS).map((p) => [p.lonLat[0], p.lonLat[1]]),
                  ...(() => {
                    const vt = viTriNoiSuy(c.vet, now - TRE_HIEN_THI_MS);
                    return vt ? [[vt.lonLat[0], vt.lonLat[1]]] : [];
                  })(),
                ],
              },
            })),
        });
        if (bayGio - lanTomTat > 1000) {
          lanTomTat = bayGio;
          setTomTat({ moPhong: moPhong.length, that });
        }
      };
      frame = requestAnimationFrame(ve);
    });

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
      banDo.current = null;
    };
  }, [coSo, tuyen]);

  return (
    <div className="space-y-3" data-testid="ban-do-thuyen" data-co-so={coSo}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#20342c]">
          Trên sông lúc này: {tomTat.that.length} thuyền thật
          {hienMoPhong ? ` · ${tomTat.moPhong} thuyền mô phỏng` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => doiXemNhanh(!xemNhanh)}
          disabled={!hienMoPhong}
          aria-pressed={xemNhanh}
          data-testid="xem-nhanh"
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold disabled:opacity-40 ${xemNhanh ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#cbd7d1] text-[#183f34]"}`}
        >
          {xemNhanh ? `Đang xem nhanh ×${TUA_NHANH} · về giờ thật` : `Xem nhanh ×${TUA_NHANH}`}
        </button>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[#42554c]">
          <input type="checkbox" checked={hienMoPhong} onChange={(e) => setHienMoPhong(e.target.checked)} className="h-4 w-4" />
          Hiện thuyền mô phỏng
        </label>
        </div>
      </div>
      <div ref={khung} className="h-[min(68vh,560px)] w-full overflow-hidden rounded-2xl border border-[#d8e0db]" />
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#5f6d66]">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#e7b96a] ring-2 ring-[#183f34]" /> Thuyền thật, theo điện thoại người chèo (vệt cam là 20 phút vừa đi)</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#fbf7ee] ring-2 ring-[#c9a15c]" /> Thuyền mô phỏng: tính từ đồng hồ dọc tuyến, để xem thử khi chưa ai chèo</span>
      </div>
      {loiHoi ? <p role="status" className="text-sm text-[#8a4f12]">{loiHoi}</p> : null}
      {tomTat.that.length > 0 ? (
        <ul className="divide-y divide-[#e3e8e5] rounded-2xl border border-[#d8e0db] bg-white" data-testid="thuyen-that">
          {tomTat.that.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-bold text-[#183f34]">{t.nhan} · {t.nguoiCheo}</span>
              <span className="text-[#5f6d66]">
                {t.soKhach} khách · đã đi {phutChu(t.phutDaDi)} · vị trí {t.giayTruoc <= 15 ? `${t.giayTruoc} giây trước` : `${phutChu(t.giayTruoc / 60)} trước, có thể máy đã tắt màn hình`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#7c8882]">
          Chưa ai đang chèo. Người chèo mở <strong>/erp/thuyen</strong> trên điện thoại và bấm &quot;Bắt đầu chuyến&quot; là thuyền hiện ở đây.
        </p>
      )}
      <p className="text-xs text-[#7c8882]">
        {tuyen.ten}: chừng {phutChu(tuyen.phutTronChuyen)} một chuyến. Thuyền thật chỉ hiện khi người chèo đang mở chuyến; trình duyệt điện thoại tắt màn hình thì thôi gửi vị trí, nên trang người chèo giữ màn hình sáng trong lúc chèo.
      </p>
    </div>
  );
}
