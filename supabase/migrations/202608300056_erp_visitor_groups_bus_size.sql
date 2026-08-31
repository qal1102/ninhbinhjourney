-- TC-15: đoàn thật — xe 32 chỗ, nhãn đoàn đọc được, và trưởng đoàn điền hộ.
--
-- ## Vì sao có
--
-- TC-06 dựng xong mã đoàn và mã riêng từng người, nhưng **một xe 32 chỗ không
-- lọt qua nổi**: `customer_orders.party_size` chặn ở 20. Chủ dự án nói thẳng
-- ngày 30/08 là đoàn thật đi xe 32 người, nên đây là quyết định kinh doanh đã
-- có, không phải một suy đoán kỹ thuật.
--
-- ## Vì sao là 45, và vì sao vẫn phải có trần
--
-- Xe khách lớn phổ biến ở Việt Nam là 45 chỗ. Lấy 45 thì phủ được cả xe 32 lẫn
-- xe lớn nhất, và còn chỗ thở.
--
-- Bỏ hẳn trần thì **sai**: trần ở đây không để hạn chế kinh doanh, nó chặn một
-- cú gõ nhầm biến thành một lượt giữ 10.000 chỗ. Ngưỡng sức chứa thật của cơ sở
-- vẫn là thứ chặn cuối cùng, nhưng một con số vô lý nên bị chặn ngay từ cửa.
--
-- **Sáu chỗ cùng chặn ở 20, phải nới cả sáu.** Bỏ sót một chỗ thì lỗi chỉ lộ ra
-- lúc có đoàn thật đứng ở quầy: đơn tạo được mà dòng đơn thì không, hoặc vé
-- phát được mà cầu nối vé thì không.
--
-- Bản đầu của chính migration này **sót đúng một chỗ**:
-- `customer_booking_hold_slots.quantity`. Lần chạy thử trên production bắt được
-- và cuộn lại, nên không ai thấy. Cách tìm sai là đi `grep` chuỗi
-- `between 1 and 20` trong tệp migration — ràng buộc đó viết bằng câu khác nên
-- không khớp. Cách đúng là **hỏi thẳng cơ sở dữ liệu**:
--
--   select conrelid::regclass::text, conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where contype = 'c' and pg_get_constraintdef(oid) ~ '<= 20\)';
--
-- Tên cả sáu ràng buộc đã đọc thẳng từ production trước khi viết, không đoán.
--
-- ## Nhãn đoàn
--
-- Chủ dự án nói *"đoàn tới từ Hà Nội ID bao nhiêu"*. Mã máy `DOAN-…` thì máy
-- đọc tốt còn người thì không nhớ nổi, nên thêm một nhãn người tự đặt: nơi xuất
-- phát, tên đoàn, công ty lữ hành. Để trống được — nó là chỗ dựa cho trí nhớ,
-- không phải một trường bắt buộc.
--
-- ## Trưởng đoàn điền hộ, và ranh giới của việc đó
--
-- Trưởng đoàn điền tên 31 người còn lại nghĩa là **một người khai dữ liệu cá
-- nhân của 31 người chưa được hỏi**. Vì thế:
--
-- 1. Chỉ **tên gọi**. Không hỏi tuổi, không hỏi giấy tờ.
-- 2. Quyền điền hộ buộc phải là **phiên khách đã đặt đơn**, không phải mã đoàn.
--    Mã đoàn là thứ trưởng đoàn gửi cho cả đoàn, ai cũng cầm — nếu mã đoàn đủ
--    để đổi tên người khác thì bất kỳ ai trong đoàn cũng sửa được tên mọi người.
-- 3. Chính chủ vẫn tự sửa được tên mình bằng mã riêng, và **sửa sau thì đè lên**
--    thứ trưởng đoàn đã điền. Người nói về mình là nguồn đúng hơn.
--
-- ## Thay tuổi bằng nhu cầu chăm sóc
--
-- Chỗ này cố ý làm khác thói quen. Muốn phục vụ tử tế thì cái cần biết không
-- phải "bao nhiêu tuổi" mà là **"có cần để ý gì không"**. Hỏi thẳng điều cần
-- biết thì thu ít dữ liệu cá nhân hơn hẳn mà vẫn đủ dùng, và nối được ngay vào
-- TC-13. Khách tự khai, để trống là bình thường.

