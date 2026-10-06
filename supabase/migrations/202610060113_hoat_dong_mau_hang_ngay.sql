-- Hoạt động mẫu hằng ngày: chấm công, bàn giao ca, báo cáo hiện trường, bảng
-- kiểm mở cửa, đề xuất của nhân viên.
--
-- Chủ dự án 06/10/2026 đăng nhập giám đốc thấy "nhiều cái còn trống": lịch sử
-- mẫu `092` chỉ sinh vé, đơn web và lượt qua cổng, nên màn Chấm công, Nhân sự,
-- SOP, Báo cáo hiện trường, Đề xuất chỉ có số khi có người thật bấm, mà trên
-- production chưa ai bấm. Chủ dự án bảo làm đầy. Đây là phần mở rộng của cùng
-- một nguồn mẫu (`erp_lich_su_mau_lam_moi`, chạy mỗi giờ), cùng công tắc
-- `erp_lich_su_mau_cau_hinh.bat`, không thêm lịch chạy nào.
--
-- Nhận diện: mọi hàng mẫu có mã `de000000…` (`erp_mau_id`); khoá chống trùng
-- bắt đầu bằng `mau-`; báo cáo hiện trường có mã `MAU-…`; chấm công mang
-- nguồn `demo-location` ("vị trí mô phỏng"). Cửa sổ trượt 28 ngày.
--
-- Mỗi việc mẫu có dòng thời gian định sẵn từ băm của khoá (gửi lúc nào, ai
-- duyệt lúc nào). Mỗi lần chạy chỉ đẩy trạng thái tới đúng giờ hiện tại, và
-- chỉ đẩy khi hàng còn đúng trạng thái trước đó: người dùng bấm tay một việc
-- mẫu thì máy không ghi đè. Lượt chấm công mẫu chỉ thêm khi người ấy chưa tự
-- chấm trong ngày.
--
-- Không sinh: lời khách kể (hiện công khai trên trang điểm đến như đánh giá đã
-- xác thực), chốt ca và bút toán (ghi vào sổ tài chính bất biến).

begin;

-- 1. Khe xoá cho hàng mẫu ở ba bảng "chỉ thêm". Chỉ mở khi phiên đặt
--    `nbj.cho_phep_xoa = 'hoat-dong-mau'` và chỉ cho hàng mẫu.
create or replace function public.erp_staff_request_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('nbj.cho_phep_xoa', true) = 'hoat-dong-mau' and old.request_key like 'mau-%' then
      return old;
    end if;
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  if (
    new.id, new.tenant_id, new.site_id, new.request_code, new.request_type, new.details,
    new.amount_vnd, new.requested_by_account_id, new.requested_by_name,
    new.acting_director_account_id, new.request_key, new.created_at
  ) is distinct from (
    old.id, old.tenant_id, old.site_id, old.request_code, old.request_type, old.details,
    old.amount_vnd, old.requested_by_account_id, old.requested_by_name,
    old.acting_director_account_id, old.request_key, old.created_at
  ) then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  if not (
    (old.status = 'submitted' and new.status in ('pending-director', 'approved', 'rejected', 'cancelled'))
    or (old.status = 'pending-director' and new.status in ('approved', 'rejected'))
    or (old.status = 'approved' and new.status = 'completed')
  ) then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  return new;
end;
$$;

create or replace function public.erp_staff_request_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('nbj.cho_phep_xoa', true) = 'hoat-dong-mau'
     and old.id::text like 'de000000%' then
    return old;
  end if;
  raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
end;
$$;

create or replace function public.erp_sop_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('nbj.cho_phep_xoa', true) = 'hoat-dong-mau'
     and old.id::text like 'de000000%' then
    return old;
  end if;
  raise exception using errcode = '42501', message = 'SOP_AUDIT_IMMUTABLE';
end;
$$;

