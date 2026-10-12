-- Vé đoàn trả tiền ngay ở quầy, công ty lữ hành, vé mời khách (12/10/2026).
--
-- ## Lời chủ dự án
--
-- "Vé đoàn này không cần người đại diện tên đăng kí hay gì à? Thường sẽ trưởng
-- đoàn là hướng dẫn viên ABC, thuộc công ty ABC cho xuất hoá đơn vé cho công
-- ty và công ty này năm nay đã hợp tác bao nhiêu… có nằm trong diện ưu đãi
-- không." Và: "Thêm option vé mời khách = free thì phải ghi ai là người mời."
-- Quyết định cùng ngày: vé đoàn tính giá người lớn × số người, trừ ưu đãi
-- theo công ty lữ hành, có hoá đơn cho công ty.
--
-- ## Vì sao cần hàm mới
--
-- `erp_create_counter_visitor_group` (migration 063) lập đoàn và cấp mã vào
-- cổng mà KHÔNG thu đồng nào: không có phiếu bán, không vào quỹ ca, không vào
-- doanh thu. Nay một đoàn ở quầy là MỘT phiếu bán (`erp_counter_sales`,
-- `sale_kind = 'group'`): một dòng vé người lớn × số người, một tấm vé
-- `QUAY-…` giữ đủ lượt, và đoàn (`erp_visitor_groups`) treo đúng vào tấm vé
-- ấy. Cổng quét mã đoàn, mã vé hay mã từng người đều trừ cùng một quỹ lượt,
-- nên không có lượt nào bị đếm hai lần. Huỷ phiếu thì vé thành `void`, mã
-- đoàn hết vào được, như mọi phiếu khác.
--
-- Vé mời (`sale_kind = 'comp'`): dòng vé vẫn mang đúng giá bảng giá, phiếu
-- giảm 100% nên tổng 0 đ; vé mang kênh `moi` (đã có nhãn "Khách mời" trong
-- báo cáo kênh bán từ trước). Người mời phải là một tài khoản trong sổ, tên
-- lấy từ sổ chứ không do màn hình gửi lên, kèm lý do.
--
-- ## Ưu đãi công ty
--
-- Bậc theo số đoàn ĐÃ trả trong năm (giờ Việt Nam, trước phiếu đang lập):
-- dưới 5 đoàn 0%, từ 5 đoàn 5%, từ 10 đoàn 8%, từ 20 đoàn 10%. Giám đốc đặt
-- được mức riêng cho một công ty (0–50%), mức riêng thay cho bậc. Tiền giảm
-- làm tròn xuống nghìn đồng. Mọi con số tính trong kho, màn hình chỉ hiện.
--
-- ## Chỉ tiến tới
--
-- Không sửa hàng dữ liệu nào. Cột mới đều có mặc định khớp phiếu cũ
-- (`sale_kind = 'single'`, giảm 0), nên ràng buộc mới tự đúng với mọi phiếu
-- đang có. Hàm cũ giữ nguyên chữ ký; hàm phiếu thu và đối soát cuối ca được
-- thay bằng `create or replace`, chỉ THÊM khoá mới vào kết quả.

begin;

-- 1. Công ty lữ hành ------------------------------------------------------------------

