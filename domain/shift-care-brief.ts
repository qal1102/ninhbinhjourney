/**
 * TC-13 (mục 2–3) — bản giao ca "hôm nay ai cần để ý".
 *
 * Hàm thuần, không gọi mạng. Nguồn là `erp_ca_truc_can_de_y`: mỗi đoàn có ít
 * nhất một người tự khai nhu cầu chăm sóc thì thành một hàng.
 *
 * Việc của tầng này là biến dữ liệu thành **một câu đọc được lên bộ đàm**.
 * Người trực ở phòng điều hành không có thời gian dịch bảng sang lời nói, và
 * mỗi lần họ tự dịch là một lần câu ra khác nhau. Câu do máy viết sẵn thì cả
 * ca nói giống nhau, và người ở cổng nghe quen tai.
 *
 * Cố ý KHÔNG có ở đây: đẩy thông báo tới điện thoại từng nhân viên. Người
 * đứng cổng không cầm điện thoại trong giờ; thông báo kiểu ấy trông hiện đại
 * mà không tới được đúng người. Bản này dừng ở phòng điều hành, người ở đó
 * đọc tiếp.
 */

export type CareNeed = "young-child" | "elderly" | "mobility";

export type ShiftCareMember = {
  memberIndex: number;
  careNeed: CareNeed;
  /** Khách tự khai. Rỗng là bình thường — phần lớn sẽ không bao giờ điền. */
  displayName: string;
  /** Người này đã qua cổng ở đây hôm nay chưa. */
  daVao: boolean;
};

export type ShiftCareGroup = {
  groupCode: string;
  groupLabel: string;
  leaderName: string;
  leaderPhone: string;
  memberCount: number;
  nguon: "web" | "quay";
  /** Giờ khung đã đặt, rỗng khi đoàn mua tại quầy (quầy không có khung giờ). */
  gioToi: string;
  members: ShiftCareMember[];
};

/** Cách gọi nhu cầu bằng lời người, không bằng mã. */
export const CARE_NEED_LABELS: Record<CareNeed, string> = {
  "young-child": "trẻ nhỏ",
  elderly: "người cao tuổi",
  mobility: "cần hỗ trợ di chuyển",
};

/** Thứ tự đọc: việc cần chuẩn bị nhiều nhất đứng trước. */
const THU_TU: CareNeed[] = ["mobility", "elderly", "young-child"];

const HOP_LE = new Set<string>(THU_TU);

function soFrom(value: unknown): number {
  const so = Number(value);
  return Number.isFinite(so) && so > 0 ? Math.round(so) : 0;
}

export function shiftCareGroupsFrom(value: unknown): ShiftCareGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      const groupCode = String(hang.group_code ?? "").trim();
      if (groupCode.length === 0) return null;
      const danhSach = Array.isArray(hang.danh_sach) ? hang.danh_sach : [];
      const members = danhSach
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const m = raw as Record<string, unknown>;
          const careNeed = String(m.care_need ?? "");
          const memberIndex = soFrom(m.member_index);
          if (!HOP_LE.has(careNeed) || memberIndex === 0) return null;
          return {
            memberIndex,
            careNeed: careNeed as CareNeed,
            displayName: String(m.display_name ?? "").trim(),
            daVao: m.da_vao === true,
          };
        })
        .filter((m): m is ShiftCareMember => m !== null)
        .sort((a, b) => a.memberIndex - b.memberIndex);
      // Một đoàn không còn ai cần để ý thì không phải việc của ca trực nữa.
      if (members.length === 0) return null;
      return {
        groupCode,
        groupLabel: String(hang.group_label ?? "").trim(),
        leaderName: String(hang.leader_name ?? "").trim(),
        leaderPhone: String(hang.leader_phone ?? "").trim(),
        memberCount: soFrom(hang.member_count),
        nguon: hang.nguon === "quay" ? ("quay" as const) : ("web" as const),
        gioToi: String(hang.gio_toi ?? "").trim(),
        members,
      };
    })
    .filter((g): g is ShiftCareGroup => g !== null);
}

/** Giờ khung, viết kiểu người Việt và theo giờ Ninh Bình. */
export function docGioToi(gioToi: string): string {
  if (gioToi.length === 0) return "chưa hẹn giờ";
  const luc = new Date(gioToi);
  if (Number.isNaN(luc.getTime())) return "chưa hẹn giờ";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(luc);
}

/**
 * Gom nhu cầu của một đoàn thành "1 người cần hỗ trợ di chuyển, 2 người cao
 * tuổi, 1 trẻ nhỏ".
 *
 * Mỗi loại có lối đếm riêng, cố ý. Ghép máy móc theo khuôn "N người X" thì ra
 * "2 người có người cao tuổi" — câu không ai đọc lên bộ đàm bao giờ.
 */
export function gomNhuCau(group: ShiftCareGroup): string {
  return THU_TU.filter((loai) => group.members.some((m) => m.careNeed === loai))
    .map((loai) => {
      const so = group.members.filter((m) => m.careNeed === loai).length;
      return loai === "mobility"
        ? `${so} người ${CARE_NEED_LABELS[loai]}`
        : `${so} ${CARE_NEED_LABELS[loai]}`;
    })
    .join(", ");
}

/**
 * Một câu đọc thẳng lên bộ đàm.
 *
 * Thứ tự trong câu là thứ tự người nghe cần: giờ trước (để biết còn bao lâu),
 * rồi đoàn nào, rồi cần chuẩn bị gì. Tên người không vào câu — người ở cổng
 * không tìm khách theo tên, họ đón theo đoàn.
 */
export function docLenBoDam(group: ShiftCareGroup): string {
  const gio = group.gioToi.length > 0 ? `${docGioToi(group.gioToi)}` : "Chưa hẹn giờ";
  const ten = group.groupLabel.length > 0 ? group.groupLabel : group.groupCode;
  // Nhãn do người tự đặt, và người ta hay đặt sẵn chữ "Đoàn" vào đó. Ghép máy
  // móc thì ra "đoàn Đoàn Lớp 9A Nam Định".
  const goiTen = /^đoàn\b/i.test(ten) ? ten : `đoàn ${ten}`;
  return `${gio}, ${goiTen}, ${group.memberCount} khách, ${gomNhuCau(group)}.`;
}

/** Còn ai trong đoàn chưa qua cổng — thứ quyết định đoàn nào còn phải đón. */
export function conChoDon(group: ShiftCareGroup): boolean {
  return group.members.some((m) => !m.daVao);
}

export type ShiftCareSummary = {
  soDoan: number;
  soNguoi: number;
  /** Số đoàn vẫn còn người chưa vào — phần việc còn lại của ca. */
  soDoanConDon: number;
};

export function tomTatCaTruc(groups: ShiftCareGroup[]): ShiftCareSummary {
  return {
    soDoan: groups.length,
    soNguoi: groups.reduce((tong, g) => tong + g.members.length, 0),
    soDoanConDon: groups.filter(conChoDon).length,
  };
}

export const SHIFT_CARE_COPY = {
  tieuDe: "Hôm nay cần để ý",
  trong: "Hôm nay chưa đoàn nào khai nhu cầu cần hỗ trợ. Khách tự khai lúc đặt, nên bảng trống là bình thường.",
  cachDung:
    "Đọc nguyên câu dưới mỗi đoàn lên bộ đàm cho người ở cổng. Đừng nhắn vào điện thoại riêng của họ — trong giờ làm không ai mở máy.",
  daDon: "Đã đón đủ",
  conDon: "Còn chờ",
} as const;
