-- Route AP exceptions to the role that can actually resolve the next step.
--
-- Missing or invalid source evidence remains with the regional manager.
-- A monetary-only variance at or above the configured materiality threshold
-- moves to the accountant for verification before it may reach the director.

begin;

create or replace function public.erp_route_ap_exception_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_director_threshold_vnd bigint;
  v_variance_vnd bigint;
  v_monetary_only boolean;
begin
  if tg_op = 'UPDATE'
     and old.status = 'match-exception'
     and new.status = 'director-exception'
     and old.owner_role <> 'accountant' then
    raise exception using
      errcode = '22023',
      message = 'AP_EXCEPTION_REQUIRES_ACCOUNTANT_VERIFICATION';
  end if;

  if new.status <> 'match-exception' then
    return new;
  end if;

  -- A director return must go back to source ownership. A later manager
  -- resubmission will be routed again from the corrected source values.
  if tg_op = 'UPDATE'
     and old.status = 'director-exception'
     and new.status = 'match-exception' then
    new.owner_role := 'manager';
    return new;
  end if;

  select rule.director_exception_threshold_vnd
  into v_director_threshold_vnd
  from public.erp_ap_posting_rules rule
  where rule.id = new.posting_rule_id
    and rule.tenant_id = new.tenant_id;

  if v_director_threshold_vnd is null then
    raise exception using
      errcode = 'P0002',
      message = 'AP_POSTING_RULE_NOT_FOUND';
  end if;

  v_monetary_only :=
    cardinality(new.exception_codes) > 0
    and new.exception_codes <@ array[
      'invoice-over-purchase-order',
      'invoice-over-acceptance'
    ]::text[];
  v_variance_vnd := greatest(
    new.total_vnd - new.purchase_order_total_vnd,
    new.total_vnd - new.accepted_total_vnd,
    0
  );

  new.owner_role := case
    when v_monetary_only
      and v_variance_vnd >= v_director_threshold_vnd
      then 'accountant'
    else 'manager'
  end;
  return new;
end;
$$;

drop trigger if exists erp_ap_route_exception_owner
  on public.erp_ap_supplier_invoices;
create trigger erp_ap_route_exception_owner
before insert or update on public.erp_ap_supplier_invoices
for each row execute function public.erp_route_ap_exception_owner();

-- Backfill any monetary-only exception created between migrations 007 and 008.
update public.erp_ap_supplier_invoices invoice
set owner_role = 'accountant',
    version = invoice.version + 1
from public.erp_ap_posting_rules rule
where invoice.posting_rule_id = rule.id
  and invoice.tenant_id = rule.tenant_id
  and invoice.status = 'match-exception'
  and invoice.owner_role = 'manager'
  and cardinality(invoice.exception_codes) > 0
  and invoice.exception_codes <@ array[
    'invoice-over-purchase-order',
    'invoice-over-acceptance'
  ]::text[]
  and greatest(
    invoice.total_vnd - invoice.purchase_order_total_vnd,
    invoice.total_vnd - invoice.accepted_total_vnd,
    0
  ) >= rule.director_exception_threshold_vnd;

revoke all on function public.erp_route_ap_exception_owner()
  from public, anon, authenticated, service_role;

commit;
