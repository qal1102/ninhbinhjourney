-- Sua erp_accounting_reverse_journal (migration 202607290006) de tuong
-- thich voi bút toán nguồn 'cash-deposit' (T10b, migration 034/035).
--
-- Phat hien that khi tu chay round-trip T10b tren production 05/08: bam nut
-- "Tao but toan dao" tren mot but toan nguon cash-deposit da posted luon bao
-- "Ho so vua duoc nguoi khac cap nhat" -- KHONG phai xung dot version that.
-- Doc thang trace network cua Playwright moi ra goc benh: sau khi qua het
-- cac buoc kiem tra (version/period/maker-checker/da-dao-chua), RPC nay
-- LUON tra bang erp_shift_close_workflows theo source_workflow_id de xac
-- nhan nguon con "posted" truoc khi cho dao -- logic nay viet rieng cho
-- shift-close tu dau (migration 007), truoc khi T10b co mat. Cash-deposit
-- dung source_cash_deposit_id, source_workflow_id luon NULL, nen truy van
-- do khong ra dong nao va RPC nem ACCOUNTING_SHIFT_CLOSE_NOT_FOUND -- bi hai
-- lop boc loi phia TypeScript (accounting-repository.ts's
-- findRpcBusinessMessage, accounting-actions.ts's actionError) che thanh
-- thong bao xung dot chung chung, khien trieu chung nhin giong loi version.
--
-- Sua: tach buoc xac nhan nguon lam hai nhanh theo source_type --
-- shift-close doc erp_shift_close_workflows (giu nguyen y het logic cu),
-- cash-deposit doc erp_cash_deposits. Phan ghi lai trang thai nguon sau khi
-- dao (update erp_shift_close_workflows + insert
-- erp_shift_close_audit_events) CHI ap dung cho shift-close -- cash-deposit
-- khong co khai niem "mo lai cho ke toan lam lai" tuong duong trong dac ta
-- hien co, va nhat ky da duoc hai loi goi erp_accounting_write_audit
-- (khong doi, da la nguon-bat-ky) ghi day du qua /erp/nhat-ky (T15).
--
-- supplier-invoice: van CHUA mo o tang ung dung (accounting-actions.ts),
-- nhung neu ai do lo goi RPC nay truc tiep voi mot but toan nguon do, nhanh
-- else moi them se tu choi ro rang (ACCOUNTING_REVERSAL_SOURCE_TYPE_NOT_
-- SUPPORTED) thay vi roi vao nhanh shift-close cu va nem loi sai ten.

begin;

create or replace function public.erp_accounting_reverse_journal(
  p_journal_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_journals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.erp_accounting_journals;
  v_reversal public.erp_accounting_journals;
  v_workflow public.erp_shift_close_workflows;
  v_deposit public.erp_cash_deposits;
  v_source_version integer;
  v_actor public.erp_account_registry;
  v_receipt public.erp_accounting_command_receipts;
  v_reversal_id uuid := gen_random_uuid();
  v_reason text := trim(coalesce(p_reason, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
  v_sequence integer;
begin
  if p_journal_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_reason) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_REVERSAL_INPUT_INVALID';
  end if;

  select *
  into v_original
  from public.erp_accounting_journals journal
  where journal.id = p_journal_id
  for update;
  if v_original.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_original.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_original.tenant_id,
       v_actor.account_id,
       'accounting-checker',
       v_original.site_id
     ) then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor.account_id = v_original.maker_account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_original.tenant_id::text || ':reverse-journal:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_accounting_command_receipts receipt
  where receipt.tenant_id = v_original.tenant_id
    and receipt.command_scope = 'reverse-journal'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash
       or v_receipt.entity_type <> 'journal' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_reversal
    from pg_catalog.jsonb_populate_record(
      null::public.erp_accounting_journals,
      v_receipt.response
    );
    return v_reversal;
  end if;

  if v_original.version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_JOURNAL_VERSION_CONFLICT';
  end if;
  if v_original.status <> 'posted'
     or v_original.reversal_of_journal_id is not null then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_ONLY_POSTED_ORIGINAL_CAN_BE_REVERSED';
  end if;
  if exists (
    select 1
    from public.erp_accounting_journals reversal
    where reversal.reversal_of_journal_id = v_original.id
      and reversal.status = 'posted'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_ALREADY_REVERSED';
  end if;
  if not exists (
    select 1
    from public.erp_accounting_periods period
    where period.tenant_id = v_original.tenant_id
      and period.period_key = v_original.period_key
      and period.status = 'open'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  if v_original.source_type = 'shift-close' then
    select *
    into v_workflow
    from public.erp_shift_close_workflows workflow
    where workflow.id = v_original.source_workflow_id
    for update;
    if v_workflow.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'ACCOUNTING_SHIFT_CLOSE_NOT_FOUND';
    end if;
    if v_workflow.status <> 'posted' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_POSTED_SOURCE_REQUIRED_FOR_REVERSAL';
    end if;
    v_source_version := v_workflow.version;
  elsif v_original.source_type = 'cash-deposit' then
    select *
    into v_deposit
    from public.erp_cash_deposits deposit
    where deposit.id = v_original.source_cash_deposit_id
    for update;
    if v_deposit.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'ACCOUNTING_CASH_DEPOSIT_NOT_FOUND';
    end if;
    if v_deposit.status <> 'posted' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_POSTED_SOURCE_REQUIRED_FOR_REVERSAL';
    end if;
    v_source_version := v_deposit.version;
  else
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_REVERSAL_SOURCE_TYPE_NOT_SUPPORTED';
  end if;

  insert into public.erp_accounting_journals (
    id,
    tenant_id,
    site_id,
    journal_code,
    source_type,
    source_workflow_id,
    source_supplier_invoice_id,
    source_cash_deposit_id,
    source_version,
    business_date,
    period_key,
    status,
    version,
    maker_account_id,
    maker_note,
    checker_account_id,
    checker_note,
    submitted_at,
    reversal_of_journal_id
  ) values (
    v_reversal_id,
    v_original.tenant_id,
    v_original.site_id,
    left(
      'RV-' || v_original.journal_code || '-'
      || upper(substr(v_reversal_id::text, 1, 8)),
      100
    ),
    v_original.source_type,
    v_original.source_workflow_id,
    v_original.source_supplier_invoice_id,
    v_original.source_cash_deposit_id,
    v_source_version,
    v_original.business_date,
    v_original.period_key,
    'draft',
    1,
    v_original.maker_account_id,
    'Bút toán đảo của ' || v_original.journal_code,
    v_actor.account_id,
    v_reason,
    v_now,
    v_original.id
  )
  returning * into v_reversal;

  insert into public.erp_accounting_journal_lines (
    journal_id,
    tenant_id,
    site_id,
    line_number,
    account_code,
    account_name,
    debit_vnd,
    credit_vnd,
    dimensions
  )
  select
    v_reversal.id,
    original_line.tenant_id,
    original_line.site_id,
    original_line.line_number,
    original_line.account_code,
    original_line.account_name,
    original_line.credit_vnd,
    original_line.debit_vnd,
    original_line.dimensions || jsonb_build_object(
      'reversalOfJournalId', v_original.id,
      'reversalOfLineId', original_line.id
    )
  from public.erp_accounting_journal_lines original_line
  where original_line.journal_id = v_original.id
  order by original_line.line_number;

  if not public.erp_accounting_journal_is_balanced(v_reversal.id) then
    raise exception using
      errcode = '23514',
      message = 'ACCOUNTING_REVERSAL_NOT_BALANCED';
  end if;

  update public.erp_accounting_journals
  set status = 'posted',
      version = version + 1,
      approved_at = v_now,
      posted_at = v_now
  where id = v_reversal.id
  returning * into v_reversal;

  -- Ghi lai "mo lai cho ke toan lam lai" chi co y nghia voi shift-close --
  -- cash-deposit khong co trang thai tuong duong trong dac ta hien co, va
  -- hai loi goi erp_accounting_write_audit ben duoi (nguon-bat-ky, khong
  -- doi) da ghi du vao /erp/nhat-ky (T15) cho ca hai nguon.
  if v_original.source_type = 'shift-close' then
    update public.erp_shift_close_workflows
    set status = 'accounting-review',
        version = version + 1,
        review_metadata = review_metadata || jsonb_build_object(
          'reversedJournalId', v_original.id,
          'reversalJournalId', v_reversal.id,
          'reversalReason', v_reason,
          'reversedByAccountId', v_actor.account_id
        ),
        updated_by_account_id = v_actor.account_id,
        updated_by_role = 'system',
        closed_at = null,
        updated_at = v_now
    where id = v_workflow.id
    returning * into v_workflow;

    select coalesce(max(event.sequence_number), 0) + 1
    into v_sequence
    from public.erp_shift_close_audit_events event
    where event.workflow_id = v_workflow.id;
    insert into public.erp_shift_close_audit_events (
      workflow_id,
      tenant_id,
      site_id,
      sequence_number,
      event_type,
      from_status,
      to_status,
      actor_account_id,
      actor_display_name,
      actor_role,
      note,
      metadata,
      idempotency_key,
      occurred_at
    ) values (
      v_workflow.id,
      v_workflow.tenant_id,
      v_workflow.site_id,
      v_sequence,
      'system.accounting-reversed',
      'posted',
      'accounting-review',
      v_actor.account_id,
      v_actor.display_name,
      'system',
      v_reason,
      jsonb_build_object(
        'originalJournalId', v_original.id,
        'reversalJournalId', v_reversal.id,
        'sourceVersion', v_workflow.version
      ),
      left('acct-reverse:' || v_key, 200),
      v_now
    );
  end if;

  perform public.erp_accounting_write_audit(
    v_original.tenant_id,
    v_original.site_id,
    'journal',
    v_original.id,
    'journal.reversal-created',
    v_actor.account_id,
    'accounting-checker',
    'posted',
    'posted',
    v_reason,
    jsonb_build_object('reversalJournalId', v_reversal.id),
    v_key,
    v_hash
  );
  perform public.erp_accounting_write_audit(
    v_reversal.tenant_id,
    v_reversal.site_id,
    'journal',
    v_reversal.id,
    'journal.reversal-posted',
    v_actor.account_id,
    'accounting-checker',
    'draft',
    'posted',
    v_reason,
    jsonb_build_object('reversalOfJournalId', v_original.id),
    v_key,
    v_hash
  );

  insert into public.erp_accounting_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    entity_type,
    entity_id,
    resulting_version,
    response
  ) values (
    v_reversal.tenant_id,
    'reverse-journal',
    v_key,
    v_actor.account_id,
    v_hash,
    'journal',
    v_reversal.id,
    v_reversal.version,
    to_jsonb(v_reversal)
  );

  return v_reversal;
end;
$$;

commit;
