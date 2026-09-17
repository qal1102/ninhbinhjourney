-- A15-ERP-04 · 17/09/2026
--
-- Bảng vé ở trang chủ giám đốc: đếm lượt khách, giữ số tấm vé làm số phụ.
--
-- ## Chỗ hỏng
--
-- Bảng này đếm bằng `count: "exact", head: true`. Kho chỉ trả về số hàng
-- `erp_tickets`, tức số tấm vé, nên một vé đoàn 42 người (`entries_allowed =
-- 42`) vẫn tính là 1. Lệnh đếm ấy không cộng được cột nào; màn hình đành ghi
-- "tấm vé" rồi bảo người đọc sang màn hình Vé từng cơ sở mà xem lượt khách.
-- Giám đốc cần con số lượt khách ngay ở trang đầu.
--
-- ## Phép đếm: y như màn hình Vé từng cơ sở (migration `202609140074`)
--
-- - Lượt khách của một tấm vé là `greatest(coalesce(entries_allowed, 1), 1)`.
-- - Vé đã huỷ không cho ai qua cổng: không tính lượt, cũng không tính tấm.
-- - Số tấm vé vẫn trả về, vì quầy đối soát giấy in theo tấm.
-- - Con số chính chỉ đếm `data_origin = 'real'`, đúng như bảng cũ. Vé gieo
--   mẫu đếm riêng để màn hình nói thẳng có bao nhiêu tấm mẫu bị loại ra.
--   Cột này có từ migration `202609060060`; thiếu cột thì hàm không tạo được,
--   và trang chủ tự lùi về lệnh đếm cũ.
--
-- ## Vì sao khung giờ do máy chủ ứng dụng truyền vào
--
-- "Hôm nay" là ngày theo lịch Việt Nam; "7 ngày", "30 ngày" là cửa sổ trượt,
-- kèm kỳ liền trước để so. Phép tính ấy đã nằm ở `domain/ticket-window.ts` và
-- có bài kiểm. Viết lại bằng SQL là thành hai nơi cùng tính một mốc, lệch nhau
-- quanh nửa đêm thì con số vẫn hiện ra bình thường, chỉ là sai. Nên hàm nhận
-- sẵn danh sách khung `[{"key", "from", "to"}]` và đếm theo khoảng nửa mở
-- `[from, to)`, đúng như lệnh đếm cũ. Tiền đơn web đọc cùng mốc 30 ngày ấy.
--
-- Mỗi khung trả về tổng, từng cơ sở và từng kênh bán; màn hình lấy phần mình
-- cần. Chỉ tạo một hàm đọc; không đụng bảng hay dữ liệu nào.

begin;

create or replace function public.erp_director_ticket_overview(
  p_tenant_id uuid,
  p_site_ids uuid[],
  p_windows jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cua_so as (
    select
      khung.value ->> 'key' as khoa,
      (khung.value ->> 'from')::timestamptz as tu,
      (khung.value ->> 'to')::timestamptz as den,
      khung.thu_tu
    from jsonb_array_elements(p_windows) with ordinality as khung(value, thu_tu)
  ),
  ve as (
    select
      cua_so.thu_tu,
      cua_so.khoa,
      ticket.site_id,
      ticket.channel,
      ticket.data_origin,
      greatest(coalesce(ticket.entries_allowed, 1), 1) as entries
    from cua_so
    join public.erp_tickets ticket
      on ticket.issued_at >= cua_so.tu
     and ticket.issued_at < cua_so.den
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = any(p_site_ids)
      -- Vé đã huỷ không cho ai vào: không đếm vào lượt khách hay số tấm vé.
      and ticket.status <> 'void'
  )
  select jsonb_build_object(
    'windows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', cua_so.khoa,
          'ticket_count', dem.ticket_count,
          'entry_count', dem.entry_count,
          'demo_seed_ticket_count', dem.demo_seed_ticket_count
        )
        order by cua_so.thu_tu
      )
      from cua_so
      cross join lateral (
        select
          count(*) filter (where ve.data_origin = 'real') as ticket_count,
          coalesce(sum(ve.entries) filter (where ve.data_origin = 'real'), 0) as entry_count,
          count(*) filter (where ve.data_origin = 'demo-seed') as demo_seed_ticket_count
        from ve
        where ve.thu_tu = cua_so.thu_tu
      ) dem
    ), '[]'::jsonb),
    'by_site', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', theo.khoa,
          'site_id', theo.site_id,
          'ticket_count', theo.ticket_count,
          'entry_count', theo.entry_count
        )
        order by theo.thu_tu, theo.site_id
      )
      from (
        select ve.thu_tu, ve.khoa, ve.site_id, count(*) as ticket_count, sum(ve.entries) as entry_count
        from ve
        where ve.data_origin = 'real'
        group by ve.thu_tu, ve.khoa, ve.site_id
      ) theo
    ), '[]'::jsonb),
    'by_channel', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', theo.khoa,
          'channel', theo.channel,
          'ticket_count', theo.ticket_count,
          'entry_count', theo.entry_count
        )
        order by theo.thu_tu, theo.channel
      )
      from (
        select ve.thu_tu, ve.khoa, ve.channel, count(*) as ticket_count, sum(ve.entries) as entry_count
        from ve
        where ve.data_origin = 'real'
        group by ve.thu_tu, ve.khoa, ve.channel
      ) theo
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.erp_director_ticket_overview(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.erp_director_ticket_overview(uuid, uuid[], jsonb) to service_role;

commit;
