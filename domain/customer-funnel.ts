import { CAC_DIP, homNayTheoGioVN, ngayCuaDipTrongNam, type DipMuaVu } from "@/domain/lich-mua-vu";

export type CustomerFunnelSourceRow = {
  sourceId: string;
  sourceLabel: string;
  campaignLabel: string;
  /** Mã dịp của chiến dịch sở hữu mã QR này; rỗng là chưa gắn dịp. */
  dipId: string;
  qrScans: number;
  pageViews: number;
  holds: number;
  payments: number;
  acceptedGateScans: number;
};

export type CustomerFunnelSlotRow = {
  slotId: string;
  siteId: string;
  startsAt: string;
  capacitySnapshot: number;
  capacitySourceKind: "estimate" | "customer" | "measured";
  thresholdVersion: number;
  reservedEntries: number;
  soldEntries: number;
  checkedInEntries: number;
};

export type CustomerFunnelTotals = {
  qrScans: number;
  pageViews: number;
  holds: number;
  payments: number;
  acceptedGateScans: number;
};

export type CustomerFunnelReport = {
  windowStart: string;
  windowEnd: string;
  totals: CustomerFunnelTotals;
  /** Tổng của kỳ so sánh; `null` khi không đem kỳ nào ra so. */
  comparisonTotals: CustomerFunnelTotals | null;
  sources: CustomerFunnelSourceRow[];
  /** Tối đa mười hai khung gần nhất của khoảng; tổng số nằm ở `slotCount`. */
  slots: CustomerFunnelSlotRow[];
  slotCount: number;
  /** Lượt qua cổng bằng vé mua tại quầy: không thuộc phễu web, chỉ nói ra cho đủ. */
  counterGateScans: number;
  /** Khoảng này có lẫn lịch sử mẫu (092) hay không. */
  hasDemoData: boolean;
  reconciliation: {
    attributedProfiles: number;
    unattributedProfiles: number;
    offlineSyncedItems: number;
    offlineDivergedItems: number;
  };
};

export type CustomerFunnelDipRow = {
  /** Mã dịp; rỗng là nhóm "chưa gắn dịp". */
  dipId: string;
  qrScans: number;
  pageViews: number;
  holds: number;
  payments: number;
  acceptedGateScans: number;
};

/**
 * Cộng các dòng nguồn khách theo dịp của chiến dịch.
 *
 * Đây là câu trả lời cho "dịp nào ra tiền": mỗi mã QR thuộc một chiến dịch,
 * chiến dịch gắn vào một dịp, nên mọi lượt quét, giữ chỗ, thanh toán và vào
 * cổng đã quy được về mã QR thì cũng quy được về dịp. Khách không rõ đến từ
 * đâu (`unattributed`) cố ý **không** bị nhét vào dịp nào — đoán hộ là bịa số.
 *
 * Xếp theo số thanh toán thành công, rồi tới lượt quét: dịp ra tiền lên trước.
 */
export function gomTheoDip(sources: readonly CustomerFunnelSourceRow[]): CustomerFunnelDipRow[] {
  const theoDip = new Map<string, CustomerFunnelDipRow>();
  for (const row of sources) {
    if (row.sourceId === "unattributed") continue;
    const dong = theoDip.get(row.dipId) ?? {
      dipId: row.dipId, qrScans: 0, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 0,
    };
    dong.qrScans += row.qrScans;
    dong.pageViews += row.pageViews;
    dong.holds += row.holds;
    dong.payments += row.payments;
    dong.acceptedGateScans += row.acceptedGateScans;
    theoDip.set(row.dipId, dong);
  }
  return [...theoDip.values()].sort((a, b) => {
    // Nhóm chưa gắn dịp luôn xuống cuối, dù nhiều số tới đâu.
    if (!a.dipId !== !b.dipId) return a.dipId ? -1 : 1;
    return b.payments - a.payments || b.qrScans - a.qrScans || a.dipId.localeCompare(b.dipId);
  });
}

/**
 * Khoảng thời gian của phễu, và kỳ đem ra so.
 *
 * Trước 27/09/2026 phễu chỉ nhìn bảy ngày gần nhất, nên không trả lời được
 * câu giám đốc thật sự hỏi sau một dịp lễ: *"dịp này năm nay so với năm trước
 * ra sao?"*. Nay có hai kiểu khoảng:
 *
 * - **Số ngày gần nhất** (7, 30, 90): so với chừng ấy ngày liền trước.
 * - **Một dịp đã diễn ra trong mười hai tháng qua:** tính từ hai tuần trước
 *   ngày đầu dịp (khách đặt trước) tới hết ngày cuối dịp, so với đúng dịp ấy
 *   của năm trước, cùng độ dài. Dịp đang diễn ra thì khoảng dừng ở hôm nay.
 *
 * Năm trước chưa có dữ liệu thì kỳ so vẫn được đếm và ra toàn số 0; màn hình
 * nói thẳng là chưa có gì để so, không giấu kỳ so đi.
 */
