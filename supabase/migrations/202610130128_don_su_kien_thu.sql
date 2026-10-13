-- Dọn dữ liệu thử của đợt kiểm production 13/10/2026 (`2du`), chỉ đúng các mã
-- dưới đây, không theo khoảng thời gian:
-- - sự kiện thử `thu-rut-tham-1310` (mở trong ERP với hạn 2 phút để bấm thử
--   rút thăm; xoá kéo theo hai lượt đăng ký của số thử •••901, •••902);
-- - lượt đăng ký thử `SK-2ADC50` (số thử •••901) trong sự kiện mẫu.
-- Hai ảnh thử của số •••902 đã ở trạng thái `tu-choi` (không hiện ở đâu) nên
-- giữ nguyên.

begin;

delete from public.su_kien
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and slug = 'thu-rut-tham-1310';

delete from public.su_kien_dang_ky d
using public.su_kien s
where d.su_kien_id = s.id
  and s.tenant_id = '00000000-0000-4000-8000-000000000001'
  and s.slug = 'dem-trang-trang-an-2026'
  and d.ma_tham_gia = 'SK-2ADC50'
  and d.contact_hint = '901';

commit;