-- 2. Sinh một ngày ở bốn cơ sở có cổng, chỉ phần đã xảy ra trước p_den.
create or replace function public.erp_hoat_dong_mau_ngay(
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
  v_so integer := 0;
  v_gd_id text;
  v_gd_ten text;
  v_kt_id text;
  v_kt_ten text;
  v_cs record;
  v_nv_id text[];
  v_nv_ten text[];
  v_ql_id text;
  v_ql_ten text;
  v_nguoi_id text[];
  v_nguoi_ten text[];
  i integer;
  n integer;
  v_k text;
  v_luc timestamptz;
  v_luc2 timestamptz;
  v_luc3 timestamptz;
  v_r double precision;
  v_id uuid;
  v_cuoi record;
  -- bàn giao
  v_ra_id text;
  v_ra_ten text;
  v_vao_id text;
  v_vao_ten text;
  v_du_kien bigint;
  v_dem bigint;
  -- báo cáo
  v_ma text;
  v_luot integer;
  -- bảng kiểm
  v_muc record;
  v_hong uuid;
  v_trang_thai text;
  -- đề xuất
  v_loai text;
  v_tien bigint;
  v_chi_tiet jsonb;
  v_ma_dx text;
  v_tu_choi boolean;
begin
  if not coalesce((select bat from public.erp_lich_su_mau_cau_hinh where id), false) then
    return 0;
  end if;
  if v_dau >= p_den then
    return 0;
  end if;

  select r.account_id, r.display_name into v_gd_id, v_gd_ten
  from public.erp_account_registry r
  join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
  where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active' and a.role = 'director'
  order by r.account_id limit 1;
  select r.account_id, r.display_name into v_kt_id, v_kt_ten
  from public.erp_account_registry r
  join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
  where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active' and a.role = 'accountant-maker'
  order by r.account_id limit 1;

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
    select coalesce(array_agg(r.account_id order by r.account_id), '{}'),
           coalesce(array_agg(r.display_name order by r.account_id), '{}')
    into v_nv_id, v_nv_ten
    from public.erp_account_registry r
    join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
    where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active'
      and a.role = 'employee' and a.site_id = v_cs.site_id
      and (a.effective_until is null or a.effective_until > v_dau);
    v_ql_id := null;
    v_ql_ten := null;
    select r.account_id, r.display_name into v_ql_id, v_ql_ten
    from public.erp_account_registry r
    join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
    where r.tenant_id = v_tenant and r.status = 'active' and a.status = 'active'
      and a.role = 'regional-manager' and a.site_id = v_cs.site_id
    order by r.account_id limit 1;
    if v_ql_id is null or coalesce(array_length(v_nv_id, 1), 0) = 0 then
      continue;
    end if;
    v_nguoi_id := v_nv_id || v_ql_id;
    v_nguoi_ten := v_nv_ten || v_ql_ten;

    -- 2a. Chấm công: vào 06:40–07:45, ra 16:50–17:40; vài ngày nghỉ.
    for i in 1 .. array_length(v_nguoi_id, 1) loop
      v_k := v_nguoi_id[i] || '|' || v_kn;
      continue when public.erp_mau_so('nghi|' || v_k) < 0.06;
      v_luc := v_dau + make_interval(mins => 400 + floor(public.erp_mau_so('vao|' || v_k) * 65)::integer);
      v_luc2 := v_dau + make_interval(mins => 1010 + floor(public.erp_mau_so('ra|' || v_k) * 50)::integer);
      select e.id, e.event_type into v_cuoi
      from public.erp_staff_attendance_events e
      where e.tenant_id = v_tenant and e.user_account_id = v_nguoi_id[i] and e.business_date = p_ngay
      order by e.created_at desc limit 1;
      if v_cuoi.id is null and v_luc <= p_den then
        insert into public.erp_staff_attendance_events (
          id, tenant_id, site_id, user_account_id, event_type, latitude, longitude,
          accuracy_meters, source, business_date, idempotency_key, created_at
        ) values (
          public.erp_mau_id('cc-vao|' || v_k), v_tenant, v_cs.site_id, v_nguoi_id[i], 'check-in',
          v_cs.lat + (public.erp_mau_so('lat|' || v_k) - 0.5) * 0.0012,
          v_cs.lng + (public.erp_mau_so('lng|' || v_k) - 0.5) * 0.0012,
          round((6 + public.erp_mau_so('sai|' || v_k) * 22)::numeric, 1)::double precision,
          'demo-location', p_ngay, 'mau-cc-vao-' || v_nguoi_id[i] || '-' || v_kn, v_luc
        ) on conflict do nothing;
        v_so := v_so + 1;
        select e.id, e.event_type into v_cuoi
        from public.erp_staff_attendance_events e
        where e.tenant_id = v_tenant and e.user_account_id = v_nguoi_id[i] and e.business_date = p_ngay
        order by e.created_at desc limit 1;
      end if;
      if v_cuoi.id = public.erp_mau_id('cc-vao|' || v_k) and v_luc2 <= p_den then
        insert into public.erp_staff_attendance_events (
          id, tenant_id, site_id, user_account_id, event_type, latitude, longitude,
          accuracy_meters, source, business_date, idempotency_key, created_at
        ) values (
          public.erp_mau_id('cc-ra|' || v_k), v_tenant, v_cs.site_id, v_nguoi_id[i], 'check-out',
          v_cs.lat + (public.erp_mau_so('lat2|' || v_k) - 0.5) * 0.0012,
          v_cs.lng + (public.erp_mau_so('lng2|' || v_k) - 0.5) * 0.0012,
          round((6 + public.erp_mau_so('sai2|' || v_k) * 22)::numeric, 1)::double precision,
          'demo-location', p_ngay, 'mau-cc-ra-' || v_nguoi_id[i] || '-' || v_kn, v_luc2
        ) on conflict do nothing;
        v_so := v_so + 1;
      end if;
    end loop;

    -- 2b. Bàn giao ca trưa ở cổng: người ca sáng giao két cho người ca chiều.
    v_k := v_cs.ma || '|' || v_kn;
    n := array_length(v_nv_id, 1);
    i := 1 + floor(public.erp_mau_so('bg-ra|' || v_k) * n)::integer;
    v_ra_id := v_nv_id[i];
    v_ra_ten := v_nv_ten[i];
    if n > 1 then
      v_vao_id := v_nv_id[1 + (i % n)];
      v_vao_ten := v_nv_ten[1 + (i % n)];
    else
      v_vao_id := v_ql_id;
      v_vao_ten := v_ql_ten;
    end if;
    v_luc := v_dau + make_interval(mins => 720 + floor(public.erp_mau_so('bg-luc|' || v_k) * 25)::integer);
    v_luc2 := v_luc + make_interval(mins => 10 + floor(public.erp_mau_so('bg-nhan|' || v_k) * 25)::integer);
    v_id := public.erp_mau_id('bg|' || v_k);
    if v_luc <= p_den then
      select coalesce(sum(sale.total_vnd), 0) into v_du_kien
      from public.erp_counter_sales sale
      where sale.tenant_id = v_tenant and sale.site_id = v_cs.site_id
        and sale.payment_method = 'cash' and sale.status = 'completed'
        and sale.sold_at >= v_dau + interval '6 hours' and sale.sold_at < v_luc;
      v_r := public.erp_mau_so('bg-lech|' || v_k);
      v_dem := case when v_r < 0.07 and v_du_kien >= 200000 then v_du_kien - (case when v_r < 0.035 then 50000 else 100000 end) else v_du_kien end;
      insert into public.erp_shift_handovers (
        id, tenant_id, site_id, business_date, shift_label, station_code,
        outgoing_account_id, outgoing_display_name, incoming_account_id, incoming_display_name,
        cash_counted_vnd, cash_expected_vnd, open_incident_codes, equipment_note, handover_note,
        status, idempotency_key, created_at, updated_at
      ) values (
        v_id, v_tenant, v_cs.site_id, p_ngay, 'Ca sáng sang ca chiều', v_cs.cong,
        v_ra_id, v_ra_ten, v_vao_id, v_vao_ten,
        v_dem, v_du_kien, '{}',
        (array[
          'Hai máy quét chạy tốt, máy in phiếu còn nửa cuộn giấy.',
          'Máy quét số 2 hơi chậm khi trời nắng gắt, đã lau kính.',
          'Bộ đàm đủ bốn chiếc, đã sạc đầy hai chiếc dự phòng.',
          'Máy in phiếu đã thay cuộn giấy mới lúc 10 giờ.'
        ])[1 + floor(public.erp_mau_so('bg-tb|' || v_k) * 4)::integer],
        (array[
          'Buổi sáng khách đều, không có đoàn lớn. Két đã đếm hai lần cùng người nhận.',
          'Có một đoàn trường học vào lúc 9 giờ, đã cho đi làn riêng. Két đếm đủ.',
          'Khách lẻ đông từ 10 giờ, hàng chờ ngắn. Tiền mặt bàn giao nguyên két.',
          'Một khách quên ví ở quầy, đã gửi lại cho bảo vệ cổng. Két đã đếm cùng người nhận.'
        ])[1 + floor(public.erp_mau_so('bg-gc|' || v_k) * 4)::integer],
        'submitted', 'mau-bg-' || v_cs.ma || '-' || v_kn, v_luc, v_luc
      ) on conflict do nothing;
      if found then v_so := v_so + 1; end if;
      if v_luc2 <= p_den then
        update public.erp_shift_handovers h
        set status = case when h.cash_counted_vnd < h.cash_expected_vnd then 'disputed' else 'accepted' end,
            decision_note = case when h.cash_counted_vnd < h.cash_expected_vnd
              then 'Thiếu ' || replace(to_char(h.cash_expected_vnd - h.cash_counted_vnd, 'FM999,999,999'), ',', '.') || ' đ so với phiếu thu; đã báo quản lý cơ sở đếm lại két.'
              else 'Đã đếm két cùng người giao, đủ tiền.' end,
            decided_at = v_luc2,
            version = h.version + 1,
            updated_at = v_luc2
        where h.id = v_id and h.status = 'submitted';
      end if;
    end if;

    -- 2c. Báo cáo hiện trường: đầu ca, giữa ca, cuối ca.
    for n in 1 .. 3 loop
      v_k := v_cs.ma || '|' || v_kn || '|' || n;
      i := 1 + floor(public.erp_mau_so('bc-ai|' || v_k) * array_length(v_nv_id, 1))::integer;
      v_luc := v_dau + make_interval(mins => (array[440, 640, 930])[n] + floor(public.erp_mau_so('bc-luc|' || v_k) * 50)::integer);
      continue when v_luc > p_den;
      v_ma := 'MAU-' || v_cs.ma || '-' || to_char(p_ngay, 'YYMMDD') || '-' || n;
      if n = 3 then
        select count(*) into v_luot from public.erp_gate_scan_events scan
        where scan.tenant_id = v_tenant and scan.site_id = v_cs.site_id
          and scan.scanned_at >= v_dau and scan.scanned_at < v_luc;
      end if;
      insert into public.erp_field_operation_reports (
        id, report_code, tenant_id, site_id, area, category, task, employee_account_id,
        employee_name, progress, status, note, finance_code, created_at
      ) values (
        public.erp_mau_id('bc|' || v_k), v_ma, v_tenant, v_cs.site_id,
        case n when 1 then v_cs.cong when 2 then v_cs.ben else v_cs.quay end,
        (array['Đầu ca', 'Tiến độ', 'Kết quả'])[n],
        case n
          when 1 then 'Mở cổng và kiểm tra máy quét'
          when 2 then (array['Phân luồng khách giờ cao điểm', 'Kiểm tra áo phao trước giờ đông', 'Nhắc khách xếp hàng theo làn', 'Dọn lối đi sau mưa'])[1 + floor(public.erp_mau_so('bc-viec|' || v_k) * 4)::integer]
          else 'Tổng kết khách trong ngày'
        end,
        v_nv_id[i], v_nv_ten[i],
        case n when 2 then (array[50, 75])[1 + floor(public.erp_mau_so('bc-td|' || v_k) * 2)::integer] else 100 end,
        case n when 2 then 'Đang xử lý' else 'Chờ quản lý xác nhận' end,
        case n
          when 1 then (array[
            'Hai máy quét chạy tốt, máy in phiếu đủ giấy, biển giờ mở cửa đã dựng.',
            'Đã thử quét vé mẫu ở cả hai làn, bộ đàm liên lạc được với bến.',
            'Lối vào đã quét dọn, dây phân làn căng lại cho khách đoàn.'
          ])[1 + floor(public.erp_mau_so('bc-gc|' || v_k) * 3)::integer]
          when 2 then (array[
            'Khách dồn ở làn bên trái, đã mở thêm làn phụ và cử một người hướng dẫn.',
            'Đã kiểm 40 áo phao ở bến, thay 2 chiếc đứt quai.',
            'Hàng chờ dài khoảng 15 phút, đã nhắc khách chuẩn bị mã vé trước.',
            'Lối đi còn đọng nước ở hai chỗ, đã rải cát và đặt biển cảnh báo trơn.'
          ])[1 + floor(public.erp_mau_so('bc-gc|' || v_k) * 4)::integer]
          else 'Tới giờ báo cáo có ' || replace(to_char(v_luot, 'FM999,999'), ',', '.') || ' lượt khách qua cổng. Không có sự cố mới; khách hỏi nhiều về giờ chuyến cuối.'
        end,
        (array['OPS-GATE-A', 'OPS-FLOW-02', 'CS-DAILY'])[n],
        v_luc
      ) on conflict do nothing;
      if found then v_so := v_so + 1; end if;
      v_luc2 := v_luc + make_interval(mins => 45 + floor(public.erp_mau_so('bc-xn|' || v_k) * 100)::integer);
      if n <> 2 and v_luc2 <= p_den then
        update public.erp_field_operation_reports r
        set status = 'Đã xác nhận'
        where r.report_code = v_ma and r.status = 'Chờ quản lý xác nhận';
      end if;
    end loop;

    -- 2d. Bảng kiểm trước giờ mở cửa: quản lý nộp, giám đốc quyết.
    v_k := v_cs.ma || '|' || v_kn;
    v_luc := v_dau + make_interval(mins => 380 + floor(public.erp_mau_so('sop-nop|' || v_k) * 20)::integer);
    v_luc2 := v_luc + make_interval(mins => 4 + floor(public.erp_mau_so('sop-qd|' || v_k) * 9)::integer);
    v_id := public.erp_mau_id('sop|' || v_k);
    if v_gd_id is not null and v_luc <= p_den
       and exists (select 1 from public.erp_sop_opening_items it where it.tenant_id = v_tenant and it.site_id = v_cs.site_id and it.active) then
      v_hong := null;
      if public.erp_mau_so('sop-hong|' || v_k) < 0.12 then
        select it.id into v_hong from public.erp_sop_opening_items it
        where it.tenant_id = v_tenant and it.site_id = v_cs.site_id and it.active
        order by it.item_code like '%COMMS%' desc, it.sort_order desc limit 1;
      end if;
      insert into public.erp_sop_opening_assessments (
        id, tenant_id, site_id, assessment_code, business_date, status, version,
        submitted_by_account_id, submitted_by_display_name, submitted_at, decision_due_at,
        decision_sla_minutes, last_submit_idempotency_key, last_submit_request_hash,
        created_at, updated_at
      ) values (
        v_id, v_tenant, v_cs.site_id, 'MAU-SOP-' || v_cs.ma || '-' || v_kn, p_ngay, 'submitted', 1,
        v_ql_id, v_ql_ten, v_luc, v_luc + interval '15 minutes',
        15, 'mau-sop-' || v_cs.ma || '-' || v_kn, md5('nop|' || v_k) || md5('nop2|' || v_k),
        v_luc, v_luc
      ) on conflict do nothing
      returning id into v_id;
      if v_id is not null then
        v_so := v_so + 1;
        for v_muc in
          select it.id from public.erp_sop_opening_items it
          where it.tenant_id = v_tenant and it.site_id = v_cs.site_id and it.active
        loop
          insert into public.erp_sop_opening_results (
            tenant_id, assessment_id, item_id, result, note, evidence_reference, created_at, updated_at
          ) values (
            v_tenant, v_id, v_muc.id,
            case when v_muc.id = v_hong then 'fail' else 'pass' end,
            case when v_muc.id = v_hong then 'Bộ đàm số 3 hết pin, đã cấp máy dự phòng; đổi pin trước 9 giờ.' else '' end,
            null, v_luc, v_luc
          ) on conflict do nothing;
        end loop;
        insert into public.erp_sop_audit_events (
          id, tenant_id, site_id, assessment_id, action, from_status, to_status,
          actor_account_id, actor_display_name, detail, idempotency_key, created_at
        ) values (
          public.erp_mau_id('sop-nop|' || v_k), v_tenant, v_cs.site_id, v_id, 'assessment.submitted', null, 'submitted',
          v_ql_id, v_ql_ten, jsonb_build_object('version', 1, 'mau', true), 'mau-sop-nop-' || v_cs.ma || '-' || v_kn, v_luc
        ) on conflict do nothing;
      end if;
      v_id := public.erp_mau_id('sop|' || v_k);
      if v_luc2 <= p_den then
        v_hong := null;
        select res.item_id into v_hong from public.erp_sop_opening_results res
        where res.assessment_id = v_id and res.result = 'fail' limit 1;
        v_trang_thai := case when v_hong is null then 'go' else 'risk-accepted' end;
        update public.erp_sop_opening_assessments a
        set status = v_trang_thai,
            version = a.version + 1,
            decision_by_account_id = v_gd_id,
            decision_by_display_name = v_gd_ten,
            decided_at = v_luc2,
            decision_note = case when v_hong is null then 'Đủ điều kiện, cho mở cửa đúng giờ.'
              else 'Mở cửa, theo dõi việc đổi pin bộ đàm.' end,
            risk_acceptance = case when v_hong is null then null
              else 'Chấp nhận mở cửa: máy dự phòng đủ liên lạc trên toàn tuyến; quản lý cơ sở đổi pin trước 9 giờ và báo lại.' end,
            decision_idempotency_key = 'mau-sop-qd-' || v_cs.ma || '-' || v_kn,
            decision_request_hash = md5('qd|' || v_k) || md5('qd2|' || v_k),
            updated_at = v_luc2
        where a.id = v_id and a.status = 'submitted';
        if found then
          insert into public.erp_sop_audit_events (
            id, tenant_id, site_id, assessment_id, action, from_status, to_status,
            actor_account_id, actor_display_name, detail, idempotency_key, created_at
          ) values (
            public.erp_mau_id('sop-qd|' || v_k), v_tenant, v_cs.site_id, v_id, 'assessment.' || v_trang_thai, 'submitted', v_trang_thai,
            v_gd_id, v_gd_ten, jsonb_build_object('version', 2, 'mau', true), 'mau-sop-qd-' || v_cs.ma || '-' || v_kn, v_luc2
          ) on conflict do nothing;
        end if;
      end if;
    end if;

    -- 2e. Đề xuất: khoảng một ngày trong ba có người gửi.
    v_k := v_cs.ma || '|' || v_kn;
    if public.erp_mau_so('dx-co|' || v_k) < 0.38 then
      i := 1 + floor(public.erp_mau_so('dx-ai|' || v_k) * array_length(v_nv_id, 1))::integer;
      v_r := public.erp_mau_so('dx-loai|' || v_k);
      v_loai := case when v_r < 0.25 then 'nghi-phep' when v_r < 0.45 then 'doi-ca' when v_r < 0.6 then 'tam-ung'
                     when v_r < 0.85 then 'de-xuat-mua' else 'sua-chua' end;
      v_tien := null;
      v_r := public.erp_mau_so('dx-chon|' || v_k);
      case v_loai
        when 'nghi-phep' then
          v_chi_tiet := jsonb_build_object(
            'from_date', to_char(p_ngay + 3 + floor(v_r * 8)::integer, 'YYYY-MM-DD'),
            'to_date', to_char(p_ngay + 3 + floor(v_r * 8)::integer + floor(public.erp_mau_so('dx-dai|' || v_k) * 2)::integer, 'YYYY-MM-DD'),
            'reason', (array['Về quê dự đám cưới em họ.', 'Đưa con đi khám định kỳ.', 'Việc gia đình, đã nhờ người trực thay.'])[1 + floor(v_r * 3)::integer]);
        when 'doi-ca' then
          v_chi_tiet := jsonb_build_object(
            'shift_date', to_char(p_ngay + 2 + floor(v_r * 5)::integer, 'YYYY-MM-DD'),
            'current_shift', 'Ca sáng', 'desired_shift', 'Ca chiều',
            'cover_name', case when array_length(v_nv_id, 1) > 1 then v_nv_ten[1 + (i % array_length(v_nv_id, 1))] else null end,
            'reason', (array['Buổi sáng phải đưa mẹ đi viện.', 'Học lớp nghiệp vụ buổi sáng.', 'Đổi với đồng nghiệp cho tiện đường.'])[1 + floor(v_r * 3)::integer]);
        when 'tam-ung' then
          v_tien := (5 + floor(v_r * 26)::integer) * 100000;
          v_chi_tiet := jsonb_build_object('purpose',
            (array['Mua nước uống cho khách đoàn chờ lâu.', 'Thuê thêm người dọn vệ sinh dịp cuối tuần.', 'Mua pin bộ đàm và băng keo phân làn.'])[1 + floor(v_r * 3)::integer]);
        when 'de-xuat-mua' then
          v_tien := (15 + floor(v_r * 106)::integer) * 100000;
          v_chi_tiet := jsonb_build_object(
            'items', (array['Hai máy quét mã vé cầm tay', '30 áo phao trẻ em', 'Mái che nắng cho hàng chờ', 'Ba bộ đàm thay thế'])[1 + floor(v_r * 4)::integer],
            'supplier', (array['Cửa hàng thiết bị Hoa Lư', 'Công ty bảo hộ Ninh Phúc', null])[1 + floor(public.erp_mau_so('dx-ncc|' || v_k) * 3)::integer],
            'reason', 'Đồ cũ đã hỏng hoặc không đủ cho ngày đông khách.');
        else
          v_tien := case when v_r < 0.4 then null else (8 + floor(v_r * 33)::integer) * 100000 end;
          v_chi_tiet := jsonb_build_object(
            'location', (array[v_cs.cong, v_cs.ben, v_cs.quay])[1 + floor(public.erp_mau_so('dx-cho|' || v_k) * 3)::integer],
            'problem', (array['Cửa cuốn kẹt, phải kéo tay.', 'Một bóng đèn lối đi bị cháy.', 'Mái tôn dột khi mưa to.'])[1 + floor(v_r * 3)::integer],
            'urgency', case when v_r < 0.3 then 'gap' else 'thuong' end);
      end case;
      -- Màn Đề xuất đọc dấu này để gắn nhãn "mẫu" (hàm JSON không trả mã hàng).
      v_chi_tiet := v_chi_tiet || jsonb_build_object('nguon', 'mau');
      v_ma_dx := 'DX-' || upper(substr(md5('dx|' || v_k), 1, 10));
      v_id := public.erp_mau_id('dx|' || v_k);
      v_luc := v_dau + make_interval(mins => 480 + floor(public.erp_mau_so('dx-luc|' || v_k) * 540)::integer);
      if v_luc <= p_den then
        insert into public.erp_staff_requests (
          id, tenant_id, site_id, request_code, request_type, status, details, amount_vnd,
          requested_by_account_id, requested_by_name, request_key, created_at, updated_at
        ) values (
          v_id, v_tenant, v_cs.site_id, v_ma_dx, v_loai, 'submitted', v_chi_tiet, v_tien,
          v_nv_id[i], v_nv_ten[i], 'mau-dx-' || v_cs.ma || '-' || v_kn, v_luc, v_luc
        ) on conflict do nothing;
        if found then
          v_so := v_so + 1;
          insert into public.erp_staff_request_events (
            id, tenant_id, site_id, request_id, event_type, from_status, to_status,
            actor_account_id, actor_display_name, note, occurred_at
          ) values (
            public.erp_mau_id('dx-gui|' || v_k), v_tenant, v_cs.site_id, v_id, 'staff-request.submitted', null, 'submitted',
            v_nv_id[i], v_nv_ten[i],
            'Gửi đề xuất ' || v_ma_dx || coalesce(', số tiền ' || v_tien || ' đ', '') || '.', v_luc
          ) on conflict do nothing;
        end if;
        -- Quản lý xem trong ngày hôm sau; khoản vượt 5 triệu chuyển giám đốc.
        v_luc2 := v_luc + make_interval(mins => 960 + floor(public.erp_mau_so('dx-ql|' || v_k) * 720)::integer);
        v_tu_choi := public.erp_mau_so('dx-tc|' || v_k) < 0.12;
        if v_luc2 <= p_den then
          update public.erp_staff_requests q
          set status = case when v_tu_choi then 'rejected'
                            when q.request_type in ('tam-ung', 'de-xuat-mua', 'sua-chua')
                                 and coalesce(q.amount_vnd, 0) > public.erp_staff_request_director_threshold_vnd() then 'pending-director'
                            else 'approved' end,
              last_actor_account_id = v_ql_id,
              last_actor_name = v_ql_ten,
              last_note = case when v_tu_choi then 'Tuần này thiếu người, xin gửi lại sau ngày 15.' else null end,
              updated_at = v_luc2
          where q.id = v_id and q.status = 'submitted'
          returning q.status into v_trang_thai;
          if found then
            insert into public.erp_staff_request_events (
              id, tenant_id, site_id, request_id, event_type, from_status, to_status,
              actor_account_id, actor_display_name, note, occurred_at
            ) values (
              public.erp_mau_id('dx-ql|' || v_k), v_tenant, v_cs.site_id, v_id,
              case v_trang_thai when 'rejected' then 'staff-request.rejected' when 'pending-director' then 'staff-request.escalated' else 'staff-request.approved' end,
              'submitted', v_trang_thai, v_ql_id, v_ql_ten,
              case v_trang_thai
                when 'rejected' then 'Từ chối đề xuất ' || v_ma_dx || '. Lý do: Tuần này thiếu người, xin gửi lại sau ngày 15.'
                when 'pending-director' then 'Quản lý đồng ý, chuyển giám đốc vì vượt ngưỡng: ' || v_ma_dx || '.'
                else 'Duyệt đề xuất ' || v_ma_dx || '.' end,
              v_luc2
            ) on conflict do nothing;
          end if;
        end if;
        -- Giám đốc xem khoản lớn sau một tới ba ngày.
        v_luc3 := v_luc2 + make_interval(mins => 1440 + floor(public.erp_mau_so('dx-gd|' || v_k) * 2880)::integer);
        if v_gd_id is not null and v_luc3 <= p_den then
          update public.erp_staff_requests q
          set status = 'approved', last_actor_account_id = v_gd_id, last_actor_name = v_gd_ten,
              last_note = null, updated_at = v_luc3
          where q.id = v_id and q.status = 'pending-director';
          if found then
            insert into public.erp_staff_request_events (
              id, tenant_id, site_id, request_id, event_type, from_status, to_status,
              actor_account_id, actor_display_name, note, occurred_at
            ) values (
              public.erp_mau_id('dx-gd|' || v_k), v_tenant, v_cs.site_id, v_id, 'staff-request.approved',
              'pending-director', 'approved', v_gd_id, v_gd_ten, 'Duyệt đề xuất ' || v_ma_dx || '.', v_luc3
            ) on conflict do nothing;
          end if;
        end if;
        -- Kế toán chi tạm ứng sau khi duyệt một ngày.
        v_luc3 := greatest(v_luc2, coalesce((select q.updated_at from public.erp_staff_requests q where q.id = v_id), v_luc2))
                  + interval '1 day';
        if v_kt_id is not null and v_luc3 <= p_den then
          update public.erp_staff_requests q
          set status = 'completed', last_actor_account_id = v_kt_id, last_actor_name = v_kt_ten,
              last_note = 'Đã chi tạm ứng bằng tiền mặt.', updated_at = v_luc3
          where q.id = v_id and q.status = 'approved' and q.request_type = 'tam-ung';
          if found then
            insert into public.erp_staff_request_events (
              id, tenant_id, site_id, request_id, event_type, from_status, to_status,
              actor_account_id, actor_display_name, note, occurred_at
            ) values (
              public.erp_mau_id('dx-kt|' || v_k), v_tenant, v_cs.site_id, v_id, 'staff-request.completed',
              'approved', 'completed', v_kt_id, v_kt_ten, 'Đã chi tạm ứng bằng tiền mặt.', v_luc3
            ) on conflict do nothing;
          end if;
        end if;
      end if;
    end if;
  end loop;
  return v_so;
end;
$ham$;

-- 3. Gỡ hoạt động mẫu trước một ngày (mặc định: gỡ hết).
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

  perform set_config('nbj.cho_phep_xoa', '', true);
  return v_so;
end;
$ham$;

-- 4. Cửa sổ trượt 28 ngày, gọi từ lượt làm mới mỗi giờ của lịch sử mẫu.
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
  end loop;
  return v_so;
end;
$ham$;

-- Bản của 092, thêm một dòng cuối gọi phần hoạt động mẫu.
create or replace function public.erp_lich_su_mau_lam_moi(p_so_ngay integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_gio timestamptz;
  v_tu timestamptz;
  v_cuoi timestamptz;
  v_so integer := 0;
begin
  if p_so_ngay is null or p_so_ngay < 1 or p_so_ngay > 90 then
    raise exception using errcode = '22023', message = 'ERP_DEMO_HISTORY_DAYS_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('erp-lich-su-mau', 0));
  v_tu := date_trunc('hour', now()) - make_interval(days => p_so_ngay);
  perform public.erp_lich_su_mau_xoa(v_tu);
  select date_trunc('hour', greatest(
    (select max(sale.sold_at) from public.erp_counter_sales sale where sale.id::text like 'de000000%'),
    (select max(customer_order.created_at) from public.customer_orders customer_order
      where customer_order.id::text like 'de000000%')
  )) into v_cuoi;
  for v_gio in
    select generate_series(
      greatest(v_tu, coalesce(v_cuoi, v_tu)),
      date_trunc('hour', now()),
      interval '1 hour'
    )
  loop
    v_so := v_so + public.erp_lich_su_mau_sinh_gio(v_gio, now());
  end loop;
  -- Sau vé và lượt qua cổng, vì két bàn giao và báo cáo cuối ca đọc từ đó.
  v_so := v_so + public.erp_hoat_dong_mau_lam_moi(28);
  return v_so;
end;
$ham$;

revoke all on function public.erp_hoat_dong_mau_ngay(date, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.erp_hoat_dong_mau_ngay(date, timestamptz) to service_role;
revoke all on function public.erp_hoat_dong_mau_xoa(date) from public, anon, authenticated, service_role;
grant execute on function public.erp_hoat_dong_mau_xoa(date) to service_role;
revoke all on function public.erp_hoat_dong_mau_lam_moi(integer) from public, anon, authenticated, service_role;
grant execute on function public.erp_hoat_dong_mau_lam_moi(integer) to service_role;
revoke all on function public.erp_staff_request_guard_update() from public, anon, authenticated, service_role;
revoke all on function public.erp_staff_request_append_only() from public, anon, authenticated, service_role;
revoke all on function public.erp_sop_audit_immutable() from public, anon, authenticated, service_role;

select public.erp_hoat_dong_mau_lam_moi(28);

commit;
