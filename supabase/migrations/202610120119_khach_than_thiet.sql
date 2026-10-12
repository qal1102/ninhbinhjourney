-- Khách thân thiết: vé đoàn thành vé cá nhân bằng số điện thoại, tích lượt đi,
-- quà và voucher (12/10/2026).
--
-- ## Lời chủ dự án
--
-- "Chuyển vé đoàn thành vé cá nhân bằng số điện thoại; tích điểm, quà, voucher
-- theo số lần đi. Khách để lại số điện thoại càng nhiều càng tốt; tách đồng ý
-- dịch vụ và đồng ý tiếp thị."
--
-- ## Cách làm
--
-- Mỗi người trong đoàn đã có mã riêng `TV-…` (migration 054). Khách mở mã ấy,
-- hoặc mở vé quầy `QUAY-…` của mình, nhập số điện thoại và tích đồng ý dịch
-- vụ: mã được GẮN vào định danh số điện thoại đã có của hệ thống
-- (`customer_identities`, số được mã hoá và băm ở máy chủ, kho không thấy số
-- thật). Đồng ý tiếp thị là ô riêng, không tích thì ghi `denied`, đúng luật
-- tách hai loại đồng ý của Gói A.
--
-- Một **lượt đi** là một cặp (cơ sở, ngày giờ Việt Nam) có lượt quét cổng
-- được nhận của một vé đã gắn, kể cả vé web của đơn đặt bằng cùng số điện
-- thoại. Đủ mốc thì máy tự cấp: 2 lượt quà lưu niệm, 4 lượt và 8 lượt mỗi
-- mốc một vé người lớn miễn phí. Quầy đổi voucher: quà thì ghi đã trao, vé
-- miễn phí thì sinh đúng một vé mời 0 đ qua `erp_create_counter_comp_sale`
-- (migration 118), nên vé ấy hiện trong đối soát ca ở dòng vé mời.
--
-- ## Ai xem được gì
--
-- Cầm một mã đã gắn chỉ thấy số lượt, số điểm, mốc kế tiếp và ba số cuối của
-- điện thoại; mã voucher và các vé khác chỉ hiện khi nhập lại đúng số điện
-- thoại. Lý do: trưởng đoàn cầm mã của cả đoàn.
--
-- ## Chỉ tiến tới
--
-- Hai bảng mới, không sửa hàng nào của bảng cũ. Liên kết không xoá, không
-- sửa; voucher chỉ đi một bước `issued` → `redeemed`.

begin;

-- 1. Bảng -----------------------------------------------------------------------------

create table if not exists public.customer_loyalty_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_id uuid not null,
  source_kind text not null check (source_kind in ('group-member', 'ticket')),
  source_code text not null check (source_code ~ '^(TV-[A-Z0-9]{10}|[A-Z]{2,6}-[A-Z0-9-]{6,32})$'),
  ticket_id uuid not null references public.erp_tickets(id) on delete restrict,
  member_id uuid references public.erp_visitor_group_members(id) on delete restrict,
  linked_channel text not null check (linked_channel in ('web', 'erp')),
  linked_by_account_id text check (linked_by_account_id is null or char_length(linked_by_account_id) between 2 and 100),
  contact_hint text not null check (contact_hint ~ '^[0-9]{3}$'),
  linked_at timestamptz not null default now(),
  foreign key (identity_id, tenant_id)
    references public.customer_identities(id, tenant_id) on delete restrict,
  unique (tenant_id, source_code),
  check ((source_kind = 'group-member') = (member_id is not null)),
  check ((linked_channel = 'erp') = (linked_by_account_id is not null))
);

create index if not exists customer_loyalty_links_identity_idx
  on public.customer_loyalty_links (tenant_id, identity_id, linked_at desc);

create table if not exists public.customer_loyalty_vouchers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_id uuid not null,
  voucher_code text not null check (voucher_code ~ '^VC-[A-Z0-9]{8}$'),
  reward_kind text not null check (reward_kind in ('qua-luu-niem', 've-mien-phi')),
  milestone integer not null check (milestone between 1 and 1000),
  status text not null default 'issued' check (status in ('issued', 'redeemed')),
  issued_at timestamptz not null default now(),
  expires_on date not null,
  redeemed_at timestamptz,
  redeemed_by_account_id text,
  redeemed_by_name text,
  redeemed_site_id uuid references public.sites(id) on delete restrict,
  redeemed_sale_code text,
  foreign key (identity_id, tenant_id)
    references public.customer_identities(id, tenant_id) on delete restrict,
  unique (tenant_id, voucher_code),
  unique (tenant_id, identity_id, milestone),
  check (
    (status = 'issued' and redeemed_at is null and redeemed_by_account_id is null and redeemed_site_id is null)
    or (status = 'redeemed' and redeemed_at is not null and redeemed_by_account_id is not null
        and redeemed_site_id is not null
        and (reward_kind = 'qua-luu-niem' or redeemed_sale_code is not null))
  )
);

