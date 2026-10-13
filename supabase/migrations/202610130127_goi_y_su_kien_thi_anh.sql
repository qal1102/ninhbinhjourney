-- Gợi ý theo khách giống bạn, sự kiện gặp người nổi tiếng có rút thăm minh
-- bạch, thi ảnh hằng tháng (13/10/2026).
--
-- Chủ dự án 13/10: "cái phần rcm của mấy ứng dụng lớn… bạn bè của bạn đã
-- check-in ở đây, giờ bạn có muốn thử không"; "thi ảnh tháng có thể làm, tự
-- quyết giải thưởng"; "tổ chức event gặp KOL, ca sĩ, cho điền số điện thoại
-- và rút thăm… thế là có một dòng data". Không gửi tin nhắn nào.
--
-- 1. `customer_so_noi_bat`: số thật để nói với khách (khách qua cổng 7 ngày
--    ở từng điểm, đơn 30 ngày từng gói, gói mà khách cùng kiểu nhóm hay
--    chọn). Chỉ số gộp, không ai bị nhận ra.
-- 2. Sự kiện: khách đăng ký bằng số điện thoại (đồng ý dịch vụ bắt buộc để
--    liên hệ khi trúng, đồng ý tiếp thị là ô riêng). Mỗi người 1 lượt, thêm 1
--    lượt cho mỗi lần qua cổng bằng vé gắn số trong thời gian đăng ký, tối đa
--    5. Rút thăm "cam kết rồi mở": lúc tạo sự kiện máy sinh hạt giống bí mật
--    và công bố ngay mã băm SHA-256 của nó; rút thăm xong công bố hạt giống
--    và danh sách (mã tham gia, số lượt). Ai cũng tính lại được người trúng:
--    điểm của một người = mã băm nhỏ nhất của `hạt giống:mã tham gia:k` với
--    k = 1..số lượt; ai có điểm nhỏ nhất trúng trước. Nghị định 239/2026 yêu
--    cầu việc xác định trúng thưởng có khách chứng kiến, trực tiếp hoặc
--    trực tuyến; trang sự kiện là chỗ chứng kiến trực tuyến. Chương trình có
--    gắn với vé là khuyến mại may rủi, phải đăng ký với Sở Công Thương trước
--    khi chạy thật; trang ghi số văn bản ấy, chưa có thì ghi rõ là chưa có.
-- 3. Thi ảnh: khách gửi ảnh chụp ở các điểm (tối đa 3 ảnh mỗi số mỗi tháng),
--    giám đốc duyệt rồi chấm giải; ảnh chỉ hiện công khai sau khi duyệt. Thi
--    theo chất lượng ảnh, không bốc thăm, không cần mua vé.

begin;

-- 0. Số điện thoại thành định danh, ghi đồng ý (chép cách làm của 119) -------------------

