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
 * Cảnh báo sớm, để một lần nữa không phải đoán.
 *
 * Ngày 29/08/2026 bộ smoke chạy với **một** mật khẩu giám đốc trong khi bốn
 * bài của nó đăng nhập bằng quản lý, nhân viên và kế toán. Ba vai kia rơi về
 * chuỗi mặc định và đỏ ở `/erp/login?error=invalid`. Vì các bài đó vừa mới
 * đổi bố cục màn hình sức chứa, kết quả trông y hệt một hồi quy giao diện —
 * chỉ đọc `error-context.md` mới thấy nó chưa từng vào tới màn hình.
 *
 * Khối dưới đây không sửa được gì, nhưng nó in ra đúng cái tên biến còn thiếu
 * ngay trên đầu output, nên chẩn đoán mất vài giây thay vì vài lượt suy luận.
 * Cố tình chỉ cảnh báo chứ không ném lỗi: nhiều spec chỉ dùng một vai, ném lỗi
 * sẽ chặn oan những spec không liên quan.
 */
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const isRemote = /^https?:\/\//i.test(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl);

if (isRemote) {
  const missing = [
    "ERP_DEMO_DIRECTOR_PASSWORD",
    "ERP_DEMO_MANAGER_PASSWORD",
    "ERP_DEMO_EMPLOYEE_PASSWORD",
    "ERP_DEMO_ACCOUNTANT_PASSWORD",
    "ERP_DEMO_CHIEF_ACCOUNTANT_PASSWORD",
    "ERP_DEMO_SEASONAL_PASSWORD",
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.warn(
      [
        `[erp-credentials] Đang chạy với ${baseUrl} nhưng thiếu ${missing.length} biến mật khẩu:`,
        ...missing.map((name) => `  - ${name}`),
        "Spec nào đăng nhập bằng các vai này sẽ dừng ở /erp/login?error=invalid.",
        "Đó là thiếu mật khẩu, KHÔNG phải lỗi sản phẩm.",
      ].join("\n"),
    );
  }
}
