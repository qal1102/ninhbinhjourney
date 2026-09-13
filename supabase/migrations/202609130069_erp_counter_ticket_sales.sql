-- QA-ERP-POS-04 · 13/09/2026
--
-- Bán vé tại quầy: nhân viên ra đơn ngay trên ERP, thu tiền mặt, phát vé QR và
-- in phiếu thu cho khách.
--
-- ## Lời chủ dự án
--
-- "tại sao không có option bán vé ở kiểu nhân viên làm 1 lệnh bán vé trên hệ
-- thống ERP thay vì chỉ có bán vé ở web. Vd thu tiền mặt bao nhiêu phải có
-- option kiểm tra bằng tay và chắc chắn đã nhập vào quỹ mới nhấn xác nhận, nếu
-- sai xót nhân viên tự chịu trách nhiệm." Rồi chốt thêm: giá do bên kỹ thuật
-- tự đặt một mức hợp lý, nhân viên chỉ chọn số vé; quản lý được huỷ vé; quầy
-- đưa QR và in được tờ giấy cho khách.
--
-- ## Trước migration này, đã đọc thẳng trong mã, không đoán
--
-- Quầy chỉ có hai lối và không lối nào là bán vé: `erp_collect_on_site_payment`
-- (057) thu tiền cho một đơn **đã đặt trên web**, còn
-- `erp_create_counter_visitor_group` (063) lập phiếu đoàn **không có tiền**.
-- `erp_tickets` không có cột giá, nên một lệnh bán cũng không có gì để tính.
-- Màn hình đối soát cuối ca tự nói thẳng "tiền bán ở quầy chưa vào sổ từng
-- khoản, nên chưa có gì để đối chiếu". Migration này lấp đúng chỗ đó.
--
-- ## Bốn quyết định, mỗi cái một lý do
--
-- 1. **Giá nằm trong bảng, có ngày hiệu lực — không ghi chết trong mã.**
--    Quy tắc kế toán của dự án (`docs/reference/ERP_ACCOUNTING_REQUIREMENTS_VI.md`
--    §2) cấm đóng cứng mức giá, ngưỡng hay ngày hiệu lực. Đổi giá là thêm một
--    hàng mới có `effective_from` muộn hơn; hàng cũ ở lại làm lịch sử, nên phiếu
--    bán hôm qua vẫn trỏ đúng mức giá của hôm qua. Bảng chỉ ghi thêm.
--
--    Mức giá gieo sẵn dưới đây là **mức em tự ước lượng theo lời chủ dự án**,
--    không phải giá niêm yết của đơn vị vận hành nào. Trẻ dưới 1m3 là 0 đồng,
--    đúng quy tắc TC-03 đang áp cho web — không dựng một quy tắc thứ hai.
--
-- 2. **Máy chủ tự tính tiền.** Màn hình chỉ gửi số vé và số tiền khách đưa.
--    Tổng tiền tính lại ở đây từ bảng giá, không tin con số nào gửi lên.
--
-- 3. **Không tick "đã đếm và bỏ vào quỹ" thì không bán được.** Cột
--    `cash_counted_confirmed` bắt buộc bằng `true` ngay ở ràng buộc bảng, nên
--    không có đường nào lưu một phiếu mà người bán chưa nhận trách nhiệm về
--    số tiền. Mỗi phiếu giữ ai bán, lúc nào, bao nhiêu, và nếu là giám đốc thao
--    tác lúc "xem thử" thì giữ luôn tên giám đốc thật.
--
-- 4. **Huỷ là một bước có người chịu trách nhiệm, không phải xoá.** Chỉ quản
--    lý cơ sở hoặc giám đốc được huỷ; phải ghi lý do; không ai huỷ được phiếu
--    do chính mình bán (tách người lập với người duyệt); vé đã quét qua cổng
--    thì không huỷ được; và chỉ huỷ trong đúng ngày bán — phiếu ngày trước đã
--    vào chốt ca, sửa nó ở đây là làm lệch một con số đã được xác nhận. Huỷ
--    đổi trạng thái phiếu và vé thành `voided`/`void`, ghi một dòng sự kiện,
--    không xoá hàng nào.
--
-- ## Tờ in cho khách là PHIẾU THU, không phải hoá đơn
--
-- Hoá đơn là chứng từ theo Nghị định 123/2020/NĐ-CP và 70/2025/NĐ-CP, phải đi
-- qua hệ thống hoá đơn điện tử. Dự án chưa nối hệ thống nào như vậy, nên tờ in
-- chỉ được là phiếu thu bán vé, và phải tự ghi rõ như thế.
--
-- ## Cố ý chưa làm
--
-- Bán tại quầy KHÔNG trừ sức chứa khung giờ (T11a), giống phiếu đoàn quầy của
-- TC-18: quầy bán cho người đang đứng trước cổng, không giữ chỗ trước. Chỉ nhận
-- tiền mặt; chuyển khoản, thẻ, QR ngân hàng là việc sau. Chưa có màn hình để
-- giám đốc sửa bảng giá — hiện đổi giá bằng một migration thêm hàng mới.
--
-- ## Chỉ tiến tới
--
-- Chỉ thêm bảng, hàm và một nhánh trong `erp_audit_timeline`. Không sửa hay
-- xoá hàng dữ liệu nào đang có. Hàm nhật ký giữ nguyên chữ ký, thân hàm chép
-- nguyên văn từ `202608030033` và chỉ thêm đúng một nhánh `union all`.