create or replace function public.customer_dinh_danh_so(
  p_tenant_id uuid,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_marketing_enabled boolean,
  p_service_policy_version text,
  p_marketing_policy_version text,
  p_surface text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_identity public.customer_identities;
  v_profile_id uuid;
  v_current_marketing public.customer_consents;
  v_marketing_status text;
begin
  if p_tenant_id is null or p_marketing_enabled is null
     or coalesce(p_identity_digest, '') !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_identity_ciphertext, '')) not between 24 and 4096
     or char_length(trim(coalesce(p_encryption_key_version, ''))) not between 1 and 40
     or char_length(trim(coalesce(p_service_policy_version, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_marketing_policy_version, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_surface, ''))) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'CUSTOMER_PHONE_INPUT_INVALID';
  end if;

  select identity.* into v_identity
  from public.customer_identities identity
  where identity.tenant_id = p_tenant_id and identity.identity_type = 'phone'
    and identity.identity_digest = p_identity_digest
  for update;

  if v_identity.id is null then
    insert into public.customer_profiles (tenant_id, anonymous_id, status)
    values (p_tenant_id, gen_random_uuid(), 'identified')
    returning id into v_profile_id;
    insert into public.customer_identities (
      tenant_id, profile_id, identity_type, identity_digest, identity_ciphertext, encryption_key_version
    ) values (
      p_tenant_id, v_profile_id, 'phone', p_identity_digest, p_identity_ciphertext, trim(p_encryption_key_version)
    ) returning * into v_identity;
    insert into public.customer_identity_audit_events (
      tenant_id, profile_id, identity_id, actor_kind, actor_account_id, event_type, purpose, metadata
    ) values (
      p_tenant_id, v_profile_id, v_identity.id, 'customer', null,
      'identity-linked', trim(p_surface), jsonb_build_object('method', 'phone')
    );
  else
    v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id);
  end if;

  perform public.customer_record_consent(
    p_tenant_id, v_profile_id, 'essential_service', 'granted', 'web',
    trim(p_service_policy_version), jsonb_build_object('surface', trim(p_surface)), now()
  );
  select consent.* into v_current_marketing
  from public.customer_consents consent
  where consent.tenant_id = p_tenant_id and consent.profile_id = v_profile_id
    and consent.purpose = 'marketing_communications'
  order by consent.occurred_at desc, consent.sequence_no desc
  limit 1;
  v_marketing_status := case
    when p_marketing_enabled then 'granted'
    when v_current_marketing.status in ('granted', 'revoked') then 'revoked'
    else 'denied'
  end;
  -- Không tích ô tiếp thị mà trước đó chưa từng đồng ý thì không ghi gì thêm:
  -- đăng ký sự kiện không được lặng lẽ rút lại một đồng ý cũ khách đã cho.
  if p_marketing_enabled and (v_current_marketing.id is null or v_current_marketing.status <> 'granted') then
    perform public.customer_record_consent(
      p_tenant_id, v_profile_id, 'marketing_communications', 'granted', 'web',
      trim(p_marketing_policy_version), jsonb_build_object('surface', trim(p_surface)), now()
    );
  elsif not p_marketing_enabled and v_current_marketing.id is null then
    perform public.customer_record_consent(
      p_tenant_id, v_profile_id, 'marketing_communications', 'denied', 'web',
      trim(p_marketing_policy_version), jsonb_build_object('surface', trim(p_surface)), now()
    );
  end if;
  return v_identity.id;
end;
$ham$;

-- 1. Số nổi bật cho gợi ý ------------------------------------------------------------------

