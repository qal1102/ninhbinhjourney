-- Hai việc kế toán (chủ dự án giao 03/10/2026: "tiền ghi hay không tự quyết").
--
-- 1. Kỳ kế toán tự mở tới tháng hiện tại.
--    Kho chỉ từng gieo kỳ 2026-07 (006) và kỳ của tháng áp 007 cùng tháng sau
--    đó. Không hàm nào mở kỳ mới, nên từ tháng 9 mọi lần lập bút toán (chốt
--    ca, hoá đơn NCC, nộp quỹ) rơi vào ACCOUNTING_PERIOD_NOT_FOUND. Hàm
--    `erp_accounting_mo_ky_den_nay` mở các kỳ còn thiếu từ 2026-07 tới tháng
--    hiện tại theo giờ Việt Nam (không mở kỳ tương lai). Máy chủ gọi nó trước
--    mỗi lần lập bút toán; migration gọi một lần ngay bây giờ. Không đổi kỳ
--    nào đã có, không mở lại kỳ đã khoá.
--
-- 2. Tiền chi hoa hồng đại lý vào sổ kế toán.
--    Trước đây "Ghi đã chi" (099) chỉ ghi một dòng `dai_ly_chi_tra`, sổ kế toán
--    không biết. Nay mỗi lần ghi chi dựng bút toán chờ kiểm tra, đúng luồng
--    lập–kiểm tra mọi bút toán khác đang đi:
--      Nợ 6418 Chi phí bán hàng – hoa hồng đại lý / Có 1121 Tiền gửi ngân hàng
--    (hoa hồng trả bằng chuyển khoản; tài khoản theo Thông tư 99/2025).
--    Bút toán nào cũng gắn một cơ sở, nên tiền chia theo cơ sở nơi khách của
--    từng đơn qua cổng lần đầu: luật hoa hồng vốn chỉ tính đơn có khách đã qua
--    cổng. Phần lẻ do làm tròn dồn vào cơ sở có tiền đơn lớn nhất, để tổng các
--    bút toán đúng bằng số hoa hồng kho tính.
--    Người ghi chi là người lập; kế toán trưởng (vai `accounting-checker`, khác
--    người lập) duyệt thì ghi sổ, trả lại thì cả lần chi bị trả và tháng ấy
--    ghi chi lại được. Lần chi chỉ "đã ghi sổ" khi mọi bút toán của nó đã ghi.

begin;

-- 1. Kỳ kế toán -------------------------------------------------------------

