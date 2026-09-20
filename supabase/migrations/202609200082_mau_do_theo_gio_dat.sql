-- TC-11 (sửa trục đo) · 20/09/2026
--
-- Thay `erp_capacity_fill_samples` của `081`: đo theo **giờ khách đặt**, không
-- theo giờ trong ngày đi.
--
-- ## Vì sao phải sửa ngay trong cùng một ngày
--
-- Bản `081` cộng dồn chỗ đã giữ theo từng nửa giờ **của chính ngày đi**. Đo
-- thử trên dữ liệu thật thì thấy ngay: tới mốc 00:00 của ngày đi đã có 4 chỗ
-- được giữ — vì khách đặt trước từ mấy hôm trước, không ai ngồi đợi tới sáng
-- hôm ấy mới đặt. Trên trục cũ, một ngày bán hết sạch từ tuần trước trông
-- giống hệt một ngày chưa ai mua: cả hai đều "không nhúc nhích trong ngày".
--
-- Câu hỏi thật của người vận hành là *"ngày mai còn chỗ không, tới lúc nào thì
-- hết"*, nên trục đúng là **giờ đặt chỗ**, còn cái đích là **ngày đi**.
--
-- ## Trả gì
--
-- Với mỗi cơ sở, cho một ngày đi:
--   - `suc_chua`: tổng trần các khung giờ đang mở của ngày ấy;
--   - `mau_do`: chỗ đã giữ cộng dồn theo từng giờ, trong 72 giờ gần nhất, mốc
--     tính bằng phút kể từ đầu cửa sổ;
--   - `da_giu`: tổng chỗ đã giữ cho ngày ấy tính tới bây giờ (gồm cả lượt đặt
--     trước cửa sổ, nên `mau_do` bắt đầu từ đúng con số ấy chứ không từ 0);
--   - `bay_gio_phut`: mốc hiện tại trên cùng trục.
--
-- Vẫn chỉ đếm lượt `active` và `converted`: lượt hết hạn hay huỷ đã trả chỗ về
-- kho, đếm vào là đoán kín sớm hơn thật rồi đẩy khách đi nơi khác oan.
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
  v_cua_so_gio constant int := 72;
  v_dau_cua_so timestamptz := date_trunc('hour', now()) - make_interval(hours => v_cua_so_gio);
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
           coalesce(tong.da_giu, 0) as da_giu,
           (extract(epoch from (now() - v_dau_cua_so)) / 60)::bigint as bay_gio_phut,
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
      select sum(hs.quantity) as da_giu
      from public.customer_booking_hold_slots hs
      join public.customer_booking_slots slot
        on slot.id = hs.slot_id and slot.tenant_id = p_tenant_id
      join public.customer_booking_holds h
        on h.id = hs.hold_id and h.tenant_id = p_tenant_id
      where hs.tenant_id = p_tenant_id
        and slot.site_id = s.site_id
        and slot.status = 'open'
        and (slot.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
        and h.status in ('active', 'converted')
    ) tong on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('at_minutes', g.moc, 'taken', g.cong_don) order by g.moc) as mau_do
      from (
        select (extract(epoch from (gio.moc - v_dau_cua_so)) / 60)::bigint as moc,
               coalesce((
                 select sum(hs.quantity)
                 from public.customer_booking_hold_slots hs
                 join public.customer_booking_slots slot
                   on slot.id = hs.slot_id and slot.tenant_id = p_tenant_id
                 join public.customer_booking_holds h
                   on h.id = hs.hold_id and h.tenant_id = p_tenant_id
                 where hs.tenant_id = p_tenant_id
                   and slot.site_id = s.site_id
                   and slot.status = 'open'
                   and (slot.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
                   and h.status in ('active', 'converted')
                   and hs.created_at <= gio.moc
               ), 0)::bigint as cong_don
        from generate_series(v_dau_cua_so, date_trunc('hour', now()), interval '1 hour') as gio(moc)
      ) g
    ) moc on true
  ) x;

  return v_rows;
end;
$$;

commit;
