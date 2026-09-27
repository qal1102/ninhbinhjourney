-- Phễu khách (QR → mở trang → giữ chỗ → trả tiền → qua cổng): đếm ngay trong kho.
--
-- Trước đây `lib/customer-data/funnel-repository.ts` đọc thô 13 bảng rồi đếm
-- bằng TypeScript. PostgREST chỉ trả tối đa 1.000 dòng mỗi lượt, mà lịch sử
-- mẫu (092) đã có khoảng 860 lượt qua cổng mỗi ngày: bảy ngày đã bị cắt ở
-- 1.000, bảng nối vé với đơn cũng vậy, và màn hình không hề báo. Hàm này đếm
-- trong kho nên con số đúng ở mọi độ dài khoảng thời gian, kể cả khi giám
-- đốc chọn cả một dịp lễ của năm trước để so.
--
-- Luật quy nguồn giữ nguyên như bản TypeScript:
-- * lượt quét QR thuộc đúng mã QR được quét;
-- * lượt mở trang thuộc mã QR ghi trong `source_context` của chính lượt đó;
-- * giữ chỗ, trả tiền, qua cổng thuộc nguồn của hành trình gần nhất của hồ sơ
--   khách (trong 90 ngày trước khoảng, tới hết khoảng);
-- * không quy được thì để 'unattributed', không chia đoán vào chiến dịch nào.
--
-- Bước "qua cổng" chỉ đếm vé thuộc đơn đặt trên web. Vé mua tại quầy không
-- đi qua phễu này; gộp vào thì một ngày lịch sử mẫu có vài trăm lượt quầy
-- đè lên vài chục đơn web, phễu ra "5.635%" và dòng "khách chưa rõ nguồn"
-- phình ra vô nghĩa. Lượt quầy vẫn được đếm riêng ở 'cong_quay' để màn hình
-- nói ra, không giấu đi.

begin;

