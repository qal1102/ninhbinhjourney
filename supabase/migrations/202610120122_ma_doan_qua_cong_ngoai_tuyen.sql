-- Mã đoàn quầy qua cổng cả khi mất mạng (12/10/2026).
--
-- Chỗ hở ghi ở HANDOFF (`2de`): cổng có mạng nhận mã `DOAN-…` nhờ lớp máy
-- chủ web đổi sang mã vé của đoàn, còn cổng ngoại tuyến thì không: bản kê
-- không có mã đoàn, và lượt quét đồng bộ lên đi thẳng vào
-- `erp_gate_scan_ticket_at` vốn chỉ nhận mã vé và mã từng người.
--
-- Hai hàm dưới đây chép NGUYÊN VĂN bản mới nhất (063 và 066), chỉ thêm:
-- 1. `erp_gate_scan_ticket_at`: mã `DOAN-` của đoàn quầy đổi sang mã vé của
--    đoàn ngay đầu hàm. Phát lại cùng khoá vẫn khớp vì cùng đổi một cách.
-- 2. `erp_prepare_offline_gate_manifest`: thêm một dòng cho mỗi mã đoàn quầy,
--    mang `alias_of` = mã băm của mã vé đoàn, để máy cầm tay trừ chung một quỹ
--    lượt (`decideOfflineGateResult`).
--
-- Chỉ tiến tới: hai `create or replace`, quyền giữ nguyên, không đụng dữ liệu.

begin;

