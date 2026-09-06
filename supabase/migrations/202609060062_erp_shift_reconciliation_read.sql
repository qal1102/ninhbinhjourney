-- TC-21 · 06/09/2026
--
-- Đối soát cuối ca: cộng khoản thu tại điểm của một ca, ngay trong SQL.
--
-- **Nguồn việc.** TC-22 mở lối "trả tiền tại điểm": khách đặt chỗ trước, tới
-- cổng thì nhân viên quét mã rồi thu tiền mặt. Khoản tiền ấy vào
-- `customer_payment_attempts`. Con số cuối ca nhân viên tự khai thì nằm ở
-- `erp_shift_close_workflows`. Đo ngày 06/09/2026: giữa hai bên **không có một
-- dòng nào nối với nhau** — `lib/erp/shift-close-repository.ts`,
-- `lib/erp/cash-deposit-repository.ts` và màn hình đối soát tiền mặt đều không
-- nhắc tới khoản thu tại điểm. Tiền nhân viên cầm ở cổng vì thế không nằm
-- trong bất kỳ con số chốt ca nào. Đây là chỗ vá.
--
-- **Migration này KHÔNG đổi một bảng nào.** Không thêm cột, không thêm ràng
-- buộc, không đụng một hàng dữ liệu nào. Nó chỉ thêm đúng một hàm **chỉ đọc**
-- (`stable`, thân là một câu `select`, không có `insert`/`update`/`delete`
-- nào). Đối soát là việc đọc và cộng; thêm một đường ghi vào đây là mở ra một
-- nguồn sự thật thứ hai cho cùng một khoản tiền.
--
-- **Vì sao cộng trong SQL chứ không kéo hàng về đếm bằng JavaScript.** Dự án
-- đã trả giá cho bài học này ở `lib/erp/ticket-overview-repository.ts`: kéo
-- hàng về rồi đếm thì tới ngày đông khách sẽ chạm trần `limit` và **âm thầm
-- báo thiếu** — một màn hình sai trông y hệt một màn hình đúng. Ở đây thì
-- `sum()` và `count()` chạy trong cơ sở dữ liệu, không có trần nào.
--
-- **Vì sao phải hỏi qua `customer_order_tickets` mới biết cơ sở.** Sổ thanh
-- toán cố ý **không** mang `site_id`: TC-22 từng nhét cột ấy vào metadata và
-- bị `customer_json_contains_pii` chặn, vì UUID cơ sở trông vừa đủ giống một
-- số điện thoại Việt Nam (chuyện này về sau thành `WEB-PLAN-04`). Đường tra
-- ngược đúng là cầu nối vé: một đơn có vé ở cơ sở nào thì thuộc cơ sở ấy.
--
-- **Khoản còn nợ đếm theo hàng chờ thu CHƯA có hàng thu tương ứng.** Sổ thanh
-- toán chỉ ghi thêm (`customer_append_only`), nên lúc thu tiền TC-22 chèn một
-- hàng mới chứ không sửa hàng cũ; hàng `pending` ở lại vĩnh viễn làm bằng
-- chứng. Đếm thẳng `status = 'pending'` là đếm cả những khoản đã thu xong từ
-- lâu. Khoá nối hai hàng là `idempotency_key` của hàng thu, đúng bằng `id` của
-- hàng chờ — cùng một khoá TC-22 dùng để chặn thu hai lần.

begin;

create or replace function public.erp_shift_on_site_cash(
  p_tenant_id uuid,
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with collected as (
    select
      payment.amount_vnd,
      payment.collected_by_account_id
    from public.customer_payment_attempts payment
    where payment.tenant_id = p_tenant_id
      and payment.mode = 'pay-on-site'
      and payment.status = 'succeeded'
      and payment.collected_at >= p_from
      and payment.collected_at < p_to
      and exists (
        select 1
        from public.customer_order_tickets bridge
        where bridge.order_id = payment.order_id
          and bridge.tenant_id = payment.tenant_id
          and bridge.site_id = p_site_id
      )
  ),
  per_collector as (
    select
      collected.collected_by_account_id as account_id,
      coalesce(registry.display_name, collected.collected_by_account_id) as display_name,
      count(*) as collection_count,
      sum(collected.amount_vnd) as collected_vnd
    from collected
    left join public.erp_account_registry registry
      on registry.account_id = collected.collected_by_account_id
     and registry.tenant_id = p_tenant_id
    group by 1, 2
  ),
  outstanding as (
    select payment.amount_vnd
    from public.customer_payment_attempts payment
    where payment.tenant_id = p_tenant_id
      and payment.mode = 'pay-on-site'
      and payment.status = 'pending'
      and not exists (
        select 1
        from public.customer_payment_attempts settled
        where settled.tenant_id = payment.tenant_id
          and settled.idempotency_key = payment.id
      )
      and exists (
        select 1
        from public.customer_order_tickets bridge
        where bridge.order_id = payment.order_id
          and bridge.tenant_id = payment.tenant_id
          and bridge.site_id = p_site_id
      )
  )
  select jsonb_build_object(
    'collection_count', (select count(*) from collected),
    'collected_vnd', (select coalesce(sum(amount_vnd), 0) from collected),
    'collectors',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'account_id', per_collector.account_id,
              'display_name', per_collector.display_name,
              'count', per_collector.collection_count,
              'total_vnd', per_collector.collected_vnd
            )
            order by per_collector.collected_vnd desc, per_collector.account_id
          )
          from per_collector
        ),
        '[]'::jsonb
      ),
    'outstanding_count', (select count(*) from outstanding),
    'outstanding_vnd', (select coalesce(sum(amount_vnd), 0) from outstanding)
  );
$$;

comment on function public.erp_shift_on_site_cash(uuid, uuid, timestamptz, timestamptz) is
  'TC-21: cong khoan thu tai diem cua mot ca tai mot co so. Chi doc, khong ghi.';

revoke all on function public.erp_shift_on_site_cash(
  uuid, uuid, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.erp_shift_on_site_cash(
  uuid, uuid, timestamptz, timestamptz
) to service_role;

commit;
