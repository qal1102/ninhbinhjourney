import type { ErpSiteId } from "@/domain/erp";
import { vietnamDayKey } from "@/domain/ticket-window";

/**
 * Ai đang có mặt tại một cơ sở, tính từ dữ liệu chấm công thật.
 *
 * Trước đây màn hình "Nhân sự & ca trực" hiển thị ba nhân viên bịa kèm tiến
 * độ, doanh thu và một dòng "bình quân 3 năm" — trong khi hệ thống mới chạy
 * được hai tháng. Nó nằm giữa hai khối dữ liệu thật nên mượn được vẻ đáng
 * tin của hàng xóm, và mọi quản lý ở mọi cơ sở đều thấy đúng ba con người
 * đó. Kiểm kê 05/09/2026 bắt được.
 *
 * Chỗ này chỉ trả lời đúng câu hỏi mà dữ liệu hiện có trả lời được: ai được
 * phân công ở đây, và hôm nay ai đã vào ca. Năng suất, doanh thu theo đầu
 * người và tỉ lệ đúng hạn thì CHƯA có nguồn — màn hình phải nói thẳng là
 * chưa đo, đừng dựng số cho kín ô.
 */
export type ShiftPresenceState = "on-shift" | "off-shift" | "not-started";

export type ShiftPresenceRow = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  state: ShiftPresenceState;
  /** Mốc của lượt chấm công gần nhất hôm nay; `null` khi chưa chấm lần nào. */
  latestAt: string | null;
  /** `true` khi lượt gần nhất dùng vị trí mô phỏng thay cho GPS thật. */
  demoLocation: boolean;
};

export type ShiftPresenceSummary = {
  assigned: number;
  onShift: number;
  finished: number;
  notStarted: number;
};

type DirectoryEntry = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  siteIds: readonly ErpSiteId[];
  active: boolean;
};

type PresenceEvent = {
  userId: string;
  siteId: ErpSiteId;
  type: "check-in" | "check-out";
  createdAt: string;
  source: "gps" | "demo-location";
};

const STATE_ORDER: Record<ShiftPresenceState, number> = {
  "on-shift": 0,
  "off-shift": 1,
  "not-started": 2,
};

/**
 * Chỉ đếm lượt chấm công CÙNG NGÀY VIỆT NAM với `at`.
 *
 * Không dùng "24 giờ gần nhất": ca đêm hôm qua sẽ trôi sang hôm nay và
 * quản lý mở màn hình lúc 8 giờ sáng thấy người của ca trước vẫn "đang
 * trong ca". Ranh giới phải là ngày làm việc, giống hệt cách bảng vé của
 * giám đốc cắt ngày.
 */
export function deriveShiftPresence(input: {
  directory: readonly DirectoryEntry[];
  events: readonly PresenceEvent[];
  siteId: ErpSiteId;
  at: Date;
}): { rows: ShiftPresenceRow[]; summary: ShiftPresenceSummary } {
  const dayKey = vietnamDayKey(input.at);
  const assigned = input.directory.filter(
    (entry) => entry.active && entry.siteIds.includes(input.siteId),
  );

  const latestByUser = new Map<string, PresenceEvent>();
  for (const event of input.events) {
    if (event.siteId !== input.siteId) continue;
    if (vietnamDayKey(new Date(event.createdAt)) !== dayKey) continue;
    const current = latestByUser.get(event.userId);
    if (!current || event.createdAt > current.createdAt) {
      latestByUser.set(event.userId, event);
    }
  }

  const rows: ShiftPresenceRow[] = assigned.map((entry) => {
    const latest = latestByUser.get(entry.accountId);
    return {
      accountId: entry.accountId,
      displayName: entry.displayName,
      jobTitle: entry.jobTitle,
      state: !latest
        ? "not-started"
        : latest.type === "check-in"
          ? "on-shift"
          : "off-shift",
      latestAt: latest?.createdAt ?? null,
      demoLocation: latest?.source === "demo-location",
    };
  });

  // Người đang trong ca lên trước — quản lý mở màn hình này là để biết ai
  // đang ở đây ngay lúc đó. Cùng trạng thái thì xếp theo tên cho ổn định.
  rows.sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (byState !== 0) return byState;
    return a.displayName.localeCompare(b.displayName, "vi");
  });

  return {
    rows,
    summary: {
      assigned: rows.length,
      onShift: rows.filter((row) => row.state === "on-shift").length,
      finished: rows.filter((row) => row.state === "off-shift").length,
      notStarted: rows.filter((row) => row.state === "not-started").length,
    },
  };
}

