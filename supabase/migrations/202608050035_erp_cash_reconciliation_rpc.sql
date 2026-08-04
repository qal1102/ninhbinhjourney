-- T10b (tiếp theo 034): các RPC vận hành lượt nộp quỹ, sao kê thủ công, đối
-- khớp, quyết định ngoại lệ và ghi sổ. Cùng kiểu khoá lạc quan qua `version`
-- và cùng vai trò chức năng (`accountant-maker`/`accounting-checker`/
-- `director`) mà migration 006/007/030 đã dùng cho tiền — không phát minh
-- vai trò mới.

begin;

-- Sinh mã lượt nộp có thể đọc được, không phải chỉ UUID trên màn hình.
create or replace function public.erp_cash_next_deposit_code(
  p_tenant_id uuid,
  p_site_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'CASH-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((
      coalesce(count(*), 0) + 1
    )::text, 3, '0')
  from public.erp_cash_deposits d
  where d.tenant_id = p_tenant_id
    and d.site_id = p_site_id
    and d.created_at::date = current_date;
$$;
revoke all on function public.erp_cash_next_deposit_code(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.erp_cash_next_deposit_code(uuid, uuid) to service_role;

-- Dựng bút toán (Nợ/Có cân bằng) cho một lượt nộp đã sẵn sàng ghi sổ, và nối
-- vào lượt nộp. Dùng chung cho cả khớp-đúng-số (match) lẫn ngoại-lệ-đã-duyệt
-- (decide-exception), vì phần "tạo journal" giống hệt nhau, chỉ khác nội
-- dung dòng bút toán truyền vào — factor ra một chỗ để tránh hai đường trôi
-- lệch nhau trên đúng phần mã nhạy nhất (tiền).
create or replace function public.erp_cash_build_deposit_journal(
  p_deposit public.erp_cash_deposits,
  p_business_date date,
  p_actor_account_id text,
  p_note text,
  p_lines jsonb -- array of {accountCode, accountName, debitVnd, creditVnd}
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_key text := to_char(p_business_date, 'YYYY-MM');
  v_period public.erp_accounting_periods;
  v_journal public.erp_accounting_journals;
  v_line jsonb;
  v_line_number integer := 0;
begin
  select * into v_period
  from public.erp_accounting_periods period
  where period.tenant_id = p_deposit.tenant_id
    and period.period_key = v_period_key
  for share;
  if v_period.id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNTING_PERIOD_NOT_FOUND';
  end if;
  if v_period.status <> 'open' then
    raise exception using errcode = '22023', message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  perform pg_catalog.set_config('app.erp_cash_mutation', 'allowed', true);

  insert into public.erp_accounting_journals (
    tenant_id, site_id, journal_code, source_type, source_cash_deposit_id,
    source_version, business_date, period_key, status, version,
    maker_account_id, maker_note, submitted_at
  ) values (
    p_deposit.tenant_id, p_deposit.site_id,
    left('CASHDEP-' || p_deposit.deposit_code, 100),
    'cash-deposit', p_deposit.id, p_deposit.version,
    p_business_date, v_period_key, 'pending-checker', 1,
    p_actor_account_id, p_note, now()
  )
  returning * into v_journal;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_number := v_line_number + 1;
    insert into public.erp_accounting_journal_lines (
      journal_id, tenant_id, site_id, line_number,
      account_code, account_name, debit_vnd, credit_vnd, dimensions
    ) values (
      v_journal.id, v_journal.tenant_id, v_journal.site_id, v_line_number,
      v_line->>'accountCode', v_line->>'accountName',
      coalesce((v_line->>'debitVnd')::bigint, 0),
      coalesce((v_line->>'creditVnd')::bigint, 0),
      jsonb_build_object(
        'siteId', p_deposit.site_id,
        'sourceType', 'cash-deposit',
        'depositId', p_deposit.id,
        'depositCode', p_deposit.deposit_code
      )
    );
  end loop;

  if not public.erp_accounting_journal_is_balanced(v_journal.id) then
    raise exception using errcode = '23514', message = 'CASH_JOURNAL_NOT_BALANCED';
  end if;

  return v_journal.id;
end;
$$;
revoke all on function public.erp_cash_build_deposit_journal(
  public.erp_cash_deposits, date, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.erp_cash_build_deposit_journal(
  public.erp_cash_deposits, date, text, text, jsonb
) to service_role;

-- 1. Gộp ca đã chốt thành một lượt nộp quỹ (kế toán = maker).
create or replace function public.erp_cash_submit_deposit(
  p_tenant_id uuid,
  p_site_id uuid,
  p_shift_close_ids uuid[],
  p_bank_account_ref text,
  p_note text,
  p_actor_account_id text,
  p_idempotency_key text
)
returns public.erp_cash_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_bank text := trim(coalesce(p_bank_account_ref, ''));
  v_code text;
  v_deposit public.erp_cash_deposits;
  v_sum bigint;
  v_count integer;
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or char_length(v_bank) < 2
     or p_shift_close_ids is null
     or cardinality(p_shift_close_ids) = 0 then
    raise exception using errcode = '22023', message = 'CASH_DEPOSIT_INPUT_INVALID';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accountant-maker', p_site_id
  ) then
    raise exception using errcode = '42501', message = 'CASH_ACCOUNTANT_ROLE_REQUIRED';
  end if;

  perform 1 from public.erp_shift_close_workflows w
  where w.id = any(p_shift_close_ids)
    and w.tenant_id = p_tenant_id
    and w.site_id = p_site_id
  for update;

  select count(*), coalesce(sum(w.cash_vnd), 0) into v_count, v_sum
  from public.erp_shift_close_workflows w
  where w.id = any(p_shift_close_ids)
    and w.tenant_id = p_tenant_id
    and w.site_id = p_site_id
    and w.status = 'posted';

  if v_count <> cardinality(p_shift_close_ids) then
    raise exception using errcode = '22023', message = 'CASH_SHIFT_NOT_POSTED_OR_NOT_FOUND';
  end if;
  if v_sum <= 0 then
    raise exception using errcode = '22023', message = 'CASH_DEPOSIT_AMOUNT_MUST_BE_POSITIVE';
  end if;
  if exists (
    select 1 from public.erp_cash_deposit_shifts s
    where s.shift_close_id = any(p_shift_close_ids)
  ) then
    raise exception using errcode = '22023', message = 'CASH_SHIFT_ALREADY_DEPOSITED';
  end if;

  v_code := public.erp_cash_next_deposit_code(p_tenant_id, p_site_id);

  insert into public.erp_cash_deposits (
    tenant_id, site_id, deposit_code, status, amount_vnd, bank_account_ref,
    note, submitted_by_account_id, submitted_at, version
  ) values (
    p_tenant_id, p_site_id, v_code, 'submitted', v_sum, v_bank,
    v_note, v_actor, now(), 1
  )
  returning * into v_deposit;

  insert into public.erp_cash_deposit_shifts (
    deposit_id, shift_close_id, tenant_id, site_id, cash_vnd_snapshot
  )
  select v_deposit.id, w.id, w.tenant_id, w.site_id, w.cash_vnd
  from public.erp_shift_close_workflows w
  where w.id = any(p_shift_close_ids)
    and w.tenant_id = p_tenant_id
    and w.site_id = p_site_id;

  perform public.erp_accounting_write_audit(
    p_tenant_id, p_site_id, 'cash-deposit', v_deposit.id,
    'cash-deposit.submitted', v_actor, 'accountant-maker', null, 'submitted', v_note,
    jsonb_build_object(
      'depositCode', v_code, 'amountVnd', v_sum,
      'shiftCloseIds', to_jsonb(p_shift_close_ids)
    ),
    v_key, repeat('0', 64)
  );

  return v_deposit;
end;
$$;
revoke all on function public.erp_cash_submit_deposit(
  uuid, uuid, uuid[], text, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_cash_submit_deposit(
  uuid, uuid, uuid[], text, text, text, text
) to service_role;

-- 2. Nhập tay một dòng sao kê ngân hàng. `source` luôn 'manual' ở đây — nửa
-- bank-api không có RPC nào trong migration này.
create or replace function public.erp_cash_record_statement_line(
  p_tenant_id uuid,
  p_site_id uuid,
  p_bank_account_ref text,
  p_statement_date date,
  p_amount_vnd bigint,
  p_description text,
  p_external_ref text,
  p_actor_account_id text,
  p_idempotency_key text
)
returns public.erp_bank_statement_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_bank text := trim(coalesce(p_bank_account_ref, ''));
  v_line public.erp_bank_statement_lines;
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or char_length(v_bank) < 2
     or p_statement_date is null
     or p_statement_date > current_date
     or p_amount_vnd is null
     or p_amount_vnd <= 0 then
    raise exception using errcode = '22023', message = 'CASH_STATEMENT_LINE_INPUT_INVALID';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accountant-maker', p_site_id
  ) then
    raise exception using errcode = '42501', message = 'CASH_ACCOUNTANT_ROLE_REQUIRED';
  end if;

  insert into public.erp_bank_statement_lines (
    tenant_id, site_id, source, bank_account_ref, statement_date, amount_vnd,
    description, external_ref, status, entered_by_account_id, entered_at, version
  ) values (
    p_tenant_id, p_site_id, 'manual', v_bank, p_statement_date, p_amount_vnd,
    trim(coalesce(p_description, '')), trim(coalesce(p_external_ref, '')),
    'unmatched', v_actor, now(), 1
  )
  returning * into v_line;

  return v_line;
end;
$$;
revoke all on function public.erp_cash_record_statement_line(
  uuid, uuid, text, date, bigint, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_cash_record_statement_line(
  uuid, uuid, text, date, bigint, text, text, text, text
) to service_role;

-- 3. Đối khớp lượt nộp với một dòng sao kê. Khớp đúng số -> dựng bút toán
-- luôn, chuyển 'accounting-review'. Lệch số -> 'exception', gán người giải
-- trình + hạn xử lý; dòng sao kê giữ 'unmatched' để còn thử lại.
create or replace function public.erp_cash_match_deposit(
  p_tenant_id uuid,
  p_deposit_id uuid,
  p_expected_deposit_version integer,
  p_statement_line_id uuid,
  p_expected_line_version integer,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text
)
returns public.erp_cash_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_deposit public.erp_cash_deposits;
  v_line public.erp_bank_statement_lines;
  v_diff bigint;
  v_journal_id uuid;
begin
  if char_length(v_actor) not between 2 and 100 or char_length(v_key) < 8 then
    raise exception using errcode = '22023', message = 'CASH_MATCH_INPUT_INVALID';
  end if;

  select * into v_deposit
  from public.erp_cash_deposits d
  where d.id = p_deposit_id and d.tenant_id = p_tenant_id
  for update;
  if v_deposit.id is null then
    raise exception using errcode = 'P0002', message = 'CASH_DEPOSIT_NOT_FOUND';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accountant-maker', v_deposit.site_id
  ) then
    raise exception using errcode = '42501', message = 'CASH_ACCOUNTANT_ROLE_REQUIRED';
  end if;
  if v_deposit.version <> p_expected_deposit_version then
    raise exception using errcode = '40001', message = 'CASH_DEPOSIT_VERSION_CONFLICT';
  end if;
  if v_deposit.status <> 'submitted' then
    raise exception using errcode = '22023', message = 'CASH_DEPOSIT_NOT_MATCHABLE';
  end if;

  select * into v_line
  from public.erp_bank_statement_lines l
  where l.id = p_statement_line_id and l.tenant_id = p_tenant_id
  for update;
  if v_line.id is null then
    raise exception using errcode = 'P0002', message = 'CASH_STATEMENT_LINE_NOT_FOUND';
  end if;
  if v_line.site_id <> v_deposit.site_id
     or v_line.bank_account_ref <> v_deposit.bank_account_ref then
    raise exception using errcode = '22023', message = 'CASH_STATEMENT_LINE_ACCOUNT_MISMATCH';
  end if;
  if v_line.version <> p_expected_line_version then
    raise exception using errcode = '40001', message = 'CASH_STATEMENT_LINE_VERSION_CONFLICT';
  end if;
  if v_line.status <> 'unmatched' then
    raise exception using errcode = '22023', message = 'CASH_STATEMENT_LINE_NOT_AVAILABLE';
  end if;

  v_diff := v_deposit.amount_vnd - v_line.amount_vnd;

  if v_diff = 0 then
    v_journal_id := public.erp_cash_build_deposit_journal(
      v_deposit, v_line.statement_date, v_actor, v_note,
      jsonb_build_array(
        jsonb_build_object(
          'accountCode', '1121', 'accountName', 'Tiền gửi ngân hàng',
          'debitVnd', v_deposit.amount_vnd, 'creditVnd', 0
        ),
        jsonb_build_object(
          'accountCode', '1111', 'accountName', 'Tiền mặt tại quầy',
          'debitVnd', 0, 'creditVnd', v_deposit.amount_vnd
        )
      )
    );

    update public.erp_cash_deposits set
      status = 'accounting-review',
      statement_line_id = v_line.id,
      difference_vnd = 0,
      matched_by_account_id = v_actor,
      matched_at = now(),
      journal_id = v_journal_id,
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    update public.erp_bank_statement_lines set
      status = 'matched',
      matched_deposit_id = v_deposit.id,
      version = version + 1
    where id = v_line.id;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.matched', v_actor, 'accountant-maker', 'submitted', 'accounting-review',
      v_note,
      jsonb_build_object('statementLineId', v_line.id, 'journalId', v_journal_id),
      v_key, repeat('0', 64)
    );
  else
    update public.erp_cash_deposits set
      status = 'exception',
      statement_line_id = v_line.id,
      difference_vnd = v_diff,
      exception_owner_account_id = v_actor,
      exception_due_at = now() + interval '24 hours',
      exception_note = v_note,
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.match-exception', v_actor, 'accountant-maker', 'submitted', 'exception',
      v_note,
      jsonb_build_object(
        'statementLineId', v_line.id, 'differenceVnd', v_diff,
        'depositAmountVnd', v_deposit.amount_vnd, 'statementAmountVnd', v_line.amount_vnd
      ),
      v_key, repeat('0', 64)
    );
  end if;

  return v_deposit;