begin;

-- 1. Bảng giá quầy ------------------------------------------------------------

create table if not exists public.erp_counter_price_list (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  product text not null check (product in ('adult', 'child')),
  unit_price_vnd integer not null check (unit_price_vnd between 0 and 10000000),
  effective_from date not null,
  note text not null default '' check (char_length(note) <= 500),
  created_by_account_id text not null check (char_length(created_by_account_id) between 2 and 100),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, site_id, product, effective_from)
);

-- 2. Phiếu bán ------------------------------------------------------------------

create table if not exists public.erp_counter_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  sale_code text not null check (sale_code ~ '^PT-[0-9A-F]{12}$'),
  sold_by_account_id text not null,
  sold_by_name text not null check (char_length(sold_by_name) between 1 and 200),
  acting_director_account_id text check (
    acting_director_account_id is null or char_length(acting_director_account_id) between 2 and 100
  ),
  sold_at timestamptz not null default now(),
  business_date date not null,
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  adults integer not null check (adults between 0 and 45),
  children integer not null check (children between 0 and 45),
  total_vnd bigint not null check (total_vnd >= 0),
  cash_received_vnd bigint not null check (cash_received_vnd between 0 and 1000000000),
  change_vnd bigint generated always as (cash_received_vnd - total_vnd) stored,
  -- Người bán nhận trách nhiệm về số tiền trước khi phiếu được lưu.
  cash_counted_confirmed boolean not null check (cash_counted_confirmed),
  request_key text not null check (char_length(request_key) between 8 and 128),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  voided_by_account_id text,
  voided_by_name text,
  voided_acting_director_account_id text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, sale_code),
  unique (tenant_id, request_key),
  foreign key (sold_by_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id) on delete restrict,
  check (adults + children between 1 and 45),
  check (cash_received_vnd >= total_vnd),
  check (
    (
      status = 'completed'
      and voided_by_account_id is null and voided_by_name is null
      and voided_acting_director_account_id is null
      and voided_at is null and void_reason is null
    )
    or (
      status = 'voided'
      and voided_by_account_id is not null and voided_by_name is not null
      and voided_at is not null
      and char_length(trim(void_reason)) between 10 and 500
    )
  ),
  -- Không ai huỷ được phiếu do chính mình bán.
  check (voided_by_account_id is null or voided_by_account_id <> sold_by_account_id)
);