export type KyPhieu = { nhan: string; tu: Date; den: Date };

export type KhoangPhieu = KyPhieu & {
  ma: string;
  /** Một câu nói khoảng này tính từ đâu tới đâu. */
  moTa: string;
  soSanh: KyPhieu;
};

export type LuaChonKhoang = { ma: string; nhan: string; nhom: "ngay" | "dip" };

const MOT_NGAY_MS = 86_400_000;
const SO_NGAY_GAN = [7, 30, 90] as const;
// Viết thẳng ra để bài smoke production tìm được đúng câu trong mã nguồn.
const NHAN_SO_NGAY: Record<(typeof SO_NGAY_GAN)[number], string> = {
  7: "7 ngày gần nhất",
  30: "30 ngày gần nhất",
  90: "90 ngày gần nhất",
};
const SO_NGAY_TRUOC_DIP = 14;

/** 00:00 giờ Việt Nam của ngày `YYYY-MM-DD`. */
function dauNgayVN(isoNgay: string): Date {
  const [y, m, d] = isoNgay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
}

function ngayNgan(isoNgay: string): string {
  const [y, m, d] = isoNgay.split("-");
  return `${d}/${m}/${y}`;
}

type DipDaQua = { ma: string; nhan: string; dip: DipMuaVu; nam: number; batDau: string; ketThuc: string };

/** Mỗi dịp một lần gần nhất đã bắt đầu trong 365 ngày qua, mới nhất trước. */
function cacDipDaQua(bayGio: Date): DipDaQua[] {
  const homNay = homNayTheoGioVN(bayGio);
  const namNay = Number(homNay.slice(0, 4));
  const moc = dauNgayVN(homNay).getTime();
  const ra: DipDaQua[] = [];
  for (const dip of CAC_DIP) {
    for (const nam of [namNay, namNay - 1]) {
      const ngay = ngayCuaDipTrongNam(dip, nam);
      if (!ngay || ngay.batDau > homNay) continue;
      if (moc - dauNgayVN(ngay.batDau).getTime() > 365 * MOT_NGAY_MS) break;
      ra.push({ ma: `dip-${dip.id}-${nam}`, nhan: `${dip.ten} ${ngay.batDau.slice(0, 4)}`, dip, nam, ...ngay });
      break;
    }
  }
  return ra.sort((a, b) => b.batDau.localeCompare(a.batDau));
}

export function cacKhoangPhieu(bayGio: Date): LuaChonKhoang[] {
  return [
    ...SO_NGAY_GAN.map((n) => ({ ma: `${n}-ngay`, nhan: NHAN_SO_NGAY[n], nhom: "ngay" as const })),
    ...cacDipDaQua(bayGio).map((d) => ({ ma: d.ma, nhan: d.nhan, nhom: "dip" as const })),
  ];
}

export function chonKhoangPhieu(ma: string | undefined, bayGio: Date): KhoangPhieu {
  const dip = ma ? cacDipDaQua(bayGio).find((d) => d.ma === ma) : undefined;
  if (dip) {
    const tu = new Date(dauNgayVN(dip.batDau).getTime() - SO_NGAY_TRUOC_DIP * MOT_NGAY_MS);
    const het = new Date(dauNgayVN(dip.ketThuc).getTime() + MOT_NGAY_MS);
    const den = het.getTime() < bayGio.getTime() ? het : bayGio;
    const truoc = ngayCuaDipTrongNam(dip.dip, dip.nam - 1);
    const tuTruoc = truoc
      ? new Date(dauNgayVN(truoc.batDau).getTime() - SO_NGAY_TRUOC_DIP * MOT_NGAY_MS)
      : new Date(tu.getTime() - 365 * MOT_NGAY_MS);
    return {
      ma: dip.ma,
      nhan: dip.nhan,
      tu,
      den,
      moTa: `Từ hai tuần trước dịp (lúc khách bắt đầu đặt) tới hết ${ngayNgan(dip.ketThuc)}${den === bayGio ? ", dịp đang diễn ra nên tính tới lúc này" : ""}.`,
      soSanh: {
        nhan: truoc ? `${dip.dip.ten} ${truoc.batDau.slice(0, 4)}` : "cùng kỳ năm trước",
        tu: tuTruoc,
        den: new Date(tuTruoc.getTime() + (den.getTime() - tu.getTime())),
      },
    };
  }
  const soNgay = SO_NGAY_GAN.find((n) => ma === `${n}-ngay`) ?? 7;
  const doDai = soNgay * MOT_NGAY_MS;
  const tu = new Date(bayGio.getTime() - doDai);
  return {
    ma: `${soNgay}-ngay`,
    nhan: NHAN_SO_NGAY[soNgay],
    tu,
    den: bayGio,
    moTa: `Tính lùi ${soNgay} ngày từ lúc này.`,
    soSanh: { nhan: `${soNgay} ngày liền trước`, tu: new Date(tu.getTime() - doDai), den: tu },
  };
}
