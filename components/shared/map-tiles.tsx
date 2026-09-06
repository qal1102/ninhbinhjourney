"use client";

import { useState } from "react";
import { TileLayer } from "react-leaflet";

/**
 * Nguồn ảnh nền dùng chung cho MỌI bản đồ Leaflet của dự án.
 *
 * Địa chỉ phải là `tile.openstreetmap.org` — lối `{s}.tile.openstreetmap.org`
 * chia miền phụ đã bị OpenStreetMap khai tử, không được dùng lại.
 *
 * Dòng ghi công là bắt buộc theo điều kiện dùng ảnh nền của OpenStreetMap;
 * bản đồ nào tắt `attributionControl` là bản đồ đó thiếu ghi công.
 *
 * Giai đoạn demo giữ nguyên OpenStreetMap. Khi chạy thương mại thật thì đổi
 * sang MapTiler — chỉ cần thay `OSM_TILE_URL`/`OSM_ATTRIBUTION` ở đây và cắm
 * khoá API; lý do và ràng buộc ghi trong `docs/HANDOFF.md`.
 */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Lời nhắn mặc định cho bản đồ có thể chạm vào từng điểm. */
export const TILE_FALLBACK_NOTE_INTERACTIVE =
  "Ảnh nền bản đồ chưa về kịp. Các điểm vẫn ghim đúng chỗ, mời bạn chọn thử một nơi.";

/** Lời nhắn cho bản đồ nhỏ chỉ để ghim vị trí, không bấm vào từng điểm. */
export const TILE_FALLBACK_NOTE_STATIC =
  "Ảnh nền bản đồ chưa về kịp. Vị trí các điểm vẫn ghim đúng chỗ.";

type TileState = "chờ" | "có ảnh nền" | "thiếu ảnh nền";

/**
 * Lớp nền thay thế khi ảnh nền không tải về được.
 *
 * Nằm dưới mọi `.leaflet-pane` (pane thấp nhất là 200) nên các ghim, đường nối
 * và popup vẫn nằm trên và vẫn bấm được; chỉ phần ô xám trống của Leaflet bị
 * thay bằng một mặt giấy có chủ ý. Lời nhắn `pointer-events-none` để không bao
 * giờ chắn thao tác của khách.
 */
function MissingTilesLayer({ note }: { note: string | null }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,#F4F0E7,#E2ECE5)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_82%_at_18%_12%,rgba(168,206,193,0.58),transparent_60%),radial-gradient(115%_92%_at_86%_84%,rgba(231,199,141,0.32),transparent_62%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(24,63,52,0.055)_0px,rgba(24,63,52,0.055)_1px,transparent_1px,transparent_26px)]" />
      </div>
      {note ? (
        // Dải sát mép dưới, KHÔNG phải thẻ nổi giữa khung: bản đồ nhỏ ở trang
        // điểm đến chỉ cao chừng 158px, một thẻ nổi là che mất đúng cái ghim mà
        // câu chữ đang bảo khách nhìn. Chừa `pb-6` để dòng ghi công Leaflet ở
        // góc dưới bên phải vẫn đọc được.
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[800] bg-[linear-gradient(to_top,rgba(24,63,52,0.96),rgba(24,63,52,0.88)_58%,rgba(24,63,52,0))] px-4 pb-6 pt-4"
        >
          <p
            role="status"
            className="mx-auto max-w-[24rem] text-center text-[11px] font-medium leading-4 text-[#F6F2E7] sm:text-xs sm:leading-5"
          >
            {note}
          </p>
        </div>
      ) : null}
    </>
  );
}

/**
 * Ảnh nền OpenStreetMap kèm lối lui nhìn thấy được.
 *
 * Leaflet không tự báo gì khi ảnh nền hỏng — nó để nguyên ô xám, nên khách chỉ
 * thấy một mảng trống với vài cái ghim trôi nổi và tưởng bản đồ hỏng. Ở đây
 * nghe `tileload`/`tileerror`: chỉ cần MỘT ô về được là coi như có ảnh nền và
 * không hiện gì thêm; hỏng ngay từ đầu thì hiện lớp nền thay thế kèm một câu
 * cho khách đọc.
 */
export function MapTiles({
  fallbackNote = TILE_FALLBACK_NOTE_INTERACTIVE,
}: {
  fallbackNote?: string | null;
}) {
  const [state, setState] = useState<TileState>("chờ");

  return (
    <>
      <TileLayer
        attribution={OSM_ATTRIBUTION}
        url={OSM_TILE_URL}
        eventHandlers={{
          tileload: () => setState("có ảnh nền"),
          // Một ô về được là đủ để bản đồ đọc được; đừng vì vài ô rìa hỏng mà
          // phủ lớp nền thay thế lên một bản đồ đang hiển thị bình thường.
          tileerror: () =>
            setState((current) =>
              current === "có ảnh nền" ? current : "thiếu ảnh nền",
            ),
        }}
      />
      {state === "thiếu ảnh nền" ? (
        <MissingTilesLayer note={fallbackNote} />
      ) : null}
    </>
  );
}
