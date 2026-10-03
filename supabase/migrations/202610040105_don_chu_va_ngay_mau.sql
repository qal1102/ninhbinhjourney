-- Soát chữ toàn ERP 04/10/2026: ba chỗ sai nằm trong dữ liệu, không trong mã.
--
-- 1. 31 đề nghị đổi ngân sách tên "PROD-SMOKE …" còn nằm ở màn Dự án Tràng An
--    và Bái Đính: cặn của các bài kiểm production cũ, cùng loại migration 022
--    đã dọn. Xoá đúng vế `summary like 'PROD-SMOKE%'` như 022.
--
-- 2. Bốn sự kiện mẫu (mã 20000000-…) mang ngày từ tháng 7, tháng 8: sự kiện
--    Tràng An "14/08/2026" đã qua 51 ngày mà tiến độ mới 35%, hạn các gói việc
--    nằm cả ở tháng 7. Đọc lên là vô nghĩa. Dời sự kiện, hạn gói việc (mã
--    EV-…) và ngày trong dòng "mốc tiếp theo" lên 100 ngày, chỉ với sự kiện mẫu
--    đã qua ngày, nên chạy lại không dời thêm. Hàng do người dùng tạo không bị
--    đụng tới.
--
-- 3. Danh mục kiểm tra mở cửa: mục "Tam Phòng và đường thoát" (đọc như tên
--    một căn phòng) đổi thành "Ba lớp phòng vệ và đường thoát", đúng điều mô
--    tả ngay bên dưới: con người, rào chắn, công nghệ. Nguồn ghi "Playbook
--    Tam Chuc.pdf · PDF p.65" đổi sang "Sổ tay vận hành Tam Chúc · trang 65".

begin;

delete from public.erp_project_change_requests
where summary like 'PROD-SMOKE%';

with su_kien as (
  update public.erp_project_events e
  set
    event_date = e.event_date + 100,
    next_milestone = case
      when e.next_milestone ~ '\d{1,2}/\d{1,2}' then regexp_replace(
        e.next_milestone,
        '\d{1,2}/\d{1,2}',
        to_char(
          to_date(
            substring(e.next_milestone from '(\d{1,2}/\d{1,2})')
              || '/' || extract(year from e.event_date)::int,
            'DD/MM/YYYY'
          ) + 100,
          'DD/MM'
        )
      )
      else e.next_milestone
    end,
    updated_at = now()
  where e.tenant_id = '00000000-0000-4000-8000-000000000001'
    and e.id::text like '20000000-%'
    and e.event_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
  returning e.id
)
update public.erp_project_action_items a
set due_date = a.due_date + 100,
    updated_at = now()
where a.event_id in (select id from su_kien)
  and a.code like 'EV-%';

update public.erp_sop_opening_items
set title = 'Ba lớp phòng vệ và đường thoát'
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and title = 'Tam Phòng và đường thoát';

update public.erp_sop_opening_items
set source_reference = replace(
  replace(
    replace(source_reference, 'Playbook Tam Chuc.pdf · PDF ', 'Sổ tay vận hành Tam Chúc · '),
    'pp.', 'trang '
  ),
  'p.', 'trang '
)
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and source_reference like 'Playbook Tam Chuc.pdf%';

commit;