create or replace function public.erp_accounting_mo_ky_den_nay(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer;
begin
  insert into public.erp_accounting_periods (tenant_id, period_key, starts_on, ends_on, status, version)
  select p_tenant_id, pg_catalog.to_char(thang, 'YYYY-MM'), thang::date,
    (thang + interval '1 month' - interval '1 day')::date, 'open', 1
  from pg_catalog.generate_series(
    date '2026-07-01',
    date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date,
    interval '1 month'
  ) as thang
  on conflict (tenant_id, period_key) do nothing;
  get diagnostics v_so = row_count;
  return v_so;
end;
$ham$;

revoke all on function public.erp_accounting_mo_ky_den_nay(uuid) from public, anon, authenticated;
grant execute on function public.erp_accounting_mo_ky_den_nay(uuid) to service_role;

select public.erp_accounting_mo_ky_den_nay(tenant.id) from public.tenants tenant;

-- 2. Lần chi hoa hồng có trạng thái -----------------------------------------

alter table public.dai_ly_chi_tra
  add column trang_thai text not null default 'cho-duyet'
    check (trang_thai in ('cho-duyet', 'da-ghi-so', 'bi-tra-lai')),
  add column ly_do_tra text check (ly_do_tra is null or char_length(ly_do_tra) <= 2000),
  add column cap_nhat_luc timestamptz not null default now();

-- Mỗi đại lý mỗi tháng một lần chi còn hiệu lực; lần bị trả lại không tính.
alter table public.dai_ly_chi_tra drop constraint dai_ly_chi_tra_dai_ly_id_thang_key;
create unique index dai_ly_chi_tra_mot_lan_moi_thang
  on public.dai_ly_chi_tra (dai_ly_id, thang)
  where trang_thai <> 'bi-tra-lai';
grant update on table public.dai_ly_chi_tra to service_role;

-- 3. Nguồn bút toán thứ tư: hoa hồng đại lý ----------------------------------

alter table public.erp_accounting_journals
  add column if not exists source_dai_ly_chi_tra_id uuid
    references public.dai_ly_chi_tra(id) on delete restrict;
alter table public.erp_accounting_journals
  drop constraint if exists erp_accounting_journals_source_type_check;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_type_check
  check (source_type in ('shift-close', 'supplier-invoice', 'cash-deposit', 'agent-commission'));
alter table public.erp_accounting_journals
  drop constraint if exists erp_accounting_journals_source_identity_check;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_identity_check
  check (
    (
      source_type = 'shift-close'
      and source_workflow_id is not null
      and source_supplier_invoice_id is null
      and source_cash_deposit_id is null
      and source_dai_ly_chi_tra_id is null
    )
    or
    (
      source_type = 'supplier-invoice'
      and source_workflow_id is null
      and source_supplier_invoice_id is not null
      and source_cash_deposit_id is null
      and source_dai_ly_chi_tra_id is null
    )
    or
    (
      source_type = 'cash-deposit'
      and source_workflow_id is null
      and source_supplier_invoice_id is null
      and source_cash_deposit_id is not null
      and source_dai_ly_chi_tra_id is null
    )
    or
    (
      source_type = 'agent-commission'
      and source_workflow_id is null
      and source_supplier_invoice_id is null
      and source_cash_deposit_id is null
      and source_dai_ly_chi_tra_id is not null
    )
  );

-- Một lần chi, mỗi cơ sở đúng một bút toán.
create unique index if not exists erp_accounting_mot_but_toan_hoa_hong_moi_co_so
  on public.erp_accounting_journals (source_dai_ly_chi_tra_id, site_id)
  where source_type = 'agent-commission' and reversal_of_journal_id is null;

-- Cùng cơ chế chặn ghi trực tiếp như 007/034: chỉ RPC của đại lý (bật cờ
-- phiên) được sửa bút toán nguồn agent-commission. Bản 034 giữ nguyên, thêm
-- nhánh mới và cột nguồn mới vào phần định danh bất biến.
create or replace function public.erp_validate_accounting_journal_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_DELETE_NOT_ALLOWED';
  end if;
  if old.source_type = 'supplier-invoice'
     and coalesce(pg_catalog.current_setting('app.erp_ap_mutation', true), '') <> 'allowed' then
    raise exception using
      errcode = '22023',
      message = 'AP_JOURNAL_REQUIRES_AP_WORKFLOW';
  end if;
  if old.source_type = 'cash-deposit'
     and coalesce(pg_catalog.current_setting('app.erp_cash_mutation', true), '') <> 'allowed' then
    raise exception using
      errcode = '22023',
      message = 'CASH_JOURNAL_REQUIRES_CASH_WORKFLOW';
  end if;
  if old.source_type = 'agent-commission'
     and coalesce(pg_catalog.current_setting('app.erp_dai_ly_mutation', true), '') <> 'allowed' then
    raise exception using
      errcode = '22023',
      message = 'DAI_LY_BUT_TOAN_PHAI_QUA_LUONG_DAI_LY';
  end if;
  if old.status = 'posted' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_POSTED_JOURNAL_IMMUTABLE';
  end if;
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.site_id is distinct from old.site_id
     or new.journal_code is distinct from old.journal_code
     or new.source_type is distinct from old.source_type
     or new.source_workflow_id is distinct from old.source_workflow_id
     or new.source_supplier_invoice_id is distinct from old.source_supplier_invoice_id
     or new.source_cash_deposit_id is distinct from old.source_cash_deposit_id
     or new.source_dai_ly_chi_tra_id is distinct from old.source_dai_ly_chi_tra_id
     or new.business_date is distinct from old.business_date
     or new.period_key is distinct from old.period_key
     or new.maker_account_id is distinct from old.maker_account_id
     or new.reversal_of_journal_id is distinct from old.reversal_of_journal_id
     or new.supersedes_journal_id is distinct from old.supersedes_journal_id
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_IDENTITY_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_JOURNAL_VERSION_MUST_INCREMENT';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 4. Chia hoa hồng một tháng theo cơ sở khách qua cổng lần đầu --------------

create or replace function public.dai_ly_tien_don_theo_co_so(p_tenant_id uuid, p_dai_ly_id uuid, p_thang date)
returns table (site_id uuid, tien_don bigint)
language sql
stable
security definer
set search_path = ''
as $ham$
  with don as (
    select ct.order_id, ct.total_vnd
    from public.dai_ly_don_chi_tiet(
      p_tenant_id, date_trunc('month', p_thang)::date, (date_trunc('month', p_thang) + interval '1 month')::date
    ) ct
    where ct.dai_ly_id = p_dai_ly_id and ct.status = 'confirmed' and ct.da_toi
  ),
  cong_dau as (
    select distinct on (don.order_id) don.order_id, don.total_vnd, scan.site_id
    from don
    join public.customer_order_tickets bridge
      on bridge.order_id = don.order_id and bridge.tenant_id = p_tenant_id
    join public.erp_gate_scan_events scan
      on scan.ticket_id = bridge.ticket_id and scan.tenant_id = bridge.tenant_id and scan.result = 'accepted'
    order by don.order_id, scan.scanned_at, scan.id
  )
  select cong_dau.site_id, sum(cong_dau.total_vnd)::bigint
  from cong_dau
  group by cong_dau.site_id;
$ham$;

revoke all on function public.dai_ly_tien_don_theo_co_so(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.dai_ly_tien_don_theo_co_so(uuid, uuid, date) to service_role;

-- 5. Dựng bút toán cho một lần chi -------------------------------------------

create or replace function public.dai_ly_lap_but_toan(p_chi_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_chi public.dai_ly_chi_tra;
  v_dai_ly public.dai_ly;
  v_ngay date := public.hang_cho_ngay_vn();
  v_ky text := pg_catalog.to_char(public.hang_cho_ngay_vn(), 'YYYY-MM');
  v_dong record;
  v_journal public.erp_accounting_journals;
  v_tong_don bigint;
  v_tong_chia bigint := 0;
  v_lon_nhat uuid;
  v_so_but_toan integer := 0;
  v_ma_chi text;
  v_ghi_chu text;
begin
  select * into v_chi from public.dai_ly_chi_tra where id = p_chi_id for update;
  select * into v_dai_ly from public.dai_ly where id = v_chi.dai_ly_id;
  if v_chi.so_tien = 0 then
    update public.dai_ly_chi_tra set trang_thai = 'da-ghi-so', cap_nhat_luc = now() where id = v_chi.id;
    return 0;
  end if;

  perform public.erp_accounting_mo_ky_den_nay(v_chi.tenant_id);
  if not exists (
    select 1 from public.erp_accounting_periods period
    where period.tenant_id = v_chi.tenant_id and period.period_key = v_ky and period.status = 'open'
  ) then
    raise exception using errcode = '22023', message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  create temporary table if not exists pg_temp.chia_hoa_hong (
    site_id uuid primary key, tien_don bigint not null, so_tien bigint not null
  ) on commit drop;
  truncate pg_temp.chia_hoa_hong;
  insert into pg_temp.chia_hoa_hong (site_id, tien_don, so_tien)
  select theo.site_id, theo.tien_don, pg_catalog.round(theo.tien_don * v_dai_ly.ty_le_hoa_hong / 100)::bigint
  from public.dai_ly_tien_don_theo_co_so(v_chi.tenant_id, v_chi.dai_ly_id, v_chi.thang) theo;

  select coalesce(sum(tien_don), 0), coalesce(sum(so_tien), 0) into v_tong_don, v_tong_chia from pg_temp.chia_hoa_hong;
  if v_tong_don = 0 then
    raise exception using errcode = '22023', message = 'DAI_LY_KHONG_CHIA_DUOC_CO_SO';
  end if;
  select site_id into v_lon_nhat from pg_temp.chia_hoa_hong order by tien_don desc, site_id limit 1;
  update pg_temp.chia_hoa_hong set so_tien = so_tien + (v_chi.so_tien - v_tong_chia) where site_id = v_lon_nhat;
  if exists (select 1 from pg_temp.chia_hoa_hong where so_tien < 0) then
    raise exception using errcode = '23514', message = 'DAI_LY_CHIA_LECH';
  end if;

  perform pg_catalog.set_config('app.erp_dai_ly_mutation', 'allowed', true);
  v_ma_chi := pg_catalog.upper(pg_catalog.left(pg_catalog.replace(v_chi.id::text, '-', ''), 6));
  v_ghi_chu := 'Chi hoa hồng tháng ' || pg_catalog.to_char(v_chi.thang, 'MM/YYYY') || ' cho đại lý '
    || v_dai_ly.ten || ' (' || v_dai_ly.ma || '), tỷ lệ ' || pg_catalog.rtrim(pg_catalog.to_char(v_dai_ly.ty_le_hoa_hong, 'FM990.##'), '.')
    || '%, trên đơn có khách đã qua cổng.' || coalesce(' ' || v_chi.ghi_chu, '');

  for v_dong in select * from pg_temp.chia_hoa_hong where so_tien > 0 order by tien_don desc, site_id loop
    v_so_but_toan := v_so_but_toan + 1;
    insert into public.erp_accounting_journals (
      tenant_id, site_id, journal_code, source_type, source_dai_ly_chi_tra_id,
      source_version, business_date, period_key, status, version,
      maker_account_id, maker_note, submitted_at
    ) values (
      v_chi.tenant_id, v_dong.site_id,
      'HH-' || v_dai_ly.ma || '-' || pg_catalog.to_char(v_chi.thang, 'YYYYMM') || '-' || v_ma_chi || '-' || v_so_but_toan,
      'agent-commission', v_chi.id, 1, v_ngay, v_ky, 'pending-checker', 1,
      v_chi.tao_boi, pg_catalog.left(v_ghi_chu, 2000), now()
    ) returning * into v_journal;

    insert into public.erp_accounting_journal_lines (
      journal_id, tenant_id, site_id, line_number, account_code, account_name, debit_vnd, credit_vnd, dimensions
    )
    select v_journal.id, v_journal.tenant_id, v_journal.site_id, dong.so, dong.tk, dong.ten, dong.no, dong.co,
      pg_catalog.jsonb_build_object(
        'siteId', v_journal.site_id, 'sourceType', 'agent-commission',
        'daiLyId', v_dai_ly.id, 'daiLyMa', v_dai_ly.ma, 'thang', pg_catalog.to_char(v_chi.thang, 'YYYY-MM'),
        'tienDonQuaCong', v_dong.tien_don
      )
    from (values
      (1, '6418', 'Chi phí bán hàng – hoa hồng đại lý', v_dong.so_tien, 0::bigint),
      (2, '1121', 'Tiền gửi ngân hàng', 0::bigint, v_dong.so_tien)
    ) as dong (so, tk, ten, no, co);

    if not public.erp_accounting_journal_is_balanced(v_journal.id) then
      raise exception using errcode = '23514', message = 'ACCOUNTING_JOURNAL_NOT_BALANCED';
    end if;

    perform public.erp_accounting_write_audit(
      v_journal.tenant_id, v_journal.site_id, 'journal', v_journal.id,
      'journal.submitted', v_chi.tao_boi, 'accountant-maker', 'draft', 'pending-checker',
      v_journal.maker_note,
      pg_catalog.jsonb_build_object('sourceType', 'agent-commission', 'daiLyChiTraId', v_chi.id, 'soTien', v_dong.so_tien),
      'dai-ly-chi:' || v_chi.id::text || ':' || v_so_but_toan,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_chi.id::text || ':' || v_dong.site_id::text || ':' || v_dong.so_tien, 'UTF8')), 'hex')
    );
  end loop;

  return v_so_but_toan;
