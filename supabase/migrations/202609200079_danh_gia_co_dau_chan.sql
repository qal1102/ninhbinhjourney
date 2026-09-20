-- TC-12 (bản đầu) · 20/09/2026
--
-- Đánh giá có dấu chân: chỉ người đã thật sự qua cổng mới nói được một câu về
-- nơi ấy.
--
-- ## Vì sao dựng kiểu này
--
-- Bản đồ đại chúng không biết ai đã thật sự đến. Mình thì biết: mỗi lượt vào
-- là một hàng `erp_gate_scan_events` với `result = 'accepted'`. Vì thế bằng
-- chứng ở đây KHÔNG phải một ô tích "tôi xin cam đoan", mà là chính lượt quét
-- ấy — `scan_event_id` là khoá ngoại bắt buộc, và duy nhất.
--
-- Hệ quả, cố ý:
--
--   - Không qua cổng thì không có gì để gắn vào, nên không viết được. Phần lớn
--     spam rụng ở đây mà không ai phải xoá tay.
--   - Một lượt vào một lời. Vào Tràng An hai ngày khác nhau thì có hai lượt
--     quét, nên nói được hai lần — đúng thực tế.
--   - Sửa lại lời đã viết thì ghi đè đúng hàng cũ (`updated_at` đổi), không
--     sinh hàng mới.
--
-- ## Cái KHÔNG làm ở bản này
--
-- Chưa có quyền xoá theo hạn mức cho marketing (TC-12 mục 3), chưa có bản đồ
-- toàn tỉnh (mục 2). Cột `hidden_at`/`hidden_by`/`hidden_reason` dựng sẵn để
-- đợt sau nối vào mà không phải đổi bảng, và MỌI lối đọc ở đây đã lọc
-- `hidden_at is null` ngay từ bây giờ.
--
-- Không chạm `customer_sealed_identity_documents`, không ghi gì vào hồ sơ
-- khách, không suy ra tuổi, không cột liên lạc nào.

begin;

-- 1. Kho lời của khách.
create table if not exists public.erp_visit_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  -- Dấu chân. Một lượt vào chỉ mang được một lời.
  scan_event_id uuid not null references public.erp_gate_scan_events(id) on delete restrict,
  member_id uuid references public.erp_visitor_group_members(id) on delete restrict,
  ticket_id uuid references public.erp_tickets(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  -- Lời khách, để trống cũng được: chấm sao thôi cũng là một câu trả lời.
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Kiểm duyệt, dựng sẵn cho đợt sau.
  hidden_at timestamptz,
  hidden_by text,
  hidden_reason text,
  constraint erp_visit_reviews_scan_once unique (tenant_id, scan_event_id),
  constraint erp_visit_reviews_comment_len check (char_length(comment) <= 400),
  constraint erp_visit_reviews_hidden_co_ly_do check (
    (hidden_at is null and hidden_by is null and hidden_reason is null)
    or (hidden_at is not null and hidden_by is not null and char_length(trim(coalesce(hidden_reason, ''))) > 0)
  )
);

create index if not exists erp_visit_reviews_site_idx
  on public.erp_visit_reviews(tenant_id, site_id, created_at desc)
  where hidden_at is null;

-- 2. Khách gửi một lời về nơi mình vừa vào.
--
-- Mã thành viên là thứ khách cầm (TC-06, TC-20). Hàm tự đi tìm lượt quét gần
-- nhất của chính người ấy tại chính cơ sở ấy; không tìm thấy thì từ chối, chứ
-- không tạo ra một "đánh giá không dấu chân".
create or replace function public.erp_submit_visit_review(
  p_tenant_id uuid,
  p_member_code text,
  p_site_id uuid,
  p_rating smallint,
  p_comment text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_member_code, '')));
  v_comment text := trim(coalesce(p_comment, ''));
  v_member_id uuid;
  v_scan record;
  v_row public.erp_visit_reviews;
