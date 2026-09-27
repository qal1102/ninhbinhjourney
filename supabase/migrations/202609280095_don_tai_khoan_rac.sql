-- Dọn 10 tài khoản rác do các bài kiểm thử cũ để lại trên production.
--
-- Soát ngày 28/09/2026 bằng truy vấn chỉ đọc trên production:
-- * 9 tài khoản `qa-t6b-check-<số>` / `qa-t14b-<số>` (tên "QA T6b Check",
--   "QA T14b <số>"), tạo 02/08/2026, đang tạm khoá; 8 trong số đó còn gắn
--   người dùng Supabase Auth email `t6b-check-<số>@ninhbinhjourney.test`.
-- * 1 tài khoản `employee-tamchuc-002` tên "Test", tạo 03/08/2026.
-- Quét mọi cột chữ và JSON của mọi bảng `public`: mã của chúng chỉ nằm ở sổ
-- tài khoản (10), phân vai (9), nhật ký quản trị (43 dòng) và nhật ký chuyển
-- vai (2). Không bảng nghiệp vụ nào (vé, tiền, ca, chấm công) dính tới chúng.
-- Không bảng `public` nào ngoài sổ tài khoản trỏ tới 8 người dùng Auth ấy.
--
-- Mỗi bước khẳng định đúng số dòng trước và sau. Sai một con số là cả giao
-- dịch huỷ, không xoá gì. Khối cuối quét lại toàn kho một lần nữa.

begin;

do $don$
declare
  v_rac constant text := '^(qa-t6b-check-[0-9]+|qa-t14b-[0-9]+|employee-tamchuc-002)$';
  v_so bigint;
  v_xoa bigint;
  v_auth uuid[];
  v_truoc_so_tai_khoan bigint;
  v_truoc_phan_vai bigint;
  v_truoc_nhat_ky bigint;
  v_truoc_chuyen_vai bigint;
  v_truoc_auth bigint;
  v_cot record;