create index if not exists erp_counter_sales_site_day_idx
  on public.erp_counter_sales (tenant_id, site_id, business_date, sold_at desc);
create index if not exists erp_counter_sales_site_sold_at_idx
  on public.erp_counter_sales (tenant_id, site_id, sold_at);

-- 3. Dòng phiếu: mỗi loại khách một tấm vé, mang đúng mức giá lúc bán ---------

create table if not exists public.erp_counter_sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null,
  product text not null check (product in ('adult', 'child')),
  quantity integer not null check (quantity between 1 and 45),
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  line_total_vnd bigint not null check (line_total_vnd >= 0),
  price_list_id uuid not null,
  ticket_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (sale_id, tenant_id)
    references public.erp_counter_sales(id, tenant_id) on delete restrict,
  foreign key (price_list_id, tenant_id)
    references public.erp_counter_price_list(id, tenant_id) on delete restrict,
  foreign key (ticket_id, tenant_id)
    references public.erp_tickets(id, tenant_id) on delete restrict,
  unique (tenant_id, sale_id, product),
  unique (tenant_id, ticket_id),
  check (line_total_vnd = unit_price_vnd::bigint * quantity)
);

-- 4. Sự kiện: chỉ ghi thêm, và hiện trong Nhật ký hệ thống -----------------------

create table if not exists public.erp_counter_sale_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  sale_id uuid not null,
  event_type text not null check (event_type in ('counter-sale.completed', 'counter-sale.voided')),
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_display_name text,
  actor_job_title text,
  actor_site_scope text,
  actor_snapshot_at_write boolean not null default true,
  acting_director_account_id text,
  amount_vnd bigint not null check (amount_vnd >= 0),
  note text check (note is null or char_length(note) <= 600),
  occurred_at timestamptz not null default now(),
  foreign key (sale_id, tenant_id)
    references public.erp_counter_sales(id, tenant_id) on delete restrict
);

create index if not exists erp_counter_sale_events_sale_idx
  on public.erp_counter_sale_events (tenant_id, sale_id, occurred_at);

drop trigger if exists erp_counter_sale_events_actor_snapshot on public.erp_counter_sale_events;
create trigger erp_counter_sale_events_actor_snapshot
  before insert on public.erp_counter_sale_events
  for each row execute function public.erp_audit_fill_actor_snapshot();

-- 5. Khoá cứng: bảng giá, dòng phiếu, sự kiện không sửa không xoá; phiếu chỉ được
--    đi đúng một bước từ `completed` sang `voided` --------------------------------

create or replace function public.erp_counter_sale_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
end;
$$;

drop trigger if exists erp_counter_price_list_append_only on public.erp_counter_price_list;
create trigger erp_counter_price_list_append_only
  before update or delete on public.erp_counter_price_list
  for each row execute function public.erp_counter_sale_append_only();

drop trigger if exists erp_counter_sale_lines_append_only on public.erp_counter_sale_lines;
create trigger erp_counter_sale_lines_append_only
  before update or delete on public.erp_counter_sale_lines
  for each row execute function public.erp_counter_sale_append_only();

drop trigger if exists erp_counter_sale_events_append_only on public.erp_counter_sale_events;
create trigger erp_counter_sale_events_append_only
  before update or delete on public.erp_counter_sale_events
  for each row execute function public.erp_counter_sale_append_only();

create or replace function public.erp_counter_sale_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
  end if;
  if old.status <> 'completed' or new.status <> 'voided'
     or (
       new.id, new.tenant_id, new.site_id, new.sale_code, new.sold_by_account_id,
       new.sold_by_name, new.acting_director_account_id, new.sold_at,
       new.business_date, new.payment_method, new.adults, new.children,
       new.total_vnd, new.cash_received_vnd, new.cash_counted_confirmed,
       new.request_key, new.created_at
     ) is distinct from (
       old.id, old.tenant_id, old.site_id, old.sale_code, old.sold_by_account_id,
       old.sold_by_name, old.acting_director_account_id, old.sold_at,
       old.business_date, old.payment_method, old.adults, old.children,
       old.total_vnd, old.cash_received_vnd, old.cash_counted_confirmed,
       old.request_key, old.created_at
     ) then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';
  end if;
  return new;