begin;

-- 1. Nới cả sáu chỗ đang chặn ở 20 người.
--
-- Chỗ giữ trong kho công suất phải nới cùng lúc: nó là nơi ghi số khách của
-- từng chặng, nên nó chặn thì cả lượt giữ chỗ hỏng ở giữa chừng.
alter table public.customer_booking_hold_slots
  drop constraint if exists customer_booking_hold_slots_quantity_check;
alter table public.customer_booking_hold_slots
  add constraint customer_booking_hold_slots_quantity_check
  check (quantity between 1 and 45);

alter table public.customer_orders
  drop constraint if exists customer_orders_party_size_check;
alter table public.customer_orders
  add constraint customer_orders_party_size_check
  check (party_size between 1 and 45);

alter table public.customer_order_lines
  drop constraint if exists customer_order_lines_quantity_check;
alter table public.customer_order_lines
  add constraint customer_order_lines_quantity_check
  check (quantity between 1 and 45);

alter table public.customer_order_tickets
  drop constraint if exists customer_order_tickets_entries_allowed_check;
alter table public.customer_order_tickets
  add constraint customer_order_tickets_entries_allowed_check
  check (entries_allowed between 1 and 45);

alter table public.erp_visitor_groups
  drop constraint if exists erp_visitor_groups_member_count_check;
alter table public.erp_visitor_groups
  add constraint erp_visitor_groups_member_count_check
  check (member_count between 1 and 45);

alter table public.erp_visitor_group_members
  drop constraint if exists erp_visitor_group_members_member_index_check;
alter table public.erp_visitor_group_members
  add constraint erp_visitor_group_members_member_index_check
  check (member_index between 1 and 45);

-- 2. Nhãn đoàn cho người đọc, và nhu cầu chăm sóc do khách tự khai.
alter table public.erp_visitor_groups
  add column if not exists group_label text not null default '';
alter table public.erp_visitor_groups
  drop constraint if exists erp_visitor_groups_group_label_check;
alter table public.erp_visitor_groups
  add constraint erp_visitor_groups_group_label_check
  check (char_length(group_label) <= 120);

alter table public.erp_visitor_group_members
  add column if not exists care_need text not null default 'none';
alter table public.erp_visitor_group_members
  drop constraint if exists erp_visitor_group_members_care_need_check;
alter table public.erp_visitor_group_members
  add constraint erp_visitor_group_members_care_need_check
  check (care_need in ('none', 'young-child', 'elderly', 'mobility'));

