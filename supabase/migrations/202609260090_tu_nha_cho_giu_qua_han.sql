-- Tự nhả chỗ giữ quá 15 phút, mỗi phút một lần.
--
-- Trước đây lượt giữ chỉ bị đánh dấu hết hạn khi chính khách ấy bấm lại. Sức
-- chứa vẫn tính đúng (chỉ đếm lượt giữ còn hạn), nhưng đơn thì nằm mãi ở
-- "Đang giữ chỗ": ngày 26/09/2026 màn Khách hàng còn sáu đơn từ 15/09 ghi
-- đang giữ, trong đó một đơn 45 khách, 35.550.000 đ.
--
-- Hàm xác nhận đơn đã từ chối lượt giữ có `status <> 'active'` bằng đúng mã
-- CUSTOMER_BOOKING_HOLD_EXPIRED như với lượt giữ quá giờ, nên khách bấm trả
-- tiền muộn vẫn nhận cùng một câu báo. Luật "ba lượt giữ bỏ dở thì tới quầy"
-- (089) đếm lượt chưa thành đơn, không đọc trạng thái, nên không đổi.

begin;

create or replace function public.customer_booking_expire_lapsed_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer;
begin
  with qua_han as (
    update public.customer_booking_holds hold
    set status = 'expired'
    where hold.status = 'active'
      and hold.expires_at <= now()
    returning hold.order_id, hold.tenant_id
  )
  update public.customer_orders customer_order
  set status = 'expired', updated_at = now()
  from qua_han
  where customer_order.id = qua_han.order_id
    and customer_order.tenant_id = qua_han.tenant_id
    and customer_order.status = 'holding';
  get diagnostics v_so = row_count;
  return v_so;
end;
$ham$;

revoke all on function public.customer_booking_expire_lapsed_holds() from public, anon, authenticated, service_role;
grant execute on function public.customer_booking_expire_lapsed_holds() to service_role;

-- Dọn luôn phần tồn từ trước tới giờ.
select public.customer_booking_expire_lapsed_holds();

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'customer-booking-expire-lapsed-holds' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'customer-booking-expire-lapsed-holds',
  '* * * * *',
  $cron$select public.customer_booking_expire_lapsed_holds();$cron$
);

commit;
