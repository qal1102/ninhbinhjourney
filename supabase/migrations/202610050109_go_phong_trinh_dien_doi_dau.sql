-- Gỡ cụm bảng "phòng trình diễn" đời đầu trong 001 (chủ dự án duyệt
-- 05/10/2026: "làm hết đi, tao duyệt hết"; luật B.7: hàm hay module không có
-- chức năng thật thì xoá sau khi kiểm kỹ).
--
-- Đã kiểm trước khi viết:
--
-- 1. Không mã ứng dụng nào gọi `.from()` hay `.rpc()` vào các bảng và hàm
--    dưới đây. Đặt vé web chạy trên `customer_*` (043), sự cố ERP trên
--    `erp_incidents` (011), mã QR chiến dịch trên `marketing_*`.
-- 2. Không migration nào sau 001 có khoá ngoại trỏ vào cụm bảng này; không
--    view, không trigger ở bảng khác, không nằm trong publication realtime.
-- 3. Trên production (chỉ đọc, 05/10/2026): 18 bảng 0 dòng; `campaigns` 3
--    dòng và `qr_sources` 4 dòng đều là dữ liệu gieo của 001 (On-site QR,
--    Hospitality welcome, Airport gateway concept), thay bằng `marketing_*`.
--
-- Giữ lại vì bảng đang dùng còn dựa vào: `tenants`, `regions`, `operators`
-- (`sites.operator_id`), `sites`, `products`, `product_sites`, `sops`,
-- `tenant_memberships` và `user_profiles` cùng hai hàm `has_tenant_role`,
-- `current_user_is_anonymous` (chính sách RLS của migration 002, 003).
--
-- Không dùng `cascade`: còn phụ thuộc nào chưa thấy thì migration báo lỗi
-- thay vì lặng lẽ xoá lan.

begin;

-- 1. Hàm nghiệp vụ của cụm bảng (kể cả bản định nghĩa lại ở 011, 047, 107).
--    Vài hàm trả về đúng kiểu dòng của bảng nên phải đi trước bảng.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as ham
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_demo_run',
        'issue_demo_join_token',
        'join_demo_run',
        'reset_demo_run',
        'create_server_quote',
        'create_sandbox_payment_intent',
        'process_sandbox_payment',
        'get_pass_snapshot',
        'redeem_pass_entitlement',
        'set_capacity_slot',
        'inspect_pass_access',
        'confirm_incident_draft',
        'update_incident_coordination'
      )
  loop
    execute format('drop function %s', r.ham);
  end loop;
end
$$;

-- 2. Bảng, con trước cha; chính sách RLS của chúng đi theo bảng.
drop table if exists public.redemptions;
drop table if exists public.pass_entitlements;
drop table if exists public.passes;
drop table if exists public.payment_events;
drop table if exists public.payment_intents;
drop table if exists public.booking_contacts;
drop table if exists public.booking_lines;
drop table if exists public.bookings;
drop table if exists public.quotes;
drop table if exists public.resource_requests;
drop table if exists public.incidents;
drop table if exists public.capacity_slots;
drop table if exists public.analytics_events;
drop table if exists public.audit_events;
drop table if exists public.demo_join_tokens;
drop table if exists public.demo_run_members;
drop table if exists public.journey_intents;
drop table if exists public.demo_runs;
drop table if exists public.qr_sources;
drop table if exists public.campaigns;

-- 3. Hàm kiểm quyền chỉ chính sách của các bảng trên dùng.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as ham
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_active_run_member',
        'is_internal_run_member',
        'can_read_run_row',
        'can_mutate_own_run_row'
      )
  loop
    execute format('drop function %s', r.ham);
  end loop;
end
$$;

commit;
