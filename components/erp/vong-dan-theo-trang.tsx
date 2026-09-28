import { chuVongDan, HIEN_VONG_DAN, hienVongDanTai, VONG_TIEN_ID } from "@/domain/huong-dan-vong-dau";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { readTienDoVongDan } from "@/lib/erp/huong-dan-repository";
import { VongDanPanel } from "./vong-dan-panel";

/**
 * Vòng dẫn trên các màn ERP ngoài trang đầu: đi dở thì lời dẫn đi theo sang
 * màn Khách hàng, màn soát vé…, để người dùng không phải quay về trang đầu
 * mới đọc được bước tiếp.
 *
 * Cố ý là một thành phần máy chủ riêng, tự đọc tiến độ của nó. 28/09/2026 đo
 * được: chỉ cần đổi cách `ErpShell` chờ dữ liệu (gộp lượt đọc tài khoản với
 * lượt đọc vòng dẫn vào một `Promise.all`) là nút "Duyệt phương án ngoại lệ"
 * có lúc kẹt "đang gửi" dù máy chủ đã duyệt xong (2/8 lần; khung giữ nguyên
 * thì 8/8 sạch). Chưa tìm ra gốc trong Next, nên đừng đưa lượt đọc này vào
 * khung.
 */
export async function VongDanTheoTrang({ user }: { user: CurrentErpUser }) {
  const chuVong = HIEN_VONG_DAN ? chuVongDan(user) : null;
  if (!chuVong) return null;
  const tienDo = await readTienDoVongDan({ accountId: chuVong, vongId: VONG_TIEN_ID });
  if (!hienVongDanTai(tienDo, false)) return null;
  return <VongDanPanel tienDoBanDau={tienDo} trangDau={false} />;
}
