-- Soát ERP production 13/10/2026 (chủ dự án: "ERP production chạy có đúng
-- không, nhìn cứ bị sao sao"). Hai chỗ sai thật:
--
-- 1. Màn Vé từng cơ sở ghi "Hôm nay" nhưng tính 24 giờ trượt
--    (`issued_at > now() - 1 ngày`), nên chiều nào cũng cộng cả phiếu chiều
--    hôm qua: Tràng An 13/10 lúc 17:30 ghi quầy 53.720.000 đ, web 20.262.259 đ,
--    trong khi trang đầu, Toàn vùng và danh sách phiếu ngay trên cùng màn ghi
--    52.720.000 đ và 11.584.194 đ. Nay "Ngày" là hôm nay theo giờ Việt Nam,
--    "Tuần" là 7 ngày lịch gồm hôm nay, tương tự 30 và 365 ngày; kỳ liền trước
--    là chừng ấy ngày ngay trước đó, tính tới cùng giờ (trước đây so nửa ngày
--    nay với cả ngày hôm qua nên trưa nào cũng báo giảm). Hàm chép nguyên văn
--    bản 103, chỉ đổi khung.
--
-- 2. Sự cố mẫu: mỗi giờ hai hồ sơ mẫu mỗi cơ sở bị dời về 09:02 và 09:16 sáng
--    nay mà vẫn "Mới báo", nên tới chiều một ca "Khách cần hỗ trợ y tế tại cổng
--    chính" ghi "Quá hạn 8 giờ" như thể không ai đoái hoài; dòng thời gian còn
--    có mục "01:59 tự chuyển cấp, trễ 78 phút" đứng trước giờ báo. Trang đầu
--    (bỏ hồ sơ mẫu) ghi 0 sự cố chuyển lên, Toàn vùng (đếm cả mẫu) ghi 8 quá
--    hạn. Nay hai hồ sơ ấy là ca đã xử lý xong trong hạn, dòng thời gian khớp
--    giờ, vẫn làm mới ngày theo hôm nay. Muốn trình diễn chuyển cấp thì bấm SOS
--    (mở sự cố P1 thật) hay để một sự cố thật quá hạn.

begin;

create or replace function public.erp_ticket_sales_summary(
  p_tenant_id uuid,
  p_site_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with web as (
    select chia.ticket_id, chia.tien_vnd
    from public.erp_tien_web_theo_ve(p_tenant_id) chia
    where chia.site_id = p_site_id
  ),
  ve as (
    select
      ticket.id,
      ticket.ticket_code,
      ticket.product,
      ticket.channel,
      ticket.guest_name,
      ticket.status,
      ticket.issued_at,
      greatest(coalesce(ticket.entries_allowed, 1), 1) as entries,
      -- Vé đã huỷ không cho ai vào: không đếm vào lượt khách hay số tấm vé.
      ticket.status <> 'void' as hieu_luc,
      line.id is not null as la_ve_quay,
      case when sale.status = 'completed' then line.line_total_vnd else 0 end as tien_quay_vnd,
      web.ticket_id is not null as la_ve_web,
      coalesce(web.tien_vnd, 0) as tien_web_vnd
    from public.erp_tickets ticket
    left join public.erp_counter_sale_lines line
      on line.ticket_id = ticket.id and line.tenant_id = ticket.tenant_id
    left join public.erp_counter_sales sale
      on sale.id = line.sale_id and sale.tenant_id = line.tenant_id
    left join web on web.ticket_id = ticket.id
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = p_site_id
      and ticket.issued_at >= now() - interval '730 days'
  ),
  dau_ngay as (
    select (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh') as moc
  ),
  cua_so as (
    select w.period, w.days, w.thu_tu,
      dau_ngay.moc - make_interval(days => w.days - 1) as tu,
      dau_ngay.moc - make_interval(days => 2 * w.days - 1) as tu_truoc
    from (values ('day', 1, 1), ('week', 7, 2), ('month', 30, 3), ('year', 365, 4)) as w(period, days, thu_tu)
    cross join dau_ngay
  )
  select jsonb_build_object(
    'periods', (
      select jsonb_agg(
        jsonb_build_object(
          'period', cua_so.period,
          'ticket_count', dem.ticket_count,
          'entry_count', dem.entry_count,
          'previous_entry_count', dem.previous_entry_count,
          'counter_revenue_vnd', dem.counter_revenue_vnd,
          'counter_ticket_count', dem.counter_ticket_count,
          'web_revenue_vnd', dem.web_revenue_vnd,
          'web_ticket_count', dem.web_ticket_count,
          'unpriced_ticket_count', dem.unpriced_ticket_count
        )
        order by cua_so.thu_tu
      )
      from cua_so
      cross join lateral (
        select
          count(*) filter (where ve.hieu_luc and ve.issued_at >= cua_so.tu) as ticket_count,
          coalesce(sum(ve.entries) filter (where ve.hieu_luc and ve.issued_at >= cua_so.tu), 0) as entry_count,
          coalesce(sum(ve.entries) filter (
            where ve.hieu_luc and ve.issued_at >= cua_so.tu_truoc
              and ve.issued_at < cua_so.tu_truoc + (now() - cua_so.tu)
          ), 0) as previous_entry_count,
          coalesce(sum(ve.tien_quay_vnd) filter (where ve.hieu_luc and ve.issued_at >= cua_so.tu), 0) as counter_revenue_vnd,
          count(*) filter (where ve.hieu_luc and ve.la_ve_quay and ve.issued_at >= cua_so.tu) as counter_ticket_count,
          coalesce(sum(ve.tien_web_vnd) filter (where ve.hieu_luc and ve.issued_at >= cua_so.tu), 0) as web_revenue_vnd,
          count(*) filter (where ve.hieu_luc and ve.la_ve_web and ve.issued_at >= cua_so.tu) as web_ticket_count,
          count(*) filter (where ve.hieu_luc and not ve.la_ve_quay and not ve.la_ve_web and ve.issued_at >= cua_so.tu) as unpriced_ticket_count
        from ve
      ) dem
    ),
    'product_shares', coalesce((
      select jsonb_agg(
        jsonb_build_object('product', theo.product, 'ticket_count', theo.ticket_count, 'entry_count', theo.entry_count)
        order by theo.entry_count desc, theo.product
      )
      from (
        select ve.product, count(*) as ticket_count, sum(ve.entries) as entry_count
        from ve
        where ve.hieu_luc and ve.issued_at > now() - interval '30 days'
        group by ve.product
      ) theo
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ticket_code', gan.ticket_code,
          'product', gan.product,
          'channel', gan.channel,
          'guest_name', gan.guest_name,
          'status', gan.status,
          'issued_at', gan.issued_at,
          'price_vnd', case when gan.la_ve_quay then gan.tien_quay_vnd when gan.la_ve_web then gan.tien_web_vnd end
        )
        order by gan.issued_at desc
      )
      from (select * from ve order by ve.issued_at desc limit 8) gan
    ), '[]'::jsonb)
  );
$$;

update public.erp_incidents i
set status = 'closed',
    sop_completed_steps = i.sop_total_steps,
    next_action = 'Không còn việc cần xử lý',
    escalated = (i.id ~ '-071$'),
    escalation_reason = case when i.id ~ '-071$' then 'Ca y tế mức P2: báo quản lý cơ sở và giám đốc ngay khi ghi nhận.' else null end,
    version = i.version + 1,
    timeline = case
      when i.id ~ '-069$' then jsonb_build_array(
        jsonb_build_object('id', 'TL-069-04', 'at', '09:11', 'actor', 'Quản lý ' || c.ten, 'action', 'Xác minh và đóng', 'note', 'Hàng chờ còn 4 phút, đóng làn phụ. Xử lý xong trong hạn 10 phút.'),
        jsonb_build_object('id', 'TL-069-03', 'at', '09:06', 'actor', 'Đỗ Thị Lan', 'action', 'Cập nhật xử lý', 'note', 'Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút.'),
        jsonb_build_object('id', 'TL-069-02', 'at', '09:04', 'actor', 'Quản lý ' || c.ten, 'action', 'Giao xử lý', 'note', 'Giao Đỗ Thị Lan phụ trách tại hiện trường.'),
        jsonb_build_object('id', 'TL-069-01', 'at', '09:02', 'actor', 'Đỗ Thị Lan', 'action', 'Báo sự cố', 'note', 'Mật độ hàng chờ vượt ngưỡng vận hành.')
      )
      else jsonb_build_array(
        jsonb_build_object('id', 'TL-071-05', 'at', '09:25', 'actor', 'Quản lý ' || c.ten, 'action', 'Xác minh và đóng', 'note', 'Khách tỉnh táo, người nhà đón về; biên bản y tế đã lưu.'),
        jsonb_build_object('id', 'TL-071-04', 'at', '09:21', 'actor', 'Tổ y tế', 'action', 'Cập nhật xử lý', 'note', 'Đo huyết áp, cho nghỉ ở phòng y tế; không cần chuyển viện.'),
        jsonb_build_object('id', 'TL-071-03', 'at', '09:18', 'actor', 'Hệ thống', 'action', 'Chuyển cấp P2', 'note', 'Đã báo quản lý cơ sở và giám đốc vì là ca y tế.'),
        jsonb_build_object('id', 'TL-071-02', 'at', '09:17', 'actor', 'Tổ y tế', 'action', 'Tiếp nhận', 'note', 'Tổ y tế có mặt tại cổng chính trong 1 phút, trong hạn 5 phút.'),
        jsonb_build_object('id', 'TL-071-01', 'at', '09:16', 'actor', 'Đỗ Thị Lan', 'action', 'Báo sự cố', 'note', 'Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế.')
      )
    end
from (values ('TA', 'Tràng An'), ('BD', 'Bái Đính'), ('TC', 'Tam Chúc'), ('TCO', 'Tam Cốc')) as c(ma, ten)
where i.tenant_id = '00000000-0000-4000-8000-000000000001'
  and i.id in ('INC-' || c.ma || '-069', 'INC-' || c.ma || '-071')
  and (i.data_origin = 'demo-seed' or i.version = 1)
  and i.status <> 'closed';

-- Làm mới mỗi giờ: hồ sơ mẫu (kể cả đã đóng) mang ngày hôm nay, giờ báo cũ.
create or replace function public.erp_su_co_mau_lam_moi()
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_so integer;
begin
  with moc as (
    select i.id,
           ((v_hom_nay::timestamp + i.reported_at::time) at time zone 'Asia/Ho_Chi_Minh') as luc
    from public.erp_incidents i
    where i.tenant_id = v_tenant
      and i.id ~ '^INC-[A-Z]+-0(69|71)$'
      and (i.data_origin = 'demo-seed' or i.version <= 2)
      and i.reported_at ~ '^\d{2}:\d{2}$'
  ), dich as (
    select id, case when luc > now() then luc - interval '1 day' else luc end as luc
    from moc
  )
  update public.erp_incidents i
  set reported_at_ts = dich.luc,
      updated_at = dich.luc + interval '9 minutes'
  from dich
  where i.id = dich.id
    and i.reported_at_ts < dich.luc - interval '1 minute';
  get diagnostics v_so = row_count;
  return v_so;
end;
$ham$;

revoke all on function public.erp_su_co_mau_lam_moi() from public, anon, authenticated;

commit;
