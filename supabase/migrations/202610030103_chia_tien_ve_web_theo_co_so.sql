-- QA-ERP-TICKET-05 phần cuối: chia tiền đơn web về từng cơ sở.
--
-- Chủ dự án giao em tự chốt luật (03/10/2026). Trước đây một đơn web theo gói
-- nhiều điểm (Tràng An + Bái Đính…) chỉ có tiền ở cấp đơn, nên:
-- - màn Vé từng cơ sở chỉ có tiền quầy, vé web ghi "chưa có giá trên vé";
-- - màn Báo cáo từng cơ sở chỉ cộng tiền quầy;
-- - trang đầu (`erp_doanh_thu_ky`) cộng tiền web của CẢ VÙNG dù được hỏi cho
--   một tập cơ sở: người chỉ xem một cơ sở sẽ thấy tiền web của bốn.
--
-- LUẬT: mỗi đơn web đã xác nhận chia về từng tấm vé của nó theo trọng số
--   số lượt vào của vé × giá vé quầy NGƯỜI LỚN của cơ sở ấy, hiệu lực tại ngày đi.
-- Lý do: giá quầy là thước đo duy nhất có sẵn trong kho, ai cũng tra được ở màn
-- Vé, và phản ánh đúng giá trị khách bỏ ra nếu mua lẻ từng chặng. Ngày đi trước
-- mốc giá đầu tiên thì dùng mốc sớm nhất; cơ sở không có giá nào thì trọng số
-- coi như 1 đồng mỗi lượt (không bịa giá). Phần lẻ do làm tròn
-- dồn vào tấm vé nặng nhất của đơn, nên tổng các phần luôn đúng bằng tiền đơn.
-- Tính lúc đọc, không ghi gì: đổi bảng giá quầy là cách chia đổi theo, cho đơn
-- có ngày đi từ ngày giá mới hiệu lực.

begin;

create or replace function public.erp_tien_web_theo_ve(p_tenant_id uuid)
returns table (
  order_id uuid,
  ticket_id uuid,
  site_id uuid,
  valid_on date,
  issued_at timestamptz,
  order_created_at timestamptz,
  tien_vnd bigint
)
language sql
stable
security definer
set search_path = ''
as $ham$
  with ve as (
    select
      bridge.order_id,
      ticket.id as ticket_id,
      ticket.site_id,
      ticket.valid_on,
      ticket.issued_at,
      orders.created_at as order_created_at,
      orders.total_vnd::bigint as tong_don,
      (greatest(coalesce(ticket.entries_allowed, 1), 1) * greatest(coalesce((
        select price.unit_price_vnd
        from public.erp_counter_price_list price
        where price.tenant_id = ticket.tenant_id
          and price.site_id = ticket.site_id
          and price.product = 'adult'
        -- Giá hiệu lực tại ngày đi; ngày đi trước mốc giá đầu tiên thì lấy mốc
        -- sớm nhất (bảng giá quầy mới có từ 13/09, đơn trước đó vẫn chia được).
        order by (price.effective_from <= ticket.valid_on) desc,
          case when price.effective_from <= ticket.valid_on then price.effective_from end desc nulls last,
          price.effective_from asc
        limit 1
      ), 0), 1))::numeric as trong_so
    from public.customer_order_tickets bridge
    join public.customer_orders orders
      on orders.id = bridge.order_id and orders.tenant_id = bridge.tenant_id
    join public.erp_tickets ticket
      on ticket.id = bridge.ticket_id and ticket.tenant_id = bridge.tenant_id
    where bridge.tenant_id = p_tenant_id
      and orders.status = 'confirmed'
      and ticket.status <> 'void'
  ),
  chia as (
    select ve.*,
      pg_catalog.round(ve.tong_don * ve.trong_so / sum(ve.trong_so) over (partition by ve.order_id))::bigint as phan,
      row_number() over (partition by ve.order_id order by ve.trong_so desc, ve.ticket_id) as hang
    from ve
  )
  select chia.order_id, chia.ticket_id, chia.site_id, chia.valid_on, chia.issued_at, chia.order_created_at,
    chia.phan + case
      when chia.hang = 1 then chia.tong_don - sum(chia.phan) over (partition by chia.order_id)
      else 0
    end
  from chia;
$ham$;

revoke all on function public.erp_tien_web_theo_ve(uuid) from public, anon, authenticated;
grant execute on function public.erp_tien_web_theo_ve(uuid) to service_role;

-- Trang đầu: tiền web nay lọc đúng theo tập cơ sở được hỏi. Một đơn có vé ở
-- hai cơ sở được tính vào số đơn của cả hai (đơn ấy có mặt ở cả hai nơi), còn
-- tiền thì chỉ phần đã chia.
create or replace function public.erp_doanh_thu_ky(
  p_tenant_id uuid,
  p_site_ids uuid[],
  p_tu timestamptz,
  p_den timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with web as (
    select chia.order_id, chia.tien_vnd
    from public.erp_tien_web_theo_ve(p_tenant_id) chia
    where chia.site_id = any(p_site_ids)
      and chia.order_created_at >= p_tu and chia.order_created_at < p_den
  )
  select jsonb_build_object(
    'counter_sales', (
      select count(*) from public.erp_counter_sales sale
      where sale.tenant_id = p_tenant_id and sale.status = 'completed'
        and sale.site_id = any(p_site_ids)
        and sale.sold_at >= p_tu and sale.sold_at < p_den
    ),
    'counter_vnd', (
      select coalesce(sum(sale.total_vnd), 0) from public.erp_counter_sales sale
      where sale.tenant_id = p_tenant_id and sale.status = 'completed'
        and sale.site_id = any(p_site_ids)
        and sale.sold_at >= p_tu and sale.sold_at < p_den
    ),
    'web_orders', (select count(distinct web.order_id) from web),
    'web_vnd', (select coalesce(sum(web.tien_vnd), 0) from web)
  );
$ham$;

-- Màn Vé từng cơ sở: thêm tiền vé web đã chia. Phần còn lại giữ nguyên bản 074.
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
          'web_revenue_vnd', dem.web_revenue_vnd,
          'web_ticket_count', dem.web_ticket_count,
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
          coalesce(sum(ve.tien_web_vnd) filter (where ve.hieu_luc and ve.issued_at > now() - make_interval(days => cua_so.days)), 0) as web_revenue_vnd,
          count(*) filter (where ve.hieu_luc and ve.la_ve_web and ve.issued_at > now() - make_interval(days => cua_so.days)) as web_ticket_count,
          count(*) filter (where ve.hieu_luc and not ve.la_ve_quay and not ve.la_ve_web and ve.issued_at > now() - make_interval(days => cua_so.days)) as unpriced_ticket_count
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

-- Màn Báo cáo từng cơ sở: thêm tiền web đã chia theo ngày đặt (cùng mốc với
-- tiền quầy là ngày bán). Phần còn lại giữ nguyên bản 093.
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
  ),
  web as (
    select (chia.order_created_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay, sum(chia.tien_vnd) as tien
    from public.erp_tien_web_theo_ve(p_tenant_id) chia
    where chia.site_id = p_site_id
      and chia.order_created_at >= (p_tu::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and chia.order_created_at < (p_den::timestamp at time zone 'Asia/Ho_Chi_Minh')
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
        'phieu_quay', coalesce(quay.phieu, 0),
        'tien_web', coalesce(web.tien, 0)
      ) order by ngay.ngay)
      from ngay
      left join ve on ve.ngay = ngay.ngay
      left join quay on quay.ngay = ngay.ngay
      left join web on web.ngay = ngay.ngay
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

commit;
