-- TC-10 · 18/09/2026
--
-- Căn cước hành trình: mỗi người xem được những nơi chính mình đã đi qua.
--
-- ## Cái đã có, và cái còn thiếu
--
-- Nhật ký quét `erp_gate_scan_events` đã ghi mỗi lượt vào bằng mã riêng của
-- từng người (`member_id`, từ TC-06). Trang trưởng đoàn đọc chuỗi ấy qua
-- `erp_visitor_group_status`. Trang của chính khách (`/doan/[ma]`) thì chưa có
-- đường đọc nào: nó chỉ ghi tên.
--
-- Không dùng lại `erp_visitor_group_status` cho khách, vì hàm ấy trả tên mọi
-- người trong đoàn, tên và số điện thoại trưởng đoàn. Một mã thành viên chỉ
-- được mở ra dữ liệu của đúng người cầm mã.
--
-- ## Hàm này trả gì — và chỉ chừng ấy
--
-- Năm trường, hình dạng cố định:
--
--   member_code, guest_group, display_name (tên chính người này tự khai),
--   visit_date (ngày đi của đoàn), entries [{site_id, scanned_at}]
--
-- `entries` chỉ gồm lượt `accepted` của chính người này, sắp theo giờ. Không
-- tên người khác, không gì của trưởng đoàn, không nhu cầu chăm sóc, không một
-- trường liên lạc nào, không chạm `customer_sealed_identity_documents`.
--
-- ## Ai gọi được
--
-- Chỉ `service_role`. Máy chủ ứng dụng gọi thay khách sau khi kiểm khuôn mã.
-- Mã thành viên là mười ký tự ngẫu nhiên, và ai cầm mã được đối xử như người
-- đó (TC-20) — đúng như cầm một tấm vé.
--
-- ## Chỉ đọc
--
-- Không đổi bảng, không ghi dữ liệu, không thêm chỉ mục. Một hàm, một chữ ký;
-- `create or replace` trên chữ ký mới nên không sinh bản nạp chồng.

begin;

create or replace function public.erp_visitor_group_member_journey(
  p_tenant_id uuid,
  p_member_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_member_code, '')));
  v_member_id uuid;
  v_group_id uuid;
  v_member_code text;
  v_guest_group text;
  v_display_name text;
  v_visit_date date;
  v_entries jsonb;
begin
  -- Cung khuon voi rang buoc cot `member_code` o migration 202608300054.
  -- Ma sai khuon thi khong can hoi bang nao ca.
  if p_tenant_id is null or v_code !~ '^TV-[A-Z0-9]{10}$' then
    raise exception using errcode = '22023', message = 'GROUP_INPUT_INVALID';
  end if;

  select m.id, m.group_id, m.member_code, m.guest_group, m.display_name
  into v_member_id, v_group_id, v_member_code, v_guest_group, v_display_name
  from public.erp_visitor_group_members m
  where m.tenant_id = p_tenant_id
    and m.member_code = v_code;
  if v_member_id is null then
    raise exception using errcode = 'P0002', message = 'GROUP_MEMBER_NOT_FOUND';
  end if;

  -- Ngay di: doan web lay tu don, doan quay lay tu chinh tam ve (TC-18).
  -- Chi doc dung mot cot ngay; khong cot nao cua truong doan.
  select coalesce(o.visit_date, t.valid_on)
  into v_visit_date
  from public.erp_visitor_groups g
  left join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id
  left join public.erp_tickets t on t.id = g.ticket_id and t.tenant_id = g.tenant_id
  where g.id = v_group_id
    and g.tenant_id = p_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'site_id', event.site_id,
    'scanned_at', event.scanned_at
  ) order by event.scanned_at, event.id), '[]'::jsonb)
  into v_entries
  from public.erp_gate_scan_events event
  where event.tenant_id = p_tenant_id
    and event.member_id = v_member_id
    and event.result = 'accepted';

  return jsonb_build_object(
    'member_code', v_member_code,
    'guest_group', v_guest_group,
    'display_name', v_display_name,
    'visit_date', v_visit_date,
    'entries', v_entries
  );
end;
$$;

revoke all on function public.erp_visitor_group_member_journey(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_visitor_group_member_journey(uuid, text) to service_role;

commit;
