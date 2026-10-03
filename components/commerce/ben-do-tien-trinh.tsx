import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Thanh tiến trình đặt chỗ kiểu bến đò: năm bến dọc một dòng sông, con đò
 * trôi tới bến của bước đang làm, bến đã qua sáng đèn. Đọc thẳng trạng thái
 * thật của luồng đặt chỗ (`buocChi` trong `customer-booking-checkout.tsx`),
 * nên đò không bao giờ đứng sai bến.
 *
 * Trình đọc màn hình đọc nó như một danh sách bước có `aria-current="step"`.
 * Đò trôi bằng `transition` CSS; giảm chuyển động thì đò đứng sẵn tại bến.
 */

export type BuocDatCho = "ngay" | "gio" | "giu" | "lien-he" | "qr" | "xong";

const THU_TU: Record<BuocDatCho, number> = { ngay: 0, gio: 0, giu: 1, "lien-he": 2, qr: 3, xong: 4 };

const BEN = [
  { vi: "Ngày giờ", en: "Date & time" },
  { vi: "Giữ chỗ", en: "Hold" },
  { vi: "Thông tin", en: "Details" },
  { vi: "Trả bằng QR", en: "Pay by QR" },
  { vi: "Có vé", en: "Ticket" },
] as const;

export function BenDoTienTrinh({ buoc, lang }: { buoc: BuocDatCho; lang: NgonNgu }) {
  const hienTai = THU_TU[buoc];
  const phanTram = (hienTai / (BEN.length - 1)) * 100;
  return (
    <nav aria-label={lang === "en" ? "Booking steps" : "Các bước đặt chỗ"} className="ben-do" data-testid="ben-do-tien-trinh">
      <div className="ben-do-song" aria-hidden="true">
        <span className="ben-do-da-di" style={{ width: `${phanTram}%` }} />
        <span className="ben-do-do" style={{ left: `${phanTram}%` }}>
          <svg viewBox="0 0 64 22">
            <path d="M2 15 Q32 22 62 15 Q60 18 54 19 L10 19 Q4 18 2 15 Z" fill="currentColor" />
            <path d="M40 15 L42 7 L44 15 Z" fill="currentColor" />
            <path d="M36 7.5 Q42 2 48 7.5 Z" fill="currentColor" />
            <path d="M44 9 L58 21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <ol className="ben-do-ds">
        {BEN.map((ben, i) => (
          <li
            key={ben.vi}
            aria-current={i === hienTai ? "step" : undefined}
            data-trang-thai={i < hienTai ? "da-qua" : i === hienTai ? "dang" : "chua"}
            className="ben-do-ben"
          >
            <span className="ben-do-den" aria-hidden="true" />
            <span className="ben-do-nhan">{lang === "en" ? ben.en : ben.vi}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
