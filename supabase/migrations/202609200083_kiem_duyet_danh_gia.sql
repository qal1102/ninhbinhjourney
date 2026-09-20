-- TC-12 mục 3–4 · 20/09/2026
--
-- Ẩn một lời khách: có hạn mức, có nhật ký, và có một giới hạn cứng.
--
-- ## Ba luật, và vì sao từng luật nằm ở đây chứ không chỉ ở màn hình
--
-- 1. **Hạn mức theo vai.** Giám đốc dọn cả đợt spam nên không hạn mức; quản lý
--    (chăm sóc khách hàng / marketing) được 20 lời mỗi 30 ngày; ba vai còn lại
--    không đụng tới. Khác nhau ở động cơ chứ không ở lòng tin: người dọn spam
--    không được lợi gì khi xoá một lời chê thật, người làm marketing thì có.
--
-- 2. **Không được ẩn tới mức toàn 5 sao.** Một bảng điểm toàn năm sao trông
--    giả, và khách nhận ra rất nhanh. Lời không phải 5 sao chỉ ẩn được khi sau
--    đó nơi ấy vẫn còn ít nhất một lời không phải 5 sao. Nơi có dưới 3 lời thì
--    miễn luật, không thì một lời spam thật sẽ nằm lại vĩnh viễn.
--
-- 3. **Mỗi lượt ẩn ghi lại ai ẩn và vì sao**, kể cả lượt hiện lại. Nhật ký là
--    thứ duy nhất biến "tôi xoá vì nó là spam" thành một câu kiểm chứng được.
--
-- Cả ba nằm trong hàm `security definer` này, nên không lách được bằng cách gọi
-- thẳng RPC. Tầng TypeScript (`domain/visit-review-moderation.ts`) lặp lại luật
-- chỉ để màn hình nói trước, không phải để thay thế.
--
-- ## CẤM, ghi lại cho rõ
--
-- Không có lối nào **xoá hẳn** một lời. Ẩn là đặt `hidden_at`; lời vẫn nằm đó,
-- vẫn đếm được, vẫn truy lại được. Chủ sạp tự xoá đánh giá xấu của chính mình
-- là thứ TC-12 cấm thẳng, nên hệ thống không dựng sẵn công cụ ấy cho ai cả.

begin;

create table if not exists public.erp_visit_review_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  review_id uuid not null references public.erp_visit_reviews(id) on delete restrict,
  actor_account_id text not null,
  actor_role text not null,
  action text not null check (action in ('hide', 'unhide')),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint erp_visit_review_moderation_reason_len check (char_length(trim(reason)) between 5 and 400)
);

create index if not exists erp_visit_review_moderation_actor_idx
  on public.erp_visit_review_moderation_audit(tenant_id, actor_account_id, created_at desc);

