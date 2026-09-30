-- Lịch sử mẫu làm mới MỖI GIỜ thay vì mỗi tháng (chủ dự án cho phép 01/10/2026).
--
-- Soát production 30/09: lịch làm mới mùng 2 hằng tháng nghĩa là tới cuối
-- tháng lịch sử mẫu đã dừng gần bốn tuần trước. Trang đầu giám đốc ghi "Hôm
-- nay 0 lượt khách", bảy ngày "−48%", biểu đồ tuần cuối tụt hẳn: người chấm
-- mở ra tưởng hệ thống hỏng.
--
-- Cửa sổ vẫn là 60 ngày: mỗi lượt xoá phần mẫu cũ hơn 60 ngày rồi sinh tiếp
-- từ giờ mẫu cuối tới bây giờ, nên lượng dữ liệu không phình. Hàm sinh dùng
-- mã cố định cho từng dòng và bỏ qua dòng đã có, nên chạy lại giờ dở dang chỉ
-- bù phần còn thiếu. Làm mới mỗi giờ (không phải mỗi đêm) để "hôm nay" trên
-- trang đầu có số theo giờ mở cửa, như một ngày làm việc thật.
--
-- Công tắc tắt hẳn vẫn là `erp_lich_su_mau_cau_hinh.bat`; gỡ sạch mẫu vẫn là
-- `select public.erp_lich_su_mau_xoa();`.

begin;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname in ('erp-lich-su-mau-hang-thang', 'erp-lich-su-mau-hang-gio')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'erp-lich-su-mau-hang-gio',
  '5 * * * *',
  $cron$select public.erp_lich_su_mau_lam_moi(60);$cron$
);

-- Bù ngay phần đã hụt từ 26/09 tới giờ.
select public.erp_lich_su_mau_lam_moi(60);

commit;
