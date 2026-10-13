-- Tra bằng mã HOẶC số điện thoại, và ERP tra khách (13/10/2026).
--
-- Chủ dự án 13/10: "phải cho nhập sđt hoặc mã vé chứ bắt nhập cả mã vé và sđt,
-- lỡ không nhớ thì sao? … mã vé ở trên web mà trong ERP vẫn không liên kết
-- vào, kiểu tao tự đặt vé, tự quét, có sđt xong kiểm tra sđt đó sao?"
--
-- 1. `customer_lookup_order_by_code`: khách chỉ cần mã đặt chỗ `NBJ-…` hay mã
--    vé `WEB-…` là mở lại vé và mã QR. Cầm mã như cầm tấm vé giấy (mã 12 ký tự
--    ngẫu nhiên, đoán không ra; máy chủ web chặn gọi dồn theo IP). Tra chỉ
--    bằng số điện thoại vẫn đi lối cũ (`customer_lookup_by_phone`): thấy vé
--    nhưng mã đã che, vì không có tin nhắn xác nhận chủ số. Quên cả mã lẫn máy
--    thì ra quầy: nhân viên tra số trong ERP và mở vé.
-- 2. `erp_tra_khach`: nhân viên (giám đốc, quản lý) gõ số điện thoại (máy chủ
--    băm trước) hoặc bất kỳ mã nào: `NBJ-` đơn web, `WEB-`/`QUAY-`/`TV-` vé,
--    `PT-` phiếu thu quầy. Ra một hồ sơ nối mọi thứ: đơn web, vé quầy đã gắn
--    số, lượt qua cổng, điểm, quà kèm mã, mã mời, sự kiện, ảnh dự thi. Mỗi lần
--    tra ghi nhật ký truy cập dữ liệu khách (`customer-360-viewed`).

begin;

create or replace function public.customer_lookup_order_by_code(
  p_tenant_id uuid,
  p_code text
)
returns table (
  found boolean,
  order_code text,
  product_id uuid,
  visit_date date,
  party_size integer,
  adults integer,
  children integer,
  total_vnd integer,
  currency text,
  order_status text,
  payment_mode text,
  payment_status text,
  amount_due_vnd integer,
  tickets jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $ham$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_order public.customer_orders;
  v_payment public.customer_payment_attempts;
begin
  if v_code ~ '^NBJ-[A-Z0-9]{12}$' then
    select o.* into v_order from public.customer_orders o
    where o.tenant_id = p_tenant_id and o.order_code = v_code and o.status = 'confirmed';
  elsif v_code ~ '^WEB-[A-Z0-9]{6,32}$' then
    select o.* into v_order
    from public.erp_tickets ticket
    join public.customer_order_tickets bridge on bridge.ticket_id = ticket.id and bridge.tenant_id = ticket.tenant_id
    join public.customer_orders o on o.id = bridge.order_id and o.tenant_id = bridge.tenant_id
    where ticket.tenant_id = p_tenant_id and ticket.ticket_code = v_code and o.status = 'confirmed'
    limit 1;
  end if;
  if v_order.id is null then
    return query select false, null::text, null::uuid, null::date, null::integer, null::integer, null::integer,
      null::integer, null::text, null::text, null::text, null::text, null::integer, null::jsonb;
    return;
  end if;
  select payment.* into v_payment from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id and payment.order_id = v_order.id
  order by case when payment.status = 'pending' then 0 else 1 end, payment.occurred_at desc
  limit 1;
  return query select
    true, v_order.order_code, v_order.product_id, v_order.visit_date, v_order.party_size,
    v_order.adults, v_order.children, v_order.total_vnd, v_order.currency, v_order.status,
    v_payment.mode, v_payment.status,
    case when v_payment.status = 'pending' then v_payment.amount_vnd else 0 end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'ticket_id', ticket.id, 'ticket_code', ticket.ticket_code, 'site_id', ticket.site_id,
        'valid_on', ticket.valid_on, 'entries_allowed', ticket.entries_allowed,
        'entries_used', ticket.entries_used, 'guest_group', ticket.product, 'status', ticket.status
      ) order by ticket.site_id, ticket.product)
      from public.customer_order_tickets bridge
      join public.erp_tickets ticket on ticket.id = bridge.ticket_id
      where bridge.order_id = v_order.id and bridge.tenant_id = p_tenant_id
    ), '[]'::jsonb);
end;
$ham$;