begin
  select count(*) into v_truoc_so_tai_khoan from public.erp_account_registry;
  select count(*) into v_truoc_phan_vai from public.erp_account_role_assignments;
  select count(*) into v_truoc_nhat_ky from public.erp_account_admin_audit;
  select count(*) into v_truoc_chuyen_vai from public.erp_role_switch_audit;
  select count(*) into v_truoc_auth from auth.users;

  -- 1. Đúng 10 tài khoản, đúng tên, đúng ngày tạo, đúng trạng thái.
  select count(*) into v_so from public.erp_account_registry where account_id ~ v_rac;
  if v_so <> 10 then
    raise exception 'DON_RAC_SO_TAI_KHOAN: cho doi 10, thay %', v_so;
  end if;
  select count(*) into v_so
  from public.erp_account_registry
  where account_id ~ v_rac
    and not (
      (account_id ~ '^qa-t6b-check-[0-9]+$' and display_name = 'QA T6b Check' and status = 'suspended')
      or (account_id ~ '^qa-t14b-[0-9]+$' and display_name like 'QA T14b %' and status = 'suspended')
      or (account_id = 'employee-tamchuc-002' and display_name = 'Test')
    );
  if v_so <> 0 then
    raise exception 'DON_RAC_TAI_KHOAN_LA: % tai khoan khop ma nhung sai ten hoac trang thai', v_so;
  end if;
  select count(*) into v_so
  from public.erp_account_registry
  where account_id ~ v_rac
    and (created_at < timestamptz '2026-08-01' or created_at >= timestamptz '2026-08-05');
  if v_so <> 0 then
    raise exception 'DON_RAC_NGAY_TAO: % tai khoan khop ma nhung tao ngoai 02-03/08/2026', v_so;
  end if;

  -- 2. Người dùng Auth: đúng 8, email thử, không tài khoản thật nào dùng chung.
  select array_agg(auth_user_id) into v_auth
  from public.erp_account_registry
  where account_id ~ v_rac and auth_user_id is not null;
  if coalesce(array_length(v_auth, 1), 0) <> 8 then
    raise exception 'DON_RAC_SO_AUTH: cho doi 8, thay %', coalesce(array_length(v_auth, 1), 0);
  end if;
  select count(*) into v_so
  from auth.users
  where id = any(v_auth) and email ~ '^t6b-check-[0-9]+@ninhbinhjourney\.test$';
  if v_so <> 8 then
    raise exception 'DON_RAC_EMAIL_AUTH: cho doi 8 email thu, thay %', v_so;
  end if;
  select count(*) into v_so
  from public.erp_account_registry
  where auth_user_id = any(v_auth) and account_id !~ v_rac;
  if v_so <> 0 then
    raise exception 'DON_RAC_AUTH_DUNG_CHUNG: % tai khoan that dung chung dang nhap', v_so;
  end if;

  -- 3. Xoá, mỗi lệnh phải trúng đúng số dòng đã soát.
  delete from public.erp_role_switch_audit where target_account_id ~ v_rac;
  get diagnostics v_xoa = row_count;
  if v_xoa <> 2 then raise exception 'DON_RAC_XOA_CHUYEN_VAI: cho doi 2, xoa %', v_xoa; end if;

  delete from public.erp_account_admin_audit
  where actor_account_id ~ v_rac or target_account_id ~ v_rac;
  get diagnostics v_xoa = row_count;
  if v_xoa <> 43 then raise exception 'DON_RAC_XOA_NHAT_KY: cho doi 43, xoa %', v_xoa; end if;

  delete from public.erp_account_role_assignments where account_id ~ v_rac;
  get diagnostics v_xoa = row_count;
  if v_xoa <> 9 then raise exception 'DON_RAC_XOA_PHAN_VAI: cho doi 9, xoa %', v_xoa; end if;

  delete from public.erp_account_registry where account_id ~ v_rac;
  get diagnostics v_xoa = row_count;
  if v_xoa <> 10 then raise exception 'DON_RAC_XOA_TAI_KHOAN: cho doi 10, xoa %', v_xoa; end if;

  delete from auth.users where id = any(v_auth);
  get diagnostics v_xoa = row_count;
  if v_xoa <> 8 then raise exception 'DON_RAC_XOA_AUTH: cho doi 8, xoa %', v_xoa; end if;

  -- 4. Kiểm lại hết: mỗi bảng chỉ mất đúng số dòng rác, không hơn không kém.
  if (select count(*) from public.erp_account_registry) <> v_truoc_so_tai_khoan - 10
     or (select count(*) from public.erp_account_role_assignments) <> v_truoc_phan_vai - 9
     or (select count(*) from public.erp_account_admin_audit) <> v_truoc_nhat_ky - 43
     or (select count(*) from public.erp_role_switch_audit) <> v_truoc_chuyen_vai - 2
     or (select count(*) from auth.users) <> v_truoc_auth - 8 then
    raise exception 'DON_RAC_KIEM_LAI_SO_DONG: mot bang mat so dong khac so da soat';
  end if;

  -- Quét lại mọi cột chữ và JSON của mọi bảng public: không còn sót mã rác.
  for v_cot in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
  loop
    if v_cot.data_type in ('jsonb', 'json', 'ARRAY') then
      execute format(
        'select count(*) from public.%I where %I::text ~ %L',
        v_cot.table_name, v_cot.column_name, '(qa-t6b-check-[0-9]+|qa-t14b-[0-9]+|employee-tamchuc-002)'
      ) into v_so;
    else
      execute format(
        'select count(*) from public.%I where %I ~ %L',
        v_cot.table_name, v_cot.column_name, v_rac
      ) into v_so;
    end if;
    if v_so <> 0 then
      raise exception 'DON_RAC_CON_SOT: %.% con % dong', v_cot.table_name, v_cot.column_name, v_so;
    end if;
  end loop;
end
$don$;

commit;
