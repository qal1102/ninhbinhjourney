-- TC-06: khách đoàn — mã đoàn, mã riêng từng người, và trạng thái ai đã vào.
--
-- ## Vấn đề thật
--
-- Hôm nay một đoàn tám người mua một vé `entries_allowed = 8`. Cổng đếm đủ tám
-- lượt, nhưng **không biết ai**. Đó chính là câu chủ dự án nói: *"khách đoàn là
-- nguồn dữ liệu lớn nhưng dễ bị thất thoát vì chỉ có thông tin trưởng đoàn."*
-- Bảy người còn lại đi qua cổng mà hệ thống không giữ lại được gì.
--
-- ## Nguyên tắc cứng: kích hoạt là tự nguyện
--
-- Chủ dự án nói rõ: *"khách chưa kích hoạt vẫn được tham quan."* Vì thế mã
-- riêng từng người **không thay thế** vé đoàn — hai đường cùng tồn tại, cùng
-- tiêu một hạn mức lượt vào duy nhất trên tấm vé. Ai quét mã của mình thì hệ
-- thống biết người đó đã vào; ai không quét vẫn đi qua bằng vé đoàn như trước.
-- Không ai bị chặn ở cổng vì chưa điền gì.
--
-- Cũng vì thế **không bắt một trăm khách điền biểu mẫu**: đoàn được tạo ra từ
-- chính đơn đã đặt, trưởng đoàn chỉ khai tên và số điện thoại của **mình**.
-- Tên từng thành viên là chỗ để trống, ai muốn thì tự điền sau.
--
-- **Không thu giấy tờ tuỳ thân** (QĐ-01). Bảng này cố ý không có một trường nào
-- cho số căn cước, hộ chiếu hay ảnh giấy tờ. Chỗ duy nhất được phép giữ thứ đó
-- là `customer_identities`, và nó không nối vào đây.
--
-- ## Vì sao mỗi thành viên mang sẵn nhóm chiều cao
--
-- Từ TC-03, một đơn có thể có hai tấm vé tại cùng một nơi: vé thường và vé của
-- trẻ dưới 1m3. Một mã thành viên phải biết mình thuộc tấm nào, nếu không thì
-- lúc quét hệ thống phải đoán — và đoán sai là trừ nhầm hạn mức. Số lượng hai
-- nhóm lấy thẳng từ đơn hàng, **không hỏi lại khách câu nào**.
--
-- ## Trạng thái "ai đã vào" không sinh ra bảng mới
--
-- Nhật ký quét đã ghi đủ: mã nào, vé nào, kết quả gì, lúc mấy giờ. Việc còn
-- thiếu chỉ là một cột `member_id` để nối. Dựng thêm một bảng trạng thái là tạo
-- nguồn sự thật thứ hai, rồi hai nguồn lệch nhau và không ai biết tin cái nào.
--
-- Một chỉ mục duy nhất từng phần chặn việc một người vào cùng một tấm vé hai
-- lần. Vé đoàn không mang `member_id` nên không bị chỉ mục này chạm tới — đúng
-- như trước, quét bao nhiêu lượt cũng được cho tới khi hết hạn mức.
--
-- ## Giới hạn đã biết, nói thẳng ra
--
-- 1. Đoàn tối đa **20 người**, vì `customer_orders.party_size` chặn ở 20. Đoàn
--    lớn hơn là một quyết định kinh doanh chưa ai duyệt, không phải một dòng mã.
-- 2. Chỉ tạo đoàn được từ **đơn đã xác nhận trên web**. Đoàn mua tại quầy chưa
--    có đơn để treo mã vào; làm phần đó cần một đường khác và không nằm trong
--    TC-06.

begin;

-- 1. Đoàn.
--
-- Một đơn đúng một đoàn: `unique (tenant_id, order_id)`. Cho phép hai đoàn trên
-- một đơn nghĩa là hai bộ mã cùng tiêu một hạn mức vé, và không ai đối soát nổi.
create table if not exists public.erp_visitor_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  group_code text not null check (group_code ~ '^DOAN-[A-Z0-9]{10}$'),
  -- Trưởng đoàn khai tối thiểu. Không có trường giấy tờ tuỳ thân, và đừng thêm.
  leader_name text not null check (char_length(trim(leader_name)) between 1 and 200),
  leader_phone text not null default '' check (char_length(leader_phone) <= 30),
  member_count integer not null check (member_count between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  unique (tenant_id, group_code),
  unique (tenant_id, order_id),
  unique (id, tenant_id)
);

-- 2. Thành viên.
--
-- `display_name` để trống là trạng thái bình thường và hợp lệ — phần lớn khách
-- sẽ không bao giờ điền, và họ vẫn vào được. `activated_at` chỉ ghi khi khách
-- thật sự tự khai tên, để sau này trả lời được câu "vì sao mình có tên người này".
create table if not exists public.erp_visitor_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null,
  member_index integer not null check (member_index between 1 and 20),
  member_code text not null check (member_code ~ '^TV-[A-Z0-9]{10}$'),
  guest_group text not null check (guest_group in ('adult', 'child')),
  display_name text not null default '' check (char_length(display_name) <= 200),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (group_id, tenant_id)
    references public.erp_visitor_groups(id, tenant_id) on delete cascade,
  unique (tenant_id, member_code),
  unique (group_id, member_index),
  unique (id, tenant_id),
  -- Kích hoạt mà không có tên thì kích hoạt cái gì.
  check (activated_at is null or char_length(trim(display_name)) > 0)
);

