/**
 * Đổi số phút ra cách người Việt nói: "45 phút", "3 giờ 20 phút",
 * "64 ngày". Trước 04/10/2026 màn Sự cố in thẳng "Quá SLA 92149 phút".
 */
export function thoiLuongChu(phut: number): string {
  const p = Math.max(0, Math.round(phut));
  if (p < 60) return `${p} phút`;
  if (p < 24 * 60) {
    const gio = Math.floor(p / 60);
    const le = p % 60;
    return le ? `${gio} giờ ${le} phút` : `${gio} giờ`;
  }
  return `${Math.floor(p / (24 * 60))} ngày`;
}

/** "06/10/2026" từ "2026-10-06". Chuỗi không đúng dạng thì trả nguyên. */
export function ngayVietNam(ngayIso: string): string {
  const khop = /^(\d{4})-(\d{2})-(\d{2})/.exec(ngayIso);
  return khop ? `${khop[3]}/${khop[2]}/${khop[1]}` : ngayIso;
}

/**
 * Lời chào đầu trang giám đốc. Chủ dự án là anh Đạt và muốn được chào đúng
 * một câu "Chào anh Đạt" (04/10/2026). Kho không lưu cách xưng hô của từng
 * người, nên chỉ tài khoản giám đốc gốc mới có chữ "anh"; người khác được
 * chào bằng tên đầy đủ, không đoán.
 */
export function loiChaoGiamDoc(accountId: string, displayName: string): string {
  const ten = displayName.trim();
  if (accountId !== "director-001") return `Chào ${ten}`;
  return `Chào anh ${ten.split(/\s+/).at(-1) ?? ten}`;
}