-- 3. Hàm giữ chỗ nhận tới 45 khách.
--
-- Thân hàm lấy nguyên văn từ `202608290053` dòng 185–524, đổi đúng một con số
-- và thêm một khối chú thích. Chữ ký không đổi nên `create or replace` đủ.
create or replace function public.customer_create_booking_hold(
  p_tenant_id uuid,
  p_request_id uuid,
  p_anonymous_id uuid,
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_occurred_at timestamptz,
  p_slot_starts_at timestamptz default null,
  -- TC-03: tach nguoi lon / tre em. De trong thi moi khach tinh la nguoi
  -- lon, dung bang hanh vi truoc TC-03 — moi loi goi cu van chay y nhu truoc.
  p_adults integer default null,
  p_children integer default null
)
returns table (
  order_id uuid,
  order_code text,
  hold_id uuid,
  hold_status text,
  expires_at timestamptz,
  total_vnd integer,
  currency text,
  slots jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_product public.products;
  v_existing_hold public.customer_booking_holds;
  v_existing_order public.customer_orders;
  v_order public.customer_orders;
  v_hold public.customer_booking_holds;
  v_template public.customer_product_capacity_templates;
  v_threshold public.erp_capacity_thresholds;
  v_slot public.customer_booking_slots;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reserved integer;
  v_template_count integer := 0;
  v_payload_digest text;
  v_slots jsonb;
  v_adults integer;
  v_children integer;
begin
  if p_tenant_id is null or p_request_id is null or p_anonymous_id is null
     or p_product_id is null or p_visit_date is null
     or p_party_size not between 1 and 45 or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or p_visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90 then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_INPUT_INVALID';
  end if;

  -- TC-15: tran 45 khach mot luot dat.
  --
  -- Khong phai con so tuy tien: mot xe khach lon o Viet Nam la 45 cho, va
  -- chu du an noi thang la co doan 32 nguoi. Van phai co tran, vi tran o day
  -- chan mot cu go nham thanh mot luot giu 10.000 cho.

  -- TC-03: hai nhom tuoi phai cong dung bang tong so khach.
  --
  -- Khong suy dien, khong tu lam tron. So tre em quyet dinh cho ngoi tren
  -- thuyen va nguoi di kem, nen mot con so sai o day di thang ra toi cong.
  -- Bat buoc it nhat mot nguoi lon: tre em khong di mot minh.
  v_adults := coalesce(p_adults, p_party_size);
  v_children := coalesce(p_children, 0);
  if v_adults < 1 or v_children < 0 or v_adults + v_children <> p_party_size then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_PARTY_MIX_INVALID';
  end if;

  -- Serialize retries before any side effect so concurrent use of one key is
  -- a replay, never a leaked unique-constraint failure.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':booking:' || p_request_id::text, 0)
  );

  insert into public.customer_profiles as existing (tenant_id, anonymous_id)
  values (p_tenant_id, p_anonymous_id)
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(existing.updated_at, now())
  returning existing.id into v_source_profile_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  v_payload_digest := public.customer_booking_payload_digest(
    p_product_id, p_visit_date, p_party_size, p_slot_starts_at,
    v_adults, v_children
  );
  select hold.* into v_existing_hold
  from public.customer_booking_holds hold
  where hold.tenant_id = p_tenant_id and hold.idempotency_key = p_request_id;
  if v_existing_hold.id is not null then
    if public.customer_canonical_profile_id(
         p_tenant_id, v_existing_hold.profile_id
       ) <> v_profile_id
       or v_existing_hold.payload_digest <> v_payload_digest then
      raise exception using errcode = '23505', message = 'CUSTOMER_BOOKING_ID_COLLISION';
    end if;
    select customer_order.* into v_existing_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_hold.order_id
      and customer_order.tenant_id = p_tenant_id;
    if v_existing_hold.status = 'active' and v_existing_hold.expires_at <= now() then
      update public.customer_booking_holds
      set status = 'expired'
      where id = v_existing_hold.id
      returning * into v_existing_hold;
      update public.customer_orders
      set status = 'expired', updated_at = now()
      where id = v_existing_order.id
      returning * into v_existing_order;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'slot_id', slot.id,
      'site_id', slot.site_id,
      'starts_at', slot.starts_at,
      'ends_at', slot.ends_at,
      'capacity_source', slot.capacity_source_kind,
      'threshold_version', slot.threshold_version
    ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
    into v_slots
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_existing_hold.id;
    return query select
      v_existing_order.id, v_existing_order.order_code, v_existing_hold.id,
      v_existing_hold.status,
      v_existing_hold.expires_at, v_existing_order.total_vnd,
      v_existing_order.currency, v_slots, false;
    return;
  end if;

  if (
    select count(*)
    from public.customer_booking_holds hold
    where hold.tenant_id = p_tenant_id
      and hold.profile_id = v_profile_id
      and hold.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception using errcode = '54000', message = 'CUSTOMER_BOOKING_RATE_LIMITED';
  end if;

  select product.* into v_product
  from public.products product
  where product.id = p_product_id
    and product.tenant_id = p_tenant_id
    and product.active
    and product.ledger_type = 'service-commerce';
  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PRODUCT_UNAVAILABLE';
  end if;

  insert into public.customer_orders (
    tenant_id, profile_id, product_id, order_code, visit_date, party_size,
    adults, children, unit_price_vnd, total_vnd, currency, status
  ) values (
    p_tenant_id, v_profile_id, v_product.id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_visit_date, p_party_size, v_adults, v_children, v_product.demo_price_vnd,
    -- Tinh theo so khach CO VE. Tre duoi 1m3 khong mua ve.
    v_product.demo_price_vnd * v_adults, 'VND', 'holding'
  ) returning * into v_order;

  -- Hai dong tach bach, hai muc gia khac han nhau.
  --
  -- Chu du an chot 29/08/2026: tre DUOI 1m3 khong mua ve, tu 1m3 tro len tinh
  -- gia thuong. Dong 'child' vi the co don gia bang khong.
  --
  -- Van ghi ra thanh mot dong rieng chu khong bo di, vi ba ly do: don hang
  -- phai doc duoc la co bao nhieu tre nho di cung, ke toan phai thay ro doan
  -- nay duoc mien bao nhieu, va sau nay chu du an doi y ve gia thi chi phai
  -- sua dung mot so o day.
  insert into public.customer_order_lines (
    tenant_id, order_id, product_id, guest_group, quantity,
    unit_price_vnd, total_vnd, ledger_type
  ) values (
    p_tenant_id, v_order.id, v_product.id, 'adult', v_adults,
    v_product.demo_price_vnd, v_product.demo_price_vnd * v_adults,
    'service-commerce'
  );
  if v_children > 0 then
    insert into public.customer_order_lines (
      tenant_id, order_id, product_id, guest_group, quantity,
      unit_price_vnd, total_vnd, ledger_type
    ) values (
      p_tenant_id, v_order.id, v_product.id, 'child', v_children,
      0, 0,
      'service-commerce'
    );
  end if;

  insert into public.customer_booking_holds (
    tenant_id, order_id, profile_id, idempotency_key, payload_digest,
    status, expires_at
  ) values (
    p_tenant_id, v_order.id, v_profile_id, p_request_id, v_payload_digest,
    'active', now() + interval '15 minutes'
  ) returning * into v_hold;

  for v_template in
    select template.*
    from public.customer_product_capacity_templates template
    where template.tenant_id = p_tenant_id
      and template.product_id = p_product_id
      and template.active
      -- Khong truyen khung gio thi giu nguyen hanh vi cu: giu moi khung dang bat.
      and (
        p_slot_starts_at is null
        -- GIO KHOI HANH cua chuyen, khong phai gio cua tung chang. Doi cho nay
        -- ve local_start_time la cat doi hanh trinh nhieu chang mot lan nua.
        or (p_visit_date + template.departure_time) at time zone 'Asia/Ho_Chi_Minh' = p_slot_starts_at
      )
    -- Thu tu nay la THU TU KHOA, khong phai chuyen trinh bay.
    -- local_start_time cong voi p_visit_date ra dung starts_at, nen
    -- (gio, co so) la mot thu tu toan phan tren bang khung gio va moi giao
    -- dich deu di theo mot chieu. customer_confirm_simulated_booking khoa
    -- theo dung thu tu nay — hai ham di nguoc chieu nhau la cong thuc
    -- cua deadlock.
    order by template.local_start_time, template.site_id
  loop
    v_template_count := v_template_count + 1;
    select threshold.* into v_threshold
    from public.erp_capacity_thresholds threshold
    where threshold.tenant_id = p_tenant_id
      and threshold.site_id = v_template.site_id
      and threshold.effective_from <= p_visit_date
    order by threshold.effective_capacity asc, threshold.effective_from desc,
      threshold.threshold_code
    limit 1
    for share;
    if v_threshold.id is null then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
    end if;

    v_starts_at := (p_visit_date + v_template.local_start_time)
      at time zone 'Asia/Ho_Chi_Minh';
    v_ends_at := v_starts_at + make_interval(mins => v_template.duration_minutes);
    if v_starts_at <= now() + interval '5 minutes' then
      raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_SLOT_PAST';
    end if;

    insert into public.customer_booking_slots as booking_slot (
      tenant_id, site_id, capacity_threshold_id,
      starts_at, ends_at, capacity_snapshot, threshold_version,
      capacity_source_kind, status
    ) values (
      p_tenant_id, v_template.site_id, v_threshold.id,
      v_starts_at, v_ends_at, v_threshold.effective_capacity, v_threshold.version,
      v_threshold.source_kind, 'open'
    )
    -- TC-03: tao va khoa hang khung gio trong DUNG MOT cau lenh.
    --
    -- do nothing roi select ... for update co hai lo. Mot: neu mot giao
    -- dich khac vua chen dung hang nay ma chua commit thi do nothing bo
    -- qua, con select chua nhin thay hang — khung gio thanh null va ca luot
    -- giu cho hong theo mot cach rat kho doc. Hai: hai cau lenh la hai thoi
    -- diem khoa khac nhau. do update cho giao dich kia xong roi tra ve hang
    -- that, da khoa san.
    on conflict (tenant_id, site_id, starts_at) do update
      set updated_at = now()
    returning booking_slot.* into v_slot;
    if v_slot.status <> 'open' then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_BOOKING_SLOT_PAUSED';
    end if;
    if v_slot.threshold_version <> v_threshold.version
       or v_slot.capacity_threshold_id <> v_threshold.id
       or v_slot.capacity_snapshot <> v_threshold.effective_capacity then
      update public.customer_booking_slots
      set capacity_threshold_id = v_threshold.id,
          capacity_snapshot = v_threshold.effective_capacity,
          threshold_version = v_threshold.version,
          capacity_source_kind = v_threshold.source_kind,
          updated_at = now()
      where id = v_slot.id
      returning * into v_slot;
    end if;

    select coalesce(sum(hold_slot.quantity), 0)::integer into v_reserved
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_holds hold on hold.id = hold_slot.hold_id
    where hold_slot.tenant_id = p_tenant_id
      and hold_slot.slot_id = v_slot.id
      and (
        hold.status = 'converted'
        or (hold.status = 'active' and hold.expires_at > now())
      );
    -- Tru theo p_party_size, KHONG theo v_adults. Tre duoi 1m3 khong mua ve
    -- nhung van ngoi mot cho tren thuyen. Tru theo so ve ban ra la ban vuot
    -- suc chua that, va cho thieu chi lo ra luc ca doan da toi ben.
    if v_reserved + p_party_size > v_slot.capacity_snapshot then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_CAPACITY_UNAVAILABLE';
    end if;
    insert into public.customer_booking_hold_slots (
      tenant_id, hold_id, slot_id, quantity
    ) values (p_tenant_id, v_hold.id, v_slot.id, p_party_size);
  end loop;

  if v_template_count = 0 then
    -- Hai nguyen nhan khac han nhau, dung chung mot thong diep thi nguoi doc
    -- khong biet minh phai sua gi: san pham chua co lich ban nao, hay khach
    -- chon dung mot khung gio khong duoc mo.
    if p_slot_starts_at is not null then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_SLOT_NOT_OFFERED';
    end if;
    raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
  end if;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, event_type, metadata, occurred_at
  ) values (
    p_tenant_id, v_profile_id, v_order.id, v_hold.id, 'hold-created',
    jsonb_build_object(
      'visit_date', p_visit_date,
      'party_size', p_party_size,
      'adults', v_adults,
      'children', v_children,
      'slot_count', v_template_count,
      'mode', 'simulation'
    ), p_occurred_at
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'slot_id', slot.id,
    'site_id', slot.site_id,
    'starts_at', slot.starts_at,
    'ends_at', slot.ends_at,
    'capacity_source', slot.capacity_source_kind,
    'threshold_version', slot.threshold_version
  ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
  into v_slots
  from public.customer_booking_hold_slots hold_slot
  join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
  where hold_slot.hold_id = v_hold.id;

  return query select
    v_order.id, v_order.order_code, v_hold.id, v_hold.status,
    v_hold.expires_at, v_order.total_vnd, v_order.currency, v_slots, true;
end;
$$;

-- 4. Trạng thái đoàn trả thêm nhãn đoàn và nhu cầu chăm sóc.
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
    'group_label', g.group_label,
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
        'care_need', m.care_need,
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

-- 5. Tạo đoàn, nay nhận thêm nhãn.
--
-- Them tham so bang `create or replace` chi de ra mot ham nap chong thu hai;
-- phai bo chu ky cu di mot cach tuong minh. Day dung cho da sap mot lan o TC-01.
drop function if exists public.erp_create_visitor_group(uuid, uuid, uuid, text, text);

create or replace function public.erp_create_visitor_group(
  p_tenant_id uuid,
  p_order_id uuid,
  p_anonymous_id uuid,
  p_leader_name text,
  p_leader_phone text,
  p_group_label text default ''
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
  v_label text := trim(coalesce(p_group_label, ''));
  v_profile_id uuid;
  v_index integer;
begin
  if p_tenant_id is null or p_order_id is null or p_anonymous_id is null
     or char_length(v_name) < 1 or char_length(v_name) > 200
     or char_length(v_phone) > 30 or char_length(v_label) > 120 then
    raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':doan:' || p_order_id::text, 0)
  );

  select * into v_order from public.customer_orders o
  where o.id = p_order_id and o.tenant_id = p_tenant_id;
  if v_order.id is null then
    raise exception using errcode = 'P0002', message = 'GROUP_ORDER_NOT_FOUND';
  end if;

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

  if v_order.status <> 'confirmed' then
    raise exception using errcode = '22023', message = 'GROUP_ORDER_NOT_CONFIRMED';
  end if;

  insert into public.erp_visitor_groups (
    tenant_id, order_id, group_code, group_label,
    leader_name, leader_phone, member_count
  ) values (
    p_tenant_id, p_order_id,
    'DOAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_label, v_name, v_phone, v_order.party_size
  ) returning * into v_group;

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