create or replace function public.customer_so_noi_bat(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with
  web as (
    select customer_order.product_id, customer_order.adults, customer_order.children, customer_order.created_at
    from public.customer_orders customer_order
    where customer_order.tenant_id = p_tenant_id and customer_order.status = 'confirmed'
      and customer_order.created_at > now() - interval '90 days'
  ),
  nhom as (
    select product.slug,
      case
        when web.children > 0 then 'gia-dinh-co-tre'
        when web.adults = 1 then 'mot-minh'
        when web.adults = 2 then 'hai-nguoi'
        else 'nhom-ban'
      end as loai
    from web join public.products product on product.id = web.product_id
  ),
  dem as (
    select loai, slug, count(*) as don, sum(count(*)) over (partition by loai) as tong,
      row_number() over (partition by loai order by count(*) desc, slug) as hang
    from nhom group by loai, slug
  )
  select jsonb_build_object(
    'diem', coalesce((
      select jsonb_object_agg(site.slug, x.so)
      from (
        select scan.site_id, count(*) as so
        from public.erp_gate_scan_events scan
        where scan.tenant_id = p_tenant_id and scan.result = 'accepted'
          and scan.scanned_at > now() - interval '7 days'
        group by scan.site_id
      ) x
      join public.sites site on site.id = x.site_id
    ), '{}'::jsonb),
    'goi', coalesce((
      select jsonb_object_agg(product.slug, x.so)
      from (
        select web.product_id, count(*) as so from web
        where web.created_at > now() - interval '30 days'
        group by web.product_id
      ) x
      join public.products product on product.id = x.product_id
    ), '{}'::jsonb),
    'theo_nhom', coalesce((
      select jsonb_object_agg(loai, ds)
      from (
        select loai, jsonb_agg(jsonb_build_object('slug', slug, 'don', don, 'tong', tong) order by hang) as ds
        from dem where hang <= 3 group by loai
      ) y
    ), '{}'::jsonb)
  );
$ham$;

-- 2. Sự kiện và rút thăm --------------------------------------------------------------------

create table if not exists public.su_kien (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  ten text not null check (char_length(trim(ten)) between 3 and 160),
  mo_ta text not null default '' check (char_length(mo_ta) <= 2000),
  khach_moi text not null check (char_length(trim(khach_moi)) between 1 and 160),
  site_id uuid references public.sites(id) on delete restrict,
  dien_ra_luc timestamptz not null,
  mo_dang_ky_luc timestamptz not null default now(),
  han_dang_ky timestamptz not null,
  so_giai integer not null check (so_giai between 1 and 200),
  giai_thuong text not null check (char_length(trim(giai_thuong)) between 3 and 500),
  so_dang_ky_khuyen_mai text check (so_dang_ky_khuyen_mai is null or char_length(trim(so_dang_ky_khuyen_mai)) between 3 and 120),
  hat_giong text not null check (hat_giong ~ '^[0-9a-f]{64}$'),
  hat_giong_bam text not null check (hat_giong_bam ~ '^[0-9a-f]{64}$'),
  trang_thai text not null default 'mo' check (trang_thai in ('mo', 'da-rut', 'huy')),
  rut_luc timestamptz,
  rut_boi_account_id text,
  tao_boi_account_id text not null,
  tao_luc timestamptz not null default now(),
  unique (tenant_id, slug),
  check (han_dang_ky > mo_dang_ky_luc and han_dang_ky <= dien_ra_luc),
  check ((trang_thai = 'da-rut') = (rut_luc is not null))
);

create table if not exists public.su_kien_dang_ky (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  su_kien_id uuid not null references public.su_kien(id) on delete cascade,
  identity_id uuid not null,
  contact_hint text not null check (contact_hint ~ '^[0-9]{3}$'),
  ma_tham_gia text not null check (ma_tham_gia ~ '^SK-[A-Z0-9]{6}$'),
  dang_ky_luc timestamptz not null default now(),
  so_luot integer check (so_luot is null or so_luot between 1 and 5),
  diem text,
  trung_thu_tu integer,
  ma_nhan text check (ma_nhan is null or ma_nhan ~ '^NHAN-[A-Z0-9]{6}$'),
  foreign key (identity_id, tenant_id) references public.customer_identities(id, tenant_id) on delete restrict,
  unique (su_kien_id, identity_id),
  unique (su_kien_id, ma_tham_gia)
);

alter table public.su_kien enable row level security;
alter table public.su_kien_dang_ky enable row level security;

create or replace function public.su_kien_bam(p_chuoi text)
returns text
language sql
immutable
set search_path = ''
as $ham$
  select encode(extensions.digest(convert_to(p_chuoi, 'UTF8'), 'sha256'), 'hex');
$ham$;

-- Số lượt hiện tại của một người: 1 + số lượt qua cổng trong thời gian đăng ký, tối đa 5.
create or replace function public.su_kien_so_luot(p_tenant_id uuid, p_su_kien public.su_kien, p_identity_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $ham$
  select least(5, 1 + (
    select count(*) from public.customer_loyalty_visits(p_tenant_id, p_identity_id) visit
    where visit.visit_date between (p_su_kien.mo_dang_ky_luc at time zone 'Asia/Ho_Chi_Minh')::date
                               and (p_su_kien.han_dang_ky at time zone 'Asia/Ho_Chi_Minh')::date
  ))::integer;
$ham$;

create or replace function public.erp_su_kien_tao(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_slug text,
  p_ten text,
  p_mo_ta text,
  p_khach_moi text,
  p_site_id uuid,
  p_dien_ra_luc timestamptz,
  p_han_dang_ky timestamptz,
  p_so_giai integer,
  p_giai_thuong text,
  p_so_dang_ky_khuyen_mai text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_hat text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if not public.erp_account_has_active_role(p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null) then
    raise exception using errcode = '42501', message = 'SU_KIEN_DIRECTOR_REQUIRED';
  end if;
  if p_han_dang_ky is null or p_dien_ra_luc is null or p_han_dang_ky <= now() or p_han_dang_ky > p_dien_ra_luc then
    raise exception using errcode = '22023', message = 'SU_KIEN_DATES_INVALID';
  end if;
  if exists (select 1 from public.su_kien s where s.tenant_id = p_tenant_id and s.slug = lower(trim(p_slug))) then
    raise exception using errcode = '23505', message = 'SU_KIEN_SLUG_TAKEN';
  end if;
  insert into public.su_kien (
    tenant_id, slug, ten, mo_ta, khach_moi, site_id, dien_ra_luc, han_dang_ky,
    so_giai, giai_thuong, so_dang_ky_khuyen_mai, hat_giong, hat_giong_bam, tao_boi_account_id
  ) values (
    p_tenant_id, lower(trim(p_slug)), trim(p_ten), trim(coalesce(p_mo_ta, '')), trim(p_khach_moi), p_site_id,
    p_dien_ra_luc, p_han_dang_ky, p_so_giai, trim(p_giai_thuong),
    nullif(trim(coalesce(p_so_dang_ky_khuyen_mai, '')), ''), v_hat, public.su_kien_bam(v_hat),
    trim(p_actor_account_id)
  ) returning id into v_id;
  return public.customer_su_kien_cong_khai(p_tenant_id, lower(trim(p_slug)));
exception when check_violation then
  raise exception using errcode = '22023', message = 'SU_KIEN_INPUT_INVALID';
end;
$ham$;

-- Mọi thứ trang công khai được thấy. Hạt giống chỉ lộ sau khi rút.
create or replace function public.customer_su_kien_cong_khai(p_tenant_id uuid, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select jsonb_build_object(
    'slug', s.slug, 'ten', s.ten, 'mo_ta', s.mo_ta, 'khach_moi', s.khach_moi,
    'site', (select site.name from public.sites site where site.id = s.site_id),
    'dien_ra_luc', s.dien_ra_luc, 'mo_dang_ky_luc', s.mo_dang_ky_luc, 'han_dang_ky', s.han_dang_ky,
    'so_giai', s.so_giai, 'giai_thuong', s.giai_thuong,
    'so_dang_ky_khuyen_mai', s.so_dang_ky_khuyen_mai,
    'trang_thai', s.trang_thai, 'rut_luc', s.rut_luc,
    'hat_giong_bam', s.hat_giong_bam,
    'hat_giong', case when s.trang_thai = 'da-rut' then s.hat_giong else null end,
    'so_nguoi', (select count(*) from public.su_kien_dang_ky d where d.su_kien_id = s.id),
    'danh_sach', case when s.trang_thai = 'da-rut' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'ma', d.ma_tham_gia, 'so', '•••' || d.contact_hint, 'luot', d.so_luot, 'trung', d.trung_thu_tu
      ) order by d.trung_thu_tu nulls last, d.ma_tham_gia)
      from public.su_kien_dang_ky d where d.su_kien_id = s.id
    ), '[]'::jsonb) else null end
  )
  from public.su_kien s
  where s.tenant_id = p_tenant_id and s.slug = lower(trim(coalesce(p_slug, ''))) and s.trang_thai <> 'huy';
