/**
 * TC-12 (mục 2) — đọc bảng điểm bằng con mắt người điều hành.
 *
 * Hàm thuần, không gọi mạng. Nguồn là `erp_site_review_overview`: mỗi cơ sở
 * một hàng, có số lời, điểm, phổ điểm và **số lượt vào trong cùng kỳ**.
 *
 * Hai câu hỏi hàm này trả lời, và cố ý chỉ hai:
 *
 *   1. Nơi nào đang tụt? — điểm thấp là việc phải xử ngay.
 *   2. Nơi nào hay mà ít người biết? — điểm cao, lưu lượng thấp. Đây là chỗ
 *      duy nhất trong cả hệ thống tạo ra giá trị mới thay vì đo lại cái đã có.
 *
 * Cố ý KHÔNG xếp hạng theo độ nổi tiếng: kế hoạch TC đã ghi rõ vì sao — xếp
 * theo lượt ghé thì nơi đông càng đông, nơi vắng vĩnh viễn không ngoi lên
 * được, rồi tới lúc nơi đông chạm trần thì chính hệ thống vừa đẩy khách tới
 * đó lại phải quay ra chặn họ.
 */

export type SiteReviewOverviewVoice = {
  rating: number;
  comment: string;
  createdAt: string;
};

export type SiteReviewOverview = {
  siteId: string;
  /** Số lời khách đã kể trong kỳ. */
  reviewCount: number;
  /** Null khi chưa ai kể — khác hẳn 0 điểm. */
  average: number | null;
  spread: Record<"1" | "2" | "3" | "4" | "5", number>;
  /** Số lượt vào cổng trong cùng kỳ, dùng để so với điểm. */
  entryCount: number;
  recentVoices: SiteReviewOverviewVoice[];
};

/**
 * Dưới mức này thì mọi kết luận đều là đoán mò, nên bảng chỉ nói "chưa đủ".
 * Cao hơn ngưỡng của bề mặt khách (3) vì một quyết định vận hành tốn tiền
 * thật, còn khách chỉ đang đọc cho biết.
 */
export const OVERVIEW_MIN_REVIEWS = 5;

/** Dưới mức này coi là đang tụt, phải nhìn ngay. */
export const OVERVIEW_LOW_SCORE = 3.5;

/** Từ mức này trở lên coi là khách thật sự hài lòng. */
export const OVERVIEW_HIGH_SCORE = 4.5;

function ratingFrom(value: unknown): number {
  const so = Number(value);
  if (!Number.isFinite(so)) return 0;
  const tron = Math.round(so);
  return tron >= 1 && tron <= 5 ? tron : 0;
}

function demFrom(value: unknown): number {
  const so = Number(value);
  return Number.isFinite(so) && so > 0 ? Math.round(so) : 0;
}

export function siteReviewOverviewsFrom(value: unknown): SiteReviewOverview[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hang = item as Record<string, unknown>;
      if (!hang.site_id) return null;
      const pho = (hang.pho_diem ?? {}) as Record<string, unknown>;
      const diem = Number(hang.diem_trung_binh);
      const loi = Array.isArray(hang.loi_gan_day) ? hang.loi_gan_day : [];
      return {
        siteId: String(hang.site_id),
        reviewCount: demFrom(hang.so_luot),
        average: Number.isFinite(diem) && diem > 0 ? diem : null,
        spread: {
          "1": demFrom(pho["1"]),
          "2": demFrom(pho["2"]),
          "3": demFrom(pho["3"]),
          "4": demFrom(pho["4"]),
          "5": demFrom(pho["5"]),
        },
        entryCount: demFrom(hang.so_luot_vao),
        recentVoices: loi
          .map((item2) => {
            if (!item2 || typeof item2 !== "object") return null;
            const v = item2 as Record<string, unknown>;
            const rating = ratingFrom(v.rating);
            const comment = String(v.comment ?? "").trim();
            if (rating === 0 || comment.length === 0) return null;
            return { rating, comment, createdAt: String(v.created_at ?? "") };
          })
          .filter((v): v is SiteReviewOverviewVoice => v !== null),
      };
    })
    .filter((s): s is SiteReviewOverview => s !== null);
}

/** Đủ lời để nói được một câu có căn cứ chưa. */
export function duLoiDeKetLuan(row: SiteReviewOverview): boolean {
  return row.reviewCount >= OVERVIEW_MIN_REVIEWS && row.average !== null;
}

export function noiDangTut(rows: SiteReviewOverview[]): SiteReviewOverview[] {
  return rows
    .filter((row) => duLoiDeKetLuan(row) && (row.average ?? 5) < OVERVIEW_LOW_SCORE)
    .sort((a, b) => (a.average ?? 5) - (b.average ?? 5));
}

/**
 * "Nơi hay mà ít người biết": điểm cao, nhưng lượt vào thấp hơn hẳn mức trung
 * bình của các nơi đang được đo trong cùng kỳ.
 *
 * Dùng **trung vị** chứ không dùng trung bình cộng: một Tràng An đông gấp mười
 * lần chỗ khác sẽ kéo trung bình lên cao tới mức chẳng nơi nào "ít người" nữa.
 *
 * Cần ít nhất ba nơi có dữ liệu thì so sánh mới có nghĩa; dưới đó trả rỗng
 * thay vì bịa ra một kết luận.
 */
export function noiHayMaItNguoiBiet(rows: SiteReviewOverview[]): SiteReviewOverview[] {
  const coDuLieu = rows.filter(duLoiDeKetLuan);
  if (coDuLieu.length < 3) return [];

  const luot = coDuLieu.map((row) => row.entryCount).sort((a, b) => a - b);
  const giua = Math.floor(luot.length / 2);
  const trungVi = luot.length % 2 === 0 ? (luot[giua - 1] + luot[giua]) / 2 : luot[giua];

  return coDuLieu
    .filter((row) => (row.average ?? 0) >= OVERVIEW_HIGH_SCORE && row.entryCount < trungVi)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
}

/** Điểm viết theo lối người Việt: dấu phẩy, một chữ số lẻ. */
export function vietDiem(average: number | null): string {
  return average === null ? "—" : average.toFixed(1).replace(".", ",");
}