-- Vé (bất kỳ kênh) dạng hiển thị cho nhân viên, kèm lượt quét gần nhất.
create or replace function public.erp_tra_khach_ve(p_tenant_id uuid, p_ticket_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select jsonb_build_object(
    'code', ticket.ticket_code,
    'site', site.name,
    'channel', ticket.channel,
    'product', ticket.product,
    'valid_on', ticket.valid_on,
    'status', ticket.status,
    'entries_allowed', ticket.entries_allowed,
    'entries_used', ticket.entries_used,
    'issued_at', ticket.issued_at,
    'lan_quet', coalesce((
      select jsonb_agg(jsonb_build_object('luc', scan.scanned_at, 'ket_qua', scan.result, 'nguoi', scan.scanned_by_name) order by scan.scanned_at desc)
      from (
        select * from public.erp_gate_scan_events s
        where s.tenant_id = p_tenant_id and s.ticket_id = ticket.id
        order by s.scanned_at desc limit 5
      ) scan
    ), '[]'::jsonb),
    'sale_code', (
      select sale.sale_code from public.erp_counter_sale_lines line
      join public.erp_counter_sales sale on sale.id = line.sale_id and sale.tenant_id = line.tenant_id
      where line.tenant_id = p_tenant_id and line.ticket_id = ticket.id limit 1
    )
  )
  from public.erp_tickets ticket
  join public.sites site on site.id = ticket.site_id
  where ticket.tenant_id = p_tenant_id and ticket.id = p_ticket_id;
$ham$;

create or replace function public.erp_tra_khach(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_identity_digest text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_identity public.customer_identities;
  v_identity_id uuid;
  v_order_ids uuid[] := '{}';
  v_ticket_ids uuid[] := '{}';
  v_src record;
begin
  if not (
    public.erp_account_has_active_role(p_tenant_id, v_actor, 'director', null)
    or exists (
      select 1 from public.erp_account_role_assignments a
      where a.tenant_id = p_tenant_id and a.account_id = v_actor and a.role = 'manager' and a.status = 'active'
    )
  ) then
    raise exception using errcode = '42501', message = 'TRA_KHACH_ROLE_REQUIRED';
  end if;

  if coalesce(p_identity_digest, '') ~ '^[0-9a-f]{64}$' then
    select i.* into v_identity from public.customer_identities i
    where i.tenant_id = p_tenant_id and i.identity_type = 'phone' and i.identity_digest = p_identity_digest;
    v_identity_id := v_identity.id;
  elsif v_code ~ '^NBJ-' then
    select array_agg(o.id), (array_agg(o.identity_id))[1] into v_order_ids, v_identity_id
    from public.customer_orders o
    where o.tenant_id = p_tenant_id and o.order_code = v_code;
  elsif v_code ~ '^PT-' then
    select array_agg(line.ticket_id) into v_ticket_ids
    from public.erp_counter_sales sale
    join public.erp_counter_sale_lines line on line.sale_id = sale.id and line.tenant_id = sale.tenant_id
    where sale.tenant_id = p_tenant_id and sale.sale_code = v_code and line.ticket_id is not null;
  elsif v_code <> '' then
    select * into v_src from public.customer_loyalty_resolve_code(p_tenant_id, v_code);
    if v_src.ticket_id is not null then
      v_ticket_ids := array[v_src.ticket_id];
      select array_agg(bridge.order_id) into v_order_ids
      from public.customer_order_tickets bridge
      where bridge.tenant_id = p_tenant_id and bridge.ticket_id = v_src.ticket_id;
    end if;
  else
    raise exception using errcode = '22023', message = 'TRA_KHACH_INPUT_INVALID';
  end if;

  -- Từ vé hay đơn tìm ra số điện thoại đã gắn (nếu có).
  if v_identity_id is null and coalesce(array_length(v_ticket_ids, 1), 0) > 0 then
    select link.identity_id into v_identity_id from public.customer_loyalty_links link
    where link.tenant_id = p_tenant_id and link.ticket_id = any(v_ticket_ids)
    order by link.linked_at desc limit 1;
  end if;
  if v_identity_id is null and coalesce(array_length(v_order_ids, 1), 0) > 0 then
    select o.identity_id into v_identity_id from public.customer_orders o
    where o.id = any(v_order_ids) and o.identity_id is not null limit 1;
  end if;
  if v_identity_id is not null then
    select i.* into v_identity from public.customer_identities i where i.id = v_identity_id and i.tenant_id = p_tenant_id;
  end if;

  if v_identity.id is null and coalesce(array_length(v_order_ids, 1), 0) = 0 and coalesce(array_length(v_ticket_ids, 1), 0) = 0 then
    return jsonb_build_object('tim_thay', false);
  end if;

  if v_identity.id is not null then
    -- Mọi đơn và vé của số này.
    select coalesce(array_agg(o.id), '{}') into v_order_ids
    from public.customer_orders o
    where o.tenant_id = p_tenant_id and o.status = 'confirmed'
      and (o.identity_id = v_identity.id
           or public.customer_canonical_profile_id(p_tenant_id, o.profile_id)
              = public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id));
    select coalesce(array_agg(distinct link.ticket_id), '{}') || v_ticket_ids into v_ticket_ids
    from public.customer_loyalty_links link
    where link.tenant_id = p_tenant_id and link.identity_id = v_identity.id;
    insert into public.customer_identity_audit_events (
      tenant_id, profile_id, identity_id, actor_kind, actor_account_id, event_type, purpose, metadata
    ) values (
      p_tenant_id, public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id), v_identity.id,
      'erp', v_actor, 'customer-360-viewed', 'tra-khach',
      jsonb_build_object('cach', case when p_identity_digest is not null then 'so-dien-thoai' else 'ma' end)
    );
  end if;

  return jsonb_build_object(
    'tim_thay', true,
    'co_so', v_identity.id is not null,
    'so', (
      select '•••' || link.contact_hint from public.customer_loyalty_links link
      where link.tenant_id = p_tenant_id and link.identity_id = v_identity.id
      order by link.linked_at desc limit 1
    ),
    'tiep_thi', (
      select consent.status from public.customer_consents consent
      where consent.tenant_id = p_tenant_id
        and consent.profile_id = public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id)
        and consent.purpose = 'marketing_communications'
      order by consent.occurred_at desc, consent.sequence_no desc limit 1
    ),
    'don_web', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_code', o.order_code, 'product', product.name, 'visit_date', o.visit_date,
        'adults', o.adults, 'children', o.children, 'total_vnd', o.total_vnd, 'giam_vnd', o.giam_vnd,
        'ma_moi', o.ma_moi, 'status', o.status, 'created_at', o.created_at,
        've', coalesce((
          select jsonb_agg(public.erp_tra_khach_ve(p_tenant_id, bridge.ticket_id) order by bridge.site_id)
          from public.customer_order_tickets bridge
          where bridge.tenant_id = p_tenant_id and bridge.order_id = o.id
        ), '[]'::jsonb)
      ) order by o.visit_date desc, o.created_at desc)
      from public.customer_orders o
      join public.products product on product.id = o.product_id
      where o.id = any(v_order_ids)
    ), '[]'::jsonb),
    've_khac', coalesce((
      select jsonb_agg(public.erp_tra_khach_ve(p_tenant_id, t.id) order by t.issued_at desc)
      from public.erp_tickets t
      where t.tenant_id = p_tenant_id and t.id = any(v_ticket_ids)
        and not exists (
          select 1 from public.customer_order_tickets bridge
          where bridge.tenant_id = p_tenant_id and bridge.ticket_id = t.id and bridge.order_id = any(v_order_ids)
        )
    ), '[]'::jsonb),
    'tich_diem', case when v_identity.id is not null
      then public.customer_loyalty_refresh(p_tenant_id, v_identity.id, true) else null end,
    'su_kien', case when v_identity.id is not null then coalesce((
      select jsonb_agg(jsonb_build_object('ten', s.ten, 'slug', s.slug, 'ma', d.ma_tham_gia, 'trung', d.trung_thu_tu, 'ma_nhan', d.ma_nhan) order by d.dang_ky_luc desc)
      from public.su_kien_dang_ky d join public.su_kien s on s.id = d.su_kien_id
      where d.tenant_id = p_tenant_id and d.identity_id = v_identity.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'thi_anh', case when v_identity.id is not null then coalesce((
      select jsonb_agg(jsonb_build_object('thang', b.thang, 'trang_thai', b.trang_thai, 'giai', b.giai, 'ma_nhan', b.ma_nhan) order by b.gui_luc desc)
      from public.thi_anh_bai b
      where b.tenant_id = p_tenant_id and b.identity_id = v_identity.id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$ham$;

revoke all on function public.customer_lookup_order_by_code(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_lookup_order_by_code(uuid, text) to service_role;
revoke all on function public.erp_tra_khach_ve(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.erp_tra_khach(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_tra_khach(uuid, text, text, text) to service_role;

commit;