$ham$;

create or replace function public.customer_su_kien_dang_mo(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'ten', s.ten, 'khach_moi', s.khach_moi, 'dien_ra_luc', s.dien_ra_luc,
    'han_dang_ky', s.han_dang_ky, 'trang_thai', s.trang_thai, 'so_giai', s.so_giai,
    'so_nguoi', (select count(*) from public.su_kien_dang_ky d where d.su_kien_id = s.id)
  ) order by s.dien_ra_luc), '[]'::jsonb)
  from public.su_kien s
  where s.tenant_id = p_tenant_id and s.trang_thai <> 'huy'
    and s.dien_ra_luc > now() - interval '30 days';
$ham$;

create or replace function public.customer_su_kien_dang_ky(
  p_tenant_id uuid,
  p_slug text,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_contact_hint text,
  p_marketing_enabled boolean,
  p_service_policy_version text,
  p_marketing_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_su_kien public.su_kien;
  v_identity_id uuid;
  v_dang_ky public.su_kien_dang_ky;
begin
  if coalesce(p_contact_hint, '') !~ '^[0-9]{3}$' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PHONE_INPUT_INVALID';
  end if;
  select s.* into v_su_kien from public.su_kien s
  where s.tenant_id = p_tenant_id and s.slug = lower(trim(coalesce(p_slug, ''))) and s.trang_thai <> 'huy';
  if v_su_kien.id is null then
    raise exception using errcode = 'P0002', message = 'SU_KIEN_NOT_FOUND';
  end if;
  if v_su_kien.trang_thai <> 'mo' or now() > v_su_kien.han_dang_ky then
    raise exception using errcode = '55000', message = 'SU_KIEN_DA_DONG';
  end if;
  v_identity_id := public.customer_dinh_danh_so(
    p_tenant_id, p_identity_digest, p_identity_ciphertext, p_encryption_key_version,
    p_marketing_enabled, p_service_policy_version, p_marketing_policy_version, 'su-kien'
  );
  select d.* into v_dang_ky from public.su_kien_dang_ky d
  where d.su_kien_id = v_su_kien.id and d.identity_id = v_identity_id;
  if v_dang_ky.id is null then
    for i in 1..5 loop
      begin
        insert into public.su_kien_dang_ky (tenant_id, su_kien_id, identity_id, contact_hint, ma_tham_gia)
        values (p_tenant_id, v_su_kien.id, v_identity_id, p_contact_hint,
                'SK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
        returning * into v_dang_ky;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end if;
  return jsonb_build_object(
    'ma_tham_gia', v_dang_ky.ma_tham_gia,
    'so_luot', public.su_kien_so_luot(p_tenant_id, v_su_kien, v_identity_id),
    'da_co', v_dang_ky.dang_ky_luc < now() - interval '2 seconds'
  );
end;
$ham$;

-- Tra bằng số: đã đăng ký chưa, mấy lượt, trúng không, mã nhận giải.
create or replace function public.customer_su_kien_tra(p_tenant_id uuid, p_slug text, p_identity_digest text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce((
    select jsonb_build_object(
      'dang_ky', true,
      'ma_tham_gia', d.ma_tham_gia,
      'so_luot', coalesce(d.so_luot, public.su_kien_so_luot(p_tenant_id, s, d.identity_id)),
      'da_rut', s.trang_thai = 'da-rut',
      'trung_thu_tu', d.trung_thu_tu,
      'ma_nhan', d.ma_nhan
    )
    from public.su_kien s
    join public.su_kien_dang_ky d on d.su_kien_id = s.id
    join public.customer_identities identity on identity.id = d.identity_id and identity.tenant_id = d.tenant_id
    where s.tenant_id = p_tenant_id and s.slug = lower(trim(coalesce(p_slug, '')))
      and identity.identity_type = 'phone' and identity.identity_digest = p_identity_digest
  ), jsonb_build_object('dang_ky', false));
$ham$;

create or replace function public.erp_su_kien_rut(p_tenant_id uuid, p_slug text, p_actor_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_su_kien public.su_kien;
  v_dk record;
  v_thu integer := 0;
begin
  if not public.erp_account_has_active_role(p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null) then
    raise exception using errcode = '42501', message = 'SU_KIEN_DIRECTOR_REQUIRED';
  end if;
  select s.* into v_su_kien from public.su_kien s
  where s.tenant_id = p_tenant_id and s.slug = lower(trim(coalesce(p_slug, '')))
  for update;
  if v_su_kien.id is null then
    raise exception using errcode = 'P0002', message = 'SU_KIEN_NOT_FOUND';
  end if;
  if v_su_kien.trang_thai <> 'mo' then
    raise exception using errcode = '55000', message = 'SU_KIEN_DA_RUT';
  end if;
  if now() < v_su_kien.han_dang_ky then
    raise exception using errcode = '55000', message = 'SU_KIEN_CHUA_HET_HAN';
  end if;

  -- Chốt số lượt và điểm của từng người, rồi xếp: điểm nhỏ nhất trúng trước.
  update public.su_kien_dang_ky d
  set so_luot = public.su_kien_so_luot(p_tenant_id, v_su_kien, d.identity_id)
  where d.su_kien_id = v_su_kien.id;
  update public.su_kien_dang_ky d
  set diem = (
    select min(public.su_kien_bam(v_su_kien.hat_giong || ':' || d.ma_tham_gia || ':' || k))
    from generate_series(1, d.so_luot) k
  )
  where d.su_kien_id = v_su_kien.id;
  for v_dk in
    select d.id from public.su_kien_dang_ky d
    where d.su_kien_id = v_su_kien.id
    order by d.diem, d.ma_tham_gia
    limit v_su_kien.so_giai
  loop
    v_thu := v_thu + 1;
    update public.su_kien_dang_ky
    set trung_thu_tu = v_thu,
        ma_nhan = 'NHAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    where id = v_dk.id;
  end loop;
  update public.su_kien
  set trang_thai = 'da-rut', rut_luc = now(), rut_boi_account_id = trim(p_actor_account_id)
  where id = v_su_kien.id;
  return public.customer_su_kien_cong_khai(p_tenant_id, v_su_kien.slug);
end;
$ham$;

create or replace function public.erp_su_kien_danh_sach(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'ten', s.ten, 'khach_moi', s.khach_moi, 'dien_ra_luc', s.dien_ra_luc,
    'han_dang_ky', s.han_dang_ky, 'trang_thai', s.trang_thai, 'so_giai', s.so_giai,
    'giai_thuong', s.giai_thuong, 'so_dang_ky_khuyen_mai', s.so_dang_ky_khuyen_mai,
    'so_nguoi', (select count(*) from public.su_kien_dang_ky d where d.su_kien_id = s.id),
    'dong_y_tiep_thi', (
      select count(*) from public.su_kien_dang_ky d
      join public.customer_identities identity on identity.id = d.identity_id
      where d.su_kien_id = s.id and (
        select consent.status from public.customer_consents consent
        where consent.tenant_id = p_tenant_id
          and consent.profile_id = public.customer_canonical_profile_id(p_tenant_id, identity.profile_id)
          and consent.purpose = 'marketing_communications'
        order by consent.occurred_at desc, consent.sequence_no desc limit 1
      ) = 'granted'
    ),
    'nguoi_trung', case when s.trang_thai = 'da-rut' then coalesce((
      select jsonb_agg(jsonb_build_object('thu_tu', d.trung_thu_tu, 'so', '•••' || d.contact_hint, 'ma_nhan', d.ma_nhan, 'ma', d.ma_tham_gia) order by d.trung_thu_tu)
      from public.su_kien_dang_ky d where d.su_kien_id = s.id and d.trung_thu_tu is not null
    ), '[]'::jsonb) else null end
  ) order by s.dien_ra_luc desc), '[]'::jsonb)
  from public.su_kien s
  where s.tenant_id = p_tenant_id;
$ham$;

-- Sự kiện mẫu để trình diễn: khách mời công bố sau, chưa có số đăng ký khuyến mại.
do $$
declare
  v_hat text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if exists (select 1 from public.tenants where id = '00000000-0000-4000-8000-000000000001') then
    insert into public.su_kien (
      tenant_id, slug, ten, mo_ta, khach_moi, site_id, dien_ra_luc, mo_dang_ky_luc, han_dang_ky,
      so_giai, giai_thuong, hat_giong, hat_giong_bam, tao_boi_account_id
    ) values (
      '00000000-0000-4000-8000-000000000001', 'dem-trang-trang-an-2026',
      'Đêm trăng Tràng An: giao lưu cùng nghệ sĩ khách mời',
      'Một buổi tối bên bến Tràng An: nghệ sĩ khách mời hát mộc trên thuyền, sau đó giao lưu và chụp ảnh với khán giả trúng thăm. Khán giả đến xem tự do; người trúng thăm được ngồi hàng đầu, chụp ảnh và trò chuyện riêng với khách mời.',
      'Nghệ sĩ khách mời, công bố trên trang này trước ngày diễn ra',
      '10000000-0000-4000-8000-000000000001',
      timestamptz '2026-11-21 19:00+07', timestamptz '2026-10-13 00:00+07', timestamptz '2026-11-18 23:59+07',
      10, '10 suất giao lưu: chụp ảnh và trò chuyện 10 phút với khách mời, ngồi hàng đầu, kèm 2 vé gói Tràng An sáng, Tam Cốc chiều.',
      v_hat, public.su_kien_bam(v_hat), 'system'
    ) on conflict (tenant_id, slug) do nothing;
  end if;
end $$;

-- 3. Thi ảnh hằng tháng ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thi-anh', 'thi-anh', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table if not exists public.thi_anh_bai (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  thang text not null check (thang ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  identity_id uuid not null,
  contact_hint text not null check (contact_hint ~ '^[0-9]{3}$'),
  ten_hien_thi text not null check (char_length(trim(ten_hien_thi)) between 1 and 60),
  chu_thich text not null default '' check (char_length(chu_thich) <= 300),
  dau_ma text not null check (dau_ma in ('trang-an', 'tam-coc', 'bai-dinh', 'tam-chuc', 'hoa-lu', 'khac')),
  anh_path text not null check (anh_path ~ '^thi-anh/[0-9]{4}-[0-9]{2}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  trang_thai text not null default 'cho-duyet' check (trang_thai in ('cho-duyet', 'da-duyet', 'tu-choi')),
  giai text check (giai is null or giai in ('nhat', 'nhi', 'ba', 'khuyen-khich')),
  ma_nhan text check (ma_nhan is null or ma_nhan ~ '^GIAI-[A-Z0-9]{6}$'),
  duyet_boi_account_id text,
  duyet_luc timestamptz,
  gui_luc timestamptz not null default now(),
  foreign key (identity_id, tenant_id) references public.customer_identities(id, tenant_id) on delete restrict,
  unique (tenant_id, anh_path),
  check (giai is null or trang_thai = 'da-duyet'),
  check ((giai is null) = (ma_nhan is null))
);
create index if not exists thi_anh_bai_thang_idx on public.thi_anh_bai (tenant_id, thang, trang_thai);
alter table public.thi_anh_bai enable row level security;

create or replace function public.customer_thi_anh_gui(
  p_tenant_id uuid,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_contact_hint text,
  p_marketing_enabled boolean,
  p_service_policy_version text,
  p_marketing_policy_version text,
  p_ten_hien_thi text,
  p_chu_thich text,
  p_dau_ma text,
  p_anh_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_identity_id uuid;
  v_thang text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM');
  v_id uuid;
begin
  if coalesce(p_contact_hint, '') !~ '^[0-9]{3}$' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PHONE_INPUT_INVALID';
  end if;
  v_identity_id := public.customer_dinh_danh_so(
    p_tenant_id, p_identity_digest, p_identity_ciphertext, p_encryption_key_version,
    p_marketing_enabled, p_service_policy_version, p_marketing_policy_version, 'thi-anh'
  );
  if (
    select count(*) from public.thi_anh_bai b
    where b.tenant_id = p_tenant_id and b.identity_id = v_identity_id and b.thang = v_thang
  ) >= 3 then
    raise exception using errcode = '54000', message = 'THI_ANH_DU_BA_ANH';
  end if;
  insert into public.thi_anh_bai (
    tenant_id, thang, identity_id, contact_hint, ten_hien_thi, chu_thich, dau_ma, anh_path
  ) values (
    p_tenant_id, v_thang, v_identity_id, p_contact_hint, trim(p_ten_hien_thi),
    trim(coalesce(p_chu_thich, '')), p_dau_ma, p_anh_path
  ) returning id into v_id;
  return jsonb_build_object('id', v_id, 'thang', v_thang);
exception when check_violation then
  raise exception using errcode = '22023', message = 'THI_ANH_INPUT_INVALID';
end;
$ham$;

-- Ảnh đã duyệt của một tháng (trang trưng bày). Máy chủ web ký đường dẫn ảnh.
create or replace function public.customer_thi_anh_trung_bay(p_tenant_id uuid, p_thang text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'ten', b.ten_hien_thi, 'chu_thich', b.chu_thich, 'dau_ma', b.dau_ma,
    'anh_path', b.anh_path, 'giai', b.giai
  ) order by case b.giai when 'nhat' then 1 when 'nhi' then 2 when 'ba' then 3 when 'khuyen-khich' then 4 else 5 end, b.duyet_luc desc), '[]'::jsonb)
  from public.thi_anh_bai b
  where b.tenant_id = p_tenant_id and b.thang = p_thang and b.trang_thai = 'da-duyet';
$ham$;

create or replace function public.customer_thi_anh_cua_toi(p_tenant_id uuid, p_identity_digest text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'thang', b.thang, 'dau_ma', b.dau_ma, 'chu_thich', b.chu_thich, 'trang_thai', b.trang_thai,
    'giai', b.giai, 'ma_nhan', b.ma_nhan, 'gui_luc', b.gui_luc
  ) order by b.gui_luc desc), '[]'::jsonb)
  from public.thi_anh_bai b
  join public.customer_identities identity on identity.id = b.identity_id and identity.tenant_id = b.tenant_id
  where b.tenant_id = p_tenant_id and identity.identity_type = 'phone' and identity.identity_digest = p_identity_digest;
