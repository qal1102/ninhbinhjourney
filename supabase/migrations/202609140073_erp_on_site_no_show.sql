-- QA-DON-DU-LIEU-10 · 14/09/2026
--
-- Khách chọn trả tại điểm rồi không đến: đóng khoản chờ thu, huỷ vé chưa dùng.
--
-- ## Vì sao cần
--
-- Khách đặt chỗ, chọn trả tiền tại điểm, rồi không tới. Khoản chờ thu ấy nằm
-- mãi trong "đơn còn nợ tiền tại cơ sở" của bảng đối soát cuối ca, và tấm vé
-- vẫn còn hiệu lực trên giấy. Trước đợt này không có lối nào đóng nó: sổ thanh
-- toán, dòng đơn, cầu nối vé đều chỉ ghi thêm — đúng như phải thế với sổ tiền.
-- Bốn đơn thử của chủ dự án trong lượt kiểm 12/09 mắc đúng chỗ này.
--
-- ## Cách làm, không sửa không xoá sổ tiền
--
-- Đóng khoản là **một hàng mới** trong `customer_payment_attempts`, trạng thái
-- `cancelled`, khoá chống trùng là chính id của hàng chờ thu — đúng khuôn của
-- `erp_collect_on_site_payment`. Hàng chờ thu ở lại làm bằng chứng; phép đếm
-- "còn nợ" của đối soát vốn đã loại hàng chờ thu có hàng khoá đi kèm, nên tự
-- đúng mà không phải sửa hàm đếm. Vé chưa dùng chuyển `void`; đơn chuyển
-- `cancelled`. Ghi một sự kiện vào sổ thương mại và hiện trong Nhật ký.
--
-- ## Chặn gì
--
-- Chỉ quản lý của đúng cơ sở, hoặc giám đốc. Bắt buộc ghi lý do. Chỉ khi **ngày
-- trải nghiệm đã qua** (giờ Việt Nam) — trong ngày thì khách còn có thể tới.
-- Vé nào của đơn đã qua cổng dù một lượt thì không phải "không đến": từ chối.
--
-- Chỉ nới ràng buộc và thêm hàm; không đụng hàng dữ liệu nào đang có.

begin;

-- 1. Sổ thanh toán: thêm trạng thái "đã đóng vì khách không đến" -------------------------------

alter table public.customer_payment_attempts
  add column if not exists cancelled_by_account_id text
    references public.erp_account_registry(account_id) on delete restrict;
alter table public.customer_payment_attempts
  add column if not exists cancel_reason text
    check (cancel_reason is null or char_length(cancel_reason) between 10 and 500);

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_status_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_status_check
  check (status in ('succeeded', 'pending', 'cancelled'));

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_mode_shape_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_mode_shape_check
  check (
    (
      mode = 'simulation'
      and provider = 'destinationos-simulation'
      and status = 'succeeded'
      and collected_by_account_id is null
      and collected_at is null
      and cancelled_by_account_id is null
      and cancel_reason is null
    )
    or (
      mode = 'pay-on-site'
      and provider = 'on-site-counter'
      and (
        (status = 'pending' and collected_by_account_id is null and collected_at is null
          and cancelled_by_account_id is null and cancel_reason is null)
        or (status = 'succeeded' and collected_by_account_id is not null and collected_at is not null
          and cancelled_by_account_id is null and cancel_reason is null)
        or (status = 'cancelled' and collected_by_account_id is null and collected_at is null
          and cancelled_by_account_id is not null and cancel_reason is not null)
      )
    )
  );

alter table public.customer_commerce_audit_events
  drop constraint if exists customer_commerce_audit_events_event_type_check;
alter table public.customer_commerce_audit_events
  add constraint customer_commerce_audit_events_event_type_check
  check (
    event_type in (
      'hold-created',
      'payment-simulated',
      'payment-due-on-site',
      'payment-collected-on-site',
      'payment-cancelled-no-show',
      'tickets-issued'
    )
  );

