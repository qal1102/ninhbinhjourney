-- QA-ERP-TICKET-05 · 14/09/2026
--
-- Màn hình Vé từng cơ sở: đếm trong kho, và có tiền bán tại quầy.
--
-- ## Hai chỗ hỏng cũ
--
-- 1. Màn hình kéo tối đa 2.000 tấm vé về rồi cộng trong JavaScript. Chạm trần
--    là số thấp hơn thực tế (màn hình có báo đỏ, nhưng báo đỏ không phải sửa).
-- 2. "Hệ thống chưa lưu giá bán trên từng vé" — nên màn Vé không có một đồng
--    nào, còn màn Tài chính lấy tiền từ ca chốt: hai nguồn không đối chiếu được.
--
-- ## Giá lấy từ đâu, và chỗ nào nói thẳng là chưa có
--
-- - Vé bán tại quầy (QA-ERP-POS-04): mỗi dòng phiếu đã chép **đơn giá và thành
--   tiền lúc bán** vào `erp_counter_sale_lines`, trỏ đúng tấm vé. Phiếu đã huỷ
--   thì tiền là 0 (đã hoàn). Đây là tiền có thật, cộng được.
-- - Vé web theo gói: giá gói gồm nhiều điểm trong một ngày, **không chia được**
--   cho từng cơ sở mà không bịa một tỷ lệ. Không cộng; đếm riêng là "chưa có giá".
-- - Vé khác (gieo mẫu, đoàn cũ): không có giá. Đếm riêng là "chưa có giá".
--
-- Không thêm cột giá vào `erp_tickets` và không điền giá cho vé cũ — đúng yêu
-- cầu của hàng QA-ERP-TICKET-05: không bịa giá cho vé đã phát.
--
-- Chỉ tạo một hàm đọc; không đụng bảng hay dữ liệu nào.

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
  with ve as (
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
      case when sale.status = 'completed' then line.line_total_vnd else 0 end as tien_quay_vnd
    from public.erp_tickets ticket
    left join public.erp_counter_sale_lines line
      on line.ticket_id = ticket.id and line.tenant_id = ticket.tenant_id
    left join public.erp_counter_sales sale
      on sale.id = line.sale_id and sale.tenant_id = line.tenant_id
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = p_site_id
      and ticket.issued_at >= now() - interval '730 days'
  ),
  cua_so as (
    select * from (values ('day', 1, 1), ('week', 7, 2), ('month', 30, 3), ('year', 365, 4)) as w(period, days, thu_tu)
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
          'unpriced_ticket_count', dem.unpriced_ticket_count
        )
        order by cua_so.thu_tu
      )
      from cua_so
      cross join lateral (
        select
          count(*) filter (where ve.hieu_luc and ve.issued_at > now() - make_interval(days => cua_so.days)) as ticket_count,
          coalesce(sum(ve.entries) filter (where ve.hieu_luc and ve.issued_at > now() - make_interval(days => cua_so.days)), 0) as entry_count,
          coalesce(sum(ve.entries) filter (
            where ve.hieu_luc and ve.issued_at <= now() - make_interval(days => cua_so.days)
              and ve.issued_at > now() - make_interval(days => cua_so.days * 2)
          ), 0) as previous_entry_count,
          coalesce(sum(ve.tien_quay_vnd) filter (where ve.hieu_luc and ve.issued_at > now() - make_interval(days => cua_so.days)), 0) as counter_revenue_vnd,
          count(*) filter (where ve.hieu_luc and ve.la_ve_quay and ve.issued_at > now() - make_interval(days => cua_so.days)) as counter_ticket_count,
          count(*) filter (where ve.hieu_luc and not ve.la_ve_quay and ve.issued_at > now() - make_interval(days => cua_so.days)) as unpriced_ticket_count
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
          'price_vnd', case when gan.la_ve_quay then gan.tien_quay_vnd end
        )
        order by gan.issued_at desc
      )
      from (select * from ve order by ve.issued_at desc limit 8) gan
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.erp_ticket_sales_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_ticket_sales_summary(uuid, uuid) to service_role;

commit;
