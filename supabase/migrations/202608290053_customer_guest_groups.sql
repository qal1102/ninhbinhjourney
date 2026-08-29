-- TC-03: người lớn và trẻ em đi tới tận tấm vé, và một thứ tự khoá duy nhất.
--
-- Hai việc trong một migration vì chúng chạm cùng hai hàm; tách ra thì phải
-- viết lại toàn bộ thân hàm hai lần.
--
-- ## Việc thứ nhất — hai nhóm tuổi
--
-- Phiếu giao việc 01 mục A2 đòi tách người lớn / trẻ em ngay từ đầu, và cho
-- tới nay chưa ai làm. Hệ quả không nằm ở báo cáo: mỗi chặng phát đúng một vé
-- `group` gộp cả đoàn, nên người soát vé ở bến thuyền không biết trong sáu
-- khách có mấy trẻ nhỏ — mà chính con số đó mới quyết định áo phao, chỗ ngồi
-- và người đi kèm.
--
-- Từ đây: đơn hàng lưu `adults` và `children` tách bạch, dòng đơn tách hai,
-- và mỗi chặng phát vé riêng cho từng nhóm với đúng `product` mà `erp_tickets`
-- đã có sẵn từ 202608020028.
--
-- **Giá vé, chủ dự án chốt ngày 29/08/2026:** trẻ **dưới 1m3 không mua vé**;
-- từ 1m3 trở lên tính giá thường. Vì thế `child` trong lược đồ này có nghĩa
-- hẹp và cố định là *khách dưới 1m3*, không phải "trẻ em" theo tuổi — một em
-- mười hai tuổi cao 1m4 vẫn là một vé thường.
--
-- Hệ quả kéo theo, và đây là chỗ dễ sập nhất: ràng buộc cũ
-- `total_vnd = unit_price_vnd * party_size` sẽ **chặn đúng những đơn có trẻ
-- nhỏ**. Nó phải đổi cùng lúc sang `* adults`. Đổi riêng lẻ một trong hai thứ
-- là hỏng ngay lượt đặt kế tiếp.
--
-- **Miễn phí không có nghĩa là không chiếm chỗ.** Sức chứa vẫn trừ theo
-- `party_size` — một em bé vẫn ngồi một chỗ trên thuyền và vẫn phải qua cổng
-- đếm được. Vé của em vẫn phát ra, chỉ là giá bằng không.
--
-- ## Việc thứ hai — thứ tự khoá
--
-- `customer_create_booking_hold` khoá các khung giờ theo `(giờ bắt đầu, cơ
-- sở)`, còn `customer_confirm_simulated_booking` khoá theo `slot_id`. Hai thứ
-- tự khác nhau trên cùng một tập hàng: hai giao dịch đi ngược chiều nhau và
-- gặp nhau ở giữa là deadlock. Chưa xảy ra vì lưu lượng còn nhỏ, nhưng nó
-- không tự khỏi.
--
-- Hàng khung giờ **chưa tồn tại** lúc hàm giữ chỗ bắt đầu — chính hàm này tạo
-- ra chúng — nên `slot_id` không dùng làm khoá sắp xếp được. `(giờ bắt đầu,
-- cơ sở)` thì biết trước, lại đúng là khoá duy nhất của bảng. Vì vậy hàm xác
-- nhận đổi sang thứ tự đó, chứ không phải ngược lại.
--
-- Nhân tiện vá luôn một lỗ có thật ở hàm giữ chỗ: `on conflict do nothing` rồi
-- `select ... for update` là hai câu lệnh. Nếu một giao dịch khác vừa chèn
-- đúng hàng đó mà chưa commit, câu đầu bỏ qua còn câu sau chưa nhìn thấy hàng
-- — biến khung giờ thành null. Gộp thành `do update ... returning` thì vừa
-- tạo, vừa khoá, vừa luôn trả về hàng thật.
--
-- ## Bó dịch vụ
--
-- Yêu cầu "thiếu một thành phần thì không giữ chỗ phần nào" đã đúng từ trước:
-- cả hàm chạy trong một giao dịch, mọi `raise` cuộn lại toàn bộ. Migration này
-- không nới lỏng điều đó, và bài kiểm thử hợp đồng canh giữ nó.
--
-- Không seed một dòng dữ liệu nào.