end;
$$;
revoke all on function public.erp_cash_match_deposit(
  uuid, uuid, integer, uuid, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_cash_match_deposit(
  uuid, uuid, integer, uuid, integer, text, text, text
) to service_role;

-- 4. Kế toán trưởng/giám đốc quyết ngoại lệ: duyệt (dựng bút toán kèm dòng
-- chênh lệch 1388/3388, đúng mã shift-close đã dùng) hoặc trả lại kế toán.
create or replace function public.erp_cash_decide_exception(
  p_tenant_id uuid,
  p_deposit_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_approve boolean,
  p_note text,
  p_idempotency_key text
)
returns public.erp_cash_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_deposit public.erp_cash_deposits;
  v_line public.erp_bank_statement_lines;
  v_journal_id uuid;
  v_lines jsonb;
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or char_length(v_note) < 4 then
    raise exception using errcode = '22023', message = 'CASH_EXCEPTION_INPUT_INVALID';
  end if;

  select * into v_deposit
  from public.erp_cash_deposits d
  where d.id = p_deposit_id and d.tenant_id = p_tenant_id
  for update;
  if v_deposit.id is null then
    raise exception using errcode = 'P0002', message = 'CASH_DEPOSIT_NOT_FOUND';
  end if;
  if not (
    public.erp_account_has_active_role(p_tenant_id, v_actor, 'accounting-checker', v_deposit.site_id)
    or public.erp_account_has_active_role(p_tenant_id, v_actor, 'director', v_deposit.site_id)
  ) then
    raise exception using errcode = '42501', message = 'CASH_CHECKER_OR_DIRECTOR_ROLE_REQUIRED';
  end if;
  if v_deposit.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'CASH_DEPOSIT_VERSION_CONFLICT';
  end if;
  if v_deposit.status <> 'exception' then
    raise exception using errcode = '22023', message = 'CASH_DEPOSIT_NOT_PENDING_EXCEPTION_DECISION';
  end if;

  if p_approve then
    select * into v_line
    from public.erp_bank_statement_lines l
    where l.id = v_deposit.statement_line_id
    for update;
    if v_line.id is null or v_line.status <> 'unmatched' then
      raise exception using errcode = '22023', message = 'CASH_STATEMENT_LINE_NOT_AVAILABLE';
    end if;

    v_lines := jsonb_build_array(
      jsonb_build_object(
        'accountCode', '1121', 'accountName', 'Tiền gửi ngân hàng',
        'debitVnd', v_line.amount_vnd, 'creditVnd', 0
      )
    );
    if v_deposit.difference_vnd > 0 then
      -- Ngân hàng nhận ít hơn báo cáo ca: thiếu, đúng mã shift-close đã dùng
      -- cho "chênh lệch thiếu chờ xử lý".
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'accountCode', '1388', 'accountName', 'Chênh lệch thiếu chờ xử lý',
        'debitVnd', v_deposit.difference_vnd, 'creditVnd', 0
      ));
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'accountCode', '1111', 'accountName', 'Tiền mặt tại quầy',
      'debitVnd', 0, 'creditVnd', v_deposit.amount_vnd
    ));
    if v_deposit.difference_vnd < 0 then
      -- Ngân hàng nhận nhiều hơn báo cáo ca: thừa.
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'accountCode', '3388', 'accountName', 'Chênh lệch thừa chờ xử lý',
        'debitVnd', 0, 'creditVnd', abs(v_deposit.difference_vnd)
      ));
    end if;

    v_journal_id := public.erp_cash_build_deposit_journal(
      v_deposit, v_line.statement_date, v_actor, v_note, v_lines
    );

    update public.erp_cash_deposits set
      status = 'accounting-review',
      exception_decided_by_account_id = v_actor,
      exception_decided_at = now(),
      exception_decision = 'approved',
      journal_id = v_journal_id,
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    update public.erp_bank_statement_lines set
      status = 'matched', matched_deposit_id = v_deposit.id, version = version + 1
    where id = v_line.id;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.exception-approved', v_actor, 'accounting-checker', 'exception', 'accounting-review',
      v_note,
      jsonb_build_object('differenceVnd', v_deposit.difference_vnd, 'journalId', v_journal_id),
      v_key, repeat('0', 64)
    );
  else
    update public.erp_cash_deposits set
      status = 'submitted',
      statement_line_id = null,
      difference_vnd = 0,
      exception_owner_account_id = null,
      exception_due_at = null,
      exception_decided_by_account_id = v_actor,
      exception_decided_at = now(),
      exception_decision = 'returned-to-maker',
      exception_note = v_note,
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.exception-returned', v_actor, 'accounting-checker', 'exception', 'submitted',
      v_note, jsonb_build_object(), v_key, repeat('0', 64)
    );
  end if;

  return v_deposit;
