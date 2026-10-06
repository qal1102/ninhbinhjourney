-- 1. Sự cố mẫu làm mới được trên production.
-- 2. Gỡ đồ chết trong kho (chủ dự án cho phép 06/10/2026).
--
-- (1) `114` chỉ làm mới sự cố mẫu còn `version = 1`. Áp lên production, hai
-- hồ sơ Tràng An vẫn ghi "Quá hạn 65 ngày": hồ sơ mẫu ở đó đã đi qua các bước
-- khác nên không còn version 1. Nay nhận hồ sơ mẫu bằng nhãn `data_origin =
-- 'demo-seed'` (nhãn làm màn Sự cố ghi "hồ sơ mẫu", gắn ở `060`), giữ thêm
-- điều kiện version 1 cho kho nào chưa có nhãn ấy. Hồ sơ đã đóng không đụng.
--
-- (2) Soát 06/10 bằng PGlite (dò mã ứng dụng, lịch chạy, hàm, trigger, khoá
-- ngoại, chính sách RLS): năm thứ dưới đây không còn ai dùng. Các hàm
-- `erp_rls_*`, `can_manage_erp_site` trông như thừa nhưng là chính sách RLS
-- của bảng tài khoản: giữ.
--   - `customer_sealed_identity_documents` (0 dòng) và
--     `customer_purge_expired_identity_documents()`: kho giấy tờ tuỳ thân niêm
--     phong của `065`, không màn nào ghi hay đọc;
--   - `erp_record_gate_scan(...)` của `012`: soát vé nay đi qua các hàm cổng mới;
--   - `erp_demo_rebase_timeline()` của `026`: dời mốc phòng trình diễn đời đầu,
--     phòng ấy đã gỡ ở `107`, `109`;
--   - `can_access_erp_site(uuid)` của `002`: không chính sách nào dùng.
-- Bài hợp đồng trong `tests/security` đọc tệp migration cũ (vẫn ở lại), không
-- đòi các thứ này còn trong kho, nên không phải sửa.

begin;

create or replace function public.erp_su_co_mau_lam_moi()
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_so integer;
begin
  with moc as (
    select i.id,
           ((v_hom_nay::timestamp + i.reported_at::time) at time zone 'Asia/Ho_Chi_Minh') as luc
    from public.erp_incidents i
    where i.tenant_id = v_tenant
      and i.id ~ '^INC-[A-Z]+-0(69|71)$'
      and (i.data_origin = 'demo-seed' or i.version = 1)
      and i.status <> 'closed'
      and i.reported_at ~ '^\d{2}:\d{2}$'
  ), dich as (
    select id, case when luc > now() then luc - interval '1 day' else luc end as luc
    from moc
  )
  update public.erp_incidents i
  set reported_at_ts = dich.luc,
      updated_at = dich.luc + interval '4 minutes'
  from dich
  where i.id = dich.id
    and i.reported_at_ts < dich.luc - interval '1 minute';
  get diagnostics v_so = row_count;
  return v_so;
end;
$ham$;

revoke all on function public.erp_su_co_mau_lam_moi() from public, anon, authenticated, service_role;
grant execute on function public.erp_su_co_mau_lam_moi() to service_role;

select public.erp_su_co_mau_lam_moi();

-- Gỡ mọi bản nạp chồng theo tên, không phải đoán chữ ký.
do $$
declare
  v_ham record;
begin
  for v_ham in
    select p.oid::regprocedure as chu_ky
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'customer_purge_expired_identity_documents',
        'erp_record_gate_scan',
        'erp_demo_rebase_timeline',
        'can_access_erp_site'
      )
  loop
    execute format('drop function %s', v_ham.chu_ky);
  end loop;
end;
$$;

-- Không `cascade`: còn thứ gì bám vào bảng thì migration dừng, không gỡ lan.
drop table if exists public.customer_sealed_identity_documents;

commit;
