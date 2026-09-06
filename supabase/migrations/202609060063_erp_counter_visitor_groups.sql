-- TC-18: đoàn mua tại quầy — vẫn là logic đoàn trưởng, chỉ khác chỗ treo vé.
--
-- ## Lời chủ dự án
--
-- "nhân viên bán vé tại quầy có thể đăng kí vé qua account của họ và bán luôn
-- tại đó... nó làm ra 1 cái phiếu đoàn xong đưa QR cho khách, khách scan vậy
-- là xong, vẫn là logic đoàn trưởng."
--
-- ## Hiện trạng đã đọc trực tiếp trong migration, không đoán
--
-- 1. `erp_visitor_groups.order_id` là `not null` và có khoá ngoại
--    `(order_id, tenant_id) references customer_orders(id, tenant_id)`
--    (đọc thẳng `create table` ở `202608300054`, dòng 57-72). Nghĩa là MỌI
--    đoàn hôm nay phải treo vào một đơn web — quầy chưa có đường nào.
-- 2. Không có trigger nào coi cột nào của `erp_tickets` là bất biến. Tìm bằng
--    cách liệt kê MỌI `create trigger`/`drop trigger` trong toàn bộ
--    `supabase/migrations/*.sql` (không chỉ grep chuỗi "erp_tickets" một
--    mình — bài học TC-15 là một chuỗi khác cũng chặn cùng một thứ) rồi lọc
--    theo tên bảng đích: chỉ có `customer_order_tickets`,
--    `customer_order_lines`, `customer_booking_hold_slots`,
--    `customer_payment_attempts`, `customer_commerce_audit_events`,
--    `customer_ticket_lookup_attempts` mang trigger `..._append_only`.
--    `erp_tickets` không xuất hiện trong danh sách đó ở bất kỳ dòng nào.
-- 3. `customer_orders` bắt buộc `profile_id not null references
--    customer_profiles`, và từ `202608290053` còn bắt buộc
--    `check (adults >= 1 and children >= 0 and adults + children = party_size)`
--    cùng `check (total_vnd = unit_price_vnd * adults)`. Nặng hơn nữa:
--    `customer_order_tickets` (cầu nối mà `erp_gate_scan_ticket_at` dùng để
--    tìm vé của một thành viên) có `slot_id uuid not null references
--    customer_booking_slots(id, tenant_id)` — một hàng cầu nối không thể tồn
--    tại mà không có một khung giờ sức chứa thật đứng sau nó.
--
-- ## Vì sao KHÔNG đi hướng "quầy tạo một customer_orders bán tại quầy"
--
-- Muốn dùng lại nguyên `erp_create_visitor_group` mà không sửa
-- `erp_gate_scan_ticket_at`, một đoàn quầy vẫn phải có cầu nối
-- `customer_order_tickets` để mã riêng từng người tìm ra đúng vé — nếu không,
-- mã thành viên quét ra "không tìm thấy" dù đoàn đã tồn tại, phá đúng thứ
-- TC-18 yêu cầu. Mà cầu nối ấy bắt buộc một `customer_booking_slots` thật.
-- Quầy không có khung giờ sức chứa nào để gắn vào — phải BỊA một hàng khung
-- giờ, tự chọn một `capacity_threshold_id` và một `capacity_snapshot`. Hàng
-- bịa đó không nằm im: `lib/customer-data/funnel-repository.ts` (đọc
-- `customer_booking_slots` và `customer_order_tickets` để dựng phễu chuyển đổi
-- marketing) và `lib/customer-data/booking-repository.ts` sẽ lặng lẽ tính một
-- suất bán tại quầy như một suất đặt qua web, làm sai chính con số phễu đó
-- đang cố đo. Đó là một con số đổi nghĩa mà không ai kịp đổi nhãn theo, đúng
-- điều bị cấm ở đầu việc này.
--
-- Ngược lại, hướng ở migration này KHÔNG chạm một dòng nào tới
-- `customer_orders`, `customer_booking_slots`, `customer_order_tickets`,
-- `customer_profiles` hay bất kỳ bảng phễu marketing nào. Hai con số đang đọc
-- thẳng từ `customer_orders` cho giám đốc — `webRevenue30dVnd` và
-- `webOrders30d` trong `lib/erp/ticket-overview-repository.ts`, đã tự ghi rõ
-- nhãn "chỉ của đơn đặt qua web đã xác nhận" — **giữ nguyên ý nghĩa, không đổi
-- nhãn**, vì đoàn quầy không hề tạo ra một hàng `customer_orders` nào. Vé quầy
-- vẫn rơi đúng vào ô "Quầy vé" đã có sẵn trong biểu đồ kênh bán
-- (`CHANNEL_LABELS['quay-ve']`), không cần thêm nhãn mới.
--
-- ## Vậy đoàn quầy treo vào đâu
--
-- Thẳng vào MỘT tấm vé quầy (`erp_tickets`, `channel = 'quay-ve'`,
-- `product = 'group'`, `entries_allowed = số người`) — không qua đơn hàng,
-- không qua khung giờ sức chứa. `erp_visitor_groups.order_id` được nới thành
-- nullable, thêm cột `ticket_id` cùng ràng buộc "đúng một trong hai" bằng
-- `num_nonnulls`. Ba hàm dùng chung của TC-06/TC-15 được sửa TỐI THIỂU:
--
--   - `erp_visitor_group_status`: đổi `join customer_orders` thành
--     `left join`, đọc `visit_date` từ vé quầy khi không có đơn. An toàn cho
--     phía TypeScript: `lib/customer-data/visitor-group-repository.ts` đã
--     đọc `order_code`/`visit_date` bằng `String(x ?? "")`, nên null không
--     làm hỏng gì — không cần sửa file đó.
--   - `erp_gate_scan_ticket_at`: thêm đúng MỘT nhánh mới trong đường tìm vé
--     theo mã thành viên — đoàn có `ticket_id` thẳng thì lấy thẳng vé đó,
--     không qua cầu nối `customer_order_tickets`. Nhánh cũ (đoàn web) giữ
--     nguyên từng dòng.
--   - `erp_create_visitor_group` (đường web): KHÔNG đổi một chữ nào.
--
-- Quyền bán được kiểm hai lớp, giống hệt khuôn `erp_gate_actor_can_scan`:
-- giám đốc luôn được, quản lý vùng được tại cơ sở mình quản, nhân viên phải
-- được gán module `ve-dat-cho` tại đúng cơ sở (đọc từ `domain/erp.ts`, đây là
-- module "Vé & đặt chỗ" — đúng module đang hiện màn hình bán vé trong
-- `components/erp/module-workspace.tsx`).
--
-- ## Chỉ tiến tới, không sửa dữ liệu cũ
--
-- Không có bước `update`/backfill nào trong migration này. Việc nới
-- `order_id` thành nullable và thêm cột `ticket_id` không đụng giá trị hàng
-- nào đang có. Ràng buộc `num_nonnulls(order_id, ticket_id) = 1` được
-- PostgreSQL tự quét toàn bảng lúc `add constraint` — mọi đoàn cũ đều đã có
-- `order_id` và chưa từng có `ticket_id`, nên tự động đúng 1/2; nếu có gì sai
-- khác thường, `add constraint` tự chặn cả migration lại, không cần một khối
-- `get diagnostics` thủ công cho một phép kiểm PostgreSQL vốn đã làm sẵn.
--
-- ## Giới hạn cố ý, nói thẳng
--
-- Đoàn quầy không tách người lớn/trẻ em (mọi thành viên là `adult`) — quầy
-- không hỏi tuổi hay chiều cao, đúng khuôn "chỉ tên gọi" của TC-15 nhưng ở
-- đây còn ít hơn nữa (quầy không cần cả tên lúc lập phiếu). Nếu sau này quầy
-- cần vé trẻ em miễn phí như web, đó là việc khác, cần thêm ô nhập.
--
-- Bản kê quét ngoại tuyến (`erp_prepare_offline_gate_manifest`) CHƯA được sửa
-- để mang theo mã thành viên của đoàn quầy — nó vẫn chỉ ráp mã qua
-- `customer_order_tickets`. Nghĩa là: mất mạng ở cổng, mã VÉ quầy (ticket_code
-- gốc) vẫn quét được như từ trước tới giờ, nhưng MÃ RIÊNG TỪNG NGƯỜI của một
-- đoàn quầy sẽ báo "không có trong bản kê" cho tới khi có mạng trở lại. Không
-- sửa trong lượt này để tránh chạm cùng lúc vào nhánh offline mà TC-16/TC-21
-- đang làm song song.