create or replace function public.erp_gate_scan_ticket_at(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_idempotency_key text,
  p_scanned_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_ticket public.erp_tickets;
  v_existing public.erp_gate_scan_events;
  v_result text;
  v_event public.erp_gate_scan_events;
  v_visit_date date := (p_scanned_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_member public.erp_visitor_group_members;
  v_group_has_ticket boolean := false;
  v_payment_due integer := 0;
  -- TC-18: đoàn quầy treo thẳng vào một vé, không qua cầu nối đơn web.
  v_group_ticket_id uuid;
  -- 12/10/2026: mã đoàn quầy đổi sang mã vé của đoàn.
  v_ma_ve_doan text;
begin
  -- TC-06: mot ma QR duy nhat phai lam duoc ca hai viec.
  --
  -- May quet o cong doc no de cho khach vao; dien thoai cua chinh khach quet
  -- no de mo trang tu ghi ten. Muon dien thoai mo duoc thi ma QR phai chua mot
  -- dia chi web — va luc do may quet o cong se go NGUYEN CA DIA CHI vao o quet.
  --
  -- Cat lay doan cuoi de hai duong cung ve mot ma. Ma ve va ma thanh vien deu
  -- khong bao gio chua dau '/', nen luat nay khong dung toi mot ma hop le nao.
  --
  -- Phia may quet ngoai tuyen bam ma truoc khi doi chieu, nen no phai cat y
  -- het cach nay: xem `normalizeScannedCode` trong `lib/erp/offline-gate-store.ts`.
  -- Hai ben lech nhau mot ky tu la ma QR chay duoc online va truot offline.
  if position('/' in v_code) > 0 then
    v_code := upper(trim(regexp_replace(
      rtrim(split_part(split_part(v_code, '?', 1), '#', 1), '/'),
      '^.*/', ''
    )));
  end if;

  -- 12/10/2026 (migration 122): mã đoàn quầy `DOAN-…` qua cổng như mã vé của
  -- đoàn. Trước đây chỉ lớp máy chủ web đổi (`ticketCodeForGroupCode`), nên
  -- lượt quét ngoại tuyến mang mã đoàn đồng bộ lên bị trả "not-found". Đoàn
  -- web không treo vào một vé nào, nên mã đoàn web vẫn không qua được cổng.
  if v_code ~ '^DOAN-[A-Z0-9]{10}$' then
    select upper(ticket.ticket_code) into v_ma_ve_doan
    from public.erp_visitor_groups grp
    join public.erp_tickets ticket on ticket.id = grp.ticket_id and ticket.tenant_id = grp.tenant_id
    where grp.tenant_id = p_tenant_id and grp.group_code = v_code;
    if v_ma_ve_doan is not null then
      v_code := v_ma_ve_doan;
    end if;
  end if;

  if char_length(v_code) < 6 or char_length(v_code) > 60
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or v_key is null or char_length(v_key) > 128
     or p_scanned_at < now() - interval '36 hours'
     or p_scanned_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'GATE_SCAN_CODE_INVALID';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  select * into v_existing from public.erp_gate_scan_events event
  where event.tenant_id = p_tenant_id and event.idempotency_key = v_key;
  if v_existing.id is not null then
    if v_existing.site_id <> p_site_id or v_existing.code <> v_code
       or v_existing.scanned_by_account_id <> v_actor_id then
      raise exception using errcode = '23505', message = 'GATE_SCAN_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'event_id', v_existing.id, 'result', v_existing.result,
      'code', v_existing.code, 'scanned_at', v_existing.scanned_at,
      'replayed', true, 'ticket', null
    );
  end if;

  select * into v_ticket from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id and ticket.ticket_code = v_code for update;

  -- TC-06: khong phai ma ve thi thu xem co phai ma thanh vien khong.
  if v_ticket.id is null then
    select * into v_member from public.erp_visitor_group_members m
    where m.tenant_id = p_tenant_id and m.member_code = v_code;
    if v_member.id is not null then
      select g.ticket_id into v_group_ticket_id
      from public.erp_visitor_groups g
      where g.id = v_member.group_id and g.tenant_id = p_tenant_id;

      if v_group_ticket_id is not null then
        -- TC-18: doan mua tai quay — mot ve duy nhat, mot co so duy nhat,
        -- khong tach theo guest_group vi quay khong ban ve tre em rieng.
        select ticket.* into v_ticket
        from public.erp_tickets ticket
        where ticket.id = v_group_ticket_id and ticket.tenant_id = p_tenant_id
        for update;
        v_group_has_ticket := v_ticket.id is not null;
      else
        -- Ve cua doan tai chinh co so nay, dung nhom chieu cao cua nguoi nay.
        select ticket.* into v_ticket
        from public.erp_visitor_groups g
        join public.customer_order_tickets bridge
          on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id
        join public.erp_tickets ticket on ticket.id = bridge.ticket_id
        where g.id = v_member.group_id
          and g.tenant_id = p_tenant_id
          and bridge.site_id = p_site_id
          and bridge.guest_group = v_member.guest_group
        for update of ticket;
        if v_ticket.id is null then
          -- Doan co ve, chi la khong phai o cua nay. Noi dung nhu vay thi nhan
          -- vien biet phai chi khach di dau, thay vi tuong ma gia.
          select exists (
            select 1
            from public.erp_visitor_groups g
            join public.customer_order_tickets bridge
              on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id
            where g.id = v_member.group_id and g.tenant_id = p_tenant_id
          ) into v_group_has_ticket;
        end if;
      end if;
    end if;
  end if;

  -- TC-22: ve nay co dang no tien khong.
  --
  -- So thanh toan CHI GHI THEM (trigger `customer_append_only`), nen mot khoan
  -- da thu khong the la hang cu duoc sua lai — no la mot hang moi. Vi vay "con
  -- no" = co hang cho thu, VA chua co hang da thu nao cho cung don.
  --
  -- Ve doan quay khong co cau noi `customer_order_tickets` nao ca (khong di
  -- qua don web), nen cau nay tu nhien khong khop hang nao va v_payment_due
  -- giu nguyen 0 — dung thuc te: quay khong co khai niem "no tien roi thu sau".
  if v_ticket.id is not null then
    select coalesce(cho_thu.amount_vnd, 0) into v_payment_due
    from public.customer_order_tickets bridge
    join public.customer_payment_attempts cho_thu
      on cho_thu.order_id = bridge.order_id
     and cho_thu.tenant_id = bridge.tenant_id
     and cho_thu.mode = 'pay-on-site'
     and cho_thu.status = 'pending'
    where bridge.ticket_id = v_ticket.id
      and bridge.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.customer_payment_attempts da_thu
        where da_thu.order_id = bridge.order_id
          and da_thu.tenant_id = bridge.tenant_id
          and da_thu.mode = 'pay-on-site'
          and da_thu.status = 'succeeded'
      )
    limit 1;
    v_payment_due := coalesce(v_payment_due, 0);
  end if;

  if v_ticket.id is null then
    v_result := case when v_group_has_ticket then 'wrong-site' else 'not-found' end;
  elsif v_ticket.status = 'void' then v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_visit_date then v_result := 'wrong-day';
  elsif v_payment_due > 0 then
    -- Ve that, dung ngay, dung cua, con luot — chi la chua tra tien. Khong tru
    -- luot vao: thu xong nhan vien quet lai, luc do moi la mot luot vao that.
    v_result := 'payment-due';
  elsif v_member.id is not null and exists (
    select 1 from public.erp_gate_scan_events event
    where event.tenant_id = p_tenant_id
      and event.ticket_id = v_ticket.id
      and event.member_id = v_member.id
      and event.result = 'accepted'
  ) then
    -- Nguoi nay da vao roi. Ve doan co the con thua luot, nen KHONG phai
    -- 'exhausted' — noi sai o day la day nhan vien di tim mot van de khong co.
    v_result := 'already-entered';
  elsif v_ticket.entries_used >= v_ticket.entries_allowed then v_result := 'exhausted';
  else
    v_result := 'accepted';
    update public.erp_tickets set
      entries_used = entries_used + 1,
      status = case when entries_used + 1 >= entries_allowed then 'used' else 'partially-used' end,
      updated_at = now()
    where id = v_ticket.id returning * into v_ticket;
  end if;

  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
    ticket_id, member_id, result, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name,
    case when v_ticket.id is null then null else v_ticket.id end,
    case when v_member.id is null then null else v_member.id end,
    v_result, v_key
  ) returning * into v_event;

  return jsonb_build_object(
    'event_id', v_event.id, 'result', v_result, 'code', v_code,
    'scanned_at', v_event.scanned_at, 'replayed', false,
    'payment_due_vnd', v_payment_due,
    'member', case when v_member.id is null then null else jsonb_build_object(
      'member_index', v_member.member_index,
      'guest_group', v_member.guest_group,
      'display_name', v_member.display_name
    ) end,
    'ticket', case when v_ticket.id is null then null else jsonb_build_object(
      'ticket_code', v_ticket.ticket_code, 'product', v_ticket.product,
      'guest_name', v_ticket.guest_name, 'guest_phone', v_ticket.guest_phone,
      'booking_reference', v_ticket.booking_reference, 'channel', v_ticket.channel,
      'valid_on', v_ticket.valid_on, 'entries_allowed', v_ticket.entries_allowed,
      'entries_used', v_ticket.entries_used, 'status', v_ticket.status
    ) end
  );
