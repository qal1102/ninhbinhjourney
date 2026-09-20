-- TC-11 · 20/09/2026
--
-- Mốc đo tốc độ giữ chỗ, để suy ra giờ chạm trần.
--
-- ## Hàm này KHÔNG dự báo
--
-- Nó chỉ trả số thật: trần của ngày ấy, và số chỗ đã giữ cộng dồn theo từng
-- nửa giờ. Phần suy ra giờ kín nằm ở `domain/capacity-forecast.ts`, nơi kiểm
-- được bằng số liệu bịa sẵn. Chia như vậy vì cái dễ sai ở đây là phép suy,
-- không phải phép đếm — mà phép suy nằm trong SQL thì không ai kiểm nổi.
--
-- ## Đếm cái gì
--
-- Chỗ đã giữ = `customer_booking_hold_slots.quantity` của những lượt giữ còn
-- hiệu lực (`active`) hoặc đã thành đơn (`converted`). Lượt hết hạn và lượt
-- huỷ **không** tính: chúng đã trả chỗ về kho, đếm vào là đoán kín sớm hơn
-- thực tế rồi đẩy khách đi nơi khác oan.
--
-- Trần của ngày = tổng `capacity_snapshot` các khung giờ đang mở của ngày ấy
-- tại cơ sở ấy. Đọc ảnh chụp trần lúc mở bán, không đọc ngưỡng hiện hành —
-- ngưỡng có thể đã đổi sau đó, mà chỗ đã bán thì bán theo trần lúc ấy.
--
-- ## Giờ Việt Nam
--
-- Ngày vận hành khép lúc nửa đêm ở Ninh Bình. Mốc `at_minutes` đếm từ 00:00
-- giờ Việt Nam của chính ngày ấy.
--
-- Chỉ đọc: không ghi, không đổi bảng, không thêm chỉ mục.

begin;

create or replace function public.erp_capacity_fill_samples(
  p_tenant_id uuid,
  p_site_ids uuid[],
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_tenant_id is null
     or p_site_ids is null
     or array_length(p_site_ids, 1) is null
     or p_date is null then
    raise exception using errcode = '22023', message = 'FORECAST_INPUT_INVALID';
  end if;
  if array_length(p_site_ids, 1) > 20 then
    raise exception using errcode = '22023', message = 'FORECAST_TOO_MANY_SITES';
  end if;

  select coalesce(jsonb_agg(x order by x.site_id), '[]'::jsonb)
  into v_rows
  from (
    select s.site_id,
           coalesce(tran.suc_chua, 0) as suc_chua,
           coalesce(moc.mau_do, '[]'::jsonb) as mau_do
    from unnest(p_site_ids) as s(site_id)
    left join lateral (
      select sum(slot.capacity_snapshot) as suc_chua
      from public.customer_booking_slots slot
      where slot.tenant_id = p_tenant_id
        and slot.site_id = s.site_id
        and slot.status = 'open'
        and (slot.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
    ) tran on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('at_minutes', m.moc, 'taken', m.cong_don) order by m.moc) as mau_do
      from (
        select nua_gio.moc,
               coalesce(sum(hs.quantity) filter (
                 where extract(epoch from ((hs.created_at at time zone 'Asia/Ho_Chi_Minh') - p_date::timestamp)) / 60 <= nua_gio.moc
               ), 0)::bigint as cong_don
        from generate_series(0, 1410, 30) as nua_gio(moc)
        left join public.customer_booking_slots slot
          on slot.tenant_id = p_tenant_id
         and slot.site_id = s.site_id
         and slot.status = 'open'
         and (slot.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
        left join public.customer_booking_hold_slots hs
          on hs.tenant_id = p_tenant_id
         and hs.slot_id = slot.id
        left join public.customer_booking_holds h
          on h.tenant_id = p_tenant_id
         and h.id = hs.hold_id
         and h.status in ('active', 'converted')
        where h.id is not null
        group by nua_gio.moc
        having coalesce(sum(hs.quantity) filter (
          where extract(epoch from ((hs.created_at at time zone 'Asia/Ho_Chi_Minh') - p_date::timestamp)) / 60 <= nua_gio.moc
        ), 0) > 0
      ) m
    ) moc on true
  ) x;

  return v_rows;
end;
$$;

revoke all on function public.erp_capacity_fill_samples(uuid, uuid[], date) from public, anon, authenticated;
grant execute on function public.erp_capacity_fill_samples(uuid, uuid[], date) to service_role;

commit;