end;
$ham$;

revoke all on function public.dai_ly_lap_but_toan(uuid) from public, anon, authenticated;
grant execute on function public.dai_ly_lap_but_toan(uuid) to service_role;

-- 6. Ghi đã chi: nay dựng luôn bút toán chờ kiểm tra -------------------------

create or replace function public.erp_dai_ly_ghi_chi(
  p_tenant_id uuid, p_id uuid, p_thang date, p_ghi_chu text, p_nguoi text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_thang date := date_trunc('month', p_thang)::date;
  v_so bigint;
  v_chi_id uuid;
begin
  if v_thang >= date_trunc('month', public.hang_cho_ngay_vn())::date then
    raise exception using errcode = '22023', message = 'DAI_LY_THANG_CHUA_KHEP';
  end if;
  select (item ->> 'hoa_hong')::bigint into v_so
  from pg_catalog.jsonb_array_elements(public.erp_dai_ly_thang(p_tenant_id, v_thang)) item
  where item ->> 'id' = p_id::text;
  if v_so is null then
    raise exception using errcode = 'P0002', message = 'DAI_LY_KHONG_CO';
  end if;
  begin
    insert into public.dai_ly_chi_tra (tenant_id, dai_ly_id, thang, so_tien, ghi_chu, tao_boi)
    values (p_tenant_id, p_id, v_thang, v_so, nullif(pg_catalog.btrim(p_ghi_chu), ''), p_nguoi)
    returning id into v_chi_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'DAI_LY_DA_CHI';
  end;
  perform public.dai_ly_lap_but_toan(v_chi_id);
  return v_so;
end;
$ham$;

-- 7. Kế toán trưởng kiểm tra bút toán hoa hồng --------------------------------

create or replace function public.erp_dai_ly_duyet_but_toan(
  p_tenant_id uuid,
  p_journal_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_decision text,
  p_note text,
  p_idempotency_key text
)
returns public.erp_accounting_journals
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := pg_catalog.btrim(coalesce(p_actor_account_id, ''));
  v_note text := pg_catalog.btrim(coalesce(p_note, ''));
  v_key text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_journal public.erp_accounting_journals;
  v_chi public.dai_ly_chi_tra;
  v_khac public.erp_accounting_journals;
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or p_decision is null or p_decision not in ('approve', 'return')
     or char_length(v_note) > 2000
     or (p_decision = 'return' and char_length(v_note) < 4) then
    raise exception using errcode = '22023', message = 'ACCOUNTING_REVIEW_INPUT_INVALID';
  end if;

  select * into v_journal from public.erp_accounting_journals journal
  where journal.id = p_journal_id and journal.tenant_id = p_tenant_id
  for update;
  if v_journal.id is null or v_journal.source_type <> 'agent-commission' then
    raise exception using errcode = 'P0002', message = 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;
  if not public.erp_account_has_active_role(p_tenant_id, v_actor, 'accounting-checker', v_journal.site_id) then
    raise exception using errcode = '42501', message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor = v_journal.maker_account_id then
    raise exception using errcode = '42501', message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;
  if v_journal.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ACCOUNTING_JOURNAL_VERSION_CONFLICT';
  end if;
  if v_journal.status <> 'pending-checker' then
    raise exception using errcode = '22023', message = 'ACCOUNTING_JOURNAL_NOT_PENDING_CHECKER';
  end if;
  select * into v_chi from public.dai_ly_chi_tra chi where chi.id = v_journal.source_dai_ly_chi_tra_id for update;
  if v_chi.trang_thai <> 'cho-duyet' then
    raise exception using errcode = '22023', message = 'ACCOUNTING_JOURNAL_NOT_PENDING_CHECKER';
  end if;

  perform pg_catalog.set_config('app.erp_dai_ly_mutation', 'allowed', true);

  if p_decision = 'approve' then
    if not public.erp_accounting_journal_is_balanced(v_journal.id) then
      raise exception using errcode = '23514', message = 'ACCOUNTING_JOURNAL_NOT_BALANCED';
    end if;
    if not exists (
      select 1 from public.erp_accounting_periods period
      where period.tenant_id = v_journal.tenant_id and period.period_key = v_journal.period_key and period.status = 'open'
    ) then
      raise exception using errcode = '22023', message = 'ACCOUNTING_PERIOD_IS_LOCKED';
    end if;
    update public.erp_accounting_journals set
      status = 'posted', checker_account_id = v_actor, checker_note = v_note,
      approved_at = now(), posted_at = now(), version = version + 1
    where id = v_journal.id
    returning * into v_journal;
    perform public.erp_accounting_write_audit(
      v_journal.tenant_id, v_journal.site_id, 'journal', v_journal.id,
      'journal.approved-and-posted', v_actor, 'accounting-checker', 'pending-checker', 'posted', v_note,
      pg_catalog.jsonb_build_object('decision', 'approve', 'daiLyChiTraId', v_chi.id),
      v_key, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_key || ':approve', 'UTF8')), 'hex')
    );
    if not exists (
      select 1 from public.erp_accounting_journals khac
      where khac.source_dai_ly_chi_tra_id = v_chi.id and khac.status <> 'posted'
    ) then
      update public.dai_ly_chi_tra set trang_thai = 'da-ghi-so', cap_nhat_luc = now() where id = v_chi.id;
    end if;
  else
    -- Trả lại thì trả cả lần chi: mọi bút toán còn chờ của lần ấy cùng về
    -- "trả lại", tháng ấy ghi chi lại được.
    for v_khac in
      select * from public.erp_accounting_journals khac
      where khac.source_dai_ly_chi_tra_id = v_chi.id and khac.status = 'pending-checker'
      order by khac.journal_code
      for update
    loop
      update public.erp_accounting_journals set
        status = 'checker-returned', checker_account_id = v_actor, checker_note = v_note, version = version + 1
      where id = v_khac.id;
      perform public.erp_accounting_write_audit(
        v_khac.tenant_id, v_khac.site_id, 'journal', v_khac.id,
        'journal.returned', v_actor, 'accounting-checker', 'pending-checker', 'checker-returned', v_note,
        pg_catalog.jsonb_build_object('decision', 'return', 'daiLyChiTraId', v_chi.id),
        v_key, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_key || ':return', 'UTF8')), 'hex')
      );
    end loop;
    update public.dai_ly_chi_tra set trang_thai = 'bi-tra-lai', ly_do_tra = v_note, cap_nhat_luc = now()
    where id = v_chi.id;
    select * into v_journal from public.erp_accounting_journals where id = p_journal_id;
  end if;

  return v_journal;