-- 6. Trưởng đoàn điền hộ tên cả đoàn.
--
-- Quyen dien ho buoc phai la PHIEN KHACH DA DAT DON, khong phai ma doan.
--
-- Ma doan la thu truong doan gui cho ca doan, ai cung cam. Neu ma doan du de
-- doi ten nguoi khac thi bat ky ai trong doan cung sua duoc ten moi nguoi — va
-- khong ai truy ra duoc ai vua sua.
--
-- Chinh chu van tu sua ten minh bang ma rieng, va sua sau thi de len thu truong
-- doan da dien. Nguoi noi ve minh la nguon dung hon.
--
-- Chi nhan TEN GOI va NHU CAU CHAM SOC. Khong tuoi, khong giay to. Mot nguoi
-- dang khai du lieu ca nhan cua 31 nguoi chua duoc hoi, nen cang it cang tot.
create or replace function public.erp_set_group_member_details(
  p_tenant_id uuid,
  p_group_code text,
  p_anonymous_id uuid,
  p_members jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.erp_visitor_groups;
  v_order public.customer_orders;
  v_profile_id uuid;
  v_item jsonb;
  v_index integer;
  v_name text;
  v_care text;
begin
  if p_tenant_id is null or p_anonymous_id is null
     or jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) > 45 then
    raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
  end if;

  select * into v_group from public.erp_visitor_groups g
  where g.tenant_id = p_tenant_id
    and g.group_code = upper(trim(coalesce(p_group_code, '')));
  if v_group.id is null then
    raise exception using errcode = 'P0002', message = 'GROUP_MEMBER_NOT_FOUND';
  end if;

  select * into v_order from public.customer_orders o
  where o.id = v_group.order_id and o.tenant_id = p_tenant_id;
  select public.customer_canonical_profile_id(p_tenant_id, profile.id)
  into v_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  if v_profile_id is null
     or v_profile_id <> public.customer_canonical_profile_id(p_tenant_id, v_order.profile_id) then
    raise exception using errcode = '42501', message = 'GROUP_OWNERSHIP_REQUIRED';
  end if;

  for v_item in select value from jsonb_array_elements(p_members)
  loop
    v_index := (v_item ->> 'member_index')::integer;
    v_name := trim(coalesce(v_item ->> 'display_name', ''));
    v_care := coalesce(nullif(trim(coalesce(v_item ->> 'care_need', '')), ''), 'none');
    if v_index is null or v_index < 1 or char_length(v_name) > 200
       or v_care not in ('none', 'young-child', 'elderly', 'mobility') then
      raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
    end if;

    update public.erp_visitor_group_members set
      display_name = v_name,
      care_need = v_care,
      -- Ten rong la rut lai. Rut lai thi xoa luon dau thoi diem, de sau nay
      -- khong con cach nao noi "nguoi nay tung dong y" ma khong con ten.
      activated_at = case
        when char_length(v_name) > 0 then coalesce(activated_at, now())
        else null
      end
    where tenant_id = p_tenant_id
      and group_id = v_group.id
      and member_index = v_index;
  end loop;

  return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);
end;
$$;

revoke all on function public.erp_create_visitor_group(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_create_visitor_group(
  uuid, uuid, uuid, text, text, text
) to service_role;

revoke all on function public.erp_set_group_member_details(
  uuid, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.erp_set_group_member_details(
  uuid, text, uuid, jsonb
) to service_role;

commit;