begin;

-- 1. Đơn hàng lưu hai nhóm tuổi.
--
-- Dữ liệu cũ không có khái niệm trẻ em, nên mọi khách đã ghi được lấp về
-- `adults`. Đó là cách đọc trung thực duy nhất còn lại: hệ thống chưa từng hỏi
-- nên chưa từng biết, không phải là đã biết rồi ghi sai.
alter table public.customer_orders
  add column if not exists adults integer,
  add column if not exists children integer;

update public.customer_orders
set adults = party_size, children = 0
where adults is null or children is null;

alter table public.customer_orders
  alter column adults set not null,
  alter column children set not null;

-- Tổng hai nhóm phải đúng bằng `party_size` — ép ở PostgreSQL, không ở
-- TypeScript. Một đoàn phải có ít nhất một người lớn: trẻ em không đi một mình.
alter table public.customer_orders
  drop constraint if exists customer_orders_party_mix_check;
alter table public.customer_orders
  add constraint customer_orders_party_mix_check
  check (adults >= 1 and children >= 0 and adults + children = party_size);

-- Trẻ dưới 1m3 không mua vé, nên tổng tiền tính theo **số khách có vé**, không
-- theo tổng đầu người. Ràng buộc cũ `customer_orders_check` là
-- `total_vnd = unit_price_vnd * party_size` — để nguyên thì mọi đơn có trẻ nhỏ
-- bị chặn ngay ở tầng cơ sở dữ liệu.
--
-- Đổi được an toàn vì bước lấp dữ liệu ở trên đã đặt `adults = party_size` cho
-- toàn bộ đơn cũ: ràng buộc mới đúng với mọi hàng đang có, không hàng nào phải
-- sửa.
alter table public.customer_orders
  drop constraint if exists customer_orders_check;
alter table public.customer_orders
  add constraint customer_orders_total_check
  check (total_vnd = unit_price_vnd * adults);

-- 2. Dòng đơn tách theo nhóm tuổi.
--
-- Ràng buộc duy nhất cũ là `(order_id, product_id)` — đúng khi một đơn chỉ có
-- một dòng, sai ngay khi có hai. Nới đúng bằng nhóm tuổi, không nới hơn.
alter table public.customer_order_lines
  add column if not exists guest_group text not null default 'adult';
alter table public.customer_order_lines
  alter column guest_group drop default;

alter table public.customer_order_lines
  drop constraint if exists customer_order_lines_guest_group_check;
alter table public.customer_order_lines
  add constraint customer_order_lines_guest_group_check
  check (guest_group in ('adult', 'child'));

alter table public.customer_order_lines
  drop constraint if exists customer_order_lines_order_id_product_id_key;
create unique index if not exists customer_order_lines_group_idx
  on public.customer_order_lines (order_id, product_id, guest_group);

-- 3. Cầu nối vé cũng tách theo nhóm.
--
-- Vé đã phát trước TC-03 giữ đúng tên cũ của chúng là `group`. Lấp về 'adult'
-- sẽ là bịa: những tấm vé đó thật sự đã gộp cả đoàn.
alter table public.customer_order_tickets
  add column if not exists guest_group text not null default 'group';
alter table public.customer_order_tickets
  alter column guest_group drop default;

alter table public.customer_order_tickets
  drop constraint if exists customer_order_tickets_guest_group_check;
alter table public.customer_order_tickets
  add constraint customer_order_tickets_guest_group_check
  check (guest_group in ('adult', 'child', 'group'));

alter table public.customer_order_tickets
  drop constraint if exists customer_order_tickets_order_id_site_id_key;
create unique index if not exists customer_order_tickets_group_idx
  on public.customer_order_tickets (order_id, site_id, guest_group);

-- 4. Dấu vân tay yêu cầu tính cả hai nhóm tuổi.
--
-- Thiếu chỗ này thì khách giữ 3 người lớn rồi sửa thành 2 người lớn 1 trẻ em
-- sẽ nhận lại đúng phiếu cũ — im lặng, không báo lỗi, và vé phát ra sai loại.
-- Cùng đúng một lớp lỗi mà TC-02 đã vá cho khung giờ.
--
-- Thêm tham số bằng `create or replace` chỉ tạo ra một hàm nạp chồng thứ hai;
-- phải bỏ hàm cũ đi một cách tường minh.
drop function if exists public.customer_booking_payload_digest(
  uuid, date, integer, timestamptz
);

