import type { ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Camera AI — kịch bản mô phỏng có kiểm soát (T17, docs/HANDOFF.md).
 *
 * Không có camera AI thật, không có cảm biến đếm người, không có API để nối.
 * Trước đây màn hình này bịa số ngay trong component rồi để số bịa đó chảy
 * vào nhật ký sự cố thật — đó là lý do nút tạo sự cố đã bị khoá.
 *
 * Module này thay chỗ đó bằng một mô hình mô phỏng **khai báo rõ ràng**:
 *
 * 1. Mỗi khu vực có một sức chứa thiết kế ước lượng (`designCapacity`) — con
 *    số vật lý do người vận hành đặt ra, không phải AI đo được. Số người hiển
 *    thị luôn là `designCapacity × hệ số tải`, nên nó tự giải thích được và
 *    không bao giờ mâu thuẫn với chính nó.
 * 2. Hệ số tải sinh ra từ một bộ số giả ngẫu nhiên **tất định**, gieo hạt bằng
 *    `${siteId}:${bucket}`. Cùng một cơ sở, cùng một khung 5 phút thì mọi
 *    người đang xem đều thấy đúng một cảnh — F5 không nhảy số, và hai máy đặt
 *    cạnh nhau không mâu thuẫn nhau.
 * 3. Kịch bản sự kiện chỉ chạy cho giám đốc và **tối đa 2 sự kiện**
 *    (`CAMERA_SCRIPT_MAX_EVENTS`). Đây là chặn tràn ở tầng dữ liệu, không phải
 *    ở tầng giao diện: hàm không có đường nào trả về quá 2 phần tử.
 *
 * Toàn bộ module này thuần tính toán: không đọc, không ghi, không chạm cơ sở
 * dữ liệu. Không có gì ở đây lọt được vào sự cố, chấm công hay sổ sách thật.
 */

/** Nhãn nguồn số liệu, cùng quy ước với ngưỡng sức chứa (T11). */
export const CAMERA_SIMULATION_SOURCE = "mô-phỏng" as const;

/** Cảnh giữ nguyên trong 5 phút để số không nhảy mỗi lần tải lại trang. */
export const CAMERA_SCENE_BUCKET_MS = 5 * 60_000;

/** Trần cứng số sự kiện kịch bản trong một phiên xem. */
export const CAMERA_SCRIPT_MAX_EVENTS = 2;

/** Tỷ lệ lấp đầy khiến một khu vực chuyển sang "cần chú ý". */
export const CAMERA_ATTENTION_LOAD = 0.85;

export type CameraStatus = "stable" | "attention" | "offline";

type ZoneDefinition = {
  name: string;
  /** Sức chứa thiết kế ước lượng — người có mặt cùng lúc, không phải lượt/ngày. */
  designCapacity: number;
  /** Khu vực nghẽn của cơ sở: nơi kịch bản luôn nhắm tới. */
  bottleneck: boolean;
  /** Vị trí cắt ảnh, chỉ để khung hình mỗi camera trông khác nhau. */
  position: string;
};

/**
 * Sức chứa thiết kế là ước lượng vận hành, chưa đo thực tế — cùng loại số với
 * ngưỡng sức chứa T11 và phải được khách xác nhận trước khi go-live.
 */
const SITE_ZONES: Readonly<Record<ErpSiteId, readonly ZoneDefinition[]>> = {
  "trang-an": [
    { name: "Cổng A", designCapacity: 260, bottleneck: false, position: "center" },
    { name: "Bến thuyền 01", designCapacity: 180, bottleneck: true, position: "45% 55%" },
    { name: "Vùng chờ trung tâm", designCapacity: 420, bottleneck: false, position: "65% center" },
    { name: "Tuyến thuyền số 2", designCapacity: 150, bottleneck: false, position: "35% center" },
  ],
  "tam-chuc": [
    { name: "Cổng Khách Điện", designCapacity: 300, bottleneck: false, position: "center" },
    { name: "Bến thuyền", designCapacity: 200, bottleneck: true, position: "45% 55%" },
    { name: "Điện Tam Thế", designCapacity: 520, bottleneck: false, position: "65% center" },
    { name: "Dốc Tháp Ngọc", designCapacity: 160, bottleneck: false, position: "35% center" },
  ],
  "tam-coc": [
    { name: "Cổng vé", designCapacity: 200, bottleneck: false, position: "center" },
    { name: "Bến đò", designCapacity: 140, bottleneck: true, position: "45% 55%" },
    { name: "Vùng chờ", designCapacity: 320, bottleneck: false, position: "65% center" },
    { name: "Tuyến sông chính", designCapacity: 120, bottleneck: false, position: "35% center" },
  ],
  "bai-dinh": [
    { name: "Cổng chính", designCapacity: 340, bottleneck: false, position: "center" },
    { name: "Bến xe điện", designCapacity: 220, bottleneck: true, position: "45% 55%" },
    { name: "Hành lang La Hán", designCapacity: 600, bottleneck: false, position: "65% center" },
    { name: "Khu Bảo Tháp", designCapacity: 260, bottleneck: false, position: "35% center" },
  ],
};

export type CameraFeed = {
  id: string;
  name: string;
  zone: string;
  status: CameraStatus;
  /** Số người mô phỏng đang có mặt. Không phải số đo. */
  simulatedPeople: number;
  designCapacity: number;
  /** 0–1. `simulatedPeople / designCapacity`, làm tròn khi hiển thị. */
  loadRatio: number;
  note: string;
  position: string;
  bottleneck: boolean;
};

export type CameraScene = {
  siteId: ErpSiteId;
  /** Khung 5 phút đã sinh ra cảnh này — dùng để biết khi nào cần dựng lại. */
  bucket: number;
  feeds: readonly CameraFeed[];
  /** Tổng số người mô phỏng trên các camera còn tín hiệu. */
  simulatedTotal: number;
  onlineCount: number;
  attentionCount: number;
};

export type CameraScriptEvent = {
  id: string;
  cameraName: string;
  zone: string;
  tone: "alert" | "resolved";
  headline: string;
  detail: string;
  /** Bao lâu sau khi mở màn hình thì sự kiện xuất hiện. */
  revealAfterMs: number;
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — nhỏ, tất định, đủ dùng cho một cảnh mô phỏng. */
function createRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cameraSceneBucket(at: Date | number): number {
  const value = typeof at === "number" ? at : at.getTime();
  return Math.floor(value / CAMERA_SCENE_BUCKET_MS);
}

/**
 * Camera thứ 4 của mỗi cơ sở luôn mất tín hiệu. Đây là chủ ý: một hệ thống
 * giám sát mà lúc nào cũng 100% xanh là dấu hiệu của số liệu bịa, và người vận
 * hành cần thấy trạng thái hỏng trông như thế nào.
 */
const OFFLINE_INDEX = 3;

export function buildCameraScene(input: {
  siteId: ErpSiteId;
  at: Date | number;
}): CameraScene {
  const zones = SITE_ZONES[input.siteId];
  const bucket = cameraSceneBucket(input.at);
  const random = createRandom(`${input.siteId}:${bucket}`);

  const feeds: CameraFeed[] = zones.map((zone, index) => {
    const name = `CAM ${String(index + 1).padStart(2, "0")}`;
    const id = `${input.siteId}-cam-${String(index + 1).padStart(2, "0")}`;
    // Gọi random() cho mọi khu vực kể cả khu offline, để chuỗi số không đổi
    // nếu sau này camera nào mất tín hiệu cũng thay đổi.
    const draw = random();

    if (index === OFFLINE_INDEX) {
      return {
        id,
        name,
        zone: zone.name,
        status: "offline" as const,
        simulatedPeople: 0,
        designCapacity: zone.designCapacity,
        loadRatio: 0,
        note: "Đang bảo trì kết nối",
        position: zone.position,
        bottleneck: zone.bottleneck,
      };
    }

    // Khu nghẽn chạy ở dải tải cao hơn (0,62–1,00); khu thường 0,34–0,78.
    const loadRatio = zone.bottleneck ? 0.62 + draw * 0.38 : 0.34 + draw * 0.44;
    const simulatedPeople = Math.round(zone.designCapacity * loadRatio);
    const status: CameraStatus =
      loadRatio >= CAMERA_ATTENTION_LOAD ? "attention" : "stable";

    return {
      id,
      name,
      zone: zone.name,
      status,
      simulatedPeople,
      designCapacity: zone.designCapacity,
      loadRatio,
      note:
        status === "attention"
          ? `Mật độ mô phỏng ${Math.round(loadRatio * 100)}% sức chứa thiết kế`
          : "Luồng di chuyển trong ngưỡng mô hình",
      position: zone.position,
      bottleneck: zone.bottleneck,
    };
  });

  return {
    siteId: input.siteId,
    bucket,
    feeds,
    simulatedTotal: feeds.reduce((sum, feed) => sum + feed.simulatedPeople, 0),
    onlineCount: feeds.filter((feed) => feed.status !== "offline").length,
    attentionCount: feeds.filter((feed) => feed.status === "attention").length,
  };
}

/**
 * Kịch bản sự kiện. Chỉ chạy cho giám đốc, tối đa 2 sự kiện một phiên xem.
 *
 * Trần 2 là chặn cứng: hàm chỉ dựng đúng 2 phần tử rồi `slice` lần nữa, nên
 * không có nhánh nào trả về nhiều hơn dù kịch bản có mở rộng về sau.
 */
export function buildCameraEventScript(input: {
  scene: CameraScene;
  role: ErpRole;
}): readonly CameraScriptEvent[] {
  if (input.role !== "director") return [];

  const target =
    input.scene.feeds.find((feed) => feed.bottleneck && feed.status !== "offline") ??
    input.scene.feeds.find((feed) => feed.status !== "offline");
  if (!target) return [];

  const percent = Math.round(target.loadRatio * 100);

  const script: CameraScriptEvent[] = [
    {
      id: `${target.id}-alert-${input.scene.bucket}`,
      cameraName: target.name,
      zone: target.zone,
      tone: "alert",
      headline: `Mật độ tăng nhanh tại ${target.zone}`,
      detail: `Mô hình mô phỏng đang ở ${percent}% sức chứa thiết kế (${target.designCapacity} người). Kịch bản trình diễn — chưa có cảm biến đếm người thật.`,
      revealAfterMs: 12_000,
    },
    {
      id: `${target.id}-resolved-${input.scene.bucket}`,
      cameraName: target.name,
      zone: target.zone,
      tone: "resolved",
      headline: `Luồng khách tại ${target.zone} trở lại ngưỡng an toàn`,
      detail:
        "Kịch bản đóng lại sau khi giãn khách. Không sự kiện nào được ghi vào nhật ký sự cố thật.",
      revealAfterMs: 45_000,
    },
  ];

  return script.slice(0, CAMERA_SCRIPT_MAX_EVENTS);
}

export function listCameraZoneNames(siteId: ErpSiteId): readonly string[] {
  return SITE_ZONES[siteId].map((zone) => zone.name);
}