end;
$$;
revoke all on function public.erp_cash_decide_exception(
  uuid, uuid, integer, text, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.erp_cash_decide_exception(
  uuid, uuid, integer, text, boolean, text, text
) to service_role;

-- 5. Kế toán trưởng duyệt bút toán và ghi sổ. Người duyệt phải khác người nộp
-- (maker <> checker) — cùng nguyên tắc migration 030 dùng lúc tiền rời hệ
-- thống, áp dụng y hệt lúc tiền được xác nhận đã vào ngân hàng.
create or replace function public.erp_accounting_review_cash_deposit_journal(
  p_tenant_id uuid,
  p_deposit_id uuid,
  p_expected_deposit_version integer,
  p_expected_journal_version integer,
  p_actor_account_id text,
  p_decision text,
  p_note text,
  p_idempotency_key text
)
returns public.erp_cash_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_deposit public.erp_cash_deposits;
  v_journal public.erp_accounting_journals;
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or p_decision not in ('approve', 'return') then
    raise exception using errcode = '22023', message = 'CASH_REVIEW_INPUT_INVALID';
  end if;

  select * into v_deposit
  from public.erp_cash_deposits d
  where d.id = p_deposit_id and d.tenant_id = p_tenant_id
  for update;
  if v_deposit.id is null then
    raise exception using errcode = 'P0002', message = 'CASH_DEPOSIT_NOT_FOUND';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accounting-checker', v_deposit.site_id
  ) then
    raise exception using errcode = '42501', message = 'CASH_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor = v_deposit.submitted_by_account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;
  if v_deposit.version <> p_expected_deposit_version then
    raise exception using errcode = '40001', message = 'CASH_DEPOSIT_VERSION_CONFLICT';
  end if;
  if v_deposit.status <> 'accounting-review' or v_deposit.journal_id is null then
    raise exception using errcode = '22023', message = 'CASH_DEPOSIT_NOT_PENDING_REVIEW';
  end if;

  select * into v_journal
  from public.erp_accounting_journals j
  where j.id = v_deposit.journal_id and j.tenant_id = p_tenant_id
  for update;
  if v_journal.id is null or v_journal.status <> 'pending-checker' then
    raise exception using errcode = '22023', message = 'CASH_JOURNAL_NOT_PENDING_CHECKER';
  end if;
  if v_journal.version <> p_expected_journal_version then
    raise exception using errcode = '40001', message = 'CASH_JOURNAL_VERSION_CONFLICT';
  end if;

  perform pg_catalog.set_config('app.erp_cash_mutation', 'allowed', true);

  if p_decision = 'approve' then
    update public.erp_accounting_journals set
      status = 'posted',
      checker_account_id = v_actor,
      checker_note = v_note,
      approved_at = now(),
      posted_at = now(),
      version = version + 1
    where id = v_journal.id;

    update public.erp_cash_deposits set
      status = 'posted',
      reconciled_by_account_id = v_actor,
      reconciled_at = now(),
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.posted', v_actor, 'accounting-checker', 'accounting-review', 'posted',
      v_note, jsonb_build_object('journalId', v_journal.id), v_key, repeat('0', 64)
    );
  else
    update public.erp_accounting_journals set
      status = 'checker-returned',
      checker_account_id = v_actor,
      checker_note = v_note,
      version = version + 1
    where id = v_journal.id;

    update public.erp_cash_deposits set
      status = 'submitted',
      journal_id = null,
      statement_line_id = null,
      matched_by_account_id = null,
      matched_at = null,
      version = version + 1
    where id = v_deposit.id
    returning * into v_deposit;

    update public.erp_bank_statement_lines set
      status = 'unmatched', matched_deposit_id = null, version = version + 1
    where matched_deposit_id = v_deposit.id;

    perform public.erp_accounting_write_audit(
      p_tenant_id, v_deposit.site_id, 'cash-deposit', v_deposit.id,
      'cash-deposit.checker-returned', v_actor, 'accounting-checker', 'accounting-review', 'submitted',
      v_note, jsonb_build_object('journalId', v_journal.id), v_key, repeat('0', 64)
    );
  end if;

  return v_deposit;
end;
$$;
revoke all on function public.erp_accounting_review_cash_deposit_journal(
  uuid, uuid, integer, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.erp_accounting_review_cash_deposit_journal(
  uuid, uuid, integer, integer, text, text, text, text
) to service_role;

commit;