end;
$$;

drop trigger if exists erp_counter_sales_guard_update on public.erp_counter_sales;
create trigger erp_counter_sales_guard_update
  before update or delete on public.erp_counter_sales
  for each row execute function public.erp_counter_sale_guard_update();

-- 6. Gieo bảng giá ban đầu -------------------------------------------------------
--
-- Mức em tự ước lượng, xem đầu tệp. Trẻ dưới 1m3 miễn phí theo TC-03.

insert into public.erp_counter_price_list (
  tenant_id, site_id, product, unit_price_vnd, effective_from, note, created_by_account_id
) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'adult', 250000, date '2026-09-13', 'Giá khởi tạo cho quầy Tràng An, chờ giám đốc xác nhận.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'child', 0, date '2026-09-13', 'Trẻ dưới 1m3 miễn phí, vẫn giữ một lượt vào.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'adult', 200000, date '2026-09-13', 'Giá khởi tạo cho quầy Tam Cốc, chờ giám đốc xác nhận.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'child', 0, date '2026-09-13', 'Trẻ dưới 1m3 miễn phí, vẫn giữ một lượt vào.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'adult', 200000, date '2026-09-13', 'Giá khởi tạo cho quầy Tam Chúc, chờ giám đốc xác nhận.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'child', 0, date '2026-09-13', 'Trẻ dưới 1m3 miễn phí, vẫn giữ một lượt vào.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'adult', 60000, date '2026-09-13', 'Giá khởi tạo cho quầy Bái Đính, chờ giám đốc xác nhận.', 'system'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'child', 0, date '2026-09-13', 'Trẻ dưới 1m3 miễn phí, vẫn giữ một lượt vào.', 'system')
on conflict (tenant_id, site_id, product, effective_from) do nothing;

-- 7. Quyền --------------------------------------------------------------------------

-- Bán: dùng lại đúng `erp_counter_actor_can_sell` của TC-18.
-- Huỷ: chỉ quản lý cơ sở tại đúng cơ sở, hoặc giám đốc. Nhân viên không huỷ.
create or replace function public.erp_counter_actor_can_void(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'director', null)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'regional-manager', p_site_id);
$$;

-- 8. Đọc -----------------------------------------------------------------------------

create or replace function public.erp_counter_current_prices(
  p_tenant_id uuid,
  p_site_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'price_list_id', price.id,
        'product', price.product,
        'unit_price_vnd', price.unit_price_vnd,
        'effective_from', price.effective_from
      )
      order by price.product
    ),
    '[]'::jsonb
  )
  from (
    select distinct on (list.product) list.*
    from public.erp_counter_price_list list
    where list.tenant_id = p_tenant_id
      and list.site_id = p_site_id
      and list.effective_from <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
    order by list.product, list.effective_from desc
  ) price;
$$;

