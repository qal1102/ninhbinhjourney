-- T10 (nửa công nợ): ghi nhận đã trả tiền nhà cung cấp.
--
-- The supplier workflow has been rigorous about recognising a liability and
-- silent about discharging it: `posted` was terminal, so the system could say
-- with certainty who is owed money and never that anybody was paid. Every
-- payables figure on every screen has therefore been a gross total, not an
-- outstanding one, and "công nợ đến hạn" was a number nobody could act on.
--
-- Two more steps, with the same separation of duties as the rest:
--   posted -> payment-requested   (kế toán tổng hợp lập đề nghị chi)
--   payment-requested -> paid     (kế toán trưởng duyệt và ghi nhận đã chi)
--   payment-requested -> posted   (trả lại, kèm lý do)
--
-- The person who requests a payment may not be the person who settles it. That
-- is the whole reason this system exists, and it applies most sharply at the
-- moment money actually leaves.
--
-- Not in scope here: the cash side of the money (nộp quỹ -> ngân hàng -> đối
-- chiếu sao kê). That is the other half of T10 and a larger piece of work; see
-- docs/HANDOFF.md.

begin;

alter table public.erp_ap_supplier_invoices
  drop constraint if exists erp_ap_supplier_invoices_status_check;
alter table public.erp_ap_supplier_invoices
  add constraint erp_ap_supplier_invoices_status_check
  check (
    status in (
      'match-exception',
      'ready-for-accounting',
      'accounting-review',
      'accounting-returned',
      'director-exception',
      'posted',
      'payment-requested',
      'paid',
      'reversed'
    )
  );

alter table public.erp_ap_supplier_invoices
  add column if not exists payment_requested_by_account_id text,
  add column if not exists payment_requested_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_note text,
  add column if not exists paid_by_account_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_amount_vnd bigint;

alter table public.erp_ap_supplier_invoices
  drop constraint if exists erp_ap_invoice_payment_method_check;
alter table public.erp_ap_supplier_invoices
  add constraint erp_ap_invoice_payment_method_check
  check (
    payment_method is null
    or payment_method in ('bank-transfer', 'cash', 'offset')
  );

alter table public.erp_ap_supplier_invoices
  drop constraint if exists erp_ap_invoice_paid_shape_check;
alter table public.erp_ap_supplier_invoices
  add constraint erp_ap_invoice_paid_shape_check
  check (
    status <> 'paid'
    or (
      paid_by_account_id is not null
      and paid_at is not null
      and paid_amount_vnd is not null
      and payment_method is not null
    )
  );

-- Maker <> checker, enforced by the table and not only by the function that
-- happens to write it.
alter table public.erp_ap_supplier_invoices
  drop constraint if exists erp_ap_invoice_payment_separation_check;
alter table public.erp_ap_supplier_invoices
  add constraint erp_ap_invoice_payment_separation_check
  check (
    paid_by_account_id is null
    or payment_requested_by_account_id is null
    or paid_by_account_id <> payment_requested_by_account_id
  );

-- The old guard treated `posted` as the end of the road. It is now the point
-- at which a liability exists and has not yet been discharged.
create or replace function public.erp_validate_ap_invoice_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_DELETE_NOT_ALLOWED';
  end if;
  if old.status in ('paid', 'reversed') then
    raise exception using
      errcode = '22023',
      message = 'AP_POSTED_SOURCE_IMMUTABLE';
  end if;
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.site_id is distinct from old.site_id
     or new.supplier_id is distinct from old.supplier_id
     or new.case_code is distinct from old.case_code
     or new.supplier_tax_code_snapshot is distinct from old.supplier_tax_code_snapshot
     or new.invoice_series is distinct from old.invoice_series
     or new.invoice_number is distinct from old.invoice_number
     or new.invoice_date is distinct from old.invoice_date
     or new.net_vnd is distinct from old.net_vnd
     or new.vat_vnd is distinct from old.vat_vnd
     or new.total_vnd is distinct from old.total_vnd
     or new.currency is distinct from old.currency
     or new.manager_account_id is distinct from old.manager_account_id
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_IDENTITY_IMMUTABLE';
  end if;
  -- Once posted, the accounting facts of the invoice are settled; only the
  -- payment story may still move.
  if old.status in ('posted', 'payment-requested')
     and (
       new.journal_id is distinct from old.journal_id
       or new.posted_at is distinct from old.posted_at
       or new.accountant_account_id is distinct from old.accountant_account_id
       or new.checker_account_id is distinct from old.checker_account_id
     ) then
    raise exception using
      errcode = '22023',
      message = 'AP_POSTED_SOURCE_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception using
      errcode = '40001',
      message = 'AP_INVOICE_VERSION_MUST_INCREMENT';
  end if;
  if not (
    (old.status = 'match-exception' and new.status in ('match-exception', 'ready-for-accounting', 'director-exception'))
    or (old.status = 'director-exception' and new.status in ('match-exception', 'ready-for-accounting'))
    or (old.status = 'ready-for-accounting' and new.status = 'accounting-review')
    or (old.status = 'accounting-returned' and new.status = 'accounting-review')
    or (old.status = 'accounting-review' and new.status in ('accounting-returned', 'posted'))
    or (old.status = 'posted' and new.status = 'payment-requested')
    or (old.status = 'payment-requested' and new.status in ('posted', 'paid'))
  ) then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_TRANSITION_NOT_ALLOWED';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Locking an accounting period asks whether the *accounting* for an invoice is