end;
$ham$;

revoke all on function public.erp_dai_ly_duyet_but_toan(uuid, uuid, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.erp_dai_ly_duyet_but_toan(uuid, uuid, integer, text, text, text, text)
  to service_role;

-- 8. Bảng tháng nói rõ lần chi đang ở đâu ------------------------------------

create or replace function public.erp_dai_ly_thang(p_tenant_id uuid, p_thang date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with don as (
    select * from public.dai_ly_don_chi_tiet(
      p_tenant_id, date_trunc('month', p_thang)::date, (date_trunc('month', p_thang) + interval '1 month')::date)
    where status = 'confirmed'
  ),
  chi as (
    select distinct on (lan.dai_ly_id) lan.*
    from public.dai_ly_chi_tra lan
    where lan.tenant_id = p_tenant_id and lan.thang = date_trunc('month', p_thang)::date
    order by lan.dai_ly_id, (lan.trang_thai <> 'bi-tra-lai') desc, lan.tao_luc desc
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', agency.id, 'ma', agency.ma, 'ten', agency.ten, 'nguoi_lien_he', agency.nguoi_lien_he,
    'dien_thoai', agency.dien_thoai, 'ty_le', agency.ty_le_hoa_hong, 'trang_thai', agency.trang_thai,
    'la_mau', agency.la_mau, 'co_khoa', agency.khoa_bam is not null,
    'don', (select count(*) from don where don.dai_ly_id = agency.id),
    'khach', (select coalesce(sum(party_size), 0) from don where don.dai_ly_id = agency.id),
    'doanh_thu', (select coalesce(sum(total_vnd), 0) from don where don.dai_ly_id = agency.id),
    'don_toi', (select count(*) from don where don.dai_ly_id = agency.id and don.da_toi),
    'khach_toi', (select coalesce(sum(party_size), 0) from don where don.dai_ly_id = agency.id and don.da_toi),
    'doanh_thu_toi', (select coalesce(sum(total_vnd), 0) from don where don.dai_ly_id = agency.id and don.da_toi),
    'hoa_hong', (select pg_catalog.round(coalesce(sum(total_vnd), 0) * agency.ty_le_hoa_hong / 100)
      from don where don.dai_ly_id = agency.id and don.da_toi),
    'da_chi', (select case when chi.trang_thai <> 'bi-tra-lai' then chi.so_tien end from chi where chi.dai_ly_id = agency.id),
    'chi_luc', (select case when chi.trang_thai <> 'bi-tra-lai' then chi.tao_luc end from chi where chi.dai_ly_id = agency.id),
    'trang_thai_chi', (select chi.trang_thai from chi where chi.dai_ly_id = agency.id),
    'ly_do_tra', (select chi.ly_do_tra from chi where chi.dai_ly_id = agency.id and chi.trang_thai = 'bi-tra-lai'),
    'but_toan', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'ma', journal.journal_code, 'trang_thai', journal.status
      ) order by journal.journal_code), '[]'::jsonb)
      from chi join public.erp_accounting_journals journal on journal.source_dai_ly_chi_tra_id = chi.id
      where chi.dai_ly_id = agency.id
    )
  ) order by agency.la_mau, agency.tao_luc), '[]'::jsonb)
  from public.dai_ly agency
  where agency.tenant_id = p_tenant_id;
$ham$;

-- 9. Lần chi ghi trước migration này: dựng bút toán cho nó, như mọi lần chi mới.
do $lap$
declare
  v_id uuid;
begin
  for v_id in select id from public.dai_ly_chi_tra order by tao_luc loop
    perform public.dai_ly_lap_but_toan(v_id);
  end loop;
end;
$lap$;

commit;
