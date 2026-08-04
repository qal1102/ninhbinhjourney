-- T10b: đóng nốt đầu tiền mặt — nộp quỹ -> ngân hàng -> đối chiếu sao kê.
--
-- Migration 030 đóng nửa công nợ NCC (đã ghi nợ -> đã trả). Nửa còn lại chưa
-- từng có: sau khi một ca chốt xong, `cash_vnd` của nó vẫn nằm ở trạng thái
-- "đã ghi nhận là tiền mặt tại quầy" (tài khoản 1111) vĩnh viễn — không có
-- đường nào chứng minh số tiền đó thật sự đã vào ngân hàng. Đây là "một đầu
-- còn hở" ghi ở docs/HANDOFF.md mục 2.5.
--
-- Chủ dự án đã quyết: làm cả hai nguồn sao kê (`statement_source` =
-- `manual` | `bank-api`), cùng một bộ đối khớp. **Nhập tay làm trước và làm
-- trọn** — migration này chỉ mở đường cho `manual`; cột/constraint đã chừa
-- chỗ cho `bank-api` nhưng không RPC nào ở đây tạo dòng sao kê nguồn đó. Nửa
-- API là việc khác, chỉ tính là chạy được khi có credential ngân hàng thật.
--
-- Luồng, theo đúng "Chuẩn" ở ERP_ACCOUNTING_REQUIREMENTS_VI.md §1:
--   1. Kế toán gộp một hoặc nhiều ca đã `posted` (chưa từng gộp vào lượt nộp
--      nào khác) thành một lượt nộp quỹ — `erp_cash_submit_deposit`.
--   2. Kế toán nhập tay dòng sao kê ngân hàng — `erp_cash_record_statement_line`.
--   3. Kế toán đối khớp lượt nộp với một dòng sao kê — `erp_cash_match_deposit`.
--      Khớp đúng số: dựng luôn bút toán nháp (Nợ 1121 / Có 1111), chuyển
--      `accounting-review`. Lệch số: `exception`, gán người giải trình + hạn
--      xử lý — không tự ý xoá chênh lệch, không tự ý ghi sổ.
--   4. Ngoại lệ do kế toán trưởng hoặc giám đốc quyết — duyệt tiếp (kèm bút
--      toán chênh lệch 1388/3388, đúng tài khoản shift-close đã dùng) hoặc trả
--      lại kế toán sửa — `erp_cash_decide_exception`.
--   5. Kế toán trưởng duyệt bút toán, ghi sổ — `erp_accounting_review_cash_deposit_journal`.
--      Người duyệt phải khác người nộp (maker <> checker), đúng nguyên tắc
--      xuyên suốt hệ thống.
--
-- Đơn giản hoá có chủ đích so với migration 007 (AP): không dùng bảng
-- `command_receipts`/`request_hash` để replay-safe tuyệt đối chính xác từng
-- byte — khoá lạc quan qua `version` đã đủ an toàn cho luồng này (gọi lại
-- với version cũ sẽ tự rớt ở bước kiểm version), đúng kiểu migration 030 (nửa
-- thanh toán NCC) đã dùng cho một luồng tiền tương tự.

begin;

-- 1. Sao kê ngân hàng ----------------------------------------------------

create table if not exists public.erp_bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  source text not null default 'manual' check (source in ('manual', 'bank-api')),
  bank_account_ref text not null check (char_length(bank_account_ref) between 2 and 100),
  statement_date date not null,
  amount_vnd bigint not null check (amount_vnd > 0),
  description text not null default '' check (char_length(description) <= 500),
  external_ref text not null default '' check (char_length(external_ref) <= 200),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched')),
  matched_deposit_id uuid,
  entered_by_account_id text not null,
  entered_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, site_id),
  foreign key (entered_by_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict
);

create index if not exists erp_bank_statement_lines_queue_idx
  on public.erp_bank_statement_lines (tenant_id, site_id, status, statement_date desc);

-- 2. Lượt nộp quỹ ---------------------------------------------------------

create table if not exists public.erp_cash_deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  deposit_code text not null check (char_length(deposit_code) between 5 and 100),
  status text not null default 'submitted' check (
    status in ('submitted', 'matched', 'exception', 'accounting-review', 'posted')
  ),
  amount_vnd bigint not null check (amount_vnd > 0),
  bank_account_ref text not null check (char_length(bank_account_ref) between 2 and 100),
  note text not null default '' check (char_length(note) <= 2000),
  submitted_by_account_id text not null,
  submitted_at timestamptz not null default now(),
  statement_line_id uuid,
  difference_vnd bigint not null default 0,
  matched_by_account_id text,
  matched_at timestamptz,
  exception_owner_account_id text,
  exception_due_at timestamptz,
  exception_note text,
  exception_decided_by_account_id text,
  exception_decided_at timestamptz,
  exception_decision text check (
    exception_decision is null or exception_decision in ('approved', 'returned-to-maker')
  ),
  journal_id uuid,
  reconciled_by_account_id text,
  reconciled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, deposit_code),
  unique (id, tenant_id, site_id),
  foreign key (statement_line_id, tenant_id, site_id)
    references public.erp_bank_statement_lines(id, tenant_id, site_id)
    on delete restrict,
  foreign key (submitted_by_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  check (
    reconciled_by_account_id is null
    or reconciled_by_account_id <> submitted_by_account_id
  ),
  check (
    status <> 'posted'
    or (
      journal_id is not null
      and reconciled_by_account_id is not null
      and reconciled_at is not null
    )
  ),
  check (
    status <> 'exception'
    or (exception_owner_account_id is not null and exception_due_at is not null)
  )
);

