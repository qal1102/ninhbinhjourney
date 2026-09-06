/**
 * Vé mẫu hay vé khách thật, phân biệt bằng dạng mã.
 *
 * Hàng rào thật nằm ở PostgreSQL: `erp_refresh_demo_tickets` chỉ chạm những
 * mã khớp `^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$` (migration 202608300055), nên vé
 * bán qua web mang mã `WEB-` cộng 12 ký tự không bao giờ bị nút "Làm mới vé
 * mẫu" kéo đi.
 *
 * Nhưng màn hình cổng thì chưa từng phân biệt: `listScannableTicketsToday`
 * đọc MỌI vé còn hiệu lực hôm nay rồi hiện tất cả dưới tiêu đề "Vé quét thử
 * được hôm nay". Hôm nay chưa cắn vì chưa có vé web nào trên production.
 * Có khách đầu tiên là vé thật của họ nằm trong một khối mang tên "vé thử".
 * Kiểm kê 05/09/2026 bắt được.
 *
 * Biểu thức dưới đây phải khớp đúng biểu thức trong migration. Đổi một bên
 * mà quên bên kia thì nhãn sai, nên bài kiểm khoá cả hai dạng mã đang có.
 */
const DEMO_TICKET_CODE = /^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$/;

export function isDemoTicketCode(ticketCode: string) {
  return DEMO_TICKET_CODE.test(ticketCode);
}