begin;

-- 1. `erp_tickets` cần một khoá duy nhất (id, tenant_id) để làm đích cho khoá
--    ngoại ghép cặp bên dưới — đúng khuôn mọi bảng khác trong hệ thống này
--    đang dùng để khoá cứng tenant xuyên bảng. Thêm constraint mới, không
--    đụng dữ liệu, không đụng ràng buộc nào đang có.
alter table public.erp_tickets
  drop constraint if exists erp_tickets_id_tenant_key;
alter table public.erp_tickets
  add constraint erp_tickets_id_tenant_key unique (id, tenant_id);

-- 2. Đoàn được phép treo vào MỘT vé quầy thay vì một đơn web.
alter table public.erp_visitor_groups
  alter column order_id drop not null;

alter table public.erp_visitor_groups
  add column if not exists ticket_id uuid;

alter table public.erp_visitor_groups
  drop constraint if exists erp_visitor_groups_ticket_id_fkey;
alter table public.erp_visitor_groups
  add constraint erp_visitor_groups_ticket_id_fkey
  foreign key (ticket_id, tenant_id)
  references public.erp_tickets(id, tenant_id) on delete restrict;

alter table public.erp_visitor_groups
  drop constraint if exists erp_visitor_groups_ticket_id_key;
alter table public.erp_visitor_groups
  add constraint erp_visitor_groups_ticket_id_key unique (tenant_id, ticket_id);