alter table public.customer_loyalty_links enable row level security;
alter table public.customer_loyalty_vouchers enable row level security;

create or replace function public.customer_loyalty_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  if tg_table_name = 'customer_loyalty_links' then
    raise exception using errcode = '55000', message = 'LOYALTY_APPEND_ONLY';
  end if;
  if tg_op = 'DELETE' or old.status <> 'issued' or new.status <> 'redeemed'
     or (new.id, new.tenant_id, new.identity_id, new.voucher_code, new.reward_kind,
         new.milestone, new.issued_at, new.expires_on)
        is distinct from
        (old.id, old.tenant_id, old.identity_id, old.voucher_code, old.reward_kind,
         old.milestone, old.issued_at, old.expires_on) then
    raise exception using errcode = '55000', message = 'LOYALTY_APPEND_ONLY';
  end if;
  return new;
end;
$ham$;

drop trigger if exists customer_loyalty_links_guard on public.customer_loyalty_links;
create trigger customer_loyalty_links_guard
  before update or delete on public.customer_loyalty_links
  for each row execute function public.customer_loyalty_guard();

drop trigger if exists customer_loyalty_vouchers_guard on public.customer_loyalty_vouchers;
create trigger customer_loyalty_vouchers_guard
  before update or delete on public.customer_loyalty_vouchers
  for each row execute function public.customer_loyalty_guard();

-- 2. Mốc thưởng --------------------------------------------------------------------------

create or replace function public.customer_loyalty_milestones()
returns table (milestone integer, reward_kind text, reward_label text)
language sql
immutable
set search_path = ''
as $ham$
  values
    (2, 'qua-luu-niem', 'Quà lưu niệm'),
    (4, 've-mien-phi', 'Một vé người lớn miễn phí'),
    (8, 've-mien-phi', 'Một vé người lớn miễn phí');
$ham$;

-- 3. Lượt đi của một số điện thoại -------------------------------------------------------