-- 2. Đọc: các đơn còn chờ thu tại một cơ sở -------------------------------------------------------

create or replace function public.erp_on_site_due_orders(
  p_tenant_id uuid,
  p_site_id uuid,
  p_viewer_account_id text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.erp_counter_actor_can_void(p_tenant_id, p_site_id, p_viewer_account_id) then
    raise exception using errcode = '42501', message = 'ON_SITE_NO_SHOW_NOT_ALLOWED';
  end if;

  -- Không trả tên, số điện thoại hay email của khách: quản lý chỉ cần mã đơn,
  -- ngày đi, số khách và số tiền để quyết.
  return coalesce(
    (
      select jsonb_agg(row_data order by row_data ->> 'visit_date', row_data ->> 'order_code')
      from (
        select jsonb_build_object(
          'order_code', customer_order.order_code,
          'visit_date', customer_order.visit_date,
          'party_size', customer_order.party_size,
          'amount_vnd', payment.amount_vnd,
          'entries_used', (
            select coalesce(sum(ticket.entries_used), 0)
            from public.customer_order_tickets bridge
            join public.erp_tickets ticket
              on ticket.id = bridge.ticket_id and ticket.tenant_id = bridge.tenant_id
            where bridge.order_id = customer_order.id and bridge.tenant_id = customer_order.tenant_id
          ),
          'ticket_codes', (
            select coalesce(jsonb_agg(ticket.ticket_code order by ticket.ticket_code), '[]'::jsonb)
            from public.customer_order_tickets bridge
            join public.erp_tickets ticket
              on ticket.id = bridge.ticket_id and ticket.tenant_id = bridge.tenant_id
            where bridge.order_id = customer_order.id and bridge.tenant_id = customer_order.tenant_id
              and bridge.site_id = p_site_id
          )
        ) as row_data
        from public.customer_payment_attempts payment
        join public.customer_orders customer_order
          on customer_order.id = payment.order_id and customer_order.tenant_id = payment.tenant_id
        where payment.tenant_id = p_tenant_id
          and payment.mode = 'pay-on-site'
          and payment.status = 'pending'
          and not exists (
            select 1 from public.customer_payment_attempts settled
            where settled.tenant_id = payment.tenant_id and settled.idempotency_key = payment.id
          )
          and exists (
            select 1 from public.customer_order_tickets bridge
            where bridge.order_id = payment.order_id
              and bridge.tenant_id = payment.tenant_id
              and bridge.site_id = p_site_id
          )
        limit least(greatest(coalesce(p_limit, 50), 1), 200)
      ) listed
    ),
    '[]'::jsonb
  );
end;
$$;

-- 3. Ghi: đóng khoản vì khách không đến ---------------------------------------------------------

create or replace function public.erp_close_on_site_no_show(
  p_tenant_id uuid,
  p_site_id uuid,
  p_order_code text,
  p_actor_account_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_order_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_reason text := trim(coalesce(p_reason, ''));
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_order public.customer_orders;
  v_pending public.customer_payment_attempts;
  v_closed public.customer_payment_attempts;
  v_voided integer;
begin
  if p_tenant_id is null or p_site_id is null
     or v_code !~ '^NBJ-[A-Z0-9]{12}$'
     or char_length(v_actor_id) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'ON_SITE_NO_SHOW_INPUT_INVALID';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'ON_SITE_NO_SHOW_REASON_REQUIRED';
  end if;
  if not public.erp_counter_actor_can_void(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'ON_SITE_NO_SHOW_NOT_ALLOWED';
  end if;

  select * into v_order from public.customer_orders customer_order
  where customer_order.tenant_id = p_tenant_id and customer_order.order_code = v_code
  for update;
  if v_order.id is null or not exists (
    select 1 from public.customer_order_tickets bridge
    where bridge.order_id = v_order.id and bridge.tenant_id = p_tenant_id and bridge.site_id = p_site_id
  ) then
    raise exception using errcode = 'P0002', message = 'ON_SITE_NO_SHOW_ORDER_NOT_FOUND';
  end if;

  select payment.* into v_pending
  from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id
    and payment.order_id = v_order.id
    and payment.mode = 'pay-on-site'
    and payment.status = 'pending'
  limit 1;
  if v_pending.id is null then
    raise exception using errcode = 'P0002', message = 'ON_SITE_NO_SHOW_NOTHING_DUE';
  end if;

  if v_order.visit_date >= v_today then
    raise exception using errcode = '55000', message = 'ON_SITE_NO_SHOW_TOO_EARLY';
  end if;

  if exists (
    select 1 from public.customer_order_tickets bridge
    join public.erp_tickets ticket on ticket.id = bridge.ticket_id and ticket.tenant_id = bridge.tenant_id
    where bridge.order_id = v_order.id and bridge.tenant_id = p_tenant_id and ticket.entries_used > 0
  ) then
    raise exception using errcode = '55000', message = 'ON_SITE_NO_SHOW_ALREADY_ADMITTED';
  end if;

  begin
    insert into public.customer_payment_attempts (
      tenant_id, order_id, hold_id, idempotency_key, provider, provider_event_id,
      mode, status, amount_vnd, currency, occurred_at,
      cancelled_by_account_id, cancel_reason
    ) values (
      p_tenant_id, v_order.id, v_pending.hold_id, v_pending.id, 'on-site-counter',
      'no-show-' || v_pending.id::text, 'pay-on-site', 'cancelled', v_pending.amount_vnd,
      v_pending.currency, now(), v_actor_id, v_reason
    ) returning * into v_closed;
  exception when unique_violation then
    -- Khoản này đã có hàng khoá: đã thu, hoặc đã có người đóng trước.
    select payment.* into v_closed
    from public.customer_payment_attempts payment
    where payment.tenant_id = p_tenant_id and payment.idempotency_key = v_pending.id;
    return jsonb_build_object(
      'closed', false,
      'already_settled', true,
      'settled_status', v_closed.status,
      'order_code', v_order.order_code
    );
  end;

  update public.erp_tickets ticket
  set status = 'void', updated_at = now()
  from public.customer_order_tickets bridge
  where bridge.order_id = v_order.id and bridge.tenant_id = p_tenant_id
    and ticket.id = bridge.ticket_id and ticket.tenant_id = bridge.tenant_id
    and ticket.entries_used = 0 and ticket.status <> 'void';
  get diagnostics v_voided = row_count;

  update public.customer_orders customer_order
  set status = 'cancelled', updated_at = now()
  where customer_order.id = v_order.id and customer_order.tenant_id = p_tenant_id;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, payment_attempt_id, event_type, metadata, occurred_at
  ) values (
    -- Lý do KHÔNG vào metadata: người gõ lý do có thể nhắc tên hay số điện
    -- thoại khách, mà sổ thương mại cấm dữ liệu cá nhân. Lý do nằm ở hàng khoá.
    p_tenant_id, v_order.profile_id, v_order.id, v_closed.hold_id, v_closed.id,
    'payment-cancelled-no-show',
    jsonb_build_object('amount_vnd', v_closed.amount_vnd, 'currency', 'VND', 'voided_tickets', v_voided),
    now()
  );

  return jsonb_build_object(
    'closed', true,
    'already_settled', false,
    'order_code', v_order.order_code,
    'amount_vnd', v_closed.amount_vnd,
    'voided_tickets', v_voided
  );
end;
$$;

-- 4. Nhật ký hệ thống: thêm một nhánh cho việc đóng khoản ------------------------------------------
--
-- Chữ ký giữ nguyên. Thân hàm chép nguyên văn bản `202609140072` và chỉ thêm nhánh.

create or replace function public.erp_audit_timeline(
  p_tenant_id uuid,
  p_viewer_account_id text,
  p_search text default null,
  p_site_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200,
  -- Lọc về đúng một người, cho trang hồ sơ. Đây là bộ lọc **thu hẹp** chồng
  -- lên phạm vi đã tính; không có đường nào nó nới rộng ra được.
  p_actor_account_id text default null
)
returns table (
  source text,
  occurred_at timestamptz,
  site_id uuid,
  actor_account_id text,
  actor_display_name text,
  actor_job_title text,
  actor_site_scope text,
  actor_snapshot_at_write boolean,
  action text,
  entity_type text,
  entity_id text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sees_everything boolean;
  v_site_ids uuid[];
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  select scope.sees_everything, scope.site_ids
    into v_sees_everything, v_site_ids
  from public.erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id) as scope;

  v_sees_everything := coalesce(v_sees_everything, false);
  v_site_ids := coalesce(v_site_ids, array[]::uuid[]);

  return query
  with unified as (
    select 'Tài khoản & phân quyền'::text as source, event.created_at as occurred_at,
           null::uuid as site_id, event.actor_account_id, event.actor_display_name,
           event.actor_job_title, event.actor_site_scope, event.actor_snapshot_at_write,
           event.action, 'account'::text as entity_type, event.target_account_id as entity_id,
           null::text as note
    from public.erp_account_admin_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Sổ kế toán', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, event.entity_type,
           event.entity_id::text, event.note
    from public.erp_accounting_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Hóa đơn nhà cung cấp', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'ap-invoice', event.invoice_id::text,
           event.note
    from public.erp_ap_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phân quyền nhân sự', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'employee-access',
           event.employee_account_id, null
    from public.erp_employee_access_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Dự án & sự kiện', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'project-work-item',
           coalesce(event.work_item_id::text, event.event_id::text), event.note
    from public.erp_project_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Chốt ca', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'shift-close',
           event.workflow_id::text, event.note
    from public.erp_shift_close_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phiếu việc', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'workday',
           event.workday_id::text, event.note
    from public.erp_workday_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Xem theo vai trò', event.created_at, null::uuid, event.director_account_id,
           event.director_name, event.director_job_title, null::text,
           event.actor_snapshot_at_write, 'role-switch.' || event.action, 'account',
           event.target_account_id, event.target_name
    from public.erp_role_switch_audit event
    where event.tenant_id = p_tenant_id
    union all
    -- QA-ERP-POS-04: bán và huỷ vé tại quầy. Mã phiếu thu làm mã bản ghi,
    -- vì đó là thứ người ta đọc trên tờ giấy in cho khách.
    select 'Bán vé tại quầy', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'counter-sale',
           sale.sale_code, event.note
    from public.erp_counter_sale_events event
    join public.erp_counter_sales sale
      on sale.id = event.sale_id and sale.tenant_id = event.tenant_id
    where event.tenant_id = p_tenant_id
    union all
    -- QA-ERP-POS-05: mỗi lần giám đốc đặt giá quầy. Hàng giá gieo sẵn của
    -- hệ thống không tính là thao tác của ai nên không hiện.
    select 'Bảng giá quầy', price.created_at, price.site_id, price.created_by_account_id,
           coalesce(price.created_by_name, price.created_by_account_id), null::text, null::text,
           price.created_by_name is not null, 'counter-price.set', 'counter-price',
           price.product,
           left(
             case price.product when 'adult' then 'Người lớn' else 'Trẻ dưới 1m3' end
             || ': ' || price.unit_price_vnd || ' đ, áp dụng từ '
             || to_char(price.effective_from, 'DD/MM/YYYY') || '.'
             || case when price.note <> '' then ' ' || price.note else '' end,
             600
           )
    from public.erp_counter_price_list price
    where price.tenant_id = p_tenant_id and price.created_by_account_id <> 'system'
    union all
    -- ERP-DE-XUAT-01: đề xuất & phê duyệt. Mã đề xuất làm mã bản ghi, vì đó là
    -- mã người gửi và người duyệt cùng đọc trên màn hình.
    select 'Đề xuất', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'staff-request',
           request.request_code, event.note
    from public.erp_staff_request_events event
    join public.erp_staff_requests request
      on request.id = event.request_id and request.tenant_id = event.tenant_id
    where event.tenant_id = p_tenant_id
    union all
    -- QA-DON-DU-LIEU-10: đóng khoản trả tại điểm vì khách không đến. Mã đơn làm
    -- mã bản ghi, cơ sở lấy từ vé của đơn.
    select 'Thu tại điểm', payment.created_at, bridge_site.site_id, payment.cancelled_by_account_id,
           coalesce(registry.display_name, payment.cancelled_by_account_id), registry.job_title, null::text,
           false, 'on-site-payment.no-show', 'customer-order',
           customer_order.order_code,
           left(
             'Đóng khoản trả tại điểm ' || payment.amount_vnd || ' đ vì khách không đến. Lý do: '
               || coalesce(payment.cancel_reason, ''),
             600
           )
    from public.customer_payment_attempts payment
    join public.customer_orders customer_order
      on customer_order.id = payment.order_id and customer_order.tenant_id = payment.tenant_id
    left join public.erp_account_registry registry
      on registry.tenant_id = payment.tenant_id and registry.account_id = payment.cancelled_by_account_id
    left join lateral (
      select bridge.site_id
      from public.customer_order_tickets bridge
      where bridge.order_id = payment.order_id and bridge.tenant_id = payment.tenant_id
      limit 1
    ) bridge_site on true
    where payment.tenant_id = p_tenant_id and payment.status = 'cancelled'
  )
  select unified.*
  from unified
  where
    -- Phạm vi. Quản lý thấy việc **tác động lên cơ sở mình** cộng việc **người
    -- của cơ sở mình** làm ở bất kỳ đâu; vế sau là lý do có mệnh đề exists.
    (
      v_sees_everything
      or unified.actor_account_id = p_viewer_account_id
      or (
        cardinality(v_site_ids) > 0
        and (
          unified.site_id = any (v_site_ids)
          or exists (
            select 1
            from public.erp_account_role_assignments assignment
            where assignment.tenant_id = p_tenant_id
              and assignment.account_id = unified.actor_account_id
              and assignment.status = 'active'
              and assignment.site_id = any (v_site_ids)
              and assignment.effective_from <= now()
              and (
                assignment.effective_until is null
                or assignment.effective_until > now()
              )
          )
        )
      )
    )
    and (p_actor_account_id is null or unified.actor_account_id = p_actor_account_id)
    and (p_site_id is null or unified.site_id = p_site_id)
    and (p_from is null or unified.occurred_at >= p_from)
    and (p_to is null or unified.occurred_at <= p_to)
    -- Tìm theo **tên trong nhật ký** (tên lúc thao tác) hoặc tên hiện tại
    -- trong sổ: đổi tên rồi vẫn tìm ra việc làm dưới tên cũ, và ngược lại.
    and (
      v_search is null
      or unified.actor_display_name ilike '%' || v_search || '%'
      or unified.actor_account_id ilike '%' || v_search || '%'
      or exists (
        select 1
        from public.erp_account_registry registry
        where registry.tenant_id = p_tenant_id
          and registry.account_id = unified.actor_account_id
          and registry.display_name ilike '%' || v_search || '%'
      )
    )
  order by unified.occurred_at desc
  limit v_limit;
end;
$$;

-- 5. Khoá cửa -------------------------------------------------------------------------------------

revoke all on function public.erp_on_site_due_orders(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.erp_on_site_due_orders(uuid, uuid, text, integer) to service_role;
revoke all on function public.erp_close_on_site_no_show(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_close_on_site_no_show(uuid, uuid, text, text, text) to service_role;

commit;