create or replace function public.erp_counter_sale_receipt(
  p_tenant_id uuid,
  p_sale_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sale_code', sale.sale_code,
    'site_id', sale.site_id,
    'sold_by_account_id', sale.sold_by_account_id,
    'sold_by_name', sale.sold_by_name,
    'acting_director_account_id', sale.acting_director_account_id,
    'sold_at', sale.sold_at,
    'business_date', sale.business_date,
    'adults', sale.adults,
    'children', sale.children,
    'total_vnd', sale.total_vnd,
    'cash_received_vnd', sale.cash_received_vnd,
    'change_vnd', sale.change_vnd,
    'status', sale.status,
    'voided_by_name', sale.voided_by_name,
    'voided_at', sale.voided_at,
    'void_reason', sale.void_reason,
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
$$;

-- Nhân viên chỉ thấy phiếu mình bán; quản lý và giám đốc thấy cả cơ sở.
create or replace function public.erp_counter_sales_for_day(
  p_tenant_id uuid,
  p_site_id uuid,
  p_viewer_account_id text,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer text := trim(coalesce(p_viewer_account_id, ''));
  v_sees_all boolean;
begin
  if p_tenant_id is null or p_site_id is null or p_business_date is null
     or char_length(v_viewer) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
  end if;
  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_viewer) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;
  v_sees_all := public.erp_counter_actor_can_void(p_tenant_id, p_site_id, v_viewer);

  return coalesce(
    (
      select jsonb_agg(public.erp_counter_sale_receipt(p_tenant_id, sale.id) order by sale.sold_at desc)
      from public.erp_counter_sales sale
      where sale.tenant_id = p_tenant_id
        and sale.site_id = p_site_id
        and sale.business_date = p_business_date
        and (v_sees_all or sale.sold_by_account_id = v_viewer)
    ),
    '[]'::jsonb
  );
end;
$$;

-- Đối soát cuối ca: cộng trong SQL, không kéo hàng về đếm (bài học TC-21).
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
as $$
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
      sum(sale.total_vnd) as total_vnd
    from in_window sale
    where sale.status = 'completed'
    group by 1
  )
  select jsonb_build_object(
    'sale_count', (select count(*) from in_window where status = 'completed'),
    'total_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'completed'),
    'voided_count', (select count(*) from in_window where status = 'voided'),
    'voided_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'voided'),
    'sellers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'account_id', per_seller.account_id,
            'display_name', per_seller.display_name,
            'count', per_seller.sale_count,
            'total_vnd', per_seller.total_vnd
          )
          order by per_seller.total_vnd desc, per_seller.account_id
        )
        from per_seller
      ),
      '[]'::jsonb
    )
  );
$$;

-- 9. Bán ------------------------------------------------------------------------------

