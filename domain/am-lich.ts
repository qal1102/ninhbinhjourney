/**
 * Đổi âm lịch Việt Nam sang dương lịch.
 *
 * ## Vì sao dự án cần tệp này
 *
 * Gần như mọi dịp lớn của Ninh Bình đều tính theo **âm lịch**: khai hội chùa
 * Bái Đính mùng 6 tháng Giêng, lễ hội Hoa Lư mùng 8 tháng Ba, lễ hội Tràng An
 * 18 tháng Ba, Phật đản 15 tháng Tư, Vu lan 15 tháng Bảy, Trung thu 15 tháng
 * Tám. Muốn có một cuốn lịch mùa vụ dùng được cho **bất kỳ năm nào** thì phải
 * tính được, chứ chép tay từng năm là vài năm sau cuốn lịch nói sai mà không
 * ai biết.
 *
 * ## Phép tính
 *
 * Thuật toán âm lịch Việt Nam theo cách dựng quen thuộc: tìm kỳ sóc (trăng
 * mới) bằng công thức Meeus, lấy **múi giờ +7** để quyết định ngày, rồi xác
 * định tháng Mười Một chứa đông chí làm mốc và dò tháng nhuận từ đó. Múi giờ
 * là chỗ dễ sai nhất: cùng một kỳ sóc, +7 và +8 có thể rơi vào hai ngày khác
 * nhau, và đó chính là lý do lịch Việt Nam và lịch Trung Quốc thỉnh thoảng
 * lệch nhau một tháng.
 *
 * ## Tệp này chỉ làm một việc
 *
 * Đổi ngày. Nó **không** trả về can chi, giờ hoàng đạo hay ngày tốt xấu —
 * những thứ ấy không tính chắc được từ đây, và dự án không nói điều mình
 * không chắc.
 */

const MUI_GIO_VN = 7;

/** Số ngày Julius của một ngày dương lịch. */
export function soNgayJulius(ngay: number, thang: number, nam: number): number {
  const a = Math.floor((14 - thang) / 12);
  const y = nam + 4800 - a;
  const m = thang + 12 * a - 3;
  let jd =
    ngay +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd =
      ngay + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Ngày dương lịch từ số ngày Julius. */
export function ngayTuJulius(jd: number): { ngay: number; thang: number; nam: number } {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    ngay: e - Math.floor((153 * m + 2) / 5) + 1,
    thang: m + 3 - 12 * Math.floor(m / 10),
    nam: b * 100 + d - 4800 + Math.floor(m / 10),
  };
}

/** Thời điểm kỳ sóc thứ `k` kể từ 01/01/1900, tính bằng ngày Julius. */
function kySoc(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3 +
    0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  Jd1 = Jd1 + C1 - deltat;
  return Jd1;
}

/** Ngày (số Julius nguyên) của kỳ sóc thứ `k` theo múi giờ Việt Nam. */
function ngaySoc(k: number): number {
  return Math.floor(kySoc(k) + 0.5 + MUI_GIO_VN / 24);
}

/** Kinh độ mặt trời tại một ngày, chia thành 12 cung 30°. */
function cungMatTroi(jdn: number): number {
  const T = (jdn - 2451545.5 - MUI_GIO_VN / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L *= dr;
  L -= Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

/** Ngày bắt đầu tháng Mười Một âm lịch (tháng chứa đông chí) của một năm. */
function thangMuoiMot(nam: number): number {
  const off = soNgayJulius(31, 12, nam) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = ngaySoc(k);
  if (cungMatTroi(nm) >= 9) nm = ngaySoc(k - 1);
  return nm;
}

/** Tháng nhuận nằm cách tháng Mười Một mốc bao nhiêu tháng. */
function khoangThangNhuan(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = cungMatTroi(ngaySoc(k + i));
  do {
    last = arc;
    i += 1;
    arc = cungMatTroi(ngaySoc(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export type NgayAm = {
  ngay: number;
  thang: number;
  nam: number;
  /** Tháng này có phải tháng nhuận không. */
  nhuan: boolean;
};

/** Đổi một ngày dương lịch sang âm lịch Việt Nam. */
export function duongSangAm(ngay: number, thang: number, nam: number): NgayAm {
  const dayNumber = soNgayJulius(ngay, thang, nam);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = ngaySoc(k + 1);
  if (monthStart > dayNumber) monthStart = ngaySoc(k);
  let a11 = thangMuoiMot(nam);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = nam;
    a11 = thangMuoiMot(nam - 1);
  } else {
    lunarYear = nam + 1;
    b11 = thangMuoiMot(nam + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = khoangThangNhuan(a11);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { ngay: lunarDay, thang: lunarMonth, nam: lunarYear, nhuan: lunarLeap };
}

/**
 * Đổi một ngày âm lịch Việt Nam sang dương lịch.
 *
 * Trả `null` khi ngày ấy không tồn tại — ví dụ hỏi tháng nhuận của một năm
 * không có tháng nhuận. Thà trả về "không có" còn hơn trả một ngày gần đúng:
 * một cuốn lịch nói sai ngày lễ còn tệ hơn một cuốn lịch nói thẳng là không
 * biết.
 */
export function amSangDuong(
  ngayAm: number,
  thangAm: number,
  namAm: number,
  nhuan = false,
): { ngay: number; thang: number; nam: number } | null {
  if (ngayAm < 1 || ngayAm > 30 || thangAm < 1 || thangAm > 12) return null;
  let a11: number;
  let b11: number;
  if (thangAm < 11) {
    a11 = thangMuoiMot(namAm - 1);
    b11 = thangMuoiMot(namAm);
  } else {
    a11 = thangMuoiMot(namAm);
    b11 = thangMuoiMot(namAm + 1);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = thangAm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = khoangThangNhuan(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (nhuan && thangAm !== leapMonth) return null;
    if (nhuan || off >= leapOff) off += 1;
  } else if (nhuan) {
    return null;
  }
  const monthStart = ngaySoc(k + off);
  const ra = ngayTuJulius(monthStart + ngayAm - 1);
  // Phép kiểm ngược: một ngày âm lịch không tồn tại (mùng 30 của tháng thiếu)
  // vẫn cho ra một ngày dương, nhưng đổi ngược lại sẽ không khớp.
  const lai = duongSangAm(ra.ngay, ra.thang, ra.nam);
  if (lai.ngay !== ngayAm || lai.thang !== thangAm || lai.nhuan !== nhuan) {
    return null;
  }
  return ra;
}

/** Dạng `YYYY-MM-DD` cho một ngày âm lịch, hoặc `null` nếu ngày ấy không có. */
export function ngayDuongISO(
  ngayAm: number,
  thangAm: number,
  namAm: number,
  nhuan = false,
): string | null {
  const d = amSangDuong(ngayAm, thangAm, namAm, nhuan);
  if (!d) return null;
  return `${d.nam}-${String(d.thang).padStart(2, "0")}-${String(d.ngay).padStart(2, "0")}`;
}
