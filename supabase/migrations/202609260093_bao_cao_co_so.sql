-- Báo cáo & dự báo cho từng cơ sở: một hàm đọc, cộng ngay trong kho.
--
-- Module "Báo cáo & dự báo" nằm ở "Giai đoạn sau" từ tháng 7 vì chưa đủ dữ
-- liệu để so kỳ. Nay kho có vé, phiếu quầy, lượt qua cổng và đơn web theo
-- ngày, nên dựng thật. Hàm chỉ đọc, trả về chuỗi số theo ngày giờ Việt Nam;
-- phần suy luận (tuần, thứ, dự báo) nằm ở `domain/bao-cao-co-so.ts` để kiểm
-- được bằng bài kiểm đơn vị.

begin;

create or replace function public.erp_bao_cao_co_so(
  p_tenant_id uuid,
  p_site_id uuid,
  p_tu date,
  p_den date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with ngay as (
    select generate_series(p_tu, p_den - 1, interval '1 day')::date as ngay
  ),
  vao as (
    select (scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay,
      extract(hour from scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::integer as gio,
      count(*) as khach
    from public.erp_gate_scan_events scan
    where scan.tenant_id = p_tenant_id and scan.site_id = p_site_id
      and scan.result = 'accepted'
      and scan.scanned_at >= (p_tu::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and scan.scanned_at < (p_den::timestamp at time zone 'Asia/Ho_Chi_Minh')
    group by 1, 2
  ),
  ve as (
    select ticket.valid_on as ngay,
      sum(ticket.entries_allowed) filter (where ticket.channel = 'website') as khach_web,
      sum(ticket.entries_used) filter (where ticket.channel = 'website') as khach_web_da_vao,
      sum(ticket.entries_allowed) as khach_co_ve
    from public.erp_tickets ticket
    where ticket.tenant_id = p_tenant_id and ticket.site_id = p_site_id
      and ticket.status <> 'void'
      and ticket.valid_on >= p_tu and ticket.valid_on < p_den + 7
    group by 1
  ),
  quay as (
    select sale.business_date as ngay, sum(sale.total_vnd) as tien, count(*) as phieu
    from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.site_id = p_site_id
      and sale.status = 'completed'
      and sale.business_date >= p_tu and sale.business_date < p_den
    group by 1
  )
  select jsonb_build_object(
    'ngay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ngay', ngay.ngay,
        'khach_vao', coalesce((select sum(vao.khach) from vao where vao.ngay = ngay.ngay), 0),
        'khach_co_ve', coalesce(ve.khach_co_ve, 0),
        'khach_web', coalesce(ve.khach_web, 0),
        'khach_web_da_vao', coalesce(ve.khach_web_da_vao, 0),
        'tien_quay', coalesce(quay.tien, 0),
        'phieu_quay', coalesce(quay.phieu, 0)
      ) order by ngay.ngay)
      from ngay
      left join ve on ve.ngay = ngay.ngay
      left join quay on quay.ngay = ngay.ngay
    ), '[]'::jsonb),
    'gio', coalesce((
      select jsonb_agg(jsonb_build_object('gio', theo.gio, 'khach', theo.khach) order by theo.gio)
      from (select vao.gio, sum(vao.khach) as khach from vao group by vao.gio) theo
    ), '[]'::jsonb),
    -- Khách đã đặt trước cho bảy ngày kể từ p_den: sàn của mọi con số dự báo.
    'da_dat', coalesce((
      select jsonb_agg(jsonb_build_object('ngay', ve.ngay, 'khach', ve.khach_co_ve) order by ve.ngay)
      from ve where ve.ngay >= p_den
    ), '[]'::jsonb),
    'suc_chua_gio', (
      select threshold.effective_capacity
      from public.erp_capacity_thresholds threshold
      where threshold.tenant_id = p_tenant_id and threshold.site_id = p_site_id
      order by threshold.effective_capacity asc, threshold.effective_from desc
      limit 1
    )
  );
$ham$;

revoke all on function public.erp_bao_cao_co_so(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.erp_bao_cao_co_so(uuid, uuid, date, date) to service_role;

commit;