create or replace function public.customer_loyalty_visits(p_tenant_id uuid, p_identity_id uuid)
returns table (site_id uuid, visit_date date)
language sql
stable
security definer
set search_path = ''
as $ham$
  with ve as (
    -- Mã đã gắn: vé quầy, vé web lẻ, hay một người trong đoàn.
    select link.ticket_id, link.member_id
    from public.customer_loyalty_links link
    where link.tenant_id = p_tenant_id and link.identity_id = p_identity_id
    union
    -- Vé web của đơn đặt bằng cùng số điện thoại (hoặc cùng hồ sơ).
    select order_ticket.ticket_id, null::uuid
    from public.customer_identities identity
    join public.customer_orders customer_order
      on customer_order.tenant_id = identity.tenant_id
     and (customer_order.identity_id = identity.id
          or public.customer_canonical_profile_id(p_tenant_id, customer_order.profile_id)
             = public.customer_canonical_profile_id(p_tenant_id, identity.profile_id))
    join public.customer_order_tickets order_ticket
      on order_ticket.tenant_id = customer_order.tenant_id and order_ticket.order_id = customer_order.id
    where identity.tenant_id = p_tenant_id and identity.id = p_identity_id
      and customer_order.status = 'confirmed'
  )
  select distinct scan.site_id, (scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::date
  from ve
  join public.erp_gate_scan_events scan
    on scan.tenant_id = p_tenant_id and scan.ticket_id = ve.ticket_id
  where scan.result = 'accepted'
    -- Người trong đoàn: lượt quét mã riêng của mình, hoặc cả đoàn qua bằng mã đoàn.
    and (ve.member_id is null or scan.member_id is null or scan.member_id = ve.member_id);
$ham$;

-- Tóm tắt; `p_full` mới kèm mã voucher và danh sách vé (khi khách nhập lại đúng số).
-- Cấp voucher còn thiếu cho các mốc đã đủ, nên đây là hàm ghi.
create or replace function public.customer_loyalty_refresh(
  p_tenant_id uuid,
  p_identity_id uuid,
  p_full boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_visits integer;
  v_moc record;
  v_hint text;
begin
  select count(*)::integer into v_visits
  from public.customer_loyalty_visits(p_tenant_id, p_identity_id);

  for v_moc in select * from public.customer_loyalty_milestones() m where m.milestone <= v_visits loop
    insert into public.customer_loyalty_vouchers (
      tenant_id, identity_id, voucher_code, reward_kind, milestone, expires_on
    ) values (
      p_tenant_id, p_identity_id,
      'VC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_moc.reward_kind, v_moc.milestone,
      ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 365)
    ) on conflict (tenant_id, identity_id, milestone) do nothing;
  end loop;

  select link.contact_hint into v_hint
  from public.customer_loyalty_links link
  where link.tenant_id = p_tenant_id and link.identity_id = p_identity_id
  order by link.linked_at desc limit 1;

  return jsonb_build_object(
    'linked', true,
    'contact_hint', v_hint,
    'visits', v_visits,
    'points', v_visits * 100,
    'next_milestone', (
      select jsonb_build_object('visits', m.milestone, 'reward', m.reward_label, 'remaining', m.milestone - v_visits)
      from public.customer_loyalty_milestones() m
      where m.milestone > v_visits order by m.milestone limit 1
    ),
    'voucher_count', (
      select count(*) from public.customer_loyalty_vouchers v
      where v.tenant_id = p_tenant_id and v.identity_id = p_identity_id and v.status = 'issued'
    ),
    'visit_list', coalesce((
      select jsonb_agg(jsonb_build_object('site', site.name, 'date', visit.visit_date) order by visit.visit_date desc, site.name)
      from public.customer_loyalty_visits(p_tenant_id, p_identity_id) visit
      join public.sites site on site.id = visit.site_id
    ), '[]'::jsonb),
    'vouchers', case when p_full then coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', v.voucher_code, 'kind', v.reward_kind, 'milestone', v.milestone,
        'status', v.status, 'expires_on', v.expires_on, 'redeemed_at', v.redeemed_at,
        'label', (select m.reward_label from public.customer_loyalty_milestones() m where m.milestone = v.milestone)
      ) order by v.milestone)
      from public.customer_loyalty_vouchers v
      where v.tenant_id = p_tenant_id and v.identity_id = p_identity_id
    ), '[]'::jsonb) else null end,
    'tickets', case when p_full then coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', link.source_code, 'kind', link.source_kind, 'site', site.name,
        'valid_on', ticket.valid_on, 'status', ticket.status,
        'entries_allowed', case when link.member_id is null then ticket.entries_allowed else 1 end,
        'entries_used', case when link.member_id is null then ticket.entries_used
          -- Người trong đoàn: đã qua bằng mã riêng, hay cả đoàn qua bằng mã đoàn.
          else (select least(count(*), 1) from public.erp_gate_scan_events scan
                where scan.tenant_id = p_tenant_id and scan.ticket_id = link.ticket_id
                  and (scan.member_id = link.member_id or scan.member_id is null)
                  and scan.result = 'accepted')::integer end
      ) order by link.linked_at desc)
      from public.customer_loyalty_links link
      join public.erp_tickets ticket on ticket.id = link.ticket_id and ticket.tenant_id = link.tenant_id
      join public.sites site on site.id = ticket.site_id
      where link.tenant_id = p_tenant_id and link.identity_id = p_identity_id
    ), '[]'::jsonb) else null end
  );
end;
$ham$;

-- 4. Đọc mã: mã có hợp lệ không, đã gắn chưa ----------------------------------------------

create or replace function public.customer_loyalty_resolve_code(p_tenant_id uuid, p_code text)
returns table (source_kind text, ticket_id uuid, member_id uuid, ticket_status text)
language sql
stable
security definer
set search_path = ''
as $ham$
  select 'group-member', grp.ticket_id, member.id, ticket.status
  from public.erp_visitor_group_members member
  join public.erp_visitor_groups grp on grp.id = member.group_id and grp.tenant_id = member.tenant_id
  join public.erp_tickets ticket on ticket.id = grp.ticket_id and ticket.tenant_id = grp.tenant_id
  where member.tenant_id = p_tenant_id and member.member_code = upper(trim(p_code))
  union all
  select 'ticket', ticket.id, null::uuid, ticket.status
  from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id and ticket.ticket_code = upper(trim(p_code))
    and upper(trim(p_code)) !~ '^TV-'
  limit 1;
$ham$;

