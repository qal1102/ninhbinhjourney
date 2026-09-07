import { z } from "zod";

/**
 * TC-17: giấy tờ tuỳ thân — mở đường sẵn, khoá cửa lại.
 *
 * Toàn bộ file này là hàm thuần: không gọi `new Date()`, không đọc
 * `process.env` để suy ra thời điểm — mọi mốc thời gian do phía gọi truyền
 * vào. Đây cũng là nơi giữ duy nhất hai con số/kiểu dữ liệu mà migration
 * `202609070065_customer_sealed_identity_documents.sql` phải khớp theo:
 * số ngày hạn xoá và danh sách lý do thu.
 *
 * Không có RPC hay đường ghi nào gọi tới các hàm này trong lượt việc hiện
 * tại — chưa có màn hình khách tự tải ảnh lên, chưa có API nhận giấy tờ.
 * File này chỉ dựng luật, để khi (và chỉ khi) có người quyết định mở
 * đường thu thật, luật đã sẵn có một chỗ để tuân theo.
 */

/**
 * Hạn xoá: 30 ngày kể từ NGÀY ĐI (không phải ngày thu).
 *
 * ⛔ Đây là quyết định KINH DOANH của chủ dự án, không phải một sự thật
 * pháp lý đã tra cứu. Lý do chọn 30 ngày: dự án bán vé tham quan trong
 * ngày, không phải cơ sở lưu trú, nên nghĩa vụ khai báo lưu trú (nếu có)
 * chưa chạm tới; 30 ngày đủ phủ một kỳ tra soát mà không biến kho thành
 * thư viện lưu vĩnh viễn. PHẢI hỏi luật sư trước khi thu bất kỳ giấy tờ
 * thật nào của khách — con số này có thể phải đổi sau khi có tư vấn pháp
 * lý, và khi đổi thì chỉ sửa đúng một chỗ này.
 */
export const IDENTITY_DOCUMENT_RETENTION_DAYS = 30;

export const IDENTITY_DOCUMENT_TYPES = ["cccd", "cmnd", "ho_chieu", "khac"] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

/**
 * Lý do thu — liệt kê có ràng buộc, không phải text tự do. Phải khớp từng
 * chữ với check constraint `collection_reason` trong migration
 * `202609070065_customer_sealed_identity_documents.sql`.
 *
 * Không có lý do nào trong danh sách này khẳng định một nghĩa vụ pháp lý
 * đã xác nhận — `residence_notification_pending_legal_review` mô tả đúng
 * hiện trạng: chuẩn bị trước cho một khả năng, đang chờ luật sư xác nhận,
 * không phải "vì luật bắt buộc".
 */
export const IDENTITY_DOCUMENT_COLLECTION_REASONS = [
  // Cơ quan chức năng yêu cầu xuất trình/lưu vết.
  "authority_request",
  // Phục vụ điều tra sự cố hoặc tranh chấp tại điểm đến.
  "incident_investigation",
  // Đối tác lữ hành/lưu trú liên kết yêu cầu theo hợp đồng đã ký.
  "partner_contract_requirement",
  // Chuẩn bị trước cho một nghĩa vụ khai báo lưu trú CHƯA xác nhận — đang
  // chờ luật sư, không phải đã có hiệu lực.
  "residence_notification_pending_legal_review",
  // Trường hợp khác, đã được giám đốc phê duyệt riêng cho từng trường hợp.
  "other_approved_by_director",
] as const;
export type IdentityDocumentCollectionReason = (typeof IDENTITY_DOCUMENT_COLLECTION_REASONS)[number];

/**
 * Tính hạn xoá từ ngày đi. Hàm thuần: `departureDate` do phía gọi truyền
 * vào, hàm không tự đọc đồng hồ hệ thống.
 */
export function computeIdentityDocumentExpiryAt(departureDate: Date): Date {
  const expiresAt = new Date(departureDate.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + IDENTITY_DOCUMENT_RETENTION_DAYS);
  return expiresAt;
}

/**
 * Một hàng đã hết hạn khi hạn xoá không còn ở tương lai so với `now`. `now`
 * do phía gọi truyền vào để hàm giữ tính thuần và dễ kiểm.
 */
export function isIdentityDocumentExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export const IdentityDocumentCollectionInputSchema = z
  .object({
    tenantId: z.string().uuid(),
    profileId: z.string().uuid(),
    documentType: z.enum(IDENTITY_DOCUMENT_TYPES),
    collectionReason: z.enum(IDENTITY_DOCUMENT_COLLECTION_REASONS),
    departureDate: z.date(),
    documentCiphertext: z.string().min(24).max(8192),
    encryptionKeyVersion: z.string().trim().min(1).max(40),
  })
  .strict();

export type IdentityDocumentCollectionInput = z.infer<
  typeof IdentityDocumentCollectionInputSchema
>;

export type IdentityDocumentCollectionValidation =
  | {
      ok: true;
      value: IdentityDocumentCollectionInput & { expiresAt: Date };
    }
  | { ok: false; errors: string[] };

/**
 * Kiểm đầu vào cho một lượt thu giấy tờ trong tương lai (chưa có bên gọi
 * nào trong lượt việc hiện tại). Trả về hạn xoá đã tính sẵn cùng lúc kiểm
 * hợp lệ, để không có đường nào tạo được một hàng thiếu `expiresAt`.
 */
export function validateIdentityDocumentCollectionInput(
  input: unknown,
): IdentityDocumentCollectionValidation {
  const parsed = IdentityDocumentCollectionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      expiresAt: computeIdentityDocumentExpiryAt(parsed.data.departureDate),
    },
  };
}

/**
 * Feature flag mặc định TẮT, theo đúng nếp các cờ `*_ENABLED` đang có
 * trong dự án (đọc biến môi trường, so sánh chuỗi `"true"`, thiếu biến coi
 * như tắt — xem `CUSTOMER_BOOKING_ENABLED` trong
 * `lib/customer-data/booking-repository.ts` và
 * `CUSTOMER_IDENTITY_COLLECTION_ENABLED` trong
 * `lib/customer-data/identity-repository.ts`).
 *
 * Đây KHÔNG phải một trường trong `ExperienceConfig` của
 * `config/experience.ts`: cấu hình đó được đọc vào bundle của trình duyệt
 * (qua `NEXT_PUBLIC_*` và `getExperienceSurfaceAttributes`), còn việc có
 * thu giấy tờ tuỳ thân hay không là quyết định thuần phía máy chủ, không
 * có lý do gì để khách đứng ngoài đọc được cờ này qua mã nguồn phía
 * trình duyệt. Vì vậy cờ được khai riêng ở đây, cùng chỗ với luật thu mà
 * nó bật/tắt.
 */
export function isCustomerIdentityDocumentCollectionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED?.trim() === "true";
}