create index if not exists erp_visitor_group_members_group_idx
  on public.erp_visitor_group_members(tenant_id, group_id, member_index);

-- 3. Nhật ký quét biết mã vừa quét là của ai.
alter table public.erp_gate_scan_events
  add column if not exists member_id uuid
  references public.erp_visitor_group_members(id) on delete restrict;

-- Một người, một tấm vé, một lần vào. Điều kiện `member_id is not null` giữ cho
-- vé đoàn không bị chạm: nó vẫn quét được nhiều lượt như trước.
create unique index if not exists erp_gate_scan_events_member_entry_idx
  on public.erp_gate_scan_events(tenant_id, ticket_id, member_id)
  where member_id is not null and result = 'accepted';

-- Kết quả mới: đúng người, đúng vé, nhưng người này đã vào rồi.
--
-- Cố ý KHÔNG dùng lại 'exhausted'. Vé đoàn có thể còn thừa lượt trong khi chính
-- người này đã vào — báo "hết lượt" là nói sai với nhân viên đang đứng ở cổng,
-- và họ sẽ đi tìm một vấn đề không tồn tại.
alter table public.erp_gate_scan_events
  drop constraint if exists erp_gate_scan_events_result_check;
alter table public.erp_gate_scan_events
  add constraint erp_gate_scan_events_result_check
  check (
    result in (
      'accepted',
      'not-found',
      'wrong-site',
      'wrong-day',
      'exhausted',
      'already-entered',
      'void',
      'legacy-uncheckable'
    )
  );

-- 4. Tạo đoàn từ một đơn đã xác nhận.
create or replace function public.erp_create_visitor_group(
  p_tenant_id uuid,
  p_order_id uuid,
  p_anonymous_id uuid,
  p_leader_name text,
  p_leader_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.customer_orders;
  v_group public.erp_visitor_groups;
  v_name text := trim(coalesce(p_leader_name, ''));
  v_phone text := trim(coalesce(p_leader_phone, ''));
  v_profile_id uuid;
  v_index integer;
begin
  if p_tenant_id is null or p_order_id is null or p_anonymous_id is null
     or char_length(v_name) < 1 or char_length(v_name) > 200
     or char_length(v_phone) > 30 then
    raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
  end if;

  -- Hai lan bam cung mot don la mot lan tao. Khoa truoc moi tac dong phu de
  -- lan thu hai khong roi vao loi rang buoc duy nhat.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':doan:' || p_order_id::text, 0)
  );

  select * into v_order from public.customer_orders o
  where o.id = p_order_id and o.tenant_id = p_tenant_id;
  if v_order.id is null then
    raise exception using errcode = 'P0002', message = 'GROUP_ORDER_NOT_FOUND';
  end if;

  -- Don nay co phai cua chinh phien khach dang goi khong.
  --
  -- Thieu cau nay thi bat ky ai doan hoac nhat duoc mot `order_id` deu tao
  -- duoc doan tren don cua nguoi khac, va sinh ra mot bo ma QR di qua duoc
  -- cong bang ve ma ho khong tra tien.
  select public.customer_canonical_profile_id(p_tenant_id, profile.id)
  into v_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  if v_profile_id is null
     or v_profile_id <> public.customer_canonical_profile_id(p_tenant_id, v_order.profile_id) then
    raise exception using errcode = '42501', message = 'GROUP_OWNERSHIP_REQUIRED';
  end if;

  select * into v_group from public.erp_visitor_groups g
  where g.tenant_id = p_tenant_id and g.order_id = p_order_id;
  if v_group.id is not null then
    return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);
  end if;

  -- Don chua xac nhan thi chua co ve nao de ma dan vao.
  if v_order.status <> 'confirmed' then
    raise exception using errcode = '22023', message = 'GROUP_ORDER_NOT_CONFIRMED';
  end if;

  insert into public.erp_visitor_groups (
    tenant_id, order_id, group_code, leader_name, leader_phone, member_count
  ) values (
    p_tenant_id, p_order_id,
    'DOAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_name, v_phone, v_order.party_size
  ) returning * into v_group;

  -- So thanh vien tung nhom lay thang tu don hang. Khong hoi lai khach.
  for v_index in 1 .. v_order.party_size loop
    insert into public.erp_visitor_group_members (
      tenant_id, group_id, member_index, member_code, guest_group
    ) values (
      p_tenant_id, v_group.id, v_index,
      'TV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      case when v_index <= v_order.adults then 'adult' else 'child' end
    );
  end loop;

  return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);
end;
$$;

