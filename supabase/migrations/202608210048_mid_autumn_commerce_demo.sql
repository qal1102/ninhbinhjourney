-- MID-AUTUMN-COMMERCE-01: one customer-visible seasonal service that can
-- exercise the existing CUS-06 order/hold/simulated-payment/T8 path.
-- Gift boxes remain editorial offers because a physical fulfilment contract
-- must not be represented as a gate ticket.

begin;

insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates, active
) values (
  '40000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Bàn Trăng bên Ngô Đồng',
  'ban-trang-tam-coc-2026',
  'experience',
  'service-commerce',
  1240000,
  150,
  '[{"siteSlug":"tam-coc-bich-dong","quantity":1,"season":"mid-autumn-2026","priceUnit":"guest","fixedPartySize":2}]'::jsonb,
  true
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  product_type = excluded.product_type,
  ledger_type = excluded.ledger_type,
  demo_price_vnd = excluded.demo_price_vnd,
  duration_minutes = excluded.duration_minutes,
  entitlement_templates = excluded.entitlement_templates,
  active = true;

insert into public.product_sites (product_id, site_id, stop_order)
values (
  '40000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000005',
  1
)
on conflict (product_id, site_id) do update set stop_order = excluded.stop_order;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, local_start_time, duration_minutes,
  source_kind, source_note, active
) values (
  '00000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000005',
  '19:00',
  150,
  'catalog-staged',
  'Bản trình diễn Trung thu 2026: 19:00–21:30 tại Tam Cốc; giá 1.240.000 VND/khách, cố định hai khách, chưa thu tiền thật.',
  true
)
on conflict (tenant_id, product_id, site_id) do update set
  local_start_time = excluded.local_start_time,
  duration_minutes = excluded.duration_minutes,
  source_note = excluded.source_note,
  active = true,
  updated_at = now();

commit;