create or replace function public.customer_loyalty_by_code(p_tenant_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_link public.customer_loyalty_links;
begin
  select * into v_link from public.customer_loyalty_links link
  where link.tenant_id = p_tenant_id and link.source_code = upper(trim(coalesce(p_code, '')));
  if v_link.id is not null then
    return public.customer_loyalty_refresh(p_tenant_id, v_link.identity_id, false);
  end if;
  if not exists (select 1 from public.customer_loyalty_resolve_code(p_tenant_id, p_code)) then
    raise exception using errcode = 'P0002', message = 'LOYALTY_CODE_NOT_FOUND';
  end if;
  return jsonb_build_object('linked', false);
end;
$ham$;

-- Nhập lại đúng số điện thoại (mã băm) cùng một mã đã gắn: xem voucher và mọi vé.
create or replace function public.customer_loyalty_by_phone(
  p_tenant_id uuid,
  p_code text,
  p_identity_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_link public.customer_loyalty_links;
begin
  select link.* into v_link
  from public.customer_loyalty_links link
  join public.customer_identities identity
    on identity.id = link.identity_id and identity.tenant_id = link.tenant_id
  where link.tenant_id = p_tenant_id
    and link.source_code = upper(trim(coalesce(p_code, '')))
    and identity.identity_type = 'phone'
    and identity.identity_digest = p_identity_digest;
  if v_link.id is null then
    raise exception using errcode = '42501', message = 'LOYALTY_PHONE_MISMATCH';
  end if;
  return public.customer_loyalty_refresh(p_tenant_id, v_link.identity_id, true);
end;
$ham$;

-- 5. Gắn mã vào số điện thoại ---------------------------------------------------------------

create or replace function public.customer_loyalty_link_code(
  p_tenant_id uuid,
  p_code text,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_contact_hint text,
  p_marketing_enabled boolean,
  p_service_policy_version text,
  p_marketing_policy_version text,
  p_channel text,
  p_actor_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_channel text := trim(coalesce(p_channel, ''));
  v_actor text := nullif(trim(coalesce(p_actor_account_id, '')), '');
  v_src record;
  v_existing public.customer_loyalty_links;
  v_identity public.customer_identities;
  v_profile_id uuid;
  v_current_marketing public.customer_consents;
  v_marketing_status text;
begin
  if p_tenant_id is null or p_marketing_enabled is null
     or p_identity_digest !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_identity_ciphertext, '')) not between 24 and 4096
     or char_length(trim(coalesce(p_encryption_key_version, ''))) not between 1 and 40
     or coalesce(p_contact_hint, '') !~ '^[0-9]{3}$'
     or char_length(trim(coalesce(p_service_policy_version, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_marketing_policy_version, ''))) not between 1 and 80
     or v_channel not in ('web', 'erp')
     or (v_channel = 'erp') <> (v_actor is not null) then
    raise exception using errcode = '22023', message = 'LOYALTY_INPUT_INVALID';
  end if;

  select * into v_src from public.customer_loyalty_resolve_code(p_tenant_id, v_code);
  if v_src.ticket_id is null then
    raise exception using errcode = 'P0002', message = 'LOYALTY_CODE_NOT_FOUND';
  end if;
  if v_src.ticket_status = 'void' then
    raise exception using errcode = '55000', message = 'LOYALTY_TICKET_VOID';
  end if;

  select identity.* into v_identity
  from public.customer_identities identity
  where identity.tenant_id = p_tenant_id
    and identity.identity_type = 'phone'
    and identity.identity_digest = p_identity_digest
  for update;

  select * into v_existing from public.customer_loyalty_links link
  where link.tenant_id = p_tenant_id and link.source_code = v_code;
  if v_existing.id is not null then
    if v_identity.id is not null and v_existing.identity_id = v_identity.id then
      return public.customer_loyalty_refresh(p_tenant_id, v_identity.id, true);
    end if;
    raise exception using errcode = '23505', message = 'LOYALTY_CODE_ALREADY_CLAIMED';
  end if;

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
      p_tenant_id, v_profile_id, v_identity.id,
      case when v_channel = 'erp' then 'erp' else 'customer' end, v_actor,
      'identity-linked', 'loyalty', jsonb_build_object('method', 'phone', 'surface', v_src.source_kind)
    );
  else
    v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id);
  end if;

  -- Số gắn quá nhiều mã trong một ngày là dấu hiệu gom mã của người khác.
  if (
    select count(*) from public.customer_loyalty_links link
    where link.tenant_id = p_tenant_id and link.identity_id = v_identity.id
      and link.linked_at > now() - interval '1 day'
  ) >= 30 then
    raise exception using errcode = '54000', message = 'LOYALTY_RATE_LIMITED';
  end if;

  insert into public.customer_loyalty_links (
    tenant_id, identity_id, source_kind, source_code, ticket_id, member_id,
    linked_channel, linked_by_account_id, contact_hint
  ) values (
    p_tenant_id, v_identity.id, v_src.source_kind, v_code, v_src.ticket_id, v_src.member_id,
    v_channel, v_actor, p_contact_hint
  );

  -- Đồng ý dịch vụ: giữ vé và tích lượt bằng số này. Đồng ý tiếp thị ghi riêng.
  perform public.customer_record_consent(
    p_tenant_id, v_profile_id, 'essential_service', 'granted', v_channel,
    trim(p_service_policy_version), jsonb_build_object('surface', 'loyalty-link'), now()
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
  if v_current_marketing.id is null
     or v_current_marketing.status <> v_marketing_status
     or v_current_marketing.policy_version <> trim(p_marketing_policy_version) then
    perform public.customer_record_consent(
      p_tenant_id, v_profile_id, 'marketing_communications', v_marketing_status, v_channel,
      trim(p_marketing_policy_version), jsonb_build_object('surface', 'loyalty-link'), now()
    );
  end if;

  return public.customer_loyalty_refresh(p_tenant_id, v_identity.id, true)
    || jsonb_build_object('marketing_status', v_marketing_status);
end;
$ham$;

-- 6. Quầy đổi voucher --------------------------------------------------------------------------

create or replace function public.erp_lookup_loyalty_voucher(p_tenant_id uuid, p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select jsonb_build_object(
    'code', v.voucher_code,
    'kind', v.reward_kind,
    'label', (select m.reward_label from public.customer_loyalty_milestones() m where m.milestone = v.milestone),
    'milestone', v.milestone,
    'status', v.status,
    'expires_on', v.expires_on,
    'expired', v.expires_on < (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    'redeemed_at', v.redeemed_at,
    'redeemed_by_name', v.redeemed_by_name,
    'redeemed_sale_code', v.redeemed_sale_code,
    'contact_hint', (
      select link.contact_hint from public.customer_loyalty_links link
      where link.tenant_id = v.tenant_id and link.identity_id = v.identity_id
      order by link.linked_at desc limit 1
    ),
    'visits', (select count(*) from public.customer_loyalty_visits(v.tenant_id, v.identity_id))
  )
  from public.customer_loyalty_vouchers v
  where v.tenant_id = p_tenant_id and v.voucher_code = upper(trim(coalesce(p_code, '')));
$ham$;

create or replace function public.erp_redeem_loyalty_voucher(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_voucher_code text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_name text := trim(coalesce(p_actor_name, ''));
  v_voucher public.customer_loyalty_vouchers;
  v_receipt jsonb;
begin
  if p_tenant_id is null or p_site_id is null or char_length(v_actor) not between 2 and 100
     or char_length(v_name) not between 1 and 200
     or char_length(trim(coalesce(p_request_key, ''))) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'LOYALTY_INPUT_INVALID';
  end if;
  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor) then
    raise exception using errcode = '42501', message = 'COUNTER_SALE_ACTOR_REQUIRED';
  end if;

  select * into v_voucher from public.customer_loyalty_vouchers v
  where v.tenant_id = p_tenant_id and v.voucher_code = upper(trim(coalesce(p_voucher_code, '')))
  for update;
  if v_voucher.id is null then
    raise exception using errcode = 'P0002', message = 'LOYALTY_VOUCHER_NOT_FOUND';
  end if;
  if v_voucher.status = 'redeemed' then
    raise exception using errcode = '55000', message = 'LOYALTY_VOUCHER_REDEEMED';
  end if;
  if v_voucher.expires_on < (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception using errcode = '55000', message = 'LOYALTY_VOUCHER_EXPIRED';
  end if;

  if v_voucher.reward_kind = 've-mien-phi' then
    v_receipt := public.erp_create_counter_comp_sale(
      p_tenant_id, p_site_id, v_actor, v_name, p_acting_director_account_id,
      1, 0, v_actor, 'Đổi voucher ' || v_voucher.voucher_code || ' của khách thân thiết',
      trim(p_request_key)
    );
  end if;

  update public.customer_loyalty_vouchers
  set status = 'redeemed', redeemed_at = now(), redeemed_by_account_id = v_actor,
      redeemed_by_name = v_name, redeemed_site_id = p_site_id,
      redeemed_sale_code = v_receipt ->> 'sale_code'
  where id = v_voucher.id;

  return jsonb_build_object(
    'voucher', public.erp_lookup_loyalty_voucher(p_tenant_id, v_voucher.voucher_code),
    'receipt', v_receipt
  );
end;
$ham$;

-- 7. Màn khách hàng của ERP: tổng quan khách thân thiết ------------------------------------

create or replace function public.erp_loyalty_overview(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with nguoi as (
    select link.identity_id,
           count(*) as so_ma,
           max(link.linked_at) as gan_cuoi,
           (array_agg(link.contact_hint order by link.linked_at desc))[1] as hint,
           bool_or(link.source_kind = 'group-member') as tu_doan
    from public.customer_loyalty_links link
    where link.tenant_id = p_tenant_id
    group by link.identity_id
  ),
  day_du as (
    select nguoi.*,
           (select count(*) from public.customer_loyalty_visits(p_tenant_id, nguoi.identity_id))::integer as luot,
           (select consent.status from public.customer_identities identity
              join public.customer_consents consent
                on consent.tenant_id = identity.tenant_id
               and consent.profile_id = public.customer_canonical_profile_id(p_tenant_id, identity.profile_id)
               and consent.purpose = 'marketing_communications'
            where identity.id = nguoi.identity_id
            order by consent.occurred_at desc, consent.sequence_no desc limit 1) as tiep_thi
    from nguoi
  )
  select jsonb_build_object(
    'customers', (select count(*) from day_du),
    'links', (select coalesce(sum(so_ma), 0) from day_du),
    'from_groups', (select count(*) from day_du where tu_doan),
    'marketing_granted', (select count(*) from day_du where tiep_thi = 'granted'),
    'vouchers_issued', (select count(*) from public.customer_loyalty_vouchers v where v.tenant_id = p_tenant_id),
    'vouchers_redeemed', (select count(*) from public.customer_loyalty_vouchers v where v.tenant_id = p_tenant_id and v.status = 'redeemed'),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'contact_hint', d.hint, 'visits', d.luot, 'codes', d.so_ma,
        'marketing', coalesce(d.tiep_thi, 'denied'), 'last_linked_at', d.gan_cuoi,
        'vouchers', (select count(*) from public.customer_loyalty_vouchers v
                     where v.tenant_id = p_tenant_id and v.identity_id = d.identity_id),
        'vouchers_open', (select count(*) from public.customer_loyalty_vouchers v
                     where v.tenant_id = p_tenant_id and v.identity_id = d.identity_id and v.status = 'issued')
      ) order by d.luot desc, d.gan_cuoi desc)
      from (select * from day_du order by luot desc, gan_cuoi desc limit 30) d
    ), '[]'::jsonb)
  );
$ham$;

-- 8. Khoá cửa ------------------------------------------------------------------------------

revoke all on table public.customer_loyalty_links from public, anon, authenticated;
revoke all on table public.customer_loyalty_vouchers from public, anon, authenticated;
revoke all on function public.customer_loyalty_guard() from public, anon, authenticated, service_role;
revoke all on function public.customer_loyalty_milestones() from public, anon, authenticated;
revoke all on function public.customer_loyalty_visits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.customer_loyalty_refresh(uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.customer_loyalty_resolve_code(uuid, text) from public, anon, authenticated, service_role;

revoke all on function public.customer_loyalty_by_code(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_loyalty_by_code(uuid, text) to service_role;
revoke all on function public.customer_loyalty_by_phone(uuid, text, text) from public, anon, authenticated;
grant execute on function public.customer_loyalty_by_phone(uuid, text, text) to service_role;
revoke all on function public.customer_loyalty_link_code(
  uuid, text, text, text, text, text, boolean, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.customer_loyalty_link_code(
  uuid, text, text, text, text, text, boolean, text, text, text, text
) to service_role;
revoke all on function public.erp_lookup_loyalty_voucher(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_lookup_loyalty_voucher(uuid, text) to service_role;
revoke all on function public.erp_redeem_loyalty_voucher(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_redeem_loyalty_voucher(uuid, uuid, text, text, text, text, text) to service_role;
revoke all on function public.erp_loyalty_overview(uuid) from public, anon, authenticated;
grant execute on function public.erp_loyalty_overview(uuid) to service_role;

commit;
