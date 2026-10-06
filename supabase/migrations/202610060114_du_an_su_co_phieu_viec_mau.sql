-- Dự án sắp tới luôn là "sắp tới", sự cố mẫu là chuyện trong ngày, có phiếu
-- việc ngày cho nhân viên.
--
-- Chủ dự án 06/10/2026 nhắc soát "các dự án sắp tới, các thứ gấp rút". Soát
-- production thấy ba chỗ:
-- 1. Bốn sự kiện mẫu (`20000000-…`) mang ngày cố định; `105` đã phải dời tay
--    +100 ngày một lần, và giữa tháng 11 "Lễ hội Tràng An 2026" lại thành đã
--    qua mà tiến độ 35%.
-- 2. Sự cố mẫu đang mở (`INC-…-069`, `INC-…-071`) báo từ lúc gieo 31/07, nên
--    hàng việc gấp của giám đốc ghi "Quá hạn 65 ngày" như bị bỏ rơi.
-- 3. Trang đầu giám đốc "0 phiếu công việc", ô "Công việc hiện trường" bằng 0:
--    chưa ai giao phiếu việc ngày trên production.
--
-- Cả ba chạy trong lượt làm mới mỗi giờ của lịch sử mẫu (gọi qua
-- `erp_hoat_dong_mau_lam_moi` của `113`), cùng công tắc
-- `erp_lich_su_mau_cau_hinh.bat`. Không thêm lịch chạy.

begin;

-- 1. Sự kiện mẫu còn dưới 21 ngày thì dời 13 tuần (giữ nguyên thứ trong tuần),
--    kéo theo hạn gói việc, mốc trong câu "… trước dd/mm" và năm trong tên.
create or replace function public.erp_du_an_mau_doi_ngay()
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_su_kien record;
  v_so integer := 0;
  v_buoc integer;
begin
  for v_su_kien in
    select e.id, e.event_date, e.next_milestone, e.name
    from public.erp_project_events e
    where e.tenant_id = v_tenant and e.id::text like '20000000-%'
      and e.event_date < v_hom_nay + 21
  loop
    -- Sự kiện đã trôi xa (kho để lâu không chạy) thì dời đủ số lần 13 tuần.
    v_buoc := 91 * greatest(1, ceil(((v_hom_nay + 21) - v_su_kien.event_date) / 91.0)::integer);
    update public.erp_project_events e
    set event_date = e.event_date + v_buoc,
        name = regexp_replace(e.name, '\m20\d\d\M', extract(year from e.event_date + v_buoc)::integer::text),
        next_milestone = case
          when e.next_milestone ~ '\d{1,2}/\d{1,2}' then regexp_replace(
            e.next_milestone,
            '\d{1,2}/\d{1,2}',
            to_char(
              -- Mốc là hạn trước sự kiện: rơi sau ngày sự kiện thì là của năm trước.
              (select case when x.m > e.event_date then x.m - interval '1 year' else x.m::timestamp end
               from (select to_date(
                 substring(e.next_milestone from '(\d{1,2}/\d{1,2})') || '/' || extract(year from e.event_date)::integer,
                 'DD/MM/YYYY') as m) x)
              + make_interval(days => v_buoc),
              'DD/MM'
            )
          )
          else e.next_milestone
        end,
        updated_at = now()
    where e.id = v_su_kien.id;
    update public.erp_project_action_items a
    set due_date = a.due_date + v_buoc, updated_at = now()
    where a.event_id = v_su_kien.id and a.code like 'EV-%';
    v_so := v_so + 1;
  end loop;
  return v_so;
end;
$ham$;

-- 2. Sự cố mẫu đang mở, chưa ai đụng tới (version 1), báo lại trong ngày theo
--    đúng giờ ghi trên hồ sơ (09:02, 09:16). Chưa tới giờ ấy thì là hôm qua.
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
      and i.version = 1
      and i.status not in ('closed', 'resolved')
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

