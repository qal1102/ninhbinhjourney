-- TC-12 mục 3 (phần nối màn hình) · 20/09/2026
--
-- `erp_site_review_overview` trả thêm **mã của từng lời** trong phần trích.
--
-- Vì sao cần: màn hình điều hành muốn ẩn một lời thì phải gọi tên được nó.
-- Bản `080` chỉ trả sao, chữ và giờ — đủ để đọc, không đủ để hành động.
--
-- Mã lời (`id`) chỉ đi tới màn hình ERP sau đăng nhập, **không** đi ra đường
-- công khai `/api/site-reviews` — hàm ấy là `erp_site_review_summary`, vẫn
-- nguyên như cũ, vẫn không trả mã nào.
--
-- Chỉ đọc: không ghi, không đổi bảng.

begin;

create or replace function public.erp_site_review_overview(
  p_tenant_id uuid,
  p_site_ids uuid[],
  p_from date,
  p_to date
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
     or p_from is null
     or p_to is null
     or p_to < p_from then
    raise exception using errcode = '22023', message = 'REVIEW_INPUT_INVALID';
  end if;
  if array_length(p_site_ids, 1) > 20 then
    raise exception using errcode = '22023', message = 'REVIEW_TOO_MANY_SITES';
  end if;

  select coalesce(jsonb_agg(x order by x.site_id), '[]'::jsonb)
  into v_rows
  from (
    select s.site_id,
           coalesce(dg.so_luot, 0) as so_luot,
           dg.diem_trung_binh,
           coalesce(dg.pho_diem, jsonb_build_object('1', 0, '2', 0, '3', 0, '4', 0, '5', 0)) as pho_diem,
           coalesce(lv.so_luot_vao, 0) as so_luot_vao,
           coalesce(dg.loi_gan_day, '[]'::jsonb) as loi_gan_day
    from unnest(p_site_ids) as s(site_id)
    left join lateral (
      select count(*) as so_luot,
             round(avg(r.rating)::numeric, 2) as diem_trung_binh,
             jsonb_build_object(
               '1', count(*) filter (where r.rating = 1),
               '2', count(*) filter (where r.rating = 2),
               '3', count(*) filter (where r.rating = 3),
               '4', count(*) filter (where r.rating = 4),
               '5', count(*) filter (where r.rating = 5)
             ) as pho_diem,
             (
               select coalesce(jsonb_agg(jsonb_build_object(
                 'id', g.id,
                 'rating', g.rating,
                 'comment', g.comment,
                 'created_at', g.created_at
               ) order by g.created_at desc), '[]'::jsonb)
               from (
                 select r2.id, r2.rating, r2.comment, r2.created_at
                 from public.erp_visit_reviews r2
                 where r2.tenant_id = p_tenant_id
                   and r2.site_id = s.site_id
                   and r2.hidden_at is null
                   and char_length(trim(r2.comment)) > 0
                   and (r2.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
                 order by r2.created_at desc
                 limit 10
               ) g
             ) as loi_gan_day
      from public.erp_visit_reviews r
      where r.tenant_id = p_tenant_id
        and r.site_id = s.site_id
        and r.hidden_at is null
        and (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    ) dg on true
    left join lateral (
      select count(*) as so_luot_vao
      from public.erp_gate_scan_events event
      where event.tenant_id = p_tenant_id
        and event.site_id = s.site_id
        and event.result = 'accepted'
        and (event.scanned_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    ) lv on true
  ) x;

  return v_rows;
end;
$$;

commit;