$ham$;

create or replace function public.erp_thi_anh_danh_sach(p_tenant_id uuid, p_thang text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'ten', b.ten_hien_thi, 'so', '•••' || b.contact_hint, 'chu_thich', b.chu_thich,
    'dau_ma', b.dau_ma, 'anh_path', b.anh_path, 'trang_thai', b.trang_thai, 'giai', b.giai,
    'ma_nhan', b.ma_nhan, 'gui_luc', b.gui_luc
  ) order by case b.trang_thai when 'cho-duyet' then 0 when 'da-duyet' then 1 else 2 end, b.gui_luc desc), '[]'::jsonb)
  from public.thi_anh_bai b
  where b.tenant_id = p_tenant_id and b.thang = p_thang;
$ham$;

-- Giám đốc duyệt, từ chối hay chấm giải. Mỗi tháng 1 nhất, 1 nhì, 1 ba, 5 khuyến khích.
create or replace function public.erp_thi_anh_duyet(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_id uuid,
  p_trang_thai text,
  p_giai text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_bai public.thi_anh_bai;
  v_giai text := nullif(trim(coalesce(p_giai, '')), '');
  v_tran integer;
begin
  if not public.erp_account_has_active_role(p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null) then
    raise exception using errcode = '42501', message = 'THI_ANH_DIRECTOR_REQUIRED';
  end if;
  if p_trang_thai not in ('da-duyet', 'tu-choi') or (v_giai is not null and p_trang_thai <> 'da-duyet') then
    raise exception using errcode = '22023', message = 'THI_ANH_INPUT_INVALID';
  end if;
  select b.* into v_bai from public.thi_anh_bai b where b.tenant_id = p_tenant_id and b.id = p_id for update;
  if v_bai.id is null then
    raise exception using errcode = 'P0002', message = 'THI_ANH_NOT_FOUND';
  end if;
  if v_giai is not null and v_giai is distinct from v_bai.giai then
    v_tran := case v_giai when 'khuyen-khich' then 5 else 1 end;
    if (
      select count(*) from public.thi_anh_bai b
      where b.tenant_id = p_tenant_id and b.thang = v_bai.thang and b.giai = v_giai and b.id <> v_bai.id
    ) >= v_tran then
      raise exception using errcode = '55000', message = 'THI_ANH_HET_GIAI';
    end if;
  end if;
  update public.thi_anh_bai
  set trang_thai = p_trang_thai,
      giai = v_giai,
      ma_nhan = case
        when v_giai is null then null
        when v_bai.ma_nhan is not null then v_bai.ma_nhan
        else 'GIAI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
      end,
      duyet_boi_account_id = trim(p_actor_account_id),
      duyet_luc = now()
  where id = v_bai.id;
  return jsonb_build_object('id', v_bai.id, 'trang_thai', p_trang_thai, 'giai', v_giai);
end;
$ham$;

-- 4. Khoá cửa -------------------------------------------------------------------------------

revoke all on table public.su_kien, public.su_kien_dang_ky, public.thi_anh_bai from public, anon, authenticated;
revoke all on function public.customer_dinh_danh_so(uuid, text, text, text, boolean, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.su_kien_bam(text) from public, anon, authenticated;
revoke all on function public.su_kien_so_luot(uuid, public.su_kien, uuid) from public, anon, authenticated, service_role;
revoke all on function public.customer_so_noi_bat(uuid) from public, anon, authenticated;
grant execute on function public.customer_so_noi_bat(uuid) to service_role;
revoke all on function public.erp_su_kien_tao(uuid, text, text, text, text, text, uuid, timestamptz, timestamptz, integer, text, text) from public, anon, authenticated;
grant execute on function public.erp_su_kien_tao(uuid, text, text, text, text, text, uuid, timestamptz, timestamptz, integer, text, text) to service_role;
revoke all on function public.customer_su_kien_cong_khai(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_su_kien_cong_khai(uuid, text) to service_role;
revoke all on function public.customer_su_kien_dang_mo(uuid) from public, anon, authenticated;
grant execute on function public.customer_su_kien_dang_mo(uuid) to service_role;
revoke all on function public.customer_su_kien_dang_ky(uuid, text, text, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.customer_su_kien_dang_ky(uuid, text, text, text, text, text, boolean, text, text) to service_role;
revoke all on function public.customer_su_kien_tra(uuid, text, text) from public, anon, authenticated;
grant execute on function public.customer_su_kien_tra(uuid, text, text) to service_role;
revoke all on function public.erp_su_kien_rut(uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_su_kien_rut(uuid, text, text) to service_role;
revoke all on function public.erp_su_kien_danh_sach(uuid) from public, anon, authenticated;
grant execute on function public.erp_su_kien_danh_sach(uuid) to service_role;
revoke all on function public.customer_thi_anh_gui(uuid, text, text, text, text, boolean, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.customer_thi_anh_gui(uuid, text, text, text, text, boolean, text, text, text, text, text, text) to service_role;
revoke all on function public.customer_thi_anh_trung_bay(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_thi_anh_trung_bay(uuid, text) to service_role;
revoke all on function public.customer_thi_anh_cua_toi(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_thi_anh_cua_toi(uuid, text) to service_role;
revoke all on function public.erp_thi_anh_danh_sach(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_thi_anh_danh_sach(uuid, text) to service_role;
revoke all on function public.erp_thi_anh_duyet(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_thi_anh_duyet(uuid, text, uuid, text, text) to service_role;

commit;
