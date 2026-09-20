import type { ErpRole } from "@/domain/erp";

/**
 * TC-12 mục 3–4 — ai được ẩn một lời khách, ẩn được bao nhiêu, và giới hạn
 * cứng "không được ẩn tới mức bảng điểm toàn 5 sao".
 *
 * Hàm thuần, không gọi mạng. Luật thật nằm **cả ở đây lẫn trong SQL**: SQL là
 * nơi chặn cuối cùng (ai gọi thẳng hàm cũng không lách được), còn ở đây để màn
 * hình nói trước cho người vận hành biết vì sao không bấm được, thay vì để họ
 * bấm rồi mới ăn một câu từ chối.
 *
 * ## Vì sao có hạn mức
 *
 * Kế hoạch TC-12 ghi thẳng: quản trị hệ thống xoá hàng loạt được (dùng cho đợt
 * spam), còn chăm sóc khách hàng và marketing chỉ được hạn mức nhỏ. Lý do nằm ở
 * chỗ khác nhau về động cơ: người dọn spam không có lợi ích gì khi xoá một lời
 * chê thật, người làm marketing thì có. Hạn mức không phải là nghi ngờ ai — nó
 * là cái phanh để một quyết định lúc nóng giận không xoá sạch được một tuần
 * đánh giá.
 */

/** Số lời một người được ẩn trong 30 ngày. `null` nghĩa là không giới hạn. */
export const MODERATION_QUOTA_30_DAYS: Record<ErpRole, number | null> = {
  // Quản trị hệ thống: dọn cả đợt spam, không hạn mức.
  director: null,
  // Chăm sóc khách hàng / marketing: hạn mức nhỏ, đúng khoảng 10–20 của kế hoạch.
  manager: 20,
  // Ba vai còn lại không dính gì tới việc này.
  accountant: 0,
  "chief-accountant": 0,
  employee: 0,
};

export function canModerateReviews(role: ErpRole): boolean {
  const quota = MODERATION_QUOTA_30_DAYS[role];
  return quota === null || quota > 0;
}

export function remainingQuota(role: ErpRole, usedIn30Days: number): number | null {
  const quota = MODERATION_QUOTA_30_DAYS[role];
  if (quota === null) return null;
  return Math.max(0, quota - Math.max(0, usedIn30Days));
}

/**
 * Luật "không được ẩn tới mức toàn 5 sao" (TC-12 mục 4).
 *
 * Chủ dự án nói đúng: một bảng điểm toàn năm sao trông giả, và khách nhận ra
 * rất nhanh. Vì thế lời **không phải 5 sao** chỉ ẩn được khi sau đó vẫn còn ít
 * nhất một lời không phải 5 sao ở chính nơi ấy.
 *
 * Nơi mới có ít lời thì luật này không áp: ba lời mà cấm ẩn thì một lời spam
 * thật cũng nằm lại vĩnh viễn. Ngưỡng đặt ở `MODERATION_MIN_VISIBLE`.
 */
export const MODERATION_MIN_VISIBLE = 3;

export function viPhamLuatToanNamSao(input: {
  /** Sao của lời đang định ẩn. */
  ratingBeingHidden: number;
  /** Sao của MỌI lời đang hiện ở nơi ấy, gồm cả lời đang định ẩn. */
  visibleRatings: readonly number[];
}): boolean {
  const { ratingBeingHidden, visibleRatings } = input;
  if (ratingBeingHidden === 5) return false;
  if (visibleRatings.length < MODERATION_MIN_VISIBLE) return false;

  const conLai = [...visibleRatings];
  const viTri = conLai.indexOf(ratingBeingHidden);
  if (viTri !== -1) conLai.splice(viTri, 1);
  if (conLai.length === 0) return true;
  return conLai.every((sao) => sao === 5);
}

export const MODERATION_COPY = {
  khongCoQuyen: "Vai của bạn không ẩn được đánh giá của khách.",
  hetHanMuc: (quota: number) =>
    `Bạn đã dùng hết hạn mức ${quota} lời trong 30 ngày. Việc còn lại xin chuyển giám đốc ạ.`,
  toanNamSao:
    "Ẩn lời này thì nơi ấy chỉ còn toàn 5 sao. Một bảng điểm toàn năm sao trông giả, nên hệ thống giữ lại lời này.",
  thieuLyDo: "Xin ghi rõ lý do ẩn, vì mỗi lượt ẩn đều được lưu lại tên người ẩn.",
  conLai: (con: number | null) =>
    con === null ? "Bạn ẩn được không giới hạn." : `Bạn còn ẩn được ${con} lời trong 30 ngày này.`,
} as const;