-- finished, not whether the supplier has been paid: the journal is posted in
-- this period, the transfer may well leave in the next one. Without this the
-- new states would make a period unlockable whenever any payment was in
-- flight, which is normal and permanent.
create or replace function public.erp_ap_block_period_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'locked' and exists (
    select 1
    from public.erp_ap_supplier_invoices invoice
    where invoice.tenant_id = new.tenant_id
      and to_char(invoice.invoice_date, 'YYYY-MM') = new.period_key
      and invoice.status not in ('posted', 'payment-requested', 'paid', 'reversed')
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_HAS_OPEN_AP_INVOICES';
  end if;
  return new;
end;
$$;

create or replace function public.erp_ap_request_supplier_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_payment_method text,
  p_payment_reference text,
  p_note text,
  p_idempotency_key text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or char_length(v_note) < 4
     or p_payment_method not in ('bank-transfer', 'cash', 'offset') then
    raise exception using errcode = '22023', message = 'AP_PAYMENT_INPUT_INVALID';
  end if;

  select * into v_invoice
  from public.erp_ap_supplier_invoices
  where id = p_invoice_id and tenant_id = p_tenant_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  if v_invoice.status <> 'posted' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_PAYABLE';
  end if;
  if v_invoice.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accountant-maker', v_invoice.site_id
  ) then
    raise exception using errcode = '42501', message = 'AP_ACCOUNTANT_ROLE_REQUIRED';
  end if;

  update public.erp_ap_supplier_invoices set
    status = 'payment-requested',
    owner_role = 'chief-accountant',
    payment_requested_by_account_id = v_actor,
    payment_requested_at = now(),
    payment_method = p_payment_method,
    payment_reference = nullif(trim(coalesce(p_payment_reference, '')), ''),
    payment_note = v_note,
    version = version + 1
  where id = v_invoice.id
  returning * into v_invoice;

  perform public.erp_ap_write_audit(
    v_invoice.id, p_tenant_id, v_invoice.site_id,
    'payment.requested', 'posted', 'payment-requested',
    v_actor, 'accountant', v_note,
    jsonb_build_object('payment_method', p_payment_method),
    'request-supplier-payment', v_key, repeat('0', 64)
  );

  return v_invoice;
end;
$$;

create or replace function public.erp_ap_settle_supplier_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_approve boolean,
  p_paid_amount_vnd bigint,
  p_note text,
  p_idempotency_key text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if char_length(v_actor) not between 2 and 100
     or char_length(v_key) < 8
     or char_length(v_note) < 4 then
    raise exception using errcode = '22023', message = 'AP_PAYMENT_INPUT_INVALID';
  end if;

  select * into v_invoice
  from public.erp_ap_supplier_invoices
  where id = p_invoice_id and tenant_id = p_tenant_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  if v_invoice.status <> 'payment-requested' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_PENDING_PAYMENT';
  end if;
  if v_invoice.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'accounting-checker', v_invoice.site_id
  ) then
    raise exception using errcode = '42501', message = 'AP_CHECKER_ROLE_REQUIRED';
  end if;
  -- The moment money leaves is the sharpest place this rule matters.
  if v_actor = v_invoice.payment_requested_by_account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  if p_approve then
    if p_paid_amount_vnd is null
       or p_paid_amount_vnd <= 0
       or p_paid_amount_vnd > v_invoice.total_vnd then
      raise exception using errcode = '22023', message = 'AP_PAYMENT_AMOUNT_INVALID';
    end if;
    update public.erp_ap_supplier_invoices set
      status = 'paid',
      owner_role = 'none',
      paid_by_account_id = v_actor,
      paid_at = now(),
      paid_amount_vnd = p_paid_amount_vnd,
      version = version + 1
    where id = v_invoice.id
    returning * into v_invoice;
  else
    update public.erp_ap_supplier_invoices set
      status = 'posted',
      owner_role = 'accountant',
      payment_requested_by_account_id = null,
      payment_requested_at = null,
      payment_method = null,
      payment_reference = null,
      payment_note = v_note,
      version = version + 1
    where id = v_invoice.id
    returning * into v_invoice;
  end if;

  perform public.erp_ap_write_audit(
    v_invoice.id, p_tenant_id, v_invoice.site_id,
    case when p_approve then 'payment.settled' else 'payment.returned' end,
    'payment-requested',
    case when p_approve then 'paid' else 'posted' end,
    v_actor, 'chief-accountant', v_note,
    jsonb_build_object('paid_amount_vnd', p_paid_amount_vnd),
    'settle-supplier-payment', v_key, repeat('0', 64)
  );

  return v_invoice;
end;
$$;

revoke all on function public.erp_ap_request_supplier_payment(
  uuid, uuid, integer, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.erp_ap_settle_supplier_payment(
  uuid, uuid, integer, text, boolean, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.erp_ap_request_supplier_payment(
  uuid, uuid, integer, text, text, text, text, text
) to service_role;
grant execute on function public.erp_ap_settle_supplier_payment(
  uuid, uuid, integer, text, boolean, bigint, text, text
) to service_role;

commit;
