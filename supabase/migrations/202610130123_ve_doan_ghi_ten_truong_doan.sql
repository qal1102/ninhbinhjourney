-- Vé đoàn quầy mang tên trưởng đoàn (13/10/2026).
--
-- Chủ dự án bán thử một đoàn, trưởng đoàn "Nguyễn Văn A", rồi mở "Vé phát
-- hành gần nhất" thì thấy "Không có tên". `erp_create_counter_group_sale`
-- (118) ghi tên và số trưởng đoàn vào phiếu thu và hồ sơ đoàn, nhưng tấm vé
-- đoàn thì để trống `guest_name`, `guest_phone`. Danh sách vé, ô tìm vé theo
-- tên hay số điện thoại và màn quét cổng đều đọc hai cột đó trên vé.
--
-- 1. Chép NGUYÊN VĂN `erp_create_counter_group_sale` của 118, chỉ thêm
--    `guest_name`, `guest_phone` vào câu chèn vé.
-- 2. Điền lại cho vé đoàn đã bán theo đúng phiếu thu của nó: vé kênh quầy,
--    loại đoàn, tên còn trống, có phiếu thu loại `group` trùng mã. Không đụng
--    phiếu đoàn cũ (063) vì phiếu ấy không hỏi tên trưởng đoàn.
--
-- `erp_tickets` không có trigger nào chặn sửa (đã soát mọi `create trigger`).
-- Quyền của hàm giữ nguyên vì chữ ký không đổi.

begin;

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
    booking_reference, guest_name, guest_phone
  ) values (
    p_tenant_id, p_site_id,
    'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    'group', 'quay-ve', v_today, p_party_size, v_sale.sale_code,
    left(v_leader, 200), coalesce(v_phone, '')
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

update public.erp_tickets ticket
set guest_name = left(sale.group_leader_name, 200),
    guest_phone = left(coalesce(sale.group_leader_phone, ''), 30)
from public.erp_counter_sales sale
where sale.tenant_id = ticket.tenant_id
  and sale.sale_code = ticket.booking_reference
  and sale.sale_kind = 'group'
  and coalesce(sale.group_leader_name, '') <> ''
  and ticket.channel = 'quay-ve'
  and ticket.product = 'group'
  and ticket.guest_name = '';

commit;