create or replace function public.customer_booking_payload_digest(
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_slot_starts_at timestamptz default null,
  p_adults integer default null,
  p_children integer default null
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      p_product_id::text || ':' || p_visit_date::text || ':' || p_party_size::text
        || ':' || coalesce(p_slot_starts_at::text, 'moi-khung')
        || ':' || coalesce(p_adults::text, 'khong-tach')
        || ':' || coalesce(p_children::text, 'khong-tach'),
      'sha256'
    ),
    'hex'
  );
$$;

-- 5. Hàm giữ chỗ nhận thêm hai nhóm tuổi.
--
-- Cùng lý do nạp chồng như trên: bỏ chữ ký 8 tham số cũ trước đã.
drop function if exists public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz
);

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
     or p_party_size not between 1 and 20 or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or p_visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90 then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_INPUT_INVALID';
  end if;

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

-- 6. Ham xac nhan: phat ve theo nhom tuoi, va khoa cung mot chieu voi ham giu cho.

create or replace function public.customer_confirm_simulated_booking(
  p_tenant_id uuid,
  p_payment_request_id uuid,
  p_hold_id uuid,
  p_anonymous_id uuid,
  p_occurred_at timestamptz
)
returns table (
  order_id uuid,
  order_code text,
  order_status text,
  payment_attempt_id uuid,
  payment_status text,
  tickets jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_existing_payment public.customer_payment_attempts;
  v_hold public.customer_booking_holds;
  v_order public.customer_orders;
  v_payment public.customer_payment_attempts;
  v_hold_slot public.customer_booking_hold_slots;
  v_slot public.customer_booking_slots;
  v_ticket_id uuid;
  v_ticket_code text;
  v_tickets jsonb;
  v_ticket_count integer := 0;
  v_group record;
begin
  if p_tenant_id is null or p_payment_request_id is null or p_hold_id is null
     or p_anonymous_id is null or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':payment:' || p_payment_request_id::text, 0)
  );

  select profile.id into v_source_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  select payment.* into v_existing_payment
  from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id
    and payment.idempotency_key = p_payment_request_id;
  if v_existing_payment.id is not null then
    select hold.* into v_hold
    from public.customer_booking_holds hold
    where hold.id = v_existing_payment.hold_id and hold.tenant_id = p_tenant_id;
    if v_existing_payment.hold_id <> p_hold_id
       or public.customer_canonical_profile_id(
         p_tenant_id, v_hold.profile_id
       ) <> v_profile_id then
      raise exception using errcode = '23505', message = 'CUSTOMER_PAYMENT_ID_COLLISION';
    end if;
    select customer_order.* into v_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_payment.order_id
      and customer_order.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'ticket_id', ticket.id,
      'ticket_code', ticket.ticket_code,
      'site_id', ticket.site_id,
      'valid_on', ticket.valid_on,
      'entries_allowed', ticket.entries_allowed,
      'guest_group', ticket.product,
      'status', ticket.status
    ) order by ticket.site_id, ticket.product), '[]'::jsonb)
    into v_tickets
    from public.customer_order_tickets bridge
    join public.erp_tickets ticket on ticket.id = bridge.ticket_id
    where bridge.order_id = v_order.id;
    return query select
      v_order.id, v_order.order_code, v_order.status, v_existing_payment.id,
      v_existing_payment.status, v_tickets, false;
    return;
  end if;

  select hold.* into v_hold
  from public.customer_booking_holds hold
  where hold.id = p_hold_id and hold.tenant_id = p_tenant_id
  for update;
  if v_hold.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_HOLD_NOT_FOUND';
  end if;
  if public.customer_canonical_profile_id(
       p_tenant_id, v_hold.profile_id
     ) <> v_profile_id then
    raise exception using errcode = '42501', message = 'CUSTOMER_BOOKING_OWNERSHIP_REQUIRED';
  end if;
  if v_hold.status = 'converted' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_ALREADY_CONFIRMED';
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_HOLD_EXPIRED';
  end if;

  select customer_order.* into v_order
  from public.customer_orders customer_order
  where customer_order.id = v_hold.order_id and customer_order.tenant_id = p_tenant_id
  for update;
  if v_order.status <> 'holding' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_STATE_INVALID';
  end if;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_hold.id and slot.tenant_id = p_tenant_id
    order by slot.starts_at, slot.site_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id and slot.tenant_id = p_tenant_id
    for update;
  end loop;

  insert into public.customer_payment_attempts (
    tenant_id, order_id, hold_id, idempotency_key, provider,
    provider_event_id, mode, status, amount_vnd, currency, occurred_at
  ) values (
    p_tenant_id, v_order.id, v_hold.id, p_payment_request_id,
    'destinationos-simulation', 'sim-' || p_payment_request_id::text,
    'simulation', 'succeeded', v_order.total_vnd, v_order.currency, p_occurred_at
  ) returning * into v_payment;

  update public.customer_booking_holds
  set status = 'converted', converted_at = now()
  where id = v_hold.id;
  update public.customer_orders
  set status = 'confirmed', updated_at = now()
  where id = v_order.id
  returning * into v_order;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_hold.id and slot.tenant_id = p_tenant_id
    order by slot.starts_at, slot.site_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id;
    -- TC-03: moi chang phat ve theo tung nhom tuoi.
    --
    -- Truoc day la mot ve group gop ca doan, nen toi cong khong ai biet
    -- trong do co may tre em — ma chinh con so do moi quyet dinh cho ngoi
    -- thuyen va nguoi di kem. Nhom nao khong co khach thi khong phat ve.
    for v_group in
      select nhom.ten, nhom.so_khach
      from (values ('adult'::text, v_order.adults), ('child'::text, v_order.children))
        as nhom(ten, so_khach)
      where nhom.so_khach > 0
      order by nhom.ten
    loop
      v_ticket_code := 'WEB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      insert into public.erp_tickets (
        tenant_id, site_id, ticket_code, product, guest_name, guest_phone,
        booking_reference, channel, valid_on, entries_allowed, entries_used,
        status, issued_at
      ) values (
        p_tenant_id, v_slot.site_id, v_ticket_code, v_group.ten, '', '',
        v_order.order_code, 'website', v_order.visit_date,
        v_group.so_khach, 0, 'issued', p_occurred_at
      ) returning id into v_ticket_id;
      insert into public.customer_order_tickets (
        tenant_id, order_id, slot_id, ticket_id, site_id,
        guest_group, entries_allowed
      ) values (
        p_tenant_id, v_order.id, v_slot.id, v_ticket_id,
        v_slot.site_id, v_group.ten, v_group.so_khach
      );
      v_ticket_count := v_ticket_count + 1;
    end loop;
  end loop;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, payment_attempt_id,
    event_type, metadata, occurred_at
  ) values
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      'payment-simulated',
      jsonb_build_object('amount_vnd', v_order.total_vnd, 'currency', 'VND', 'mode', 'simulation'),
      p_occurred_at
    ),
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      'tickets-issued',
      jsonb_build_object('ticket_count', v_ticket_count, 'channel', 'website'),
      p_occurred_at
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id', ticket.id,
    'ticket_code', ticket.ticket_code,
    'site_id', ticket.site_id,
    'valid_on', ticket.valid_on,
    'entries_allowed', ticket.entries_allowed,
    'guest_group', ticket.product,
    'status', ticket.status
  ) order by ticket.site_id, ticket.product), '[]'::jsonb)
  into v_tickets
  from public.customer_order_tickets bridge
  join public.erp_tickets ticket on ticket.id = bridge.ticket_id
  where bridge.order_id = v_order.id;

  return query select
    v_order.id, v_order.order_code, v_order.status, v_payment.id,
    v_payment.status, v_tickets, true;
end;
$$;

revoke all on function public.customer_booking_payload_digest(
  uuid, date, integer, timestamptz, integer, integer
) from public, anon, authenticated;
grant execute on function public.customer_booking_payload_digest(
  uuid, date, integer, timestamptz, integer, integer
) to service_role;

revoke all on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz, integer, integer
) from public, anon, authenticated;
grant execute on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz, integer, integer
) to service_role;

commit;
