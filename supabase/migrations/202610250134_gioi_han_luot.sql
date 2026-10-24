-- Bảo mật · 25/10/2026
--
-- Giới hạn lượt gọi API dùng chung cho mọi bản máy chủ.
--
-- Trước đây các ô công khai (giữ chỗ, hàng chờ, gửi ảnh, hỏi AI…) hoặc không
-- giới hạn gì, hoặc đếm trong bộ nhớ của từng bản máy chủ. Vercel chạy nhiều
-- bản song song nên kẻ gửi dồn chỉ cần gọi đủ nhanh là lách được; gửi giữ chỗ
-- hàng loạt còn chiếm hết chỗ trống của khách thật trong 15 phút mỗi lượt.
--
-- `proxy.ts` gọi `nbj_lay_luot` cho mỗi lệnh ghi vào `/api`. Bảng chỉ giữ mã
-- băm HMAC của khoá (nhóm API + địa chỉ máy), không giữ IP trần; mỗi khoá một
-- dòng, đếm theo cửa sổ cố định, tăng nguyên tử bằng `on conflict`.
--
-- Đây là bảng kỹ thuật, không phải sổ nghiệp vụ: dòng hết cửa sổ tự dọn.
--
-- Kèm theo: thu quyền chạy hai hàm phụ của RLS khỏi `anon`. Supabase cấp sẵn
-- quyền chạy mọi hàm mới cho `anon`; hai hàm này chỉ phục vụ policy của
-- `authenticated`, khách chưa đăng nhập không cần gọi.

begin;

create table if not exists public.nbj_dem_luot (
  khoa text primary key check (khoa ~ '^[0-9a-f]{64}$'),
  so_luot integer not null default 1 check (so_luot >= 1),
  het_han timestamptz not null
);

create index if not exists nbj_dem_luot_het_han_idx on public.nbj_dem_luot (het_han);

alter table public.nbj_dem_luot enable row level security;
revoke all on table public.nbj_dem_luot from public, anon, authenticated, service_role;

-- Ghi một lượt cho khoá và trả về còn trong hạn mức hay không.
create or replace function public.nbj_lay_luot(
  p_khoa text,
  p_toi_da integer,
  p_cua_so_giay integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_so_luot integer;
begin
  if coalesce(p_khoa, '') !~ '^[0-9a-f]{64}$'
     or p_toi_da is null or p_toi_da not between 1 and 100000
     or p_cua_so_giay is null or p_cua_so_giay not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'GIOI_HAN_LUOT_INPUT_INVALID';
  end if;

  insert into public.nbj_dem_luot as dem (khoa, so_luot, het_han)
  values (p_khoa, 1, now() + make_interval(secs => p_cua_so_giay))
  on conflict (khoa) do update
    set so_luot = case when dem.het_han <= now() then 1 else dem.so_luot + 1 end,
        het_han = case when dem.het_han <= now() then now() + make_interval(secs => p_cua_so_giay) else dem.het_han end
  returning so_luot into v_so_luot;

  -- Dọn thưa: khoảng một trăm lượt gọi mới quét một lần.
  if random() < 0.01 then
    delete from public.nbj_dem_luot dem where dem.het_han < now() - interval '1 hour';
  end if;

  return v_so_luot <= p_toi_da;
end;
$$;

revoke all on function public.nbj_lay_luot(text, integer, integer) from public, anon, authenticated;
grant execute on function public.nbj_lay_luot(text, integer, integer) to service_role;

revoke execute on function public.can_manage_erp_site(uuid) from public, anon;
revoke execute on function public.has_tenant_role(uuid, text[]) from public, anon;
grant execute on function public.can_manage_erp_site(uuid) to authenticated, service_role;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated, service_role;

commit;