/** Một ô của bảng công: một người, một ngày. */
export type OBangCong = {
  /** Giờ vào ca đầu tiên trong ngày, "07:12". */
  vao: string | null;
  /** Giờ ra ca cuối cùng sau lượt vào, "17:20". */
  ra: string | null;
  /** Vào sau mốc {@link GIO_MUON}. */
  muon: boolean;
  /** Lượt cuối trong ngày là vào ca (chưa chấm ra). */
  dangTrongCa: boolean;
  viTriMoPhong: boolean;
};

export type DongBangCong = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  /** Theo khoá ngày `yyyy-mm-dd`; `null` là ngày ấy không chấm công. */
  theoNgay: Record<string, OBangCong | null>;
  soNgayLam: number;
  soLanMuon: number;
  /** Giờ vào trung bình của các ngày có chấm, "07:18". */
  gioVaoTrungBinh: string | null;
};

/** Vào ca sau 07:30 là muộn (cơ sở mở cửa đón khách lúc 07:30). */
export const GIO_MUON = 7 * 60 + 30;

const GIO_PHUT_VN = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

function phutTrongNgay(iso: string): number {
  const [h, m] = GIO_PHUT_VN.format(new Date(iso)).split(":").map(Number);
  return h * 60 + m;
}

function chuGio(phut: number): string {
  const p = Math.round(phut);
  return `${String(Math.floor(p / 60)).padStart(2, "0")}:${String(p % 60).padStart(2, "0")}`;
}

/**
 * Bảng công của một cơ sở trong `soNgay` ngày tới hết hôm nay (giờ Việt Nam):
 * mỗi người được phân công một dòng, mỗi ngày một ô giờ vào, giờ ra. Chỉ đọc
 * lượt chấm công thật trong kho (kể cả lượt mẫu, ô ghi "vị trí mô phỏng");
 * ngày không chấm để trống, không đoán.
 */
export function bangCongCoSo(input: {
  directory: readonly DirectoryEntry[];
  events: readonly PresenceEvent[];
  siteId: ErpSiteId;
  at: Date;
  soNgay?: number;
}): { ngay: string[]; dong: DongBangCong[] } {
  const soNgay = input.soNgay ?? 7;
  const ngay: string[] = [];
  for (let k = soNgay - 1; k >= 0; k -= 1) ngay.push(vietnamDayKey(new Date(input.at.getTime() - k * 86_400_000)));
  const trongKy = new Set(ngay);

  const theoNguoiNgay = new Map<string, PresenceEvent[]>();
  for (const event of input.events) {
    if (event.siteId !== input.siteId) continue;
    const ngayKey = vietnamDayKey(new Date(event.createdAt));
    if (!trongKy.has(ngayKey)) continue;
    const khoa = `${event.userId}|${ngayKey}`;
    const ds = theoNguoiNgay.get(khoa) ?? [];
    ds.push(event);
    theoNguoiNgay.set(khoa, ds);
  }

  const dong = input.directory
    .filter((entry) => entry.active && entry.siteIds.includes(input.siteId))
    .map((entry): DongBangCong => {
      const theoNgay: Record<string, OBangCong | null> = {};
      let soNgayLam = 0;
      let soLanMuon = 0;
      let tongVao = 0;
      for (const n of ngay) {
        const ds = (theoNguoiNgay.get(`${entry.accountId}|${n}`) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const vao = ds.find((e) => e.type === "check-in");
        if (!vao) {
          theoNgay[n] = null;
          continue;
        }
        const ra = [...ds].reverse().find((e) => e.type === "check-out" && e.createdAt > vao.createdAt);
        const phutVao = phutTrongNgay(vao.createdAt);
        const muon = phutVao > GIO_MUON;
        soNgayLam += 1;
        tongVao += phutVao;
        if (muon) soLanMuon += 1;
        theoNgay[n] = {
          vao: chuGio(phutVao),
          ra: ra ? chuGio(phutTrongNgay(ra.createdAt)) : null,
          muon,
          dangTrongCa: ds[ds.length - 1].type === "check-in",
          viTriMoPhong: ds.some((e) => e.source === "demo-location"),
        };
      }
      return {
        accountId: entry.accountId,
        displayName: entry.displayName,
        jobTitle: entry.jobTitle,
        theoNgay,
        soNgayLam,
        soLanMuon,
        gioVaoTrungBinh: soNgayLam ? chuGio(tongVao / soNgayLam) : null,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));

  return { ngay, dong };
}
