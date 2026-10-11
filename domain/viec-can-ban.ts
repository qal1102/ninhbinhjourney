/**
 * "Việc cần bạn" (G1, chủ dự án chọn 11/10/2026 từ bảng vẽ): mọi hồ sơ đang
 * chờ giám đốc, từng dòng một, xếp theo đúng thứ tự gấp của `viec-dau-tien.ts`
 * (cổng mở cửa → sự cố quá hạn → sự cố → ca lệch → hoá đơn → đổi dự án).
 *
 * Khối "Việc nên làm trước" vẫn chỉ nói một việc; danh sách này nằm ngay dưới
 * để giám đốc thấy hết mà không phải mở từng module. Chỉ dựng từ dữ liệu trang
 * đầu đã đọc sẵn, không mở thêm lượt đọc nào, không có nguồn số thứ hai.
 */

export type LoaiViecCanBan = "sop" | "su-co" | "ca-lech" | "hoa-don" | "du-an";

export type ViecCanBan = {
  id: string;
  loai: LoaiViecCanBan;
  ten: string;
  phu: string;
  siteId: string;
  href: string;
  han: string;
  /** Đã trễ hạn hoặc đang đứng chặn việc khác (cổng mở cửa, sự cố quá SLA). */
  gap: boolean;
};

export const NHAN_LOAI_VIEC: Record<LoaiViecCanBan, string> = {
  sop: "Mở cửa",
  "su-co": "Sự cố",
  "ca-lech": "Ca lệch tiền",
  "hoa-don": "Hoá đơn NCC",
  "du-an": "Đổi dự án",
};

const THU_TU: Record<LoaiViecCanBan, number> = { sop: 0, "su-co": 1, "ca-lech": 2, "hoa-don": 3, "du-an": 4 };

export type NguonViecCanBan = {
  sop: ReadonlyArray<{ id: string; siteId: string; assessmentCode: string; submittedByDisplayName: string; decisionDueAt: string; criticalFailures: number }>;
  suCo: ReadonlyArray<{ id: string; siteId: string; title: string; area: string; elapsedMinutes: number; slaMinutes: number }>;
  caLech: ReadonlyArray<{ id: string; siteId: string; shiftCode: string; station: string; shiftLabel: string; differenceVnd: number }>;
  hoaDon: ReadonlyArray<{ id: string; siteId: string; caseCode: string; supplier: { name: string }; dueDate: string }>;
  duAn: ReadonlyArray<{ id: string; siteId: string; summary: string; requestedByName: string; createdAt: string }>;
};

function phutThanhChu(phut: number) {
  const p = Math.abs(Math.round(phut));
  if (p < 60) return `${p} phút`;
  const gio = Math.floor(p / 60);
  if (gio < 24) return `${gio} giờ`;
  return `${Math.floor(gio / 24)} ngày`;
}

function gioVn(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function ngayVn(isoNgay: string) {
  const [y, m, d] = isoNgay.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}` : isoNgay;
}

function tienVn(vnd: number) {
  return `${Math.abs(vnd).toLocaleString("vi-VN")} đ`;
}

export function danhSachViecCanBan(nguon: NguonViecCanBan, bayGio: Date = new Date()): ViecCanBan[] {
  const homNay = bayGio.toISOString().slice(0, 10);
  const viec: ViecCanBan[] = [
    ...nguon.sop.map((s) => ({
      id: `sop-${s.id}`,
      loai: "sop" as const,
      ten: `${s.assessmentCode} · chờ quyết cho mở cửa`,
      phu: `${s.submittedByDisplayName} gửi${s.criticalFailures > 0 ? ` · ${s.criticalFailures} mục nghiêm trọng` : ""}`,
      siteId: s.siteId,
      href: `/erp/${s.siteId}/sop-dien-tap`,
      han: `hạn ${gioVn(s.decisionDueAt)}`,
      gap: true,
    })),
    ...nguon.suCo.map((c) => {
      const tre = c.elapsedMinutes - c.slaMinutes;
      return {
        id: `su-co-${c.id}`,
        loai: "su-co" as const,
        ten: c.title,
        phu: c.area,
        siteId: c.siteId,
        href: `/erp/${c.siteId}/su-co`,
        han: tre >= 0 ? `trễ ${phutThanhChu(tre)}` : `còn ${phutThanhChu(-tre)}`,
        gap: tre >= 0,
      };
    }),
    ...nguon.caLech.map((c) => ({
      id: `ca-${c.id}`,
      loai: "ca-lech" as const,
      ten: `${c.shiftCode} · lệch ${tienVn(c.differenceVnd)}`,
      phu: `${c.station} · ${c.shiftLabel}`,
      siteId: c.siteId,
      href: `/erp/${c.siteId}/tai-chinh-doi-soat`,
      han: "chờ giải trình",
      gap: false,
    })),
    ...nguon.hoaDon.map((h) => ({
      id: `hd-${h.id}`,
      loai: "hoa-don" as const,
      ten: `${h.caseCode} · ${h.supplier.name}`,
      phu: "Kế toán đã đối chiếu, chờ giám đốc quyết",
      siteId: h.siteId,
      href: `/erp/${h.siteId}/doi-tac-nha-cung-ung`,
      han: h.dueDate < homNay ? `quá hạn trả ${ngayVn(h.dueDate)}` : `hạn trả ${ngayVn(h.dueDate)}`,
      gap: h.dueDate < homNay,
    })),
    ...nguon.duAn.map((d) => ({
      id: `da-${d.id}`,
      loai: "du-an" as const,
      ten: d.summary,
      phu: `${d.requestedByName} đề nghị`,
      siteId: d.siteId,
      href: `/erp/${d.siteId}/du-an-su-kien`,
      han: `gửi ${ngayVn(d.createdAt)}`,
      gap: false,
    })),
  ];
  return viec.sort((a, b) => Number(b.gap) - Number(a.gap) || THU_TU[a.loai] - THU_TU[b.loai]);
}