create or replace function public.erp_phieu_khach(
  p_tenant_id uuid,
  p_tu timestamptz,
  p_den timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with
  nguon_ho_so as (
    select distinct on (journey.profile_id)
      journey.profile_id,
      coalesce(
        case when jsonb_typeof(journey.source_context -> 'qr_source_id') = 'string'
          then nullif(journey.source_context ->> 'qr_source_id', '') end,
        'unattributed'
      ) as nguon
    from public.customer_journeys journey
    where journey.tenant_id = p_tenant_id
      and journey.created_at >= p_tu - interval '90 days'
      and journey.created_at < p_den
    order by journey.profile_id, journey.created_at desc
  ),
  quet as (
    select scan.qr_source_id::text as nguon, count(*) as so
    from public.marketing_qr_scans scan
    where scan.tenant_id = p_tenant_id
      and scan.occurred_at >= p_tu and scan.occurred_at < p_den
    group by 1
  ),
  xem as (
    select coalesce(
        case when jsonb_typeof(event.source_context -> 'qr_source_id') = 'string'
          then nullif(event.source_context ->> 'qr_source_id', '') end,
        'unattributed'
      ) as nguon,
      count(*) as so
    from public.customer_events event
    where event.tenant_id = p_tenant_id
      and event.event_name = 'page_viewed'
      and event.occurred_at >= p_tu and event.occurred_at < p_den
    group by 1
  ),
  giu as (
    select hold.id, hold.profile_id, hold.id::text like 'de000000%' as mau
    from public.customer_booking_holds hold
    where hold.tenant_id = p_tenant_id
      and hold.created_at >= p_tu and hold.created_at < p_den
  ),
  giu_nguon as (
    select coalesce(ho_so.nguon, 'unattributed') as nguon, count(*) as so
    from giu
    left join nguon_ho_so ho_so on ho_so.profile_id = giu.profile_id
    group by 1
  ),
  tra as (
    select coalesce(ho_so.nguon, 'unattributed') as nguon, count(*) as so
    from public.customer_payment_attempts payment
    left join public.customer_booking_holds hold
      on hold.id = payment.hold_id and hold.tenant_id = payment.tenant_id
    left join nguon_ho_so ho_so on ho_so.profile_id = hold.profile_id
    where payment.tenant_id = p_tenant_id
      and payment.status = 'succeeded'
      and payment.occurred_at >= p_tu and payment.occurred_at < p_den
    group by 1
  ),
  -- Một vé web chỉ nằm trong một đơn; `distinct on` giữ cho phép nối không
  -- nhân đôi lượt qua cổng nếu dữ liệu cũ lỡ có hai dòng.
  ve_don as (
    select distinct on (bridge.ticket_id) bridge.ticket_id, bridge.slot_id, orders.profile_id
    from public.customer_order_tickets bridge
    left join public.customer_orders orders
      on orders.id = bridge.order_id and orders.tenant_id = bridge.tenant_id
    where bridge.tenant_id = p_tenant_id
    order by bridge.ticket_id
  ),
  cong as (
    select ve_don.slot_id, ve_don.profile_id, ve_don.ticket_id is not null as tu_web,
      scan.id::text like 'de000000%' as mau
    from public.erp_gate_scan_events scan
    left join ve_don on ve_don.ticket_id = scan.ticket_id
    where scan.tenant_id = p_tenant_id
      and scan.result = 'accepted'
      and scan.scanned_at >= p_tu and scan.scanned_at < p_den
  ),
  cong_nguon as (
    select coalesce(ho_so.nguon, 'unattributed') as nguon, count(*) as so
    from cong
    left join nguon_ho_so ho_so on ho_so.profile_id = cong.profile_id
    where cong.tu_web
    group by 1
  ),
  theo_nguon as (
    select tung.nguon,
      sum(tung.qr)::bigint as qr, sum(tung.xem)::bigint as xem, sum(tung.giu)::bigint as giu,
      sum(tung.tra)::bigint as tra, sum(tung.cong)::bigint as cong
    from (
      select nguon, so as qr, 0 as xem, 0 as giu, 0 as tra, 0 as cong from quet
      union all select nguon, 0, so, 0, 0, 0 from xem
      union all select nguon, 0, 0, so, 0, 0 from giu_nguon
      union all select nguon, 0, 0, 0, so, 0 from tra
      union all select nguon, 0, 0, 0, 0, so from cong_nguon
    ) tung
    group by tung.nguon
  ),
  khung as (
    select slot.id, slot.site_id, slot.starts_at, slot.capacity_snapshot,
      slot.capacity_source_kind, slot.threshold_version
    from public.customer_booking_slots slot
    where slot.tenant_id = p_tenant_id
      and slot.starts_at >= p_tu and slot.starts_at < p_den
  ),
  -- Màn hình chỉ vẽ mười hai khung gần nhất; tổng số khung đi riêng.
  khung_gan as (
    select * from khung order by khung.starts_at desc limit 12
  )
  select jsonb_build_object(
    'tong', jsonb_build_object(
      'qr', coalesce((select sum(qr) from theo_nguon), 0),
      'xem', coalesce((select sum(xem) from theo_nguon), 0),
      'giu', coalesce((select sum(giu) from theo_nguon), 0),
      'tra', coalesce((select sum(tra) from theo_nguon), 0),
      'cong', coalesce((select sum(cong) from theo_nguon), 0)
    ),
    'nguon', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nguon', theo_nguon.nguon, 'qr', theo_nguon.qr, 'xem', theo_nguon.xem,
        'giu', theo_nguon.giu, 'tra', theo_nguon.tra, 'cong', theo_nguon.cong
      ))
      from theo_nguon
    ), '[]'::jsonb),
    'cong_quay', (select count(*) from cong where not cong.tu_web),
    'so_khung', (select count(*) from khung),
    'khung', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', khung_gan.id,
        'site_id', khung_gan.site_id,
        'starts_at', khung_gan.starts_at,
        'capacity_snapshot', khung_gan.capacity_snapshot,
        'capacity_source_kind', khung_gan.capacity_source_kind,
        'threshold_version', khung_gan.threshold_version,
        -- Giữ và bán tính theo mọi lượt giữ của khung, không chỉ lượt tạo
        -- trong khoảng: khách đặt từ tuần trước vẫn chiếm chỗ của khung này.
        'dang_giu', coalesce((
          select sum(hold_slot.quantity)
          from public.customer_booking_hold_slots hold_slot
          join public.customer_booking_holds hold
            on hold.id = hold_slot.hold_id and hold.tenant_id = hold_slot.tenant_id
          where hold_slot.tenant_id = p_tenant_id and hold_slot.slot_id = khung_gan.id
            and hold.status in ('active', 'converted')
        ), 0),
        'da_ban', coalesce((
          select sum(hold_slot.quantity)
          from public.customer_booking_hold_slots hold_slot
          join public.customer_booking_holds hold
            on hold.id = hold_slot.hold_id and hold.tenant_id = hold_slot.tenant_id
          where hold_slot.tenant_id = p_tenant_id and hold_slot.slot_id = khung_gan.id
            and hold.status = 'converted'
        ), 0),
        'da_toi', (select count(*) from cong where cong.slot_id = khung_gan.id)
      ) order by khung_gan.starts_at)
      from khung_gan
    ), '[]'::jsonb),
    'ho_so_co_giu', (select count(distinct giu.profile_id) from giu),
    'ho_so_ro_nguon', (
      select count(distinct giu.profile_id)
      from giu
      join nguon_ho_so ho_so on ho_so.profile_id = giu.profile_id
      where ho_so.nguon <> 'unattributed'
    ),
    'ngoai_tuyen', (
      select count(*)
      from public.erp_gate_offline_sync_items item
      where item.tenant_id = p_tenant_id
        and item.client_scanned_at >= p_tu and item.client_scanned_at < p_den
    ),
    'ngoai_tuyen_lech', (
      select count(*)
      from public.erp_gate_offline_sync_items item
      where item.tenant_id = p_tenant_id
        and item.reconciliation_status = 'diverged'
        and item.client_scanned_at >= p_tu and item.client_scanned_at < p_den
    ),
    -- Lịch sử mẫu (092) mang mã bắt đầu `de000000`; màn hình phải nói ra.
    'co_mau', exists (select 1 from giu where giu.mau) or exists (select 1 from cong where cong.mau)
  );
$ham$;

revoke all on function public.erp_phieu_khach(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.erp_phieu_khach(uuid, timestamptz, timestamptz) to service_role;

commit;