end;
$$;

create or replace function public.erp_prepare_offline_gate_manifest(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest_id uuid := gen_random_uuid();
  v_service_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_expires_at timestamptz;
  v_tickets jsonb;
  v_count integer;
  v_digest text;
begin
  if p_device_id is null or not public.erp_gate_actor_can_scan(p_tenant_id, p_site_id, p_actor_account_id) then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  v_expires_at := least(
    now() + interval '12 hours',
    ((v_service_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  );

  with ve_con_hieu_luc as (
    select ticket.id, upper(trim(ticket.ticket_code)) as ma,
           ticket.entries_allowed - ticket.entries_used as con_lai
    from public.erp_tickets ticket
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = p_site_id
      and ticket.valid_on = v_service_date
      and ticket.status in ('issued', 'partially-used')
      and ticket.entries_used < ticket.entries_allowed
      -- TC-22: ve con no tien thi khong phat ra ngoai tuyen. Doc y het cach
      -- cua o quet: co hang cho thu, va chua co hang da thu nao cho don do.
      --
      -- Ve doan quay khong co hang cau noi nao, nen cau nay khong khop gi va
      -- ve quay luon duoc phat ra — dung thuc te: quay thu tien ngay luc ban.
      and not exists (
        select 1
        from public.customer_order_tickets bridge
        join public.customer_payment_attempts cho_thu
          on cho_thu.order_id = bridge.order_id
         and cho_thu.tenant_id = bridge.tenant_id
         and cho_thu.mode = 'pay-on-site'
         and cho_thu.status = 'pending'
        where bridge.ticket_id = ticket.id
          and bridge.tenant_id = ticket.tenant_id
          and not exists (
            select 1 from public.customer_payment_attempts da_thu
            where da_thu.order_id = bridge.order_id
              and da_thu.tenant_id = bridge.tenant_id
              and da_thu.mode = 'pay-on-site'
              and da_thu.status = 'succeeded'
          )
      )
  ),
  moi_ma as (
    select ma, con_lai, null::text as bi_danh_cua from ve_con_hieu_luc
    union all
    -- Ma thanh vien chua dung, thuoc dung tam ve cua nhom chieu cao cua ho.
    select member.member_code, ve.con_lai, null::text
    from public.erp_visitor_group_members member
    join public.erp_visitor_groups grp
      on grp.id = member.group_id and grp.tenant_id = member.tenant_id
    join public.customer_order_tickets bridge
      on bridge.order_id = grp.order_id and bridge.tenant_id = grp.tenant_id
      and bridge.guest_group = member.guest_group
    join ve_con_hieu_luc ve on ve.id = bridge.ticket_id
    where member.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.erp_gate_scan_events event
        where event.tenant_id = member.tenant_id
          and event.member_id = member.id
          and event.ticket_id = ve.id
          and event.result = 'accepted'
      )
    union all
    -- GATE-OFFLINE-02: doan mua tai quay treo thang vao MOT tam ve, khong qua
    -- don web. Khong tach theo `guest_group` vi quay khong ban ve tre em rieng
    -- — dung y het nhanh truc tuyen o migration 063.
    --
    -- `grp.order_id is null` la thua duoi rang buoc
    -- `erp_visitor_groups_origin_xor_check` (moi doan dung mot nguon goc), nen
    -- no khong doi mot hang ket qua nao. No o day de neu mot phien sau lo noi
    -- rang buoc, nhanh nay tu nhuong doan web cho nhanh tren thay vi phat ra
    -- hai lan cung mot ma.
    select member.member_code, ve.con_lai, null::text
    from public.erp_visitor_group_members member
    join public.erp_visitor_groups grp
      on grp.id = member.group_id and grp.tenant_id = member.tenant_id
    join ve_con_hieu_luc ve on ve.id = grp.ticket_id
    where member.tenant_id = p_tenant_id
      and grp.order_id is null
      and not exists (
        select 1 from public.erp_gate_scan_events event
        where event.tenant_id = member.tenant_id
          and event.member_id = member.id
          and event.ticket_id = ve.id
          and event.result = 'accepted'
      )
    union all
    -- 12/10/2026 (migration 122): mã đoàn quầy là BÍ DANH của mã vé đoàn. Máy
    -- cầm tay trừ chung quỹ lượt với mã vé (`aliasOf`), không cho vào gấp đôi.
    select upper(grp.group_code), ve.con_lai, ve.ma
    from public.erp_visitor_groups grp
    join ve_con_hieu_luc ve on ve.id = grp.ticket_id
    where grp.tenant_id = p_tenant_id
      and grp.order_id is null
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code_digest', encode(extensions.digest(ma, 'sha256'), 'hex'),
      'entries_remaining', con_lai
    ) || case when bi_danh_cua is null then '{}'::jsonb
         else jsonb_build_object('alias_of', encode(extensions.digest(bi_danh_cua, 'sha256'), 'hex')) end
    order by ma), '[]'::jsonb),
    count(*)::integer
  into v_tickets, v_count
  from moi_ma;

  v_digest := encode(extensions.digest(v_tickets::text, 'sha256'), 'hex');

  insert into public.erp_gate_offline_manifests (
    id, tenant_id, site_id, device_id, actor_account_id, service_date,
    ticket_count, snapshot_digest, expires_at
  ) values (
    v_manifest_id, p_tenant_id, p_site_id, p_device_id, trim(p_actor_account_id),
    v_service_date, v_count, v_digest, v_expires_at
  );

  return jsonb_build_object(
    'manifest_id', v_manifest_id,
    'site_id', p_site_id,
    'device_id', p_device_id,
    'service_date', v_service_date,
    'issued_at', now(),
    'expires_at', v_expires_at,
    'ticket_count', v_count,
    'snapshot_digest', v_digest,
    'tickets', v_tickets
  );
end;
$$;

-- Như 045: hàm soát chỉ gọi được từ bên trong kho, kể cả service_role không gọi thẳng.
revoke all on function public.erp_gate_scan_ticket_at(uuid, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_prepare_offline_gate_manifest(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.erp_prepare_offline_gate_manifest(uuid, uuid, text, uuid)
  to service_role;

commit;