begin
  if p_tenant_id is null or p_site_id is null or v_code !~ '^TV-[A-Z0-9]{10}$' then
    raise exception using errcode = '22023', message = 'REVIEW_INPUT_INVALID';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;
  if char_length(v_comment) > 400 then
    raise exception using errcode = '22023', message = 'REVIEW_COMMENT_TOO_LONG';
  end if;

  select m.id into v_member_id
  from public.erp_visitor_group_members m
  where m.tenant_id = p_tenant_id and m.member_code = v_code;
  if v_member_id is null then
    raise exception using errcode = 'P0002', message = 'REVIEW_MEMBER_NOT_FOUND';
  end if;

  -- Dấu chân: lượt vào gần nhất của chính người này, tại chính nơi này.
  select event.id, event.ticket_id into v_scan
  from public.erp_gate_scan_events event
  where event.tenant_id = p_tenant_id
    and event.member_id = v_member_id
    and event.site_id = p_site_id
    and event.result = 'accepted'
  order by event.scanned_at desc, event.id desc
  limit 1;
  if v_scan.id is null then
    raise exception using errcode = '42501', message = 'REVIEW_KHONG_CO_DAU_CHAN';
  end if;

  insert into public.erp_visit_reviews (
    tenant_id, site_id, scan_event_id, member_id, ticket_id, rating, comment
  ) values (
    p_tenant_id, p_site_id, v_scan.id, v_member_id, v_scan.ticket_id, p_rating, v_comment
  )
  on conflict (tenant_id, scan_event_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'site_id', v_row.site_id,
    'rating', v_row.rating,
    'comment', v_row.comment,
    'updated_at', v_row.updated_at
  );
end;
$$;

-- 3. Lời của chính người cầm mã, để trang của họ hiện lại cái đã viết.
create or replace function public.erp_visit_reviews_of_member(
  p_tenant_id uuid,
  p_member_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_member_code, '')));
  v_member_id uuid;
  v_rows jsonb;
begin
  if p_tenant_id is null or v_code !~ '^TV-[A-Z0-9]{10}$' then
    raise exception using errcode = '22023', message = 'REVIEW_INPUT_INVALID';
  end if;

  select m.id into v_member_id
  from public.erp_visitor_group_members m
  where m.tenant_id = p_tenant_id and m.member_code = v_code;
  if v_member_id is null then
    raise exception using errcode = 'P0002', message = 'REVIEW_MEMBER_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'site_id', r.site_id,
    'rating', r.rating,
    'comment', r.comment,
    'updated_at', r.updated_at
  ) order by r.updated_at desc), '[]'::jsonb)
  into v_rows
  from public.erp_visit_reviews r
  where r.tenant_id = p_tenant_id
    and r.member_id = v_member_id
    and r.hidden_at is null;

  return v_rows;
end;
$$;

-- 4. Bảng điểm công khai từng nơi.
--
-- Trả số đếm và điểm trung bình, KHÔNG trả tên ai. Lời để công khai thì cắt
-- còn vài câu gần nhất, kèm ngày — đủ để người đọc tin, không đủ để lần ra
-- một người cụ thể.
create or replace function public.erp_site_review_summary(
  p_tenant_id uuid,
  p_site_ids uuid[]
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
  if p_tenant_id is null or p_site_ids is null or array_length(p_site_ids, 1) is null then
    raise exception using errcode = '22023', message = 'REVIEW_INPUT_INVALID';
  end if;
  if array_length(p_site_ids, 1) > 20 then
    raise exception using errcode = '22023', message = 'REVIEW_TOO_MANY_SITES';
  end if;

  select coalesce(jsonb_agg(x order by x.site_id), '[]'::jsonb)
  into v_rows
  from (
    select r.site_id,
           count(*) as so_luot,
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
               'rating', gan_day.rating,
               'comment', gan_day.comment,
               'created_at', gan_day.created_at
             ) order by gan_day.created_at desc), '[]'::jsonb)
             from (
               select r2.rating, r2.comment, r2.created_at
               from public.erp_visit_reviews r2
               where r2.tenant_id = r.tenant_id
                 and r2.site_id = r.site_id
                 and r2.hidden_at is null
                 and char_length(trim(r2.comment)) > 0
               order by r2.created_at desc
               limit 5
             ) gan_day
           ) as loi_gan_day
    from public.erp_visit_reviews r
    where r.tenant_id = p_tenant_id
      and r.site_id = any(p_site_ids)
      and r.hidden_at is null
    group by r.tenant_id, r.site_id
  ) x;

  return v_rows;
end;
$$;

alter table public.erp_visit_reviews enable row level security;

revoke all on table public.erp_visit_reviews from public, anon, authenticated;
grant select, insert, update on table public.erp_visit_reviews to service_role;

revoke all on function public.erp_submit_visit_review(uuid, text, uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.erp_submit_visit_review(uuid, text, uuid, smallint, text) to service_role;

revoke all on function public.erp_visit_reviews_of_member(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_visit_reviews_of_member(uuid, text) to service_role;

revoke all on function public.erp_site_review_summary(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.erp_site_review_summary(uuid, uuid[]) to service_role;

commit;
