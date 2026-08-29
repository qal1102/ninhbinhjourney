/**
 * Mật khẩu của các tài khoản trình diễn ERP, phân giải đúng như sản phẩm.
 *
 * `lib/erp/demo-data.ts` đọc mật khẩu theo thứ tự: biến môi trường trước,
 * chuỗi mặc định sau. Các spec trước đây chép cứng **chuỗi mặc định**, nên
 * chúng chỉ đúng chừng nào production chưa đặt biến.
 *
 * Ngày 22/08/2026 production đặt cả sáu `ERP_DEMO_*_PASSWORD` trên Vercel.
 * Từ thời điểm đó, **toàn bộ 27 spec smoke production mất đường đăng nhập** và
 * dừng ở `/erp/login?error=invalid`. Triệu chứng trông hệt một lỗi sản phẩm
 * nghiêm trọng, trong khi thực chất là hạ tầng kiểm thử đã lệch khỏi cấu hình
 * thật — đúng loại nhầm lẫn đã một lần tạo ra báo cáo "lỗi nghiêm trọng" giả.
 *
 * Vì thế nơi này là **nguồn duy nhất**, và nó phân giải theo cùng một quy tắc
 * với sản phẩm. Không spec nào được chép lại chuỗi mật khẩu lần nữa.
 *
 * Chạy trên production thì truyền mật khẩu thật trong **cùng câu lệnh**, giống
 * cách bắt buộc với `PLAYWRIGHT_BASE_URL`:
 *
 *   ERP_DEMO_DIRECTOR_PASSWORD=... PLAYWRIGHT_BASE_URL=https://... npx playwright test ...
 *
 * Giá trị thật **không bao giờ được ghi vào repo, vào `.env` hay vào log.**
 */

export const ERP_DIRECTOR_PASSWORD =
  process.env.ERP_DEMO_DIRECTOR_PASSWORD ?? "Giamdoc@2026";
export const ERP_MANAGER_PASSWORD =
  process.env.ERP_DEMO_MANAGER_PASSWORD ?? "Quanly@2026";
export const ERP_EMPLOYEE_PASSWORD =
  process.env.ERP_DEMO_EMPLOYEE_PASSWORD ?? "Nhanvien@2026";
export const ERP_ACCOUNTANT_PASSWORD =
  process.env.ERP_DEMO_ACCOUNTANT_PASSWORD ?? "Ketoan@2026";
export const ERP_CHIEF_ACCOUNTANT_PASSWORD =
  process.env.ERP_DEMO_CHIEF_ACCOUNTANT_PASSWORD ?? "Ketoantruong@2026";
export const ERP_SEASONAL_PASSWORD =
  process.env.ERP_DEMO_SEASONAL_PASSWORD ?? "Thoivu@2026";

/**
 * Chỉ canh giữ mật khẩu giám đốc, cố ý.
 *
 * Chủ dự án chốt ngày 29/08/2026: trong thực tế **chỉ tài khoản giám đốc được
 * dùng**, mọi vai khác xem bằng nút "Xem theo vai trò" ngay trong phiên đó.
 * Mật khẩu của năm tài khoản còn lại không phải chuyện vận hành, nên đừng
 * dựng thêm gì quanh chúng và đừng bắt ai phải nhập chúng.
 *
 * Vì thế chỉ cảnh báo đúng một biến. Trước đó khối này liệt kê cả sáu, và
 * chạy bộ smoke bình thường cũng in ra năm dòng "thiếu" — tiếng ồn thuần tuý,
 * làm loãng đúng cái dòng cần đọc.
 */
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const isRemote = /^https?:\/\//i.test(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl);

if (isRemote && !process.env.ERP_DEMO_DIRECTOR_PASSWORD) {
  console.warn(
    [
      `[erp-credentials] Chạy với ${baseUrl} mà chưa truyền ERP_DEMO_DIRECTOR_PASSWORD.`,
      "Mọi bài đăng nhập sẽ dừng ở /erp/login?error=invalid — thiếu mật khẩu,",
      "KHÔNG phải lỗi sản phẩm.",
    ].join("\n"),
  );
}