create or replace function public.erp_create_counter_sale(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_adults integer,
  p_children integer,
  p_cash_received_vnd bigint,
  p_cash_counted_confirmed boolean,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_key text := nullif(trim(coalesce(p_request_key, '')), '');
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_existing public.erp_counter_sales;
  v_sale public.erp_counter_sales;
  v_ticket public.erp_tickets;
  v_price public.erp_counter_price_list;
  v_total bigint := 0;
  v_product text;
  v_quantity integer;
  v_note text;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or p_adults is null or p_adults not between 0 and 45
     or p_children is null or p_children not between 0 and 45
     or p_adults + p_children not between 1 and 45
     or p_cash_received_vnd is null or p_cash_received_vnd not between 0 and 1000000000
     or v_key is null or char_length(v_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;

  -- Cùng một khoá thì trả lại đúng phiếu đã lưu, không bán lần hai. Chỉ trả
  -- cho đúng người bán ở đúng cơ sở, để một khoá lạ không thành đường đọc
  -- phiếu của người khác.
  select * into v_existing from public.erp_counter_sales sale
  where sale.tenant_id = p_tenant_id and sale.request_key = v_key;
  if v_existing.id is not null then
    if v_existing.sold_by_account_id <> v_actor_id or v_existing.site_id <> p_site_id then
      raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
    end if;
    return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
  end if;

  if coalesce(p_cash_counted_confirmed, false) is not true then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_NOT_CONFIRMED';
  end if;

  -- Tổng tiền tính ở đây, từ bảng giá đang hiệu lực hôm nay.
  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc
      limit 1;
      if v_price.id is null then
        raise exception using errcode = 'P0002', message = 'COUNTER_SALE_PRICE_MISSING';
      end if;
      v_total := v_total + v_price.unit_price_vnd::bigint * v_quantity;
      v_price := null;
    end if;
  end loop;

  if p_cash_received_vnd < v_total then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_SHORT';
  end if;

  insert into public.erp_counter_sales (
    tenant_id, site_id, sale_code, sold_by_account_id, sold_by_name,
    acting_director_account_id, business_date, adults, children, total_vnd,
    cash_received_vnd, cash_counted_confirmed, request_key
  ) values (
    p_tenant_id, p_site_id,
    'PT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_actor_id, v_actor_name, v_director, v_today, p_adults, p_children, v_total,
    p_cash_received_vnd, true, v_key
  ) returning * into v_sale;

  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc
      limit 1;

      insert into public.erp_tickets (
        tenant_id, site_id, ticket_code, product, channel, valid_on, entries_allowed,
        booking_reference
      ) values (
        p_tenant_id, p_site_id,
        'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        v_product, 'quay-ve', v_today, v_quantity, v_sale.sale_code
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

  v_note := format(
    'Bán %s người lớn, %s trẻ em. Nhận %s đ, thối %s đ.%s',
    p_adults, p_children, p_cash_received_vnd, p_cash_received_vnd - v_total,
    case when v_director is not null
      then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
      else '' end
  );
  insert into public.erp_counter_sale_events (
    tenant_id, site_id, sale_id, event_type, actor_account_id, actor_display_name,
    acting_director_account_id, amount_vnd, note
  ) values (
    p_tenant_id, p_site_id, v_sale.id, 'counter-sale.completed', v_actor_id, v_actor_name,
    v_director, v_total, v_note
  );

  return public.erp_counter_sale_receipt(p_tenant_id, v_sale.id);

exception
  -- Hai lượt gửi cùng một khoá chạy sát nhau: chỉ số duy nhất chặn lượt sau,
  -- khối này cuộn lại toàn bộ phiếu, vé, dòng vừa chèn, rồi trả về phiếu của
  -- lượt trước. Không để lại một tấm vé mồ côi nào.
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
$$;

-- 10. Huỷ ----------------------------------------------------------------------------

create or replace function public.erp_void_counter_sale(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_sale_code text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_reason text := trim(coalesce(p_reason, ''));
  v_code text := upper(trim(coalesce(p_sale_code, '')));
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_sale public.erp_counter_sales;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or v_code !~ '^PT-[0-9A-F]{12}$' then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_VOID_REASON_REQUIRED';
  end if;

  if not public.erp_counter_actor_can_void(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_VOID_NOT_ALLOWED';
  end if;

  select * into v_sale from public.erp_counter_sales sale
  where sale.tenant_id = p_tenant_id and sale.site_id = p_site_id and sale.sale_code = v_code
  for update;
  if v_sale.id is null then
    raise exception using errcode = 'P0002', message = 'COUNTER_SALE_NOT_FOUND';
  end if;

  -- Đã huỷ rồi thì trả lại đúng phiếu ấy, không ghi thêm dòng nào.
  if v_sale.status = 'voided' then
    return public.erp_counter_sale_receipt(p_tenant_id, v_sale.id);
  end if;

  if v_sale.sold_by_account_id = v_actor_id then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_VOID_OWN_SALE';
  end if;

  if v_sale.business_date <> v_today then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_VOID_DAY_CLOSED';
  end if;

  if exists (
    select 1
    from public.erp_counter_sale_lines line
    join public.erp_tickets ticket
      on ticket.id = line.ticket_id and ticket.tenant_id = line.tenant_id
    where line.tenant_id = p_tenant_id and line.sale_id = v_sale.id
      and ticket.entries_used > 0
  ) then
    raise exception using errcode = '55000', message = 'COUNTER_SALE_ALREADY_ADMITTED';
  end if;

  update public.erp_tickets ticket
  set status = 'void', updated_at = now()
  from public.erp_counter_sale_lines line
  where line.tenant_id = p_tenant_id and line.sale_id = v_sale.id
    and ticket.id = line.ticket_id and ticket.tenant_id = line.tenant_id;

  update public.erp_counter_sales sale
  set status = 'voided',
      voided_by_account_id = v_actor_id,
      voided_by_name = v_actor_name,
      voided_acting_director_account_id = v_director,
      voided_at = now(),
      void_reason = v_reason
  where sale.id = v_sale.id and sale.tenant_id = p_tenant_id;

  insert into public.erp_counter_sale_events (
    tenant_id, site_id, sale_id, event_type, actor_account_id, actor_display_name,
    acting_director_account_id, amount_vnd, note
  ) values (
    p_tenant_id, p_site_id, v_sale.id, 'counter-sale.voided', v_actor_id, v_actor_name,
    v_director, v_sale.total_vnd,
    left(
      'Huỷ phiếu, hoàn ' || v_sale.total_vnd || ' đ cho khách. Lý do: ' || v_reason
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_counter_sale_receipt(p_tenant_id, v_sale.id);
end;
$$;


-- 11. Nhật ký hệ thống: thêm đúng một nhánh -------------------------------------
--
-- Chữ ký giữ nguyên nên `create or replace` thay đúng hàm đang có, không đẻ
-- bản nạp chồng. Thân hàm chép nguyên văn từ `202608030033` — hàm này chưa
-- từng được định nghĩa lại ở migration nào khác — và chỉ thêm nhánh bán vé.
-- Quyền đã cấp cho hàm được giữ nguyên khi thay bằng `create or replace`.

create or replace function public.erp_audit_timeline(
  p_tenant_id uuid,
  p_viewer_account_id text,
  p_search text default null,
  p_site_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200,
  -- Lọc về đúng một người, cho trang hồ sơ. Đây là bộ lọc **thu hẹp** chồng
  -- lên phạm vi đã tính; không có đường nào nó nới rộng ra được.
  p_actor_account_id text default null
)
returns table (
  source text,
  occurred_at timestamptz,
  site_id uuid,
  actor_account_id text,
  actor_display_name text,
  actor_job_title text,
  actor_site_scope text,
  actor_snapshot_at_write boolean,
  action text,
  entity_type text,
  entity_id text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sees_everything boolean;
  v_site_ids uuid[];
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  select scope.sees_everything, scope.site_ids
    into v_sees_everything, v_site_ids
  from public.erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id) as scope;

  v_sees_everything := coalesce(v_sees_everything, false);
  v_site_ids := coalesce(v_site_ids, array[]::uuid[]);

  return query
  with unified as (
    select 'Tài khoản & phân quyền'::text as source, event.created_at as occurred_at,
           null::uuid as site_id, event.actor_account_id, event.actor_display_name,
           event.actor_job_title, event.actor_site_scope, event.actor_snapshot_at_write,
           event.action, 'account'::text as entity_type, event.target_account_id as entity_id,
           null::text as note
    from public.erp_account_admin_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Sổ kế toán', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, event.entity_type,
           event.entity_id::text, event.note
    from public.erp_accounting_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Hóa đơn nhà cung cấp', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'ap-invoice', event.invoice_id::text,
           event.note
    from public.erp_ap_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phân quyền nhân sự', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'employee-access',
           event.employee_account_id, null
    from public.erp_employee_access_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Dự án & sự kiện', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'project-work-item',
           coalesce(event.work_item_id::text, event.event_id::text), event.note
    from public.erp_project_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Chốt ca', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'shift-close',
           event.workflow_id::text, event.note
    from public.erp_shift_close_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phiếu việc', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'workday',
           event.workday_id::text, event.note
    from public.erp_workday_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Xem theo vai trò', event.created_at, null::uuid, event.director_account_id,
           event.director_name, event.director_job_title, null::text,
           event.actor_snapshot_at_write, 'role-switch.' || event.action, 'account',
           event.target_account_id, event.target_name
    from public.erp_role_switch_audit event
    where event.tenant_id = p_tenant_id
    union all
    -- QA-ERP-POS-04: bán và huỷ vé tại quầy. Mã phiếu thu làm mã bản ghi,
    -- vì đó là thứ người ta đọc trên tờ giấy in cho khách.
    select 'Bán vé tại quầy', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'counter-sale',
           sale.sale_code, event.note
    from public.erp_counter_sale_events event
    join public.erp_counter_sales sale
      on sale.id = event.sale_id and sale.tenant_id = event.tenant_id
    where event.tenant_id = p_tenant_id
  )
  select unified.*
  from unified
  where
    -- Phạm vi. Quản lý thấy việc **tác động lên cơ sở mình** cộng việc **người
    -- của cơ sở mình** làm ở bất kỳ đâu; vế sau là lý do có mệnh đề exists.
    (
      v_sees_everything
      or unified.actor_account_id = p_viewer_account_id
      or (
        cardinality(v_site_ids) > 0
        and (
          unified.site_id = any (v_site_ids)
          or exists (
            select 1
            from public.erp_account_role_assignments assignment
            where assignment.tenant_id = p_tenant_id
              and assignment.account_id = unified.actor_account_id
              and assignment.status = 'active'
              and assignment.site_id = any (v_site_ids)
              and assignment.effective_from <= now()
              and (
                assignment.effective_until is null
                or assignment.effective_until > now()
              )
          )
        )
      )
    )
    and (p_actor_account_id is null or unified.actor_account_id = p_actor_account_id)
    and (p_site_id is null or unified.site_id = p_site_id)
    and (p_from is null or unified.occurred_at >= p_from)
    and (p_to is null or unified.occurred_at <= p_to)
    -- Tìm theo **tên trong nhật ký** (tên lúc thao tác) hoặc tên hiện tại
    -- trong sổ: đổi tên rồi vẫn tìm ra việc làm dưới tên cũ, và ngược lại.
    and (
      v_search is null
      or unified.actor_display_name ilike '%' || v_search || '%'
      or unified.actor_account_id ilike '%' || v_search || '%'
      or exists (
        select 1
        from public.erp_account_registry registry
        where registry.tenant_id = p_tenant_id
          and registry.account_id = unified.actor_account_id
          and registry.display_name ilike '%' || v_search || '%'
      )
    )
  order by unified.occurred_at desc
  limit v_limit;
end;
$$;

-- 12. Khoá cửa ------------------------------------------------------------------

alter table public.erp_counter_price_list enable row level security;
alter table public.erp_counter_sales enable row level security;
alter table public.erp_counter_sale_lines enable row level security;
alter table public.erp_counter_sale_events enable row level security;

revoke all on table public.erp_counter_price_list from public, anon, authenticated, service_role;
revoke all on table public.erp_counter_sales from public, anon, authenticated, service_role;
revoke all on table public.erp_counter_sale_lines from public, anon, authenticated, service_role;
revoke all on table public.erp_counter_sale_events from public, anon, authenticated, service_role;

revoke all on function public.erp_counter_sale_append_only() from public, anon, authenticated, service_role;
revoke all on function public.erp_counter_sale_guard_update() from public, anon, authenticated, service_role;

revoke all on function public.erp_counter_actor_can_void(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.erp_counter_actor_can_void(uuid, uuid, text) to service_role;
revoke all on function public.erp_counter_current_prices(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_counter_current_prices(uuid, uuid) to service_role;
revoke all on function public.erp_counter_sale_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_counter_sale_receipt(uuid, uuid) to service_role;
revoke all on function public.erp_counter_sales_for_day(uuid, uuid, text, date) from public, anon, authenticated;
grant execute on function public.erp_counter_sales_for_day(uuid, uuid, text, date) to service_role;
revoke all on function public.erp_shift_counter_cash(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.erp_shift_counter_cash(uuid, uuid, timestamptz, timestamptz) to service_role;
revoke all on function public.erp_create_counter_sale(uuid, uuid, text, text, text, integer, integer, bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.erp_create_counter_sale(uuid, uuid, text, text, text, integer, integer, bigint, boolean, text) to service_role;
revoke all on function public.erp_void_counter_sale(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_void_counter_sale(uuid, uuid, text, text, text, text, text) to service_role;

commit;
