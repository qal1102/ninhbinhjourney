-- QA-ERP-POS-05 · 13/09/2026
--
-- Bán vé tại quầy, đợt hai: nhận thêm chuyển khoản quét QR, và giám đốc tự
-- sửa giá quầy.
--
-- ## Lời chủ dự án
--
-- "Làm 1 cái màn hình tự sửa giá cho giám đốc đi, quầy nhận cả tiền mặt cả
-- scan QR có sẵn, in phiếu thì cứ để sẵn 1 cái để link với máy in…"
--
-- ## Hai quyết định, mỗi cái một lý do
--
-- 1. **Chuyển khoản QR là một phương thức riêng, không phải "tiền mặt bằng
--    con số khác".** Tiền chuyển khoản không nằm trong két, nên đối soát cuối
--    ca phải so nó với ô "Thẻ/chuyển khoản" của tờ chốt ca, không so với ô tiền
--    mặt. Với QR, số tiền nhận luôn bằng đúng tổng (không có tiền thối), và dấu
--    xác nhận của người bán nghĩa là "đã thấy tiền về tài khoản, đúng số, đúng
--    nội dung". Mã nội dung chuyển khoản lưu kèm phiếu để kế toán khớp với sao
--    kê. "QR có sẵn" là mã QR ngân hàng quầy đang dùng; hệ thống không sinh mã
--    ngân hàng vì dự án chưa có số tài khoản nhận tiền nào được xác nhận.
--
-- 2. **Giá do giám đốc đặt, mỗi lần đặt là một hàng mới.** Bảng giá vẫn chỉ
--    ghi thêm. Bỏ ràng buộc "mỗi ngày một giá" để giám đốc gõ nhầm còn sửa lại
--    được trong ngày: giá đang áp là hàng có ngày áp dụng muộn nhất đã tới, và
--    nếu cùng ngày thì hàng đặt sau cùng. Phiếu đã bán vẫn trỏ đúng hàng giá lúc
--    bán, nên đổi giá không sửa được con số của phiếu cũ. Không cho đặt giá lùi
--    ngày: lịch sử đã bán không được đổi nghĩa sau lưng kế toán. Mỗi lần đặt giá
--    hiện trong Nhật ký.
--
-- ## Chỉ tiến tới
--
-- Không sửa hay xoá hàng dữ liệu nào. Tại lúc viết, production có 0 phiếu bán
-- (đo 13/09/2026), nên đổi ràng buộc không đụng tới dữ liệu thật nào; ràng
-- buộc mới vẫn tự quét toàn bảng khi thêm. Hàm bán đổi chữ ký, nên bỏ tường
-- minh chữ ký cũ trước khi tạo lại — tránh để hai bản nạp chồng song song.

begin;

-- 1. Phương thức trả tiền ------------------------------------------------------------

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_payment_method_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_payment_method_check
  check (payment_method in ('cash', 'qr-transfer'));

alter table public.erp_counter_sales
  add column if not exists payment_reference text;

alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_payment_reference_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_payment_reference_check
  check (payment_reference is null or payment_reference ~ '^[A-Z0-9-]{4,40}$');

-- Chuyển khoản thì nhận đúng bằng tổng, không có tiền thối.
alter table public.erp_counter_sales
  drop constraint if exists erp_counter_sales_qr_exact_amount_check;
alter table public.erp_counter_sales
  add constraint erp_counter_sales_qr_exact_amount_check
  check (payment_method <> 'qr-transfer' or cash_received_vnd = total_vnd);

-- Khoá sửa phiếu phải biết thêm cột mới.
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
$$;

-- 2. Bảng giá: nhiều lần đặt trong một ngày, người đặt ghi tên --------------------------

alter table public.erp_counter_price_list
  drop constraint if exists erp_counter_price_list_tenant_id_site_id_product_effective__key;

alter table public.erp_counter_price_list
  add column if not exists created_by_name text
    check (created_by_name is null or char_length(created_by_name) between 1 and 200);

create index if not exists erp_counter_price_list_lookup_idx
  on public.erp_counter_price_list (tenant_id, site_id, product, effective_from desc, created_at desc);

-- 3. Quyền đặt giá: chỉ giám đốc ---------------------------------------------------------