alter table public.erp_bank_statement_lines
  add constraint erp_bank_statement_lines_matched_deposit_fk
  foreign key (matched_deposit_id, tenant_id, site_id)
  references public.erp_cash_deposits(id, tenant_id, site_id)
  on delete restrict;

create index if not exists erp_cash_deposits_queue_idx
  on public.erp_cash_deposits (tenant_id, site_id, status, updated_at desc);

-- Mỗi ca chỉ được gộp vào đúng một lượt nộp, một lần duy nhất, vĩnh viễn —
-- không thì tiền mặt của một ca có thể bị đếm hai lần vào hai lượt nộp khác
-- nhau (bẫy #4 dạng "số bịa lọt vào nghiệp vụ thật", ở đây là số thật bị đếm
-- trùng chứ không phải bịa, nhưng hậu quả với sổ sách giống hệt).
create table if not exists public.erp_cash_deposit_shifts (
  deposit_id uuid not null references public.erp_cash_deposits(id) on delete cascade,
  shift_close_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  cash_vnd_snapshot bigint not null check (cash_vnd_snapshot > 0),
  created_at timestamptz not null default now(),
  primary key (deposit_id, shift_close_id),
  unique (shift_close_id),
  foreign key (deposit_id, tenant_id, site_id)
    references public.erp_cash_deposits(id, tenant_id, site_id)
    on delete cascade,
  foreign key (shift_close_id, tenant_id, site_id)
    references public.erp_shift_close_workflows(id, tenant_id, site_id)
    on delete restrict
);

-- 3. Nối vào sổ kế toán dùng chung ----------------------------------------
--
-- `erp_accounting_journals` từng chỉ chấp `source_type = 'shift-close'`,
-- migration 007 nới ra `supplier-invoice`. Nới thêm lần này theo đúng khuôn.

alter table public.erp_accounting_journals
  drop constraint if exists erp_accounting_journals_source_identity_check;
alter table public.erp_accounting_journals
  add column if not exists source_cash_deposit_id uuid;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_cash_deposit_fk
  foreign key (source_cash_deposit_id, tenant_id, site_id)
  references public.erp_cash_deposits(id, tenant_id, site_id)
  on delete restrict;
alter table public.erp_accounting_journals
  drop constraint if exists erp_accounting_journals_source_type_check;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_type_check
  check (source_type in ('shift-close', 'supplier-invoice', 'cash-deposit'));
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_identity_check
  check (
    (
      source_type = 'shift-close'
      and source_workflow_id is not null
      and source_supplier_invoice_id is null
      and source_cash_deposit_id is null
    )
    or
    (
      source_type = 'supplier-invoice'
      and source_workflow_id is null
      and source_supplier_invoice_id is not null
      and source_cash_deposit_id is null
    )
    or
    (
      source_type = 'cash-deposit'
      and source_workflow_id is null
      and source_supplier_invoice_id is null
      and source_cash_deposit_id is not null
    )
  );

create unique index if not exists erp_accounting_one_open_journal_per_deposit_idx
  on public.erp_accounting_journals (tenant_id, source_cash_deposit_id)
  where source_type = 'cash-deposit'
    and reversal_of_journal_id is null
    and status in ('draft', 'pending-checker', 'checker-returned');

alter table public.erp_cash_deposits
  add constraint erp_cash_deposits_journal_fk
  foreign key (journal_id, tenant_id, site_id)
  references public.erp_accounting_journals(id, tenant_id, site_id)
  on delete restrict;

-- Cùng cơ chế chặn ghi trực tiếp mà migration 007 dùng cho supplier-invoice:
-- chỉ RPC của module này (bật cờ phiên) được sửa journal nguồn cash-deposit.
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

-- 4. Nhật ký T15 -----------------------------------------------------------
--
-- `erp_accounting_audit_events.entity_type` từng chỉ chấp
-- ('journal','period','shift-close'). Nới ra 'cash-deposit' để lượt nộp quỹ
-- tự động xuất hiện trong /erp/nhat-ky qua cùng bảng, không cần bảng nhật ký
-- riêng thứ tám (đúng bài học "tám bảng nhật ký rời nhau" ở migration 033).

alter table public.erp_accounting_audit_events
  drop constraint if exists erp_accounting_audit_events_entity_type_check;
alter table public.erp_accounting_audit_events
  add constraint erp_accounting_audit_events_entity_type_check
  check (entity_type in ('journal', 'period', 'shift-close', 'cash-deposit'));


commit;