-- Khoá chống lập trùng phiếu quầy.
--
-- Ở quầy, nhân viên bấm "Tạo phiếu" trên máy chạy 4G. Mạng lỡ nhịp, màn hình
-- chưa kịp trả lời, họ bấm lại — và không có gì ngăn hai tấm phiếu ra đời cho
-- cùng một đoàn. Nút tự khoá lúc đang chờ chỉ chặn được cú bấm thứ hai trên
-- CÙNG một màn hình; nó không chặn được một lượt gửi lại sau khi kết nối rơi.
--
-- Tấm phiếu thừa ấy không nằm im: nó là một hàng `erp_tickets` thật, mang
-- `entries_allowed` bằng cả đoàn, và cộng thẳng vào ô "vé đã bán" của giám
-- đốc. Một con số sai mà không ai biết là sai.
--
-- Chỉ số duy nhất có điều kiện: hàng đoàn web không mang khoá này nên `null`
-- không bị đụng tới, và Postgres bỏ qua `null` trong chỉ số có điều kiện.
alter table public.erp_visitor_groups
  add column if not exists counter_request_key text;

drop index if exists public.erp_visitor_groups_counter_request_key_idx;
create unique index erp_visitor_groups_counter_request_key_idx
  on public.erp_visitor_groups (tenant_id, counter_request_key)
  where counter_request_key is not null;

-- Đúng một trong hai nguồn gốc — không phải cả hai, không phải không cái nào.
-- PostgreSQL tự quét toàn bảng khi thêm CHECK này; mọi hàng cũ có `order_id`
-- và chưa từng có `ticket_id` nên tự động thoả `num_nonnulls(...) = 1`.
alter table public.erp_visitor_groups
  drop constraint if exists erp_visitor_groups_origin_xor_check;
alter table public.erp_visitor_groups
  add constraint erp_visitor_groups_origin_xor_check
  check (num_nonnulls(order_id, ticket_id) = 1);

-- 3. Trạng thái đoàn đọc được cả hai nguồn gốc.
--
-- Chữ ký không đổi nên `create or replace` đủ, đúng khuôn TC-15 đã dùng cho
-- chính hàm này. Đổi duy nhất: `join customer_orders` thành `left join`, và
-- thêm `left join erp_tickets` để lấy `visit_date` khi không có đơn.
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
    'visit_date', coalesce(o.visit_date, t.valid_on),
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
  left join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id
  left join public.erp_tickets t on t.id = g.ticket_id and t.tenant_id = g.tenant_id
  where g.tenant_id = p_tenant_id
    and g.group_code = upper(trim(coalesce(p_group_code, '')));
$$;

-- 4. Cổng soát vé tìm ra vé của một mã thành viên, dù đoàn đó đến từ web hay
--    từ quầy.
--
-- Thân hàm lấy nguyên văn từ `202608310057` (bản đang chạy thật gần nhất),
-- chỉ thêm đúng một nhánh rẽ trước nhánh cầu nối `customer_order_tickets` cũ.
-- Nhánh cũ (đoàn web) không đổi một dòng nào — vẫn cùng một cách tìm, cùng một
-- kết quả cho mọi đoàn đã tồn tại từ trước.
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

-- 5. Ai được bán vé đoàn tại quầy — hai lớp, giống hệt khuôn
--    `erp_gate_actor_can_scan` nhưng cho module "Vé & đặt chỗ" (`ve-dat-cho`)
--    thay vì "Check-in khách". Tách hàm riêng để `erp_create_counter_visitor_group`
--    không nhân đôi logic quyền, và để bài kiểm khoá được đúng một chỗ.
create or replace function public.erp_counter_actor_can_sell(
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
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'regional-manager', p_site_id)
    or (
      public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'employee', p_site_id)
      and exists (
        select 1 from public.erp_employee_access access
        where access.tenant_id = p_tenant_id
          and access.employee_account_id = trim(p_actor_account_id)
          and access.site_id = p_site_id
          and 've-dat-cho' = any(access.module_ids)
      )
    );
$$;