create or replace function public.erp_counter_actor_can_set_price(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'director', null);
$$;

-- 4. Đọc giá: ngày áp dụng muộn nhất đã tới, cùng ngày thì hàng đặt sau cùng ------------

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
    order by list.product, list.effective_from desc, list.created_at desc
  ) price;
$$;

create or replace function public.erp_counter_price_history(
  p_tenant_id uuid,
  p_site_id uuid,
  p_limit integer default 30
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
        'price_list_id', row_data.id,
        'product', row_data.product,
        'unit_price_vnd', row_data.unit_price_vnd,
        'effective_from', row_data.effective_from,
        'created_at', row_data.created_at,
        'created_by_name', coalesce(row_data.created_by_name, row_data.created_by_account_id),
        'note', row_data.note
      )
      order by row_data.effective_from desc, row_data.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select list.*
    from public.erp_counter_price_list list
    where list.tenant_id = p_tenant_id and list.site_id = p_site_id
    order by list.effective_from desc, list.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 200)
  ) row_data;
$$;

-- 5. Đặt giá ------------------------------------------------------------------------------

create or replace function public.erp_set_counter_price(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_product text,
  p_unit_price_vnd integer,
  p_effective_from date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or p_product is null or p_product not in ('adult', 'child')
     or p_unit_price_vnd is null or p_unit_price_vnd not between 0 and 10000000
     or char_length(v_note) > 500 then
    raise exception using errcode = '22023', message = 'COUNTER_PRICE_INPUT_INVALID';
  end if;

  -- Không đặt giá lùi ngày, và không đặt trước quá một năm.
  if p_effective_from is null or p_effective_from < v_today or p_effective_from > v_today + 365 then
    raise exception using errcode = '22023', message = 'COUNTER_PRICE_DATE_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_counter_actor_can_set_price(p_tenant_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'COUNTER_PRICE_NOT_ALLOWED';
  end if;

  insert into public.erp_counter_price_list (
    tenant_id, site_id, product, unit_price_vnd, effective_from, note,
    created_by_account_id, created_by_name
  ) values (
    p_tenant_id, p_site_id, p_product, p_unit_price_vnd, p_effective_from, v_note,
    v_actor_id, v_actor_name
  );

  return public.erp_counter_current_prices(p_tenant_id, p_site_id);
end;
$$;

-- 6. Phiếu thu mang phương thức và mã nội dung --------------------------------------------

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

-- 7. Cuối ca: tách tiền mặt với chuyển khoản ------------------------------------------------

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
$$;

-- 8. Bán: đổi chữ ký, nên bỏ tường minh bản cũ trước --------------------------------------

drop function if exists public.erp_create_counter_sale(
  uuid, uuid, text, text, text, integer, integer, bigint, boolean, text
);

create or replace function public.erp_create_counter_sale(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_adults integer,
  p_children integer,
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
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_key text := nullif(trim(coalesce(p_request_key, '')), '');
  v_method text := trim(coalesce(p_payment_method, ''));
  v_reference text := nullif(upper(trim(coalesce(p_payment_reference, ''))), '');
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_existing public.erp_counter_sales;
  v_sale public.erp_counter_sales;
  v_ticket public.erp_tickets;
  v_price public.erp_counter_price_list;
  v_total bigint := 0;
  v_received bigint;
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
     or v_key is null or char_length(v_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
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
    if v_existing.sold_by_account_id <> v_actor_id or v_existing.site_id <> p_site_id then
      raise exception using errcode = '22023', message = 'COUNTER_SALE_INPUT_INVALID';
    end if;
    return public.erp_counter_sale_receipt(p_tenant_id, v_existing.id);
  end if;

  if coalesce(p_cash_counted_confirmed, false) is not true then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_NOT_CONFIRMED';
  end if;

  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc, list.created_at desc
      limit 1;
      if v_price.id is null then
        raise exception using errcode = 'P0002', message = 'COUNTER_SALE_PRICE_MISSING';
      end if;
      v_total := v_total + v_price.unit_price_vnd::bigint * v_quantity;
      v_price := null;
    end if;
  end loop;

  -- Chuyển khoản: nhận đúng bằng tổng, bỏ qua số màn hình gửi lên.
  v_received := case when v_method = 'qr-transfer' then v_total else p_cash_received_vnd end;
  if v_received < v_total then
    raise exception using errcode = '22023', message = 'COUNTER_SALE_CASH_SHORT';
  end if;

  insert into public.erp_counter_sales (
    tenant_id, site_id, sale_code, sold_by_account_id, sold_by_name,
    acting_director_account_id, business_date, payment_method, payment_reference,
    adults, children, total_vnd, cash_received_vnd, cash_counted_confirmed, request_key
  ) values (
    p_tenant_id, p_site_id,
    'PT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_actor_id, v_actor_name, v_director, v_today, v_method, v_reference,
    p_adults, p_children, v_total, v_received, true, v_key
  ) returning * into v_sale;

  foreach v_product in array array['adult', 'child'] loop
    v_quantity := case v_product when 'adult' then p_adults else p_children end;
    if v_quantity > 0 then
      select * into v_price from public.erp_counter_price_list list
      where list.tenant_id = p_tenant_id and list.site_id = p_site_id
        and list.product = v_product and list.effective_from <= v_today
      order by list.effective_from desc, list.created_at desc
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
    'Bán %s người lớn, %s trẻ em. %s%s',
    p_adults, p_children,
    case when v_method = 'qr-transfer'
      then 'Chuyển khoản QR ' || v_total || ' đ' || coalesce(', nội dung ' || v_reference, '') || '.'
      else 'Tiền mặt: nhận ' || v_received || ' đ, thối ' || (v_received - v_total) || ' đ.' end,
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


-- 9. Nhật ký hệ thống: thêm một nhánh cho việc đặt giá -----------------------------------
--
-- Chữ ký giữ nguyên. Thân hàm chép nguyên văn bản `202609130069` — đã đo bằng
-- `pg_get_functiondef` rằng production đang chạy đúng bản ấy — và chỉ thêm nhánh.

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
    union all
    -- QA-ERP-POS-05: mỗi lần giám đốc đặt giá quầy. Hàng giá gieo sẵn của
    -- hệ thống không tính là thao tác của ai nên không hiện.
    select 'Bảng giá quầy', price.created_at, price.site_id, price.created_by_account_id,
           coalesce(price.created_by_name, price.created_by_account_id), null::text, null::text,
           price.created_by_name is not null, 'counter-price.set', 'counter-price',
           price.product,
           left(
             case price.product when 'adult' then 'Người lớn' else 'Trẻ dưới 1m3' end
             || ': ' || price.unit_price_vnd || ' đ, áp dụng từ '
             || to_char(price.effective_from, 'DD/MM/YYYY') || '.'
             || case when price.note <> '' then ' ' || price.note else '' end,
             600
           )
    from public.erp_counter_price_list price
    where price.tenant_id = p_tenant_id and price.created_by_account_id <> 'system'
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

-- 10. Khoá cửa --------------------------------------------------------------------------------

revoke all on function public.erp_counter_sale_guard_update() from public, anon, authenticated, service_role;

revoke all on function public.erp_counter_actor_can_set_price(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_counter_actor_can_set_price(uuid, text) to service_role;
revoke all on function public.erp_counter_current_prices(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_counter_current_prices(uuid, uuid) to service_role;
revoke all on function public.erp_counter_price_history(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.erp_counter_price_history(uuid, uuid, integer) to service_role;
revoke all on function public.erp_set_counter_price(uuid, uuid, text, text, text, integer, date, text) from public, anon, authenticated;
grant execute on function public.erp_set_counter_price(uuid, uuid, text, text, text, integer, date, text) to service_role;
revoke all on function public.erp_counter_sale_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_counter_sale_receipt(uuid, uuid) to service_role;
revoke all on function public.erp_shift_counter_cash(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.erp_shift_counter_cash(uuid, uuid, timestamptz, timestamptz) to service_role;
revoke all on function public.erp_create_counter_sale(uuid, uuid, text, text, text, integer, integer, text, bigint, text, boolean, text) from public, anon, authenticated;
grant execute on function public.erp_create_counter_sale(uuid, uuid, text, text, text, integer, integer, text, bigint, text, boolean, text) to service_role;

commit;