-- 5. Khách tự khai tên. Tự nguyện, và bỏ được.
--
-- Doi lai tien ich chu khong phai dieu kien vao cong: khong ham nao trong duong
-- soat ve doc `activated_at` de quyet dinh cho vao hay khong.
create or replace function public.erp_activate_group_member(
  p_tenant_id uuid,
  p_member_code text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.erp_visitor_group_members;
  v_name text := trim(coalesce(p_display_name, ''));
begin
  if p_tenant_id is null or char_length(v_name) > 200 then
    raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
  end if;

  select * into v_member from public.erp_visitor_group_members m
  where m.tenant_id = p_tenant_id
    and m.member_code = upper(trim(coalesce(p_member_code, '')))
  for update;
  if v_member.id is null then
    raise exception using errcode = 'P0002', message = 'GROUP_MEMBER_NOT_FOUND';
  end if;

  update public.erp_visitor_group_members set
    display_name = v_name,
    -- Ten rong nghia la rut lai. Rut lai thi xoa luon dau thoi diem, de sau nay
    -- khong con cach nao noi "nguoi nay tung dong y" ma khong con ten.
    activated_at = case when char_length(v_name) > 0 then coalesce(activated_at, now()) else null end
  where id = v_member.id
  returning * into v_member;

  return jsonb_build_object(
    'member_code', v_member.member_code,
    'display_name', v_member.display_name,
    'activated_at', v_member.activated_at
  );
end;
$$;

-- 6. Trạng thái đoàn: ai đã vào đâu, lúc nào.
--
-- Chi doc. Trang thai "da vao" doc thang tu nhat ky quet, khong tu mot bang
-- trang thai rieng — mot nguon su that, khong hai.
create or replace function public.erp_visitor_group_status(
  p_tenant_id uuid,
  p_group_code text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'group_code', g.group_code,
    'order_code', o.order_code,
    'leader_name', g.leader_name,
    'leader_phone', g.leader_phone,
    'visit_date', o.visit_date,
    'member_count', g.member_count,
    'activated_count', (
      select count(*) from public.erp_visitor_group_members m
      where m.group_id = g.id and m.activated_at is not null
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'member_index', m.member_index,
        'member_code', m.member_code,
        'guest_group', m.guest_group,
        'display_name', m.display_name,
        'activated', m.activated_at is not null,
        'entries', coalesce((
          select jsonb_agg(jsonb_build_object(
            'site_id', event.site_id,
            'scanned_at', event.scanned_at
          ) order by event.scanned_at)
          from public.erp_gate_scan_events event
          where event.tenant_id = m.tenant_id
            and event.member_id = m.id
            and event.result = 'accepted'
        ), '[]'::jsonb)
      ) order by m.member_index)
      from public.erp_visitor_group_members m
      where m.group_id = g.id
    ), '[]'::jsonb)
  )
  from public.erp_visitor_groups g
  join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id
  where g.tenant_id = p_tenant_id
    and g.group_code = upper(trim(coalesce(p_group_code, '')));
$$;

-- 7. Cổng nhận thêm mã thành viên.
--
-- Giu nguyen tung dong cua duong ve cu. Phan them vao chi chay khi ma quet
-- khong phai ma ve — nen mot ma ve hom nay van di qua dung con duong hom qua.
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

  if v_ticket.id is null then
    v_result := case when v_group_has_ticket then 'wrong-site' else 'not-found' end;
  elsif v_ticket.status = 'void' then v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_visit_date then v_result := 'wrong-day';
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

-- 8. Bản kê offline mang theo cả mã thành viên.
--
-- Thieu buoc nay thi cung mot ma QR chay duoc luc co mang va bi tu choi luc mat
-- mang — mot su khong nhat quan im lang, va nguoi o cong khong co cach nao doan.
--
-- `ticket_count` tu day dem SO MA trong ban ke, khong con la so tam ve. Giu
-- nguyen ten cot vi thiet bi ngoai hien truong doc theo ten do; doi ten la lam
-- hong ban dang chay ma khong duoc gi.
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
  ),
  moi_ma as (
    select ma, con_lai from ve_con_hieu_luc
    union all
    -- Ma thanh vien chua dung, thuoc dung tam ve cua nhom chieu cao cua ho.
    select member.member_code, ve.con_lai
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
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code_digest', encode(extensions.digest(ma, 'sha256'), 'hex'),
      'entries_remaining', con_lai
    ) order by ma), '[]'::jsonb),
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

-- 9. Khoá cửa. Không vai nào của khách hay của trình duyệt gọi thẳng được.
alter table public.erp_visitor_groups enable row level security;
alter table public.erp_visitor_group_members enable row level security;

revoke all on table public.erp_visitor_groups from public, anon, authenticated;
revoke all on table public.erp_visitor_group_members from public, anon, authenticated;
grant select, insert, update, delete on table public.erp_visitor_groups to service_role;
grant select, insert, update, delete on table public.erp_visitor_group_members to service_role;

revoke all on function public.erp_create_visitor_group(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.erp_create_visitor_group(
  uuid, uuid, uuid, text, text
) to service_role;

revoke all on function public.erp_activate_group_member(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.erp_activate_group_member(
  uuid, text, text
) to service_role;

revoke all on function public.erp_visitor_group_status(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.erp_visitor_group_status(
  uuid, text
) to service_role;

commit;