-- Hạn mức 30 ngày của một người, đọc thẳng từ nhật ký.
create or replace function public.erp_visit_review_hide_quota_used(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.erp_visit_review_moderation_audit a
  where a.tenant_id = p_tenant_id
    and a.actor_account_id = p_actor_account_id
    and a.action = 'hide'
    and a.created_at > now() - interval '30 days';
$$;

create or replace function public.erp_hide_visit_review(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_actor_role text,
  p_review_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_han_muc int;
  v_da_dung int;
  v_review public.erp_visit_reviews;
  v_con_lai_khac_nam_sao int;
  v_dang_hien int;
begin
  if p_tenant_id is null or p_review_id is null or coalesce(trim(p_actor_account_id), '') = '' then
    raise exception using errcode = '22023', message = 'REVIEW_MODERATION_INPUT_INVALID';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 400 then
    raise exception using errcode = '22023', message = 'REVIEW_MODERATION_REASON_REQUIRED';
  end if;

  -- Luật 1: hạn mức theo vai. Giữ đúng một bản đếm ở đây, khớp với
  -- `MODERATION_QUOTA_30_DAYS` bên TypeScript.
  v_han_muc := case p_actor_role
    when 'director' then null
    when 'manager' then 20
    else 0
  end;
  if p_actor_role <> 'director' and coalesce(v_han_muc, 0) = 0 then
    raise exception using errcode = '42501', message = 'REVIEW_MODERATION_ROLE_REQUIRED';
  end if;
  if v_han_muc is not null then
    v_da_dung := public.erp_visit_review_hide_quota_used(p_tenant_id, p_actor_account_id);
    if v_da_dung >= v_han_muc then
      raise exception using errcode = '42501', message = 'REVIEW_MODERATION_QUOTA_EXHAUSTED';
    end if;
  end if;

  select * into v_review
  from public.erp_visit_reviews r
  where r.tenant_id = p_tenant_id and r.id = p_review_id;
  if v_review.id is null then
    raise exception using errcode = 'P0002', message = 'REVIEW_MODERATION_NOT_FOUND';
  end if;
  if v_review.hidden_at is not null then
    raise exception using errcode = '22023', message = 'REVIEW_MODERATION_ALREADY_HIDDEN';
  end if;

  -- Luật 2: không được ẩn tới mức toàn 5 sao.
  if v_review.rating <> 5 then
    select count(*) into v_dang_hien
    from public.erp_visit_reviews r
    where r.tenant_id = p_tenant_id and r.site_id = v_review.site_id and r.hidden_at is null;

    select count(*) into v_con_lai_khac_nam_sao
    from public.erp_visit_reviews r
    where r.tenant_id = p_tenant_id
      and r.site_id = v_review.site_id
      and r.hidden_at is null
      and r.id <> v_review.id
      and r.rating <> 5;

    if v_dang_hien >= 3 and v_con_lai_khac_nam_sao = 0 then
      raise exception using errcode = '42501', message = 'REVIEW_MODERATION_TOAN_NAM_SAO';
    end if;
  end if;

  update public.erp_visit_reviews
  set hidden_at = now(),
      hidden_by = p_actor_account_id,
      hidden_reason = v_reason
  where tenant_id = p_tenant_id and id = p_review_id;

  -- Luật 3: ghi nhật ký. Cùng một giao dịch với lượt ẩn, nên không có đường nào
  -- ẩn được mà không để lại vết.
  insert into public.erp_visit_review_moderation_audit (
    tenant_id, review_id, actor_account_id, actor_role, action, reason
  ) values (
    p_tenant_id, p_review_id, p_actor_account_id, p_actor_role, 'hide', v_reason
  );

  return jsonb_build_object(
    'review_id', p_review_id,
    'hidden', true,
    'quota_used', case when v_han_muc is null then null
                       else public.erp_visit_review_hide_quota_used(p_tenant_id, p_actor_account_id) end,
    'quota_limit', v_han_muc
  );
end;
$$;

create or replace function public.erp_unhide_visit_review(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_actor_role text,
  p_review_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if p_tenant_id is null or p_review_id is null or coalesce(trim(p_actor_account_id), '') = '' then
    raise exception using errcode = '22023', message = 'REVIEW_MODERATION_INPUT_INVALID';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 400 then
    raise exception using errcode = '22023', message = 'REVIEW_MODERATION_REASON_REQUIRED';
  end if;
  -- Hiện lại một lời thì không tốn hạn mức: hạn mức sinh ra để phanh việc ẩn,
  -- không phải để phanh việc sửa sai.
  if p_actor_role not in ('director', 'manager') then
    raise exception using errcode = '42501', message = 'REVIEW_MODERATION_ROLE_REQUIRED';
  end if;

  update public.erp_visit_reviews
  set hidden_at = null, hidden_by = null, hidden_reason = null
  where tenant_id = p_tenant_id and id = p_review_id and hidden_at is not null;
  if not found then
    raise exception using errcode = 'P0002', message = 'REVIEW_MODERATION_NOT_FOUND';
  end if;

  insert into public.erp_visit_review_moderation_audit (
    tenant_id, review_id, actor_account_id, actor_role, action, reason
  ) values (
    p_tenant_id, p_review_id, p_actor_account_id, p_actor_role, 'unhide', v_reason
  );

  return jsonb_build_object('review_id', p_review_id, 'hidden', false);
end;
$$;

alter table public.erp_visit_review_moderation_audit enable row level security;

revoke all on table public.erp_visit_review_moderation_audit from public, anon, authenticated;
grant select, insert on table public.erp_visit_review_moderation_audit to service_role;

revoke all on function public.erp_visit_review_hide_quota_used(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_visit_review_hide_quota_used(uuid, text) to service_role;

revoke all on function public.erp_hide_visit_review(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.erp_hide_visit_review(uuid, text, text, uuid, text) to service_role;

revoke all on function public.erp_unhide_visit_review(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.erp_unhide_visit_review(uuid, text, text, uuid, text) to service_role;

commit;