create table if not exists public.erp_travel_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 200),
  tax_code text check (tax_code is null or tax_code ~ '^[0-9]{10}(-[0-9]{3})?$'),
  address text not null default '' check (char_length(address) <= 300),
  invoice_email text check (invoice_email is null or invoice_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^[0-9+ ]{8,16}$'),
  contact_name text not null default '' check (char_length(contact_name) <= 120),
  special_discount_percent integer check (
    special_discount_percent is null or special_discount_percent between 0 and 50
  ),
  created_by_account_id text not null check (char_length(created_by_account_id) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create unique index if not exists erp_travel_companies_name_idx
  on public.erp_travel_companies (tenant_id, lower(trim(name)));
create unique index if not exists erp_travel_companies_tax_idx
  on public.erp_travel_companies (tenant_id, tax_code) where tax_code is not null;

alter table public.erp_travel_companies enable row level security;

-- 2. Phiếu bán biết mình là phiếu lẻ, đoàn hay vé mời ------------------------------------

alter table public.erp_counter_sales
  add column if not exists sale_kind text not null default 'single';
alter table public.erp_counter_sales
  add column if not exists discount_percent integer not null default 0;
alter table public.erp_counter_sales
  add column if not exists discount_vnd bigint not null default 0;
alter table public.erp_counter_sales
  add column if not exists travel_company_id uuid;
alter table public.erp_counter_sales
  add column if not exists group_leader_name text;
alter table public.erp_counter_sales
  add column if not exists group_leader_phone text;
alter table public.erp_counter_sales
  add column if not exists invoice_requested boolean not null default false;
alter table public.erp_counter_sales
  add column if not exists comp_inviter_account_id text;
alter table public.erp_counter_sales
  add column if not exists comp_inviter_name text;
alter table public.erp_counter_sales
  add column if not exists comp_reason text;

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_sale_kind_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_sale_kind_check
  check (sale_kind in ('single', 'group', 'comp'));

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_discount_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_discount_check
  check (discount_percent between 0 and 100 and discount_vnd >= 0);

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_travel_company_fkey;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_travel_company_fkey
  foreign key (travel_company_id, tenant_id)
  references public.erp_travel_companies(id, tenant_id) on delete restrict;

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_comp_inviter_fkey;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_comp_inviter_fkey
  foreign key (comp_inviter_account_id, tenant_id)
  references public.erp_account_registry(account_id, tenant_id) on delete restrict;

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_payment_method_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_payment_method_check
  check (payment_method in ('cash', 'qr-transfer', 'complimentary'));

-- Phiếu lẻ không mang gì của đoàn hay vé mời; đoàn có trưởng đoàn; vé mời 0 đ,
-- có người mời và lý do; chỉ vé mời được dùng cách trả "miễn phí".
alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_kind_shape_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_kind_shape_check
  check (
    (
      sale_kind = 'single'
      and discount_percent = 0 and discount_vnd = 0
      and travel_company_id is null and group_leader_name is null
      and group_leader_phone is null and invoice_requested = false
      and comp_inviter_account_id is null and comp_inviter_name is null and comp_reason is null
      and payment_method <> 'complimentary'
    )
    or (
      sale_kind = 'group'
      and char_length(trim(group_leader_name)) between 2 and 120
      and (group_leader_phone is null or group_leader_phone ~ '^[0-9+ ]{8,16}$')
      and (invoice_requested = false or travel_company_id is not null)
      and comp_inviter_account_id is null and comp_inviter_name is null and comp_reason is null
      and payment_method <> 'complimentary'
    )
    or (
      sale_kind = 'comp'
      and payment_method = 'complimentary'
      and total_vnd = 0 and cash_received_vnd = 0
      and discount_percent = 100
      and comp_inviter_account_id is not null
      and char_length(trim(comp_inviter_name)) between 2 and 120
      and char_length(trim(comp_reason)) between 5 and 300
      and travel_company_id is null and group_leader_name is null
      and invoice_requested = false
    )
  );

create index if not exists erp_counter_sales_company_idx
  on public.erp_counter_sales (tenant_id, travel_company_id, sold_at)
  where travel_company_id is not null;

-- Khoá sửa phiếu biết thêm cột mới: chỉ được đi đúng một bước sang `voided`.
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
       new.cash_counted_confirmed, new.request_key, new.created_at,
       new.sale_kind, new.discount_percent, new.discount_vnd, new.travel_company_id,
       new.group_leader_name, new.group_leader_phone, new.invoice_requested,
       new.comp_inviter_account_id, new.comp_inviter_name, new.comp_reason
     ) is distinct from (
       old.id, old.tenant_id, old.site_id, old.sale_code, old.sold_by_account_id,
       old.sold_by_name, old.acting_director_account_id, old.sold_at,
       old.business_date, old.payment_method, old.payment_reference, old.adults,
       old.children, old.total_vnd, old.cash_received_vnd,
       old.cash_counted_confirmed, old.request_key, old.created_at,
       old.sale_kind, old.discount_percent, old.discount_vnd, old.travel_company_id,
       old.group_leader_name, old.group_leader_phone, old.invoice_requested,
       old.comp_inviter_account_id, old.comp_inviter_name, old.comp_reason
     ) then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
  end if;
  return new;
end;
$ham$;

-- 3. Ưu đãi và lịch sử của một công ty ----------------------------------------------------

create or replace function public.erp_travel_company_standing(
  p_tenant_id uuid,
  p_company_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with nam as (
    select date_trunc('year', (now() at time zone 'Asia/Ho_Chi_Minh'))::date as dau
  ),
  doan as (
    select sale.*
    from public.erp_counter_sales sale, nam
    where sale.tenant_id = p_tenant_id
      and sale.travel_company_id = p_company_id
      and sale.sale_kind = 'group'
      and sale.status = 'completed'
      and sale.business_date >= nam.dau
  ),
  dem as (
    select count(*)::integer as so_doan,
           coalesce(sum(doan.adults + doan.children), 0)::integer as so_khach,
           coalesce(sum(doan.total_vnd), 0)::bigint as tien
    from doan
  ),
  bac as (
    select case
             when dem.so_doan >= 20 then 10
             when dem.so_doan >= 10 then 8
             when dem.so_doan >= 5 then 5
             else 0
           end as phan_tram,
           case
             when dem.so_doan >= 20 then null
             when dem.so_doan >= 10 then 20
             when dem.so_doan >= 5 then 10
             else 5
           end as moc_ke
    from dem
  )
  select jsonb_build_object(
    'company_id', company.id,
    'name', company.name,
    'tax_code', company.tax_code,
    'address', company.address,
    'invoice_email', company.invoice_email,
    'phone', company.phone,
    'contact_name', company.contact_name,
    'special_discount_percent', company.special_discount_percent,
    'groups_this_year', dem.so_doan,
    'guests_this_year', dem.so_khach,
    'revenue_this_year_vnd', dem.tien,
    'tier_percent', bac.phan_tram,
    'next_tier_at', bac.moc_ke,
    'discount_percent', coalesce(company.special_discount_percent, bac.phan_tram),
    'groups_all_time', (
      select count(*) from public.erp_counter_sales sale
      where sale.tenant_id = p_tenant_id and sale.travel_company_id = company.id
        and sale.sale_kind = 'group' and sale.status = 'completed'
    ),
    'last_group_at', (
      select max(sale.sold_at) from public.erp_counter_sales sale
      where sale.tenant_id = p_tenant_id and sale.travel_company_id = company.id
        and sale.sale_kind = 'group' and sale.status = 'completed'
    )
  )
  from public.erp_travel_companies company, dem, bac
  where company.tenant_id = p_tenant_id and company.id = p_company_id;
$ham$;

create or replace function public.erp_travel_companies_list(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(
    jsonb_agg(public.erp_travel_company_standing(p_tenant_id, company.id) order by lower(company.name)),
    '[]'::jsonb
  )
  from public.erp_travel_companies company
  where company.tenant_id = p_tenant_id;
$ham$;

create or replace function public.erp_travel_company_history(
  p_tenant_id uuid,
  p_company_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(row_data order by sold_at desc), '[]'::jsonb)
  from (
    select sale.sold_at,
           jsonb_build_object(
             'sale_code', sale.sale_code,
             'site_id', sale.site_id,
             'sold_at', sale.sold_at,
             'business_date', sale.business_date,
             'guests', sale.adults + sale.children,
             'total_vnd', sale.total_vnd,
             'discount_percent', sale.discount_percent,
             'discount_vnd', sale.discount_vnd,
             'group_leader_name', sale.group_leader_name,
             'invoice_requested', sale.invoice_requested,
             'status', sale.status
           ) as row_data
    from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.travel_company_id = p_company_id
      and sale.sale_kind = 'group'
    order by sale.sold_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) rows;
$ham$;

-- Thêm công ty: ai bán được vé ở một cơ sở là thêm được, vì trưởng đoàn đứng
-- ngay trước quầy. Trùng tên hay trùng mã số thuế thì trả lại công ty đã có.
create or replace function public.erp_create_travel_company(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_name text,
  p_tax_code text,
  p_address text,
  p_invoice_email text,
  p_phone text,
  p_contact_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_tax text := nullif(trim(coalesce(p_tax_code, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_invoice_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_company public.erp_travel_companies;
begin
  if p_tenant_id is null or p_site_id is null or char_length(v_name) not between 2 and 200
     or (v_tax is not null and v_tax !~ '^[0-9]{10}(-[0-9]{3})?$')
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     or (v_phone is not null and v_phone !~ '^[0-9+ ]{8,16}$')
     or char_length(coalesce(p_address, '')) > 300
     or char_length(coalesce(p_contact_name, '')) > 120 then
    raise exception using errcode = '22023', message = 'TRAVEL_COMPANY_INPUT_INVALID';
  end if;
  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;

  select * into v_company from public.erp_travel_companies company
  where company.tenant_id = p_tenant_id
    and (lower(trim(company.name)) = lower(v_name) or (v_tax is not null and company.tax_code = v_tax))
  limit 1;
  if v_company.id is null then
    insert into public.erp_travel_companies (
      tenant_id, name, tax_code, address, invoice_email, phone, contact_name, created_by_account_id
    ) values (
      p_tenant_id, v_name, v_tax, trim(coalesce(p_address, '')), v_email, v_phone,
      trim(coalesce(p_contact_name, '')), v_actor
    ) returning * into v_company;
  end if;
  return public.erp_travel_company_standing(p_tenant_id, v_company.id);
end;
$ham$;

-- Mức ưu đãi riêng: chỉ giám đốc. `null` là về lại bậc theo số đoàn.
create or replace function public.erp_set_travel_company_discount(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_company_id uuid,
  p_percent integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  if p_percent is not null and p_percent not between 0 and 50 then
    raise exception using errcode = '22023', message = 'TRAVEL_COMPANY_INPUT_INVALID';
  end if;
  if not public.erp_account_has_active_role(p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null) then
    raise exception using errcode = '42501', message = 'TRAVEL_COMPANY_DISCOUNT_DIRECTOR_ONLY';
  end if;
  update public.erp_travel_companies company
  set special_discount_percent = p_percent, updated_at = now()
  where company.tenant_id = p_tenant_id and company.id = p_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAVEL_COMPANY_NOT_FOUND';
  end if;
  return public.erp_travel_company_standing(p_tenant_id, p_company_id);
end;
$ham$;

-- 4. Phiếu thu mang thêm loại phiếu, giảm giá, công ty, trưởng đoàn, người mời ------------

create or replace function public.erp_counter_sale_receipt(
  p_tenant_id uuid,
  p_sale_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select jsonb_build_object(
    'sale_code', sale.sale_code,
    'site_id', sale.site_id,
    'sold_by_account_id', sale.sold_by_account_id,
    'sold_by_name', sale.sold_by_name,
    'acting_director_account_id', sale.acting_director_account_id,
    'sold_at', sale.sold_at,
    'business_date', sale.business_date,
    'payment_method', sale.payment_method,
    'payment_reference', sale.payment_reference,
    'adults', sale.adults,
    'children', sale.children,
    'total_vnd', sale.total_vnd,
    'cash_received_vnd', sale.cash_received_vnd,
    'change_vnd', sale.change_vnd,
    'status', sale.status,
    'voided_by_name', sale.voided_by_name,
    'voided_at', sale.voided_at,
    'void_reason', sale.void_reason,
    'sale_kind', sale.sale_kind,
    'discount_percent', sale.discount_percent,
    'discount_vnd', sale.discount_vnd,
    'group_leader_name', sale.group_leader_name,
    'group_leader_phone', sale.group_leader_phone,
    'invoice_requested', sale.invoice_requested,
    'comp_inviter_name', sale.comp_inviter_name,
    'comp_reason', sale.comp_reason,
    'travel_company', (
      select jsonb_build_object(
        'id', company.id, 'name', company.name, 'tax_code', company.tax_code,
        'address', company.address, 'invoice_email', company.invoice_email
      )
      from public.erp_travel_companies company
      where company.id = sale.travel_company_id and company.tenant_id = sale.tenant_id
    ),
    'group_code', (
      select grp.group_code
      from public.erp_counter_sale_lines line
      join public.erp_visitor_groups grp
        on grp.ticket_id = line.ticket_id and grp.tenant_id = line.tenant_id
      where line.tenant_id = sale.tenant_id and line.sale_id = sale.id
      limit 1
    ),
    'lines', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product', line.product,
            'quantity', line.quantity,
            'unit_price_vnd', line.unit_price_vnd,
            'line_total_vnd', line.line_total_vnd,
            'ticket_code', ticket.ticket_code,
            'entries_allowed', ticket.entries_allowed,
            'entries_used', ticket.entries_used,
            'ticket_status', ticket.status
          )
          order by line.product
        )
        from public.erp_counter_sale_lines line
        join public.erp_tickets ticket
          on ticket.id = line.ticket_id and ticket.tenant_id = line.tenant_id
        where line.tenant_id = sale.tenant_id and line.sale_id = sale.id
      ),
      '[]'::jsonb
    )
  )
  from public.erp_counter_sales sale
  where sale.tenant_id = p_tenant_id and sale.id = p_sale_id;
$ham$;

-- 5. Đối soát cuối ca: vé mời tách riêng, không lẫn vào tiền --------------------------------

create or replace function public.erp_shift_counter_cash(
  p_tenant_id uuid,
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with in_window as (
    select sale.*
    from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id
      and sale.site_id = p_site_id
      and sale.sold_at >= p_from
      and sale.sold_at < p_to
  ),
  per_seller as (
    select
      sale.sold_by_account_id as account_id,
      max(sale.sold_by_name) as display_name,
      count(*) as sale_count,
      sum(sale.total_vnd) as total_vnd,
      coalesce(sum(sale.total_vnd) filter (where sale.payment_method = 'cash'), 0) as cash_vnd,
      coalesce(sum(sale.total_vnd) filter (where sale.payment_method = 'qr-transfer'), 0) as qr_vnd
    from in_window sale
    where sale.status = 'completed'
    group by 1
  )
  select jsonb_build_object(
    'sale_count', (select count(*) from in_window where status = 'completed' and payment_method = 'cash'),
    'total_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'completed' and payment_method = 'cash'),
    'qr_count', (select count(*) from in_window where status = 'completed' and payment_method = 'qr-transfer'),
    'qr_total_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'completed' and payment_method = 'qr-transfer'),
    'voided_count', (select count(*) from in_window where status = 'voided'),
    'voided_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'voided'),
    'comp_count', (select count(*) from in_window where status = 'completed' and sale_kind = 'comp'),
    'comp_guests', (select coalesce(sum(adults + children), 0) from in_window where status = 'completed' and sale_kind = 'comp'),
    'group_count', (select count(*) from in_window where status = 'completed' and sale_kind = 'group'),
    'discount_vnd', (select coalesce(sum(discount_vnd), 0) from in_window where status = 'completed' and sale_kind = 'group'),
    'sellers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'account_id', per_seller.account_id,
            'display_name', per_seller.display_name,
            'count', per_seller.sale_count,
            'total_vnd', per_seller.cash_vnd,
            'qr_total_vnd', per_seller.qr_vnd
          )
          order by per_seller.total_vnd desc, per_seller.account_id
        )
        from per_seller
      ),
      '[]'::jsonb
    )
  );
$ham$;

-- 6. Bán vé đoàn ---------------------------------------------------------------------------

create or replace function public.erp_create_counter_group_sale(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_party_size integer,
  p_group_label text,
  p_leader_name text,
  p_leader_phone text,
  p_travel_company_id uuid,
  p_invoice_requested boolean,
  p_payment_method text,
  p_cash_received_vnd bigint,
  p_payment_reference text,
  p_cash_counted_confirmed boolean,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_key text := nullif(trim(coalesce(p_request_key, '')), '');
  v_method text := trim(coalesce(p_payment_method, ''));
  v_reference text := nullif(upper(trim(coalesce(p_payment_reference, ''))), '');
  v_label text := trim(coalesce(p_group_label, ''));
  v_leader text := regexp_replace(trim(coalesce(p_leader_name, '')), '\s+', ' ', 'g');
  v_phone text := nullif(regexp_replace(trim(coalesce(p_leader_phone, '')), '\s+', '', 'g'), '');
  v_invoice boolean := coalesce(p_invoice_requested, false);
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_existing public.erp_counter_sales;
  v_sale public.erp_counter_sales;
  v_ticket public.erp_tickets;
  v_group public.erp_visitor_groups;
  v_price public.erp_counter_price_list;
  v_company public.erp_travel_companies;
  v_percent integer := 0;
  v_subtotal bigint;
  v_discount bigint;
  v_total bigint;
  v_received bigint;
  v_index integer;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or p_party_size is null or p_party_size not between 2 and 45
     or char_length(v_leader) not between 2 and 120
     or (v_phone is not null and v_phone !~ '^\+?[0-9]{8,15}$')
     or char_length(v_label) > 120
     or (v_invoice and p_travel_company_id is null)
     or v_key is null or char_length(v_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'GROUP_SALE_INPUT_INVALID';
  end if;

  if v_method not in ('cash', 'qr-transfer')
     or (v_method = 'cash' and (p_cash_received_vnd is null or p_cash_received_vnd not between 0 and 1000000000))
     or (v_reference is not null and v_reference !~ '^[A-Z0-9-]{4,40}$') then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_PAYMENT_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;

  select * into v_existing from public.erp_counter_sales sale
  where sale.tenant_id = p_tenant_id and sale.request_key = v_key;
  if v_existing.id is not null then
    if v_existing.sold_by_account_id <> v_actor_id or v_existing.site_id <> p_site_id
       or v_existing.sale_kind <> 'group' then
      raise exception using errcode = '22023', message = 'GROUP_SALE_INPUT_INVALID';
    end if;
    return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
  end if;

  if coalesce(p_cash_counted_confirmed, false) is not true then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_NOT_CONFIRMED';
  end if;

  if p_travel_company_id is not null then
    select * into v_company from public.erp_travel_companies company
    where company.tenant_id = p_tenant_id and company.id = p_travel_company_id;
    if v_company.id is null then
      raise exception using errcode = 'P0002', message = 'TRAVEL_COMPANY_NOT_FOUND';
    end if;
    v_percent := coalesce(
      (public.erp_travel_company_standing(p_tenant_id, v_company.id) ->> 'discount_percent')::integer,
      0
    );
  end if;

  select * into v_price from public.erp_counter_price_list list
  where list.tenant_id = p_tenant_id and list.site_id = p_site_id
    and list.product = 'adult' and list.effective_from <= v_today
  order by list.effective_from desc, list.revision desc
  limit 1;
  if v_price.id is null then
    raise exception using errcode = 'P0002', message = 'COUNTER_SALE_PRICE_MISSING';
  end if;

  v_subtotal := v_price.unit_price_vnd::bigint * p_party_size;
  v_discount := ((v_subtotal * v_percent / 100) / 1000) * 1000;
  v_total := v_subtotal - v_discount;
  v_received := case when v_method = 'qr-transfer' then v_total else p_cash_received_vnd end;
  if v_received < v_total then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_SHORT';
  end if;

  insert into public.erp_counter_sales (
    tenant_id, site_id, sale_code, sold_by_account_id, sold_by_name,
    acting_director_account_id, business_date, payment_method, payment_reference,
    adults, children, total_vnd, cash_received_vnd, cash_counted_confirmed, request_key,
    sale_kind, discount_percent, discount_vnd, travel_company_id, group_leader_name,
    group_leader_phone, invoice_requested
  ) values (
    p_tenant_id, p_site_id,
    'PT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_actor_id, v_actor_name, v_director, v_today, v_method, v_reference,
    p_party_size, 0, v_total, v_received, true, v_key,
    'group', v_percent, v_discount, v_company.id, v_leader, v_phone, v_invoice
  ) returning * into v_sale;

  insert into public.erp_tickets (
    tenant_id, site_id, ticket_code, product, channel, valid_on, entries_allowed,
    booking_reference
  ) values (
    p_tenant_id, p_site_id,
    'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    'group', 'quay-ve', v_today, p_party_size, v_sale.sale_code
  ) returning * into v_ticket;

  insert into public.erp_counter_sale_lines (
    tenant_id, sale_id, product, quantity, unit_price_vnd, line_total_vnd,
    price_list_id, ticket_id
  ) values (
    p_tenant_id, v_sale.id, 'adult', p_party_size, v_price.unit_price_vnd,
    v_subtotal, v_price.id, v_ticket.id
  );

  insert into public.erp_visitor_groups (
    tenant_id, ticket_id, group_code, group_label, leader_name, leader_phone,
    member_count, counter_request_key
  ) values (
    p_tenant_id, v_ticket.id,
    'DOAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    left(coalesce(nullif(v_label, ''), coalesce(v_company.name || ' · ', '') || v_leader), 120),
    v_leader, coalesce(v_phone, ''), p_party_size, v_key
  ) returning * into v_group;

  for v_index in 1 .. p_party_size loop
    insert into public.erp_visitor_group_members (
      tenant_id, group_id, member_index, member_code, guest_group
    ) values (
      p_tenant_id, v_group.id, v_index,
      'TV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      'adult'
    );
  end loop;

  insert into public.erp_counter_sale_events (
    tenant_id, site_id, sale_id, event_type, actor_account_id, actor_display_name,
    acting_director_account_id, amount_vnd, note
  ) values (
    p_tenant_id, p_site_id, v_sale.id, 'counter-sale.completed', v_actor_id, v_actor_name,
    v_director, v_total,
    left(
      format('Bán vé đoàn %s người, trưởng đoàn %s', p_party_size, v_leader)
        || coalesce(', công ty ' || v_company.name, '')
        || case when v_discount > 0 then format(', ưu đãi %s%% (giảm %s đ)', v_percent, v_discount) else '' end
        || case when v_invoice then ', xuất hoá đơn cho công ty' else '' end
        || '. '
        || case when v_method = 'qr-transfer'
             then 'Chuyển khoản QR ' || v_total || ' đ' || coalesce(', nội dung ' || v_reference, '') || '.'
             else 'Tiền mặt: nhận ' || v_received || ' đ, thối ' || (v_received - v_total) || ' đ.' end
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_counter_sale_receipt(p_tenant_id, v_sale.id);

exception
  when unique_violation then
    select * into v_existing from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.request_key = v_key;
    if v_existing.id is not null
       and v_existing.sold_by_account_id = v_actor_id
       and v_existing.site_id = p_site_id then
      return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
    end if;
    raise;
end;
$ham$;

-- 7. Vé mời ----------------------------------------------------------------------------------

create or replace function public.erp_create_counter_comp_sale(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_adults integer,
  p_children integer,
  p_inviter_account_id text,
  p_reason text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_key text := nullif(trim(coalesce(p_request_key, '')), '');
  v_inviter_id text := trim(coalesce(p_inviter_account_id, ''));
  v_reason text := regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g');
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_inviter public.erp_account_registry;
  v_existing public.erp_counter_sales;
  v_sale public.erp_counter_sales;
  v_ticket public.erp_tickets;
  v_price public.erp_counter_price_list;
  v_subtotal bigint := 0;
  v_product text;
  v_quantity integer;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or p_adults is null or p_adults not between 0 and 20
     or p_children is null or p_children not between 0 and 20
     or p_adults + p_children not between 1 and 20
     or char_length(v_reason) not between 5 and 300
     or v_key is null or char_length(v_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'COMP_SALE_INPUT_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;

  -- Người mời là một tài khoản đang hoạt động; tên lấy từ sổ, không lấy từ màn hình.
  select * into v_inviter from public.erp_account_registry registry
  where registry.tenant_id = p_tenant_id and registry.account_id = v_inviter_id
    and registry.status = 'active';
  if v_inviter.account_id is null then
    raise exception using errcode = '22023', message = 'COMP_SALE_INVITER_INVALID';
  end if;

  select * into v_existing from public.erp_counter_sales sale
  where sale.tenant_id = p_tenant_id and sale.request_key = v_key;
  if v_existing.id is not null then
    if v_existing.sold_by_account_id <> v_actor_id or v_existing.site_id <> p_site_id
       or v_existing.sale_kind <> 'comp' then
      raise exception using errcode = '22023', message = 'COMP_SALE_INPUT_INVALID';
    end if;
    return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
  end if;

  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc, list.revision desc
      limit 1;
      if v_price.id is null then
        raise exception using errcode = 'P0002', message = 'COUNTER_SALE_PRICE_MISSING';
      end if;
      v_subtotal := v_subtotal + v_price.unit_price_vnd::bigint * v_quantity;
      v_price := null;
    end if;
  end loop;

  insert into public.erp_counter_sales (
    tenant_id, site_id, sale_code, sold_by_account_id, sold_by_name,
    acting_director_account_id, business_date, payment_method, payment_reference,
    adults, children, total_vnd, cash_received_vnd, cash_counted_confirmed, request_key,
    sale_kind, discount_percent, discount_vnd, comp_inviter_account_id, comp_inviter_name, comp_reason
  ) values (
    p_tenant_id, p_site_id,
    'PT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_actor_id, v_actor_name, v_director, v_today, 'complimentary', null,
    p_adults, p_children, 0, 0, true, v_key,
    'comp', 100, v_subtotal, v_inviter.account_id, v_inviter.display_name, v_reason
  ) returning * into v_sale;

  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc, list.revision desc
      limit 1;

      insert into public.erp_tickets (
        tenant_id, site_id, ticket_code, product, channel, valid_on, entries_allowed,
        booking_reference
      ) values (
        p_tenant_id, p_site_id,
        'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        v_product, 'moi', v_today, v_quantity, v_sale.sale_code
      ) returning * into v_ticket;

      insert into public.erp_counter_sale_lines (
        tenant_id, sale_id, product, quantity, unit_price_vnd, line_total_vnd,
        price_list_id, ticket_id
      ) values (
        p_tenant_id, v_sale.id, v_product, v_quantity, v_price.unit_price_vnd,
        v_price.unit_price_vnd::bigint * v_quantity, v_price.id, v_ticket.id
      );
      v_price := null;
    end if;
  end loop;

  insert into public.erp_counter_sale_events (
    tenant_id, site_id, sale_id, event_type, actor_account_id, actor_display_name,
    acting_director_account_id, amount_vnd, note
  ) values (
    p_tenant_id, p_site_id, v_sale.id, 'counter-sale.completed', v_actor_id, v_actor_name,
    v_director, 0,
    left(
      format('Vé mời %s người lớn, %s trẻ em (trị giá %s đ). Người mời: %s. Lý do: %s',
             p_adults, p_children, v_subtotal, v_inviter.display_name, v_reason)
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_counter_sale_receipt(p_tenant_id, v_sale.id);

exception
  when unique_violation then
    select * into v_existing from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.request_key = v_key;
    if v_existing.id is not null
       and v_existing.sold_by_account_id = v_actor_id
       and v_existing.site_id = p_site_id then
      return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
    end if;
    raise;
end;
$ham$;

-- 8. Khoá cửa ------------------------------------------------------------------------------

revoke all on table public.erp_travel_companies from public, anon, authenticated;

revoke all on function public.erp_counter_sale_guard_update() from public, anon, authenticated, service_role;

revoke all on function public.erp_travel_company_standing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_travel_company_standing(uuid, uuid) to service_role;
revoke all on function public.erp_travel_companies_list(uuid) from public, anon, authenticated;
grant execute on function public.erp_travel_companies_list(uuid) to service_role;
revoke all on function public.erp_travel_company_history(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.erp_travel_company_history(uuid, uuid, integer) to service_role;
revoke all on function public.erp_create_travel_company(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_create_travel_company(uuid, uuid, text, text, text, text, text, text, text) to service_role;
revoke all on function public.erp_set_travel_company_discount(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.erp_set_travel_company_discount(uuid, text, uuid, integer) to service_role;
revoke all on function public.erp_create_counter_group_sale(
  uuid, uuid, text, text, text, integer, text, text, text, uuid, boolean, text, bigint, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.erp_create_counter_group_sale(
  uuid, uuid, text, text, text, integer, text, text, text, uuid, boolean, text, bigint, text, boolean, text
) to service_role;
revoke all on function public.erp_create_counter_comp_sale(
  uuid, uuid, text, text, text, integer, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_create_counter_comp_sale(
  uuid, uuid, text, text, text, integer, integer, text, text, text
) to service_role;

commit;
