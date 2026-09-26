-- Lịch sử mẫu: 60 ngày hoạt động ở bốn cơ sở có cổng, nạp một lần.
--
-- Chủ dự án chọn ngày 26/09/2026: trang đầu giám đốc toàn số 0 thì không trình
-- diễn được, nên nạp 60 ngày lịch sử mẫu, ghi rõ là mẫu trên mọi khối số, gỡ
-- sạch được. Việc này đảo một phần luật ERP-FAKE-03 ("con số ra quyết định
-- chỉ đếm hàng thật") một cách có chủ ý và nhìn thấy được: hàng mẫu mang
-- nguồn riêng `demo-history`, khác với `demo-seed` cũ vẫn bị loại khỏi số.
--
-- Cách làm: ghi thẳng vào đúng các bảng nghiệp vụ (vé, phiếu quầy, lượt qua
-- cổng, đơn web trả bằng QR), đúng hình dạng các hàm bán vé và xác nhận đơn
-- sinh ra, để mọi màn hình đọc cùng một nguồn. Không có bảng số liệu thứ hai.
--
-- Nhận diện để gỡ: mọi mã hàng mẫu bắt đầu bằng `de000000`; vé mang thêm
-- `data_origin = 'demo-history'`; phiếu quầy mang `request_key` bắt đầu bằng
-- `mau-`. Mã sinh từ băm của khoá (cơ sở, giờ, số thứ tự), nên chạy lại cùng
-- một giờ không nhân đôi gì.
--
-- Không sinh liên tục (chủ dự án: sinh liên tục thì toàn rác): mỗi tháng một lần
-- xoá mẫu cũ hơn 60 ngày và sinh tiếp tới hôm nay, nên kho luôn đúng 60 ngày.
-- Công tắc `erp_lich_su_mau_cau_hinh.bat = false` thì chỉ còn xoá, không sinh;
-- gỡ sạch mọi mẫu: `select public.erp_lich_su_mau_xoa();`

begin;

-- 1. Vé nhận thêm nguồn "lịch sử mẫu".
alter table public.erp_tickets drop constraint if exists erp_tickets_data_origin_check;
alter table public.erp_tickets
  add constraint erp_tickets_data_origin_check
  check (data_origin in ('real', 'demo-seed', 'demo-history'));

-- 1b. Lượt qua cổng tra theo vé: hộ chiếu khách đọc lượt vào theo mã vé, và
--     xoá một vé phải dò bảng này. Chưa có chỉ mục thì mỗi lần là đọc cả bảng.
create index if not exists erp_gate_scan_events_ticket_idx
  on public.erp_gate_scan_events (ticket_id)
  where ticket_id is not null;

-- 1c. Vé mẫu còn chờ vào cổng, theo ngày: hàm sinh tìm chúng mỗi giờ. Chỉ mục
--     một phần nên chỉ chứa vé chờ, nhỏ và không đụng vé thật.
create index if not exists erp_tickets_mau_cho_vao_idx
  on public.erp_tickets (valid_on)
  where data_origin = 'demo-history' and entries_used = 0 and status = 'issued';

-- 2. Công tắc.
create table if not exists public.erp_lich_su_mau_cau_hinh (
  id boolean primary key default true check (id),
  bat boolean not null default true,
  cap_nhat_luc timestamptz not null default now()
);
insert into public.erp_lich_su_mau_cau_hinh (id, bat) values (true, true)
on conflict (id) do nothing;
alter table public.erp_lich_su_mau_cau_hinh enable row level security;
revoke all on table public.erp_lich_su_mau_cau_hinh from public, anon, authenticated;
grant select, update on table public.erp_lich_su_mau_cau_hinh to service_role;

-- 3. Số ngẫu nhiên có thể lặp lại: cùng khoá, cùng số, trong [0, 1).
create or replace function public.erp_mau_so(p_khoa text)
returns double precision
language sql
immutable
set search_path = ''
as $ham$
  select (('x' || substr(md5(p_khoa), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
$ham$;

-- Mã hàng mẫu: luôn bắt đầu bằng de000000.
create or replace function public.erp_mau_id(p_khoa text)
returns uuid
language sql
immutable
set search_path = ''
as $ham$
  select ('de000000' || substr(md5(p_khoa), 9, 24))::uuid;
$ham$;

-- 4. Sinh hoạt động của một giờ, chỉ những việc đã xảy ra trước p_den.
create or replace function public.erp_lich_su_mau_sinh_gio(
  p_gio timestamptz,
  p_den timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_gio timestamptz := date_trunc('hour', p_gio);
  v_gio_dia_phuong timestamp := v_gio at time zone 'Asia/Ho_Chi_Minh';
  v_ngay date := (v_gio at time zone 'Asia/Ho_Chi_Minh')::date;
  v_h integer := extract(hour from v_gio at time zone 'Asia/Ho_Chi_Minh')::integer;
  v_thu integer := extract(isodow from v_gio at time zone 'Asia/Ho_Chi_Minh')::integer;
  v_so integer := 0;
  -- Khoá theo số giây epoch, không theo chữ ngày giờ: chữ đổi theo múi giờ
  -- của phiên, mà lịch chạy và migration có thể khác múi giờ.
  v_k text := extract(epoch from date_trunc('hour', p_gio))::bigint::text;
  v_kn text := to_char((p_gio at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD');
  v_he_so_ngay double precision;
  v_trong_so_gio double precision;
  v_co_so record;
  v_ky double precision;
  v_so_phieu integer;
  i integer;
  v_khoa text;
  v_luc timestamptz;
  v_nguoi_lon integer;
  v_tre integer;
  v_r double precision;
  v_gia_lon record;
  v_gia_tre record;
  v_tong bigint;
  v_phieu_id uuid;
  v_ve_lon uuid;
  v_ve_tre uuid;
  v_nguoi record;
  v_quet timestamptz;
  -- đơn web
  v_so_don integer;
  v_goi record;
  v_ngay_di date;
  v_gio_di time;
  v_ho_so uuid;
  v_don uuid;
  v_giu uuid;
  v_tra uuid;
  v_ma_don text;
  v_tra_luc timestamptz;
  v_mau record;
  v_suat uuid;
  v_nguong record;
  v_bat_dau timestamptz;
  v_ve uuid;
  v_nhom text;
  v_so_ve integer;
  v_ve_web record;
begin
  if not coalesce((select bat from public.erp_lich_su_mau_cau_hinh where id), false) then
    return 0;
  end if;
  if v_gio >= p_den then
    return 0;
  end if;

  -- Nhịp ngày: cuối tuần đông hơn, ngày lễ đông hẳn, mùa thu tăng dần.
  v_he_so_ngay := case v_thu when 6 then 1.55 when 7 then 1.6 when 5 then 1.15 else 1.0 end
    * case v_ngay
        when date '2026-09-02' then 2.2
        when date '2026-09-01' then 1.5
        when date '2026-08-31' then 1.3
        when date '2026-09-25' then 1.4
        else 1.0
      end
    * (0.85 + 0.15 * least(1.0, greatest(0.0, (v_ngay - date '2026-07-28')::double precision / 90.0)))
    * (0.85 + 0.3 * public.erp_mau_so('ngay:' || v_kn));

  -- Nhịp giờ trong ngày (7h–16h), tổng trọng số khoảng 8,3.
  v_trong_so_gio := case v_h
    when 7 then 0.4 when 8 then 1.0 when 9 then 1.3 when 10 then 1.2
    when 11 then 0.8 when 12 then 0.5 when 13 then 0.7 when 14 then 1.0
    when 15 then 0.9 when 16 then 0.5 else 0 end / 8.3;

  -- A. Bán vé tại quầy và khách qua cổng ngay sau đó.
  if v_trong_so_gio > 0 then
    for v_co_so in
      select * from (values
        ('10000000-0000-4000-8000-000000000001'::uuid, 'trang-an', 260.0, 'employee-trang-an-01'),
        ('10000000-0000-4000-8000-000000000009'::uuid, 'tam-chuc', 130.0, 'employee-tam-chuc-01'),
        ('10000000-0000-4000-8000-000000000005'::uuid, 'tam-coc', 170.0, 'employee-tam-coc-01'),
        ('10000000-0000-4000-8000-000000000003'::uuid, 'bai-dinh', 300.0, 'employee-bai-dinh-01')
      ) as co_so(id, ma, khach_ngay, nguoi_ban)
    loop
      select account_id, display_name into v_nguoi
      from public.erp_account_registry
      where account_id = v_co_so.nguoi_ban and tenant_id = v_tenant;
      continue when v_nguoi.account_id is null;

      select * into v_gia_lon from public.erp_counter_price_list
      where tenant_id = v_tenant and site_id = v_co_so.id and product = 'adult'
      order by (effective_from <= v_ngay) desc, effective_from desc limit 1;
      select * into v_gia_tre from public.erp_counter_price_list
      where tenant_id = v_tenant and site_id = v_co_so.id and product = 'child'
      order by (effective_from <= v_ngay) desc, effective_from desc limit 1;
      continue when v_gia_lon.id is null or v_gia_tre.id is null;

      v_ky := v_co_so.khach_ngay * v_he_so_ngay * v_trong_so_gio / 3.0;
      v_so_phieu := floor(v_ky + public.erp_mau_so('sl:' || v_co_so.ma || ':' || v_k))::integer;

      for i in 1..v_so_phieu loop
        v_khoa := 'quay:' || v_co_so.ma || ':' || v_k || ':' || i;
        v_luc := v_gio + make_interval(secs => floor(3599 * (i - 1 + public.erp_mau_so(v_khoa || ':phut')) / v_so_phieu));
        continue when v_luc >= p_den;

        v_r := public.erp_mau_so(v_khoa || ':lon');
        v_nguoi_lon := case when v_r < 0.25 then 1 when v_r < 0.6 then 2 when v_r < 0.8 then 3
          when v_r < 0.93 then 4 else 5 + floor(public.erp_mau_so(v_khoa || ':doan') * 4)::integer end;
        v_r := public.erp_mau_so(v_khoa || ':tre');
        v_tre := case when v_r < 0.7 then 0 when v_r < 0.9 then 1 else 2 end;
        v_tong := v_gia_lon.unit_price_vnd::bigint * v_nguoi_lon + v_gia_tre.unit_price_vnd::bigint * v_tre;
        v_phieu_id := public.erp_mau_id(v_khoa);
        v_ve_lon := public.erp_mau_id(v_khoa || ':ve-lon');
        v_ve_tre := public.erp_mau_id(v_khoa || ':ve-tre');

        insert into public.erp_counter_sales (
          id, tenant_id, site_id, sale_code, sold_by_account_id, sold_by_name,
          sold_at, business_date, adults, children, total_vnd, cash_received_vnd,
          cash_counted_confirmed, request_key, created_at
        ) values (
          v_phieu_id, v_tenant, v_co_so.id, 'PT-' || upper(substr(md5(v_khoa), 1, 12)),
          v_nguoi.account_id, v_nguoi.display_name, v_luc, v_ngay, v_nguoi_lon, v_tre,
          v_tong, ceil(v_tong / 50000.0) * 50000, true, 'mau-' || md5(v_khoa), v_luc
        ) on conflict do nothing;
        continue when not found;
        v_so := v_so + 1;

        insert into public.erp_tickets (
          id, tenant_id, site_id, ticket_code, product, channel, valid_on,
          entries_allowed, booking_reference, issued_at, created_at, updated_at, data_origin
        ) values (
          v_ve_lon, v_tenant, v_co_so.id, 'QUAY-' || upper(substr(md5(v_khoa || ':ve-lon'), 1, 12)),
          'adult', 'quay-ve', v_ngay, v_nguoi_lon, 'PT-' || upper(substr(md5(v_khoa), 1, 12)),
          v_luc, v_luc, v_luc, 'demo-history'
        );
        insert into public.erp_counter_sale_lines (
          tenant_id, sale_id, product, quantity, unit_price_vnd, line_total_vnd,
          price_list_id, ticket_id, created_at
        ) values (
          v_tenant, v_phieu_id, 'adult', v_nguoi_lon, v_gia_lon.unit_price_vnd,
          v_gia_lon.unit_price_vnd::bigint * v_nguoi_lon, v_gia_lon.id, v_ve_lon, v_luc
        );
        if v_tre > 0 then
          insert into public.erp_tickets (
            id, tenant_id, site_id, ticket_code, product, channel, valid_on,
            entries_allowed, booking_reference, issued_at, created_at, updated_at, data_origin
          ) values (
            v_ve_tre, v_tenant, v_co_so.id, 'QUAY-' || upper(substr(md5(v_khoa || ':ve-tre'), 1, 12)),
            'child', 'quay-ve', v_ngay, v_tre, 'PT-' || upper(substr(md5(v_khoa), 1, 12)),
            v_luc, v_luc, v_luc, 'demo-history'
          );
          insert into public.erp_counter_sale_lines (
            tenant_id, sale_id, product, quantity, unit_price_vnd, line_total_vnd,
            price_list_id, ticket_id, created_at
          ) values (
            v_tenant, v_phieu_id, 'child', v_tre, v_gia_tre.unit_price_vnd,
            v_gia_tre.unit_price_vnd::bigint * v_tre, v_gia_tre.id, v_ve_tre, v_luc
          );
        end if;
      end loop;
    end loop;
  end if;

  -- B. Khách qua cổng: vé mẫu tới giờ vào mà chưa quét. Vé quầy vào sau khi
  -- mua 5–35 phút; vé web vào đúng khung giờ đã đặt. Khoảng 3% vé quầy và 8%
  -- vé web không tới, để số "đã bán" và "đã vào" không trùng khít.
  for v_ve_web in
    select ticket.id, ticket.site_id, ticket.ticket_code, ticket.entries_allowed, ticket.channel,
      coalesce(slot.starts_at, ticket.issued_at + interval '5 minutes') as vao_tu
    from public.erp_tickets ticket
    left join public.customer_order_tickets bridge on bridge.ticket_id = ticket.id
    left join public.customer_booking_slots slot on slot.id = bridge.slot_id
    where ticket.tenant_id = v_tenant
      and ticket.data_origin = 'demo-history'
      and ticket.entries_used = 0
      and ticket.status = 'issued'
      and ticket.valid_on = v_ngay
      and coalesce(slot.starts_at, ticket.issued_at + interval '5 minutes') < v_gio + interval '1 hour'
  loop
    continue when public.erp_mau_so('vang:' || v_ve_web.id)
      < case when v_ve_web.channel = 'website' then 0.08 else 0.03 end;
    v_quet := v_ve_web.vao_tu + make_interval(mins => floor(
      case when v_ve_web.channel = 'website' then 20 else 30 end
      * public.erp_mau_so('quet:' || v_ve_web.id))::integer);
    continue when v_quet >= p_den;
    select registry.account_id, registry.display_name into v_nguoi
    from public.erp_account_registry registry
    where registry.tenant_id = v_tenant
      and registry.account_id = case v_ve_web.site_id
        when '10000000-0000-4000-8000-000000000001' then 'employee-trang-an-01'
        when '10000000-0000-4000-8000-000000000009' then 'employee-tam-chuc-01'
        when '10000000-0000-4000-8000-000000000005' then 'employee-tam-coc-01'
        else 'employee-bai-dinh-01' end;
    continue when v_nguoi.account_id is null;
    insert into public.erp_gate_scan_events (
      id, tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
      scanned_at, ticket_id, result, idempotency_key
    )
    select public.erp_mau_id('cong:' || v_ve_web.id || ':' || lan), v_tenant, v_ve_web.site_id,
      v_ve_web.ticket_code, v_nguoi.account_id, v_nguoi.display_name,
      v_quet + make_interval(secs => lan * 4), v_ve_web.id, 'accepted',
      'mau-' || v_ve_web.id || '-' || lan
    from generate_series(1, v_ve_web.entries_allowed) as lan
    on conflict do nothing;
    update public.erp_tickets
    set entries_used = entries_allowed, status = 'used', updated_at = v_quet
    where id = v_ve_web.id and entries_used = 0;
    v_so := v_so + 1;
  end loop;

  -- C. Đơn đặt trên web, trả bằng QR. Khách đặt từ 7h tới 23h, đi sau 0–6 ngày.
  if v_h between 7 and 22 then
    v_so_don := floor(1.0 * v_he_so_ngay + public.erp_mau_so('sd:' || v_k))::integer;
    for i in 1..v_so_don loop
      v_khoa := 'web:' || v_k || ':' || i;
      v_luc := v_gio + make_interval(secs => floor(3000 * public.erp_mau_so(v_khoa || ':phut')));
      v_tra_luc := v_luc + make_interval(secs => 90 + floor(420 * public.erp_mau_so(v_khoa || ':tra')));
      continue when v_tra_luc >= p_den;

      v_r := public.erp_mau_so(v_khoa || ':goi');
      select product.* into v_goi from public.products product
      where product.tenant_id = v_tenant
        and product.slug = case when v_r < 0.35 then 'heritage-day' when v_r < 0.6 then 'slow-ninh-binh'
          when v_r < 0.85 then 'family-discovery' else 'cinematic-sunset' end;
      continue when v_goi.id is null;

      v_r := public.erp_mau_so(v_khoa || ':ngay');
      v_ngay_di := v_ngay + case when v_r < 0.15 then 0 when v_r < 0.45 then 1 when v_r < 0.7 then 2
        when v_r < 0.85 then 3 else 4 + floor(public.erp_mau_so(v_khoa || ':xa') * 3)::integer end;
      select template.departure_time into v_gio_di
      from public.customer_product_capacity_templates template
      where template.tenant_id = v_tenant and template.product_id = v_goi.id and template.active
      group by template.departure_time
      order by md5(v_khoa || template.departure_time::text)
      limit 1;
      continue when v_gio_di is null;
      -- Khung đi hôm nay đã qua giờ thì chuyển sang hôm sau.
      if (v_ngay_di + v_gio_di) at time zone 'Asia/Ho_Chi_Minh' <= v_tra_luc + interval '30 minutes' then
        v_ngay_di := v_ngay_di + 1;
      end if;

      v_r := public.erp_mau_so(v_khoa || ':lon');
      v_nguoi_lon := case when v_r < 0.2 then 1 when v_r < 0.65 then 2 when v_r < 0.85 then 3 else 4 end;
      v_r := public.erp_mau_so(v_khoa || ':tre');
      v_tre := case when v_goi.slug = 'family-discovery' then (case when v_r < 0.3 then 1 else 2 end)
        when v_r < 0.8 then 0 else 1 end;

      -- Một khách quen có thể quay lại: 420 hồ sơ cho khoảng 900 đơn.
      v_ho_so := public.erp_mau_id('ho-so:' || floor(420 * public.erp_mau_so(v_khoa || ':khach'))::integer);
      insert into public.customer_profiles (id, tenant_id, anonymous_id, status, created_at, updated_at)
      values (v_ho_so, v_tenant, public.erp_mau_id('an-danh:' || v_ho_so), 'anonymous', v_luc, v_luc)
      on conflict do nothing;

      v_don := public.erp_mau_id(v_khoa);
      v_giu := public.erp_mau_id(v_khoa || ':giu');
      v_tra := public.erp_mau_id(v_khoa || ':tra');
      v_ma_don := 'NBJ-' || upper(substr(md5(v_khoa || ':ma'), 1, 12));

      insert into public.customer_orders (
        id, tenant_id, profile_id, product_id, order_code, visit_date, party_size,
        adults, children, unit_price_vnd, total_vnd, status, created_at, updated_at
      ) values (
        v_don, v_tenant, v_ho_so, v_goi.id, v_ma_don, v_ngay_di, v_nguoi_lon + v_tre,
        v_nguoi_lon, v_tre, v_goi.demo_price_vnd, v_goi.demo_price_vnd * v_nguoi_lon,
        'confirmed', v_luc, v_tra_luc
      ) on conflict do nothing;
      continue when not found;
      v_so := v_so + 1;

      insert into public.customer_order_lines (
        tenant_id, order_id, product_id, quantity, unit_price_vnd, total_vnd,
        ledger_type, guest_group, created_at
      ) values (
        v_tenant, v_don, v_goi.id, v_nguoi_lon, v_goi.demo_price_vnd,
        v_goi.demo_price_vnd * v_nguoi_lon, 'service-commerce', 'adult', v_luc
      );
      if v_tre > 0 then
        insert into public.customer_order_lines (
          tenant_id, order_id, product_id, quantity, unit_price_vnd, total_vnd,
          ledger_type, guest_group, created_at
        ) values (
          v_tenant, v_don, v_goi.id, v_tre, 0, 0, 'service-commerce', 'child', v_luc
        );
      end if;

      insert into public.customer_booking_holds (
        id, tenant_id, order_id, profile_id, idempotency_key, payload_digest,
        status, expires_at, created_at, converted_at
      ) values (
        v_giu, v_tenant, v_don, v_ho_so, public.erp_mau_id(v_khoa || ':khoa-giu'),
        md5(v_khoa || ':a') || md5(v_khoa || ':b'),
        'converted', v_luc + interval '15 minutes', v_luc, v_tra_luc
      );

      v_so_ve := 0;
      for v_mau in
        select template.*
        from public.customer_product_capacity_templates template
        where template.tenant_id = v_tenant and template.product_id = v_goi.id
          and template.active and template.departure_time = v_gio_di
        order by template.local_start_time, template.site_id
      loop
        select threshold.* into v_nguong
        from public.erp_capacity_thresholds threshold
        where threshold.tenant_id = v_tenant and threshold.site_id = v_mau.site_id
        order by threshold.effective_capacity asc, threshold.effective_from desc, threshold.threshold_code
        limit 1;
        continue when v_nguong.id is null;
        v_bat_dau := (v_ngay_di + v_mau.local_start_time) at time zone 'Asia/Ho_Chi_Minh';

        insert into public.customer_booking_slots (
          tenant_id, site_id, capacity_threshold_id, starts_at, ends_at,
          capacity_snapshot, threshold_version, capacity_source_kind, status
        ) values (
          v_tenant, v_mau.site_id, v_nguong.id, v_bat_dau,
          v_bat_dau + make_interval(mins => v_mau.duration_minutes),
          v_nguong.effective_capacity, v_nguong.version, v_nguong.source_kind, 'open'
        ) on conflict (tenant_id, site_id, starts_at) do nothing;
        select slot.id into v_suat from public.customer_booking_slots slot
        where slot.tenant_id = v_tenant and slot.site_id = v_mau.site_id and slot.starts_at = v_bat_dau;

        insert into public.customer_booking_hold_slots (tenant_id, hold_id, slot_id, quantity, created_at)
        values (v_tenant, v_giu, v_suat, v_nguoi_lon + v_tre, v_luc);

        foreach v_nhom in array array['adult', 'child'] loop
          continue when v_nhom = 'child' and v_tre = 0;
          v_ve := public.erp_mau_id(v_khoa || ':ve:' || v_mau.site_id || ':' || v_nhom);
          insert into public.erp_tickets (
            id, tenant_id, site_id, ticket_code, product, booking_reference, channel,
            valid_on, entries_allowed, issued_at, created_at, updated_at, data_origin
          ) values (
            v_ve, v_tenant, v_mau.site_id,
            'WEB-' || upper(substr(md5(v_khoa || ':ve:' || v_mau.site_id || ':' || v_nhom), 1, 12)),
            v_nhom, v_ma_don, 'website', v_ngay_di,
            case v_nhom when 'adult' then v_nguoi_lon else v_tre end,
            v_tra_luc, v_tra_luc, v_tra_luc, 'demo-history'
          );
          insert into public.customer_order_tickets (
            tenant_id, order_id, slot_id, ticket_id, site_id, guest_group, entries_allowed, created_at
          ) values (
            v_tenant, v_don, v_suat, v_ve, v_mau.site_id, v_nhom,
            case v_nhom when 'adult' then v_nguoi_lon else v_tre end, v_tra_luc
          );
          v_so_ve := v_so_ve + 1;
        end loop;
      end loop;

      insert into public.customer_payment_attempts (
        id, tenant_id, order_id, hold_id, idempotency_key, provider, provider_event_id,
        mode, status, amount_vnd, currency, occurred_at, created_at
      ) values (
        v_tra, v_tenant, v_don, v_giu, public.erp_mau_id(v_khoa || ':khoa-tra'),
        'destinationos-simulation', 'qr-' || v_tra, 'qr-transfer', 'succeeded',
        v_goi.demo_price_vnd * v_nguoi_lon, 'VND', v_tra_luc, v_tra_luc
      );

      insert into public.customer_commerce_audit_events (
        tenant_id, profile_id, order_id, hold_id, payment_attempt_id, event_type, metadata, occurred_at
      ) values
        (v_tenant, v_ho_so, v_don, v_giu, null, 'hold-created',
          jsonb_build_object('visit_date', v_ngay_di, 'party_size', v_nguoi_lon + v_tre,
            'adults', v_nguoi_lon, 'children', v_tre, 'mode', 'qr-transfer'), v_luc),
        (v_tenant, v_ho_so, v_don, v_giu, v_tra, 'payment-simulated',
          jsonb_build_object('amount_vnd', v_goi.demo_price_vnd * v_nguoi_lon, 'currency', 'VND',
            'mode', 'qr-transfer'), v_tra_luc),
        (v_tenant, v_ho_so, v_don, v_giu, v_tra, 'tickets-issued',
          jsonb_build_object('ticket_count', v_so_ve, 'channel', 'website'), v_tra_luc);
    end loop;
  end if;

  return v_so;
end;
$ham$;

revoke all on function public.erp_lich_su_mau_sinh_gio(timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.erp_lich_su_mau_sinh_gio(timestamptz, timestamptz) to service_role;
revoke all on function public.erp_mau_so(text) from public, anon, authenticated;
revoke all on function public.erp_mau_id(text) from public, anon, authenticated;

-- 5. Xoá và làm mới.
--
-- Chủ dự án hỏi: sinh liên tục thì một lúc là toàn rác? Đúng, nên không sinh
-- liên tục. Kho luôn giữ ĐÚNG một cửa sổ 60 ngày mẫu: mỗi tháng một lần xoá
-- phần mẫu cũ hơn 60 ngày và sinh tiếp phần còn thiếu tới hôm nay.
--
-- Khoá "chỉ thêm" của các bảng lịch sử nhả đúng khe 'lich-su-mau' cho dòng
-- mang mã mẫu (bảng khách nhả ở 090; phiếu quầy nhả ở đây). Vé mẫu nào đã bị
-- phiếu đoàn, lời đánh giá hay lô đồng bộ ngoại tuyến trỏ vào thì giữ lại cùng
-- phiếu hoặc đơn của nó, không xoá liều.
create or replace function public.erp_counter_sale_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('nbj.cho_phep_xoa', true), '') = 'lich-su-mau'
     and (
       coalesce(to_jsonb(old) ->> 'sale_id', '') like 'de000000%'
       or coalesce(to_jsonb(old) ->> 'id', '') like 'de000000%'
     ) then
    return old;
  end if;
  raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
end;
$ham$;

create or replace function public.erp_counter_sale_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('nbj.cho_phep_xoa', true), '') = 'lich-su-mau'
       and old.id::text like 'de000000%' then
      return old;
    end if;
    raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
  end if;
  if old.status <> 'completed' or new.status <> 'voided'
     or (
       new.id, new.tenant_id, new.site_id, new.sale_code, new.sold_by_account_id,
       new.sold_by_name, new.acting_director_account_id, new.sold_at,
       new.business_date, new.payment_method, new.payment_reference, new.adults,
       new.children, new.total_vnd, new.cash_received_vnd,
       new.cash_counted_confirmed, new.request_key, new.created_at
     ) is distinct from (
       old.id, old.tenant_id, old.site_id, old.sale_code, old.sold_by_account_id,
       old.sold_by_name, old.acting_director_account_id, old.sold_at,
       old.business_date, old.payment_method, old.payment_reference, old.adults,
       old.children, old.total_vnd, old.cash_received_vnd,
       old.cash_counted_confirmed, old.request_key, old.created_at
     ) then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
  end if;
  return new;
end;
$ham$;

create or replace function public.erp_lich_su_mau_xoa(p_truoc timestamptz default 'infinity')
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer;
begin
  create temporary table if not exists nbj_ve_giu (ticket_id uuid primary key) on commit drop;
  create temporary table if not exists nbj_ve_xoa (ticket_id uuid primary key) on commit drop;
  create temporary table if not exists nbj_don_xoa (order_id uuid primary key) on commit drop;
  delete from pg_temp.nbj_ve_giu;
  delete from pg_temp.nbj_ve_xoa;
  delete from pg_temp.nbj_don_xoa;

  -- Vé mẫu đang bị hồ sơ thật trỏ vào: giữ.
  insert into pg_temp.nbj_ve_giu (ticket_id)
  select ticket.id from public.erp_tickets ticket
  where ticket.data_origin = 'demo-history'
    and (
      exists (select 1 from public.erp_visitor_groups g where g.ticket_id = ticket.id)
      or exists (select 1 from public.erp_visit_reviews r where r.ticket_id = ticket.id)
      or exists (
        select 1 from public.erp_gate_scan_events scan
        where scan.ticket_id = ticket.id
          and (
            exists (select 1 from public.erp_visit_reviews r where r.scan_event_id = scan.id)
            or exists (select 1 from public.erp_gate_offline_sync_items i where i.scan_event_id = scan.id)
          )
      )
    )
  on conflict do nothing;
  -- Giữ cả những vé cùng phiếu, cùng đơn với vé đang giữ.
  insert into pg_temp.nbj_ve_giu (ticket_id)
  select other.ticket_id from public.erp_counter_sale_lines line
  join public.erp_counter_sale_lines other on other.sale_id = line.sale_id
  where line.ticket_id in (select ticket_id from pg_temp.nbj_ve_giu)
  union
  select other.ticket_id from public.customer_order_tickets bridge
  join public.customer_order_tickets other on other.order_id = bridge.order_id
  where bridge.ticket_id in (select ticket_id from pg_temp.nbj_ve_giu)
  on conflict do nothing;

  -- Vé của phiếu quầy bán trước mốc, hoặc của đơn web đặt trước mốc.
  insert into pg_temp.nbj_ve_xoa (ticket_id)
  select line.ticket_id
  from public.erp_counter_sales sale
  join public.erp_counter_sale_lines line
    on line.tenant_id = sale.tenant_id and line.sale_id = sale.id
  where sale.id::text like 'de000000%' and sale.sold_at < p_truoc
    and not exists (select 1 from pg_temp.nbj_ve_giu giu where giu.ticket_id = line.ticket_id)
  union
  select bridge.ticket_id
  from public.customer_orders customer_order
  join public.customer_order_tickets bridge on bridge.order_id = customer_order.id
  where customer_order.id::text like 'de000000%' and customer_order.created_at < p_truoc
    and not exists (select 1 from pg_temp.nbj_ve_giu giu where giu.ticket_id = bridge.ticket_id)
  on conflict do nothing;
  select count(*) into v_so from pg_temp.nbj_ve_xoa;
  analyze pg_temp.nbj_ve_xoa;
  analyze pg_temp.nbj_ve_giu;

  perform set_config('nbj.cho_phep_xoa', 'lich-su-mau', true);

  delete from public.erp_gate_scan_events scan
  where scan.ticket_id in (select ticket_id from pg_temp.nbj_ve_xoa);

  -- Lọc ngược theo danh sách GIỮ (gần như luôn rỗng) thay vì danh sách xoá:
  -- cùng kết quả, mà đo trên PGlite nhanh gấp ba mươi lần.
  delete from public.erp_counter_sale_lines line
  using public.erp_counter_sales sale
  where sale.tenant_id = line.tenant_id and sale.id = line.sale_id
    and sale.id::text like 'de000000%' and sale.sold_at < p_truoc
    and not exists (select 1 from pg_temp.nbj_ve_giu giu where giu.ticket_id = line.ticket_id);
  delete from public.erp_counter_sales sale
  where sale.id::text like 'de000000%' and sale.sold_at < p_truoc
    and not exists (
      select 1 from public.erp_counter_sale_lines line
      where line.tenant_id = sale.tenant_id and line.sale_id = sale.id
    );

  insert into pg_temp.nbj_don_xoa (order_id)
  select customer_order.id from public.customer_orders customer_order
  where customer_order.id::text like 'de000000%' and customer_order.created_at < p_truoc
    and not exists (
      select 1 from public.customer_order_tickets bridge
      where bridge.order_id = customer_order.id
        and not exists (select 1 from pg_temp.nbj_ve_xoa xoa where xoa.ticket_id = bridge.ticket_id)
    )
    and not exists (select 1 from public.erp_visitor_groups g where g.order_id = customer_order.id);
  analyze pg_temp.nbj_don_xoa;

  delete from public.customer_order_tickets bridge
  where bridge.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_commerce_audit_events event
  where event.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_payment_attempts payment
  where payment.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_booking_hold_slots hold_slot
  using public.customer_booking_holds hold
  where hold_slot.hold_id = hold.id
    and hold.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_booking_holds hold
  where hold.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_order_lines line
  where line.order_id in (select order_id from pg_temp.nbj_don_xoa);
  delete from public.customer_orders customer_order
  where customer_order.id in (select order_id from pg_temp.nbj_don_xoa);

  delete from public.erp_tickets ticket
  where ticket.id in (select ticket_id from pg_temp.nbj_ve_xoa)
    -- Nêu cả tenant_id: chỉ mục của dòng phiếu bắt đầu bằng tenant_id, thiếu nó
    -- là mỗi vé đọc lại cả bảng (đo trên PGlite: 150 giây thay vì vài giây).
    and not exists (
      select 1 from public.erp_counter_sale_lines line
      where line.tenant_id = ticket.tenant_id and line.ticket_id = ticket.id
    )
    and not exists (select 1 from public.customer_order_tickets bridge where bridge.ticket_id = ticket.id);

  perform set_config('nbj.cho_phep_xoa', '', true);
  return v_so;
end;
$ham$;

-- Làm mới là cửa sổ trượt: xoá phần mẫu cũ hơn p_so_ngay ngày, rồi sinh tiếp từ
-- giờ mẫu cuối cùng tới bây giờ, từng giờ một theo thứ tự thời gian (đơn web
-- phải có trước lượt quét của chính nó). Không xoá rồi sinh lại đúng những mã
-- cũ: đo trên PGlite, làm thế chậm gấp ba vì chỉ mục còn vướng dòng vừa xoá.
create or replace function public.erp_lich_su_mau_lam_moi(p_so_ngay integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_gio timestamptz;
  v_tu timestamptz;
  v_cuoi timestamptz;
  v_so integer := 0;
begin
  if p_so_ngay is null or p_so_ngay < 1 or p_so_ngay > 90 then
    raise exception using errcode = '22023', message = 'ERP_DEMO_HISTORY_DAYS_INVALID';
  end if;
  -- Hai lượt làm mới chạy chồng nhau thì lượt sau đợi lượt trước xong.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('erp-lich-su-mau', 0));
  v_tu := date_trunc('hour', now()) - make_interval(days => p_so_ngay);
  perform public.erp_lich_su_mau_xoa(v_tu);
  select date_trunc('hour', greatest(
    (select max(sale.sold_at) from public.erp_counter_sales sale where sale.id::text like 'de000000%'),
    (select max(customer_order.created_at) from public.customer_orders customer_order
      where customer_order.id::text like 'de000000%')
  )) into v_cuoi;
  for v_gio in
    select generate_series(
      greatest(v_tu, coalesce(v_cuoi, v_tu)),
      date_trunc('hour', now()),
      interval '1 hour'
    )
  loop
    v_so := v_so + public.erp_lich_su_mau_sinh_gio(v_gio, now());
  end loop;
  return v_so;
end;
$ham$;

revoke all on function public.erp_lich_su_mau_xoa(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.erp_lich_su_mau_xoa(timestamptz) to service_role;
revoke all on function public.erp_lich_su_mau_lam_moi(integer) from public, anon, authenticated, service_role;
grant execute on function public.erp_lich_su_mau_lam_moi(integer) to service_role;

select public.erp_lich_su_mau_lam_moi(60);

-- Mỗi tháng một lần: 03:00 sáng mùng 2 giờ Việt Nam (20:00 UTC mùng 1).
do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'erp-lich-su-mau-hang-thang' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'erp-lich-su-mau-hang-thang',
  '0 20 1 * *',
  $cron$select public.erp_lich_su_mau_lam_moi(60);$cron$
);

-- 6. Trang đầu giám đốc đếm cả lịch sử mẫu, và nói ra phần mẫu là bao nhiêu
--    (demo_history_entry_count) để màn hình ghi "gồm số liệu mẫu". Vé gieo cũ
--    (demo-seed) vẫn bị loại như trước.
create or replace function public.erp_director_ticket_overview(
  p_tenant_id uuid,
  p_site_ids uuid[],
  p_windows jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cua_so as (
    select
      khung.value ->> 'key' as khoa,
      (khung.value ->> 'from')::timestamptz as tu,
      (khung.value ->> 'to')::timestamptz as den,
      khung.thu_tu
    from jsonb_array_elements(p_windows) with ordinality as khung(value, thu_tu)
  ),
  ve as (
    select
      cua_so.thu_tu,
      cua_so.khoa,
      ticket.site_id,
      ticket.channel,
      ticket.data_origin,
      greatest(coalesce(ticket.entries_allowed, 1), 1) as entries
    from cua_so
    join public.erp_tickets ticket
      on ticket.issued_at >= cua_so.tu
     and ticket.issued_at < cua_so.den
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = any(p_site_ids)
      -- Vé đã huỷ không cho ai vào: không đếm vào lượt khách hay số tấm vé.
      and ticket.status <> 'void'
  )
  select jsonb_build_object(
    'windows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', cua_so.khoa,
          'ticket_count', dem.ticket_count,
          'entry_count', dem.entry_count,
          'demo_seed_ticket_count', dem.demo_seed_ticket_count,
          'demo_history_entry_count', dem.demo_history_entry_count
        )
        order by cua_so.thu_tu
      )
      from cua_so
      cross join lateral (
        select
          count(*) filter (where ve.data_origin in ('real', 'demo-history')) as ticket_count,
          coalesce(sum(ve.entries) filter (where ve.data_origin in ('real', 'demo-history')), 0) as entry_count,
          count(*) filter (where ve.data_origin = 'demo-seed') as demo_seed_ticket_count,
          coalesce(sum(ve.entries) filter (where ve.data_origin = 'demo-history'), 0) as demo_history_entry_count
        from ve
        where ve.thu_tu = cua_so.thu_tu
      ) dem
    ), '[]'::jsonb),
    'by_site', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', theo.khoa,
          'site_id', theo.site_id,
          'ticket_count', theo.ticket_count,
          'entry_count', theo.entry_count
        )
        order by theo.thu_tu, theo.site_id
      )
      from (
        select ve.thu_tu, ve.khoa, ve.site_id, count(*) as ticket_count, sum(ve.entries) as entry_count
        from ve
        where ve.data_origin in ('real', 'demo-history')
        group by ve.thu_tu, ve.khoa, ve.site_id
      ) theo
    ), '[]'::jsonb),
    'by_channel', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', theo.khoa,
          'channel', theo.channel,
          'ticket_count', theo.ticket_count,
          'entry_count', theo.entry_count
        )
        order by theo.thu_tu, theo.channel
      )
      from (
        select ve.thu_tu, ve.khoa, ve.channel, count(*) as ticket_count, sum(ve.entries) as entry_count
        from ve
        where ve.data_origin in ('real', 'demo-history')
        group by ve.thu_tu, ve.khoa, ve.channel
      ) theo
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.erp_director_ticket_overview(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.erp_director_ticket_overview(uuid, uuid[], jsonb) to service_role;

-- 7. Tiền trong kỳ, cộng ngay trong kho. PostgREST chỉ trả tối đa 1.000 dòng
--    mỗi lượt, mà ba mươi ngày có hàng nghìn phiếu quầy: cộng ở phía web là
--    cộng thiếu mà trông như đúng.
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
    'web_orders', (
      select count(*) from public.customer_orders customer_order
      where customer_order.tenant_id = p_tenant_id and customer_order.status = 'confirmed'
        and customer_order.created_at >= p_tu and customer_order.created_at < p_den
    ),
    'web_vnd', (
      select coalesce(sum(customer_order.total_vnd), 0) from public.customer_orders customer_order
      where customer_order.tenant_id = p_tenant_id and customer_order.status = 'confirmed'
        and customer_order.created_at >= p_tu and customer_order.created_at < p_den
    )
  );
$ham$;

revoke all on function public.erp_doanh_thu_ky(uuid, uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.erp_doanh_thu_ky(uuid, uuid[], timestamptz, timestamptz) to service_role;

commit;