-- 6. Lập một đoàn quầy: một vé (`erp_tickets`), một đoàn treo vào vé đó
--    (`erp_visitor_groups`), đủ mã riêng từng người (`erp_visitor_group_members`).
--
-- ERP-UX-06: mã đoàn và mã từng người LUÔN do máy sinh, không nhận tham số
-- nào cho phép gõ tay — gõ tay rồi trùng mã sẽ lặng lẽ `upsert` đè lên hồ sơ
-- của người đang đi làm, đúng điều đã chốt cấm.
create or replace function public.erp_create_counter_visitor_group(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_party_size integer,
  p_group_label text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_label text := trim(coalesce(p_group_label, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_ticket_code text;
  v_group_code text;
  v_ticket public.erp_tickets;
  v_group public.erp_visitor_groups;
  v_index integer;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or p_party_size is null or p_party_size not between 1 and 45
     or char_length(v_label) < 1 or char_length(v_label) > 120
     or v_key is null or char_length(v_key) > 128 then
    raise exception using errcode = '22023', message = 'GROUP_COUNTER_INPUT_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_counter_actor_can_sell(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'GROUP_COUNTER_ACTOR_REQUIRED';
  end if;

  -- Cùng một khoá thì trả lại đúng tấm phiếu đã lập, không lập tấm thứ hai.
  -- Kiểm sau bước quyền, để một khoá lạ không trở thành đường đọc dữ liệu đoàn
  -- mà không cần quyền bán ở cơ sở này.
  select * into v_group from public.erp_visitor_groups g
  where g.tenant_id = p_tenant_id and g.counter_request_key = v_key;
  if v_group.id is not null then
    return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);
  end if;

  v_ticket_code := 'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.erp_tickets (
    tenant_id, site_id, ticket_code, product, channel, valid_on, entries_allowed
  ) values (
    p_tenant_id, p_site_id, v_ticket_code, 'group', 'quay-ve', v_today, p_party_size
  ) returning * into v_ticket;

  v_group_code := 'DOAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.erp_visitor_groups (
    tenant_id, ticket_id, group_code, group_label, leader_name, leader_phone,
    member_count, counter_request_key
  ) values (
    -- Quay khong hoi ai la truong doan luc lap phieu — cot nay NOT NULL nen
    -- dung mot nhan chung thuc, khong bia mot ten khach cu the nao ca.
    p_tenant_id, v_ticket.id, v_group_code, v_label, 'Khách mua tại quầy', '',
    p_party_size, v_key
  ) returning * into v_group;

  -- Quay khong tach nguoi lon/tre em: khong hoi tuoi, khong hoi chieu cao luc
  -- ban. Moi thanh vien la 'adult' — dung gia thuong cho toan doan.
  for v_index in 1 .. p_party_size loop
    insert into public.erp_visitor_group_members (
      tenant_id, group_id, member_index, member_code, guest_group
    ) values (
      p_tenant_id, v_group.id, v_index,
      'TV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      'adult'
    );
  end loop;

  return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);

exception
  -- Hai lượt gửi cùng một khoá chạy sát nhau thì cả hai đều qua được phép
  -- kiểm ở trên, và chỉ số duy nhất chặn lượt sau lại. Khi ấy trả về đúng tấm
  -- phiếu lượt trước vừa lập, thay vì ném lỗi cho một nhân viên chẳng làm gì
  -- sai. Khối `exception` cuộn lại cả tấm vé vừa chèn, nên không để lại một
  -- hàng `erp_tickets` mồ côi nào.
  --
  -- Trùng mã vé hay trùng mã đoàn cũng ném cùng mã lỗi này; khi ấy câu tra
  -- bên dưới không tìm thấy gì và lỗi được ném tiếp nguyên vẹn.
  when unique_violation then
    select * into v_group from public.erp_visitor_groups g
    where g.tenant_id = p_tenant_id and g.counter_request_key = v_key;
    if v_group.id is not null then
      return public.erp_visitor_group_status(p_tenant_id, v_group.group_code);
    end if;
    raise;
end;
$$;

-- 7. Khoá cửa cho hai hàm mới. Bốn hàm cũ (`erp_visitor_group_status`,
--    `erp_gate_scan_ticket_at`, `erp_account_has_active_role`,
--    `erp_create_visitor_group`) giữ nguyên quyền đã cấp từ trước —
--    `create or replace` với chữ ký không đổi không xoá mất quyền đang có.
revoke all on function public.erp_counter_actor_can_sell(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.erp_counter_actor_can_sell(
  uuid, uuid, text
) to service_role;

revoke all on function public.erp_create_counter_visitor_group(
  uuid, uuid, text, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.erp_create_counter_visitor_group(
  uuid, uuid, text, text, integer, text, text
) to service_role;

commit;