-- 3. Phiếu việc ngày: quản lý giao lúc 06:30, nhân viên vào ca đúng giờ chấm
--    công mẫu của `113`, nộp trước giờ ra ca, quản lý duyệt sau đó. Phiếu mẫu
--    chưa ai đụng tới (version 1) được dựng lại theo trạng thái lúc này; phiếu
--    người thật đã bấm thì để yên.
create or replace function public.erp_phieu_viec_mau_ngay(
  p_ngay date,
  p_den timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_kn text := to_char(p_ngay, 'YYYYMMDD');
  v_dau timestamptz := p_ngay::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_cs record;
  v_nv record;
  v_ql_id text;
  v_ql_ten text;
  v_k text;
  v_giao timestamptz;
  v_vao timestamptz;
  v_ra timestamptz;
  v_nop timestamptz;
  v_duyet timestamptz;
  v_trang_thai text;
  v_id uuid;
  v_cu record;
  v_viec integer;
  v_so integer := 0;
begin
  if not coalesce((select bat from public.erp_lich_su_mau_cau_hinh where id), false) then
    return 0;
  end if;
  v_giao := v_dau + interval '6 hours 30 minutes';
  if v_giao > p_den then
    return 0;
  end if;

  for v_cs in
    select t.*, s.latitude as lat, s.longitude as lng
    from (values
      ('10000000-0000-4000-8000-000000000001'::uuid, 'TA', 'Cổng đón khách Tràng An', 'Bến thuyền trung tâm', 'Quầy hỗ trợ khách'),
      ('10000000-0000-4000-8000-000000000003'::uuid, 'BD', 'Cổng tam quan', 'Điểm đón xe điện', 'Quầy hướng dẫn'),
      ('10000000-0000-4000-8000-000000000005'::uuid, 'TCO', 'Cổng soát vé Văn Lâm', 'Bến đò Văn Lâm', 'Nhà chờ khách đoàn'),
      ('10000000-0000-4000-8000-000000000009'::uuid, 'TCH', 'Cổng soát vé Tam Chúc', 'Bến thuyền Khánh Điện', 'Điểm đón xe trung chuyển')
    ) as t(site_id, ma, cong, ben, quay)
    join public.sites s on s.id = t.site_id
  loop
    v_ql_id := null;
    v_ql_ten := null;
    select r.account_id, r.display_name into v_ql_id, v_ql_ten
    from public.erp_account_registry r
    join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
    where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active'
      and a.role = 'regional-manager' and a.site_id = v_cs.site_id
    order by r.account_id limit 1;
    continue when v_ql_id is null;

    v_viec := 0;
    for v_nv in
      select r.account_id, r.display_name
      from public.erp_account_registry r
      join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
      where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active'
        and a.role = 'employee' and a.site_id = v_cs.site_id
        and (a.effective_until is null or a.effective_until > v_dau)
      order by r.account_id
    loop
      v_viec := v_viec + 1;
      -- Cùng khoá băm với chấm công mẫu của 113: nghỉ cùng ngày, vào ra cùng giờ.
      v_k := v_nv.account_id || '|' || v_kn;
      continue when public.erp_mau_so('nghi|' || v_k) < 0.06;
      v_vao := v_dau + make_interval(mins => 400 + floor(public.erp_mau_so('vao|' || v_k) * 65)::integer);
      v_ra := v_dau + make_interval(mins => 1010 + floor(public.erp_mau_so('ra|' || v_k) * 50)::integer);
      v_nop := v_ra - make_interval(mins => 5 + floor(public.erp_mau_so('pv-nop|' || v_k) * 20)::integer);
      v_duyet := v_ra + make_interval(mins => 15 + floor(public.erp_mau_so('pv-duyet|' || v_k) * 60)::integer);
      v_trang_thai := case
        when p_den >= v_duyet then 'approved'
        when p_den >= v_nop then 'submitted'
        when p_den >= v_vao + interval '30 minutes' then 'in-progress'
        when p_den >= v_vao then 'checked-in'
        else 'assigned' end;
      v_id := public.erp_mau_id('pv|' || v_k);

      select w.id, w.version, w.status into v_cu
      from public.erp_workday_workflows w where w.id = v_id;
      if v_cu.id is not null then
        continue when v_cu.version <> 1 or v_cu.status = v_trang_thai;
        delete from public.erp_workday_workflows w
        where w.id = v_id and w.version = 1
          and not exists (select 1 from public.erp_workday_audit_events ev where ev.workday_id = w.id);
        continue when not found;
      end if;

      insert into public.erp_workday_workflows (
        id, tenant_id, site_id, business_code, business_date,
        employee_account_id, employee_display_name, manager_account_id, manager_display_name,
        module_id, station_code, shift_label, task_title, instructions, priority,
        due_at, evidence_required, status, progress_percent, latest_update_note, result_note,
        check_in_at, check_out_at, check_in_latitude, check_in_longitude, check_in_accuracy_meters,
        manager_note, version, idempotency_key, created_at, updated_at
      ) values (
        v_id, v_tenant, v_cs.site_id,
        'CV-' || v_cs.ma || '-' || v_kn || '-' || lpad(v_viec::text, 2, '0'), p_ngay,
        v_nv.account_id, v_nv.display_name, v_ql_id, v_ql_ten,
        (array['check-in-khach', 'suc-chua', 'bao-cao-hien-truong'])[1 + (v_viec - 1) % 3],
        (array[v_cs.cong, v_cs.ben, v_cs.quay])[1 + (v_viec - 1) % 3],
        '07:30–17:00',
        (array['Soát vé và đón khách tại cổng', 'Điều phối hàng chờ xuống bến', 'Hỗ trợ khách đoàn và báo cáo cuối ca'])[1 + (v_viec - 1) % 3],
        (array[
          'Mở hai làn quét vé, ưu tiên khách đoàn có mã đoàn; báo quản lý khi hàng chờ quá 15 phút.',
          'Gọi lượt theo số, kiểm áo phao trước khi khách xuống thuyền; ghi lại lượt nào phải chờ lâu.',
          'Đón khách đoàn ở điểm hẹn, phát sơ đồ tuyến; cuối ca gửi báo cáo số khách và việc phát sinh.'
        ])[1 + (v_viec - 1) % 3],
        case when public.erp_mau_so('pv-uu|' || v_k) < 0.2 then 'high' else 'normal' end,
        v_dau + interval '17 hours', false, v_trang_thai,
        case v_trang_thai when 'assigned' then 0 when 'checked-in' then 10 when 'in-progress' then 40 + floor(public.erp_mau_so('pv-td|' || v_k) * 4)::integer * 10 else 100 end,
        case when v_trang_thai = 'in-progress' then 'Đang làm, chưa có việc phát sinh.' else '' end,
        case when v_trang_thai in ('submitted', 'approved') then
          (array['Xong ca, không có sự cố. Hàng chờ dài nhất khoảng 10 phút lúc 10 giờ.',
                 'Xong ca. Có một đoàn đến sớm 30 phút, đã xếp làn riêng.',
                 'Xong ca. Một khách đau chân được đưa xe điện ra cổng.'])[1 + floor(public.erp_mau_so('pv-kq|' || v_k) * 3)::integer]
          else '' end,
        case when v_trang_thai = 'assigned' then null else v_vao end,
        case when v_trang_thai in ('submitted', 'approved') then v_nop else null end,
        case when v_trang_thai = 'assigned' then null else v_cs.lat + (public.erp_mau_so('lat|' || v_k) - 0.5) * 0.0012 end,
        case when v_trang_thai = 'assigned' then null else v_cs.lng + (public.erp_mau_so('lng|' || v_k) - 0.5) * 0.0012 end,
        case when v_trang_thai = 'assigned' then null else round((6 + public.erp_mau_so('sai|' || v_k) * 22)::numeric, 1)::double precision end,
        case when v_trang_thai = 'approved' then 'Đã xem, duyệt ngày công.' else '' end,
        1, 'mau-pv-' || v_cs.ma || '-' || v_nv.account_id || '-' || v_kn,
        v_giao,
        case v_trang_thai when 'approved' then v_duyet when 'submitted' then v_nop
             when 'in-progress' then v_vao + interval '30 minutes' when 'checked-in' then v_vao else v_giao end
      ) on conflict do nothing;
      if found then v_so := v_so + 1; end if;
    end loop;
  end loop;
  return v_so;
end;
$ham$;

-- 4. Gỡ: thêm phiếu việc mẫu vào hàm gỡ của 113 (bản của 113, thêm một khối).
create or replace function public.erp_hoat_dong_mau_xoa(p_truoc date default 'infinity')
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer := 0;
  v_n integer;
  v_moc timestamptz := case when p_truoc = 'infinity'::date then 'infinity'::timestamptz
                            else p_truoc::timestamp at time zone 'Asia/Ho_Chi_Minh' end;
begin
  perform set_config('nbj.cho_phep_xoa', 'hoat-dong-mau', true);

  delete from public.erp_staff_attendance_events e
  where e.id::text like 'de000000%' and e.idempotency_key like 'mau-cc-%' and e.business_date < p_truoc;
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  delete from public.erp_shift_handovers h
  where h.id::text like 'de000000%' and h.idempotency_key like 'mau-bg-%' and h.business_date < p_truoc;
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  delete from public.erp_field_operation_reports r
  where r.report_code like 'MAU-%' and r.id::text like 'de000000%' and r.created_at < v_moc;
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  delete from public.erp_sop_audit_events ev
  using public.erp_sop_opening_assessments a
  where ev.assessment_id = a.id and a.id::text like 'de000000%'
    and a.last_submit_idempotency_key like 'mau-sop-%' and a.business_date < p_truoc;
  delete from public.erp_sop_opening_assessments a
  where a.id::text like 'de000000%' and a.last_submit_idempotency_key like 'mau-sop-%' and a.business_date < p_truoc
    and not exists (select 1 from public.erp_sop_audit_events ev where ev.assessment_id = a.id);
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  delete from public.erp_staff_request_events ev
  using public.erp_staff_requests q
  where ev.request_id = q.id and q.request_key like 'mau-dx-%' and q.created_at < v_moc
    and ev.id::text like 'de000000%';
  delete from public.erp_staff_requests q
  where q.request_key like 'mau-dx-%' and q.id::text like 'de000000%' and q.created_at < v_moc
    and not exists (select 1 from public.erp_staff_request_events ev where ev.request_id = q.id);
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  -- Phiếu việc mẫu; phiếu đã có người thật bấm (có nhật ký) thì giữ.
  delete from public.erp_workday_workflows w
  where w.id::text like 'de000000%' and w.idempotency_key like 'mau-pv-%' and w.business_date < p_truoc
    and not exists (select 1 from public.erp_workday_audit_events ev where ev.workday_id = w.id);
  get diagnostics v_n = row_count; v_so := v_so + v_n;

  perform set_config('nbj.cho_phep_xoa', '', true);
  return v_so;
end;
$ham$;

-- 5. Lượt làm mới gọi thêm ba phần mới (bản của 113, thêm dòng cuối vòng lặp).
create or replace function public.erp_hoat_dong_mau_lam_moi(p_so_ngay integer default 28)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_ngay date;
  v_so integer := 0;
begin
  if p_so_ngay is null or p_so_ngay < 1 or p_so_ngay > 60 then
    raise exception using errcode = '22023', message = 'ERP_DEMO_ACTIVITY_DAYS_INVALID';
  end if;
  perform public.erp_hoat_dong_mau_xoa(v_hom_nay - p_so_ngay);
  for v_ngay in select generate_series(v_hom_nay - p_so_ngay, v_hom_nay, interval '1 day')::date loop
    v_so := v_so + public.erp_hoat_dong_mau_ngay(v_ngay, now());
    v_so := v_so + public.erp_phieu_viec_mau_ngay(v_ngay, now());
  end loop;
  v_so := v_so + public.erp_du_an_mau_doi_ngay();
  v_so := v_so + public.erp_su_co_mau_lam_moi();
  return v_so;
end;
$ham$;

revoke all on function public.erp_du_an_mau_doi_ngay() from public, anon, authenticated, service_role;
grant execute on function public.erp_du_an_mau_doi_ngay() to service_role;
revoke all on function public.erp_su_co_mau_lam_moi() from public, anon, authenticated, service_role;
grant execute on function public.erp_su_co_mau_lam_moi() to service_role;
revoke all on function public.erp_phieu_viec_mau_ngay(date, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.erp_phieu_viec_mau_ngay(date, timestamptz) to service_role;
revoke all on function public.erp_hoat_dong_mau_xoa(date) from public, anon, authenticated, service_role;
grant execute on function public.erp_hoat_dong_mau_xoa(date) to service_role;
revoke all on function public.erp_hoat_dong_mau_lam_moi(integer) from public, anon, authenticated, service_role;
grant execute on function public.erp_hoat_dong_mau_lam_moi(integer) to service_role;

select public.erp_hoat_dong_mau_lam_moi(28);

commit;
