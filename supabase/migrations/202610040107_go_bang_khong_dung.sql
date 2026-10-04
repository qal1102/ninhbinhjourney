-- Gỡ hai bảng không còn mã nào dùng (chủ dự án cho phép 04/10/2026: "kiểm
-- tra 2 bảng không còn mã dùng nào xem có thực sự không dùng không, nếu
-- không có thì xoá đi").
--
-- Đã kiểm trên production trước khi viết, chỉ đọc:
--
-- 1. `erp_huong_dan_tien_do` (086) cùng `erp_doc_tien_do_huong_dan`,
--    `erp_ghi_tien_do_huong_dan`: tiến độ của vòng dẫn cũ. Từ 29/09 màn
--    Hướng dẫn giữ dấu "Đã mở" trên trình duyệt, không mã nào gọi hai hàm
--    này nữa. Bảng còn 2 dòng, ghi lần cuối 29/09/2026 14:56 giờ Việt Nam.
-- 2. `itineraries` và bảng con `itinerary_items` (001) cùng
--    `save_generated_journey`, `update_saved_journey`: lịch trình đã lưu của
--    phòng trình diễn, gỡ khỏi mã ngày 27/09. Cả hai bảng 0 dòng; không dòng
--    nào ở `quotes` hay `bookings` trỏ vào. Lịch trình khách nay sống trong
--    trình duyệt và `customer_anonymous_journeys`, không dính tới bảng này.
--
-- Phụ thuộc trong kho: ngoài ràng buộc, chỉ mục, chính sách của chính các
-- bảng, chỉ có hai khoá ngoại `quotes_itinerary_id_fkey` và
-- `bookings_itinerary_id_fkey`. Bỏ hai khoá ngoại ấy, giữ cột (toàn null),
-- vì các hàm cũ của `quotes`/`bookings` vẫn nhắc tên cột. Không view, không
-- trigger ở bảng khác, không nằm trong publication realtime.
--
-- `reset_demo_run` (001, không mã nào gọi) có xoá vào hai bảng lịch trình;
-- định nghĩa lại y nguyên, chỉ bỏ hai dòng ấy, để hàm không gãy. Quyền của
-- hàm giữ nguyên vì `create or replace` không đụng tới quyền.

begin;

drop function if exists public.erp_ghi_tien_do_huong_dan(uuid, text, text, integer, boolean, boolean, boolean);
drop function if exists public.erp_doc_tien_do_huong_dan(uuid, text, text);
drop table if exists public.erp_huong_dan_tien_do;

drop function if exists public.update_saved_journey(uuid, jsonb, integer, jsonb, text);
drop function if exists public.save_generated_journey(uuid, text, text, jsonb, jsonb);

alter table public.quotes drop constraint if exists quotes_itinerary_id_fkey;
alter table public.bookings drop constraint if exists bookings_itinerary_id_fkey;
drop table if exists public.itinerary_items;
drop table if exists public.itineraries;

create or replace function public.reset_demo_run(p_demo_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
begin
  select * into v_run from public.demo_runs where id = p_demo_run_id for update;
  if v_run.id is null then
    raise exception using errcode = 'P0002', message = 'Demo room was not found';
  end if;
  if v_run.owner_user_id <> v_user_id
     or not public.has_tenant_role(v_run.tenant_id, array['admin']) then
    raise exception using errcode = '42501', message = 'Only the authorized room owner can reset this room';
  end if;
  if v_run.status <> 'active' or v_run.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Demo room is expired or read-only';
  end if;

  delete from public.resource_requests where demo_run_id = p_demo_run_id;
  delete from public.incidents where demo_run_id = p_demo_run_id;
  delete from public.redemptions where demo_run_id = p_demo_run_id;
  delete from public.pass_entitlements where demo_run_id = p_demo_run_id;
  delete from public.passes where demo_run_id = p_demo_run_id;
  delete from public.payment_events where demo_run_id = p_demo_run_id;
  delete from public.payment_intents where demo_run_id = p_demo_run_id;
  delete from public.booking_contacts where demo_run_id = p_demo_run_id;
  delete from public.booking_lines where demo_run_id = p_demo_run_id;
  delete from public.bookings where demo_run_id = p_demo_run_id;
  delete from public.quotes where demo_run_id = p_demo_run_id;
  delete from public.journey_intents where demo_run_id = p_demo_run_id;
  delete from public.analytics_events where demo_run_id = p_demo_run_id;
  delete from public.audit_events where demo_run_id = p_demo_run_id;

  update public.capacity_slots
  set reserved = 0,
      checked_in = 0,
      status = 'available',
      capacity = case
        when site_id = '10000000-0000-4000-8000-000000000001'::uuid then 24
        when site_id = '10000000-0000-4000-8000-000000000002'::uuid then 30
        when site_id = '10000000-0000-4000-8000-000000000003'::uuid then 36
        when site_id = '10000000-0000-4000-8000-000000000004'::uuid then 50
        when site_id = '10000000-0000-4000-8000-000000000005'::uuid then 28
        when site_id = '10000000-0000-4000-8000-000000000006'::uuid then 20
        when site_id = '10000000-0000-4000-8000-000000000007'::uuid then 24
        when site_id = '10000000-0000-4000-8000-000000000008'::uuid then 18
        when site_id = '10000000-0000-4000-8000-000000000009'::uuid then 42
        else 50
      end,
      updated_by = v_user_id,
      updated_at = now()
  where demo_run_id = p_demo_run_id;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'demo.state-reset', 'demo_run', v_run.id,
    jsonb_build_object('scope', 'active-run-only')
  );
end;
$$;

commit;
