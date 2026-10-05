-- Việc, ghi chú và nhật ký ngày, ghi bằng giọng nói hoặc gõ tay
-- (chủ dự án 06/10/2026: "bật app ERP lên và voice để note lại").
--
-- Một bảng cho ba loại:
-- - `viec`: người giao (giám đốc, quản lý) giao cho một người, có hạn, có
--   trạng thái mở / xong / huỷ. Khác phiếu việc của ngày công
--   (`erp_workday_workflows`): phiếu ấy gò theo mẫu việc của trạm, chỉ trong
--   ngày và có vào ca bằng GPS; việc ở đây là lời dặn tự do ("mai kiểm lại áo
--   phao bến Tam Cốc"), hạn ngày nào cũng được.
-- - `ghi-chu`: ghi chú của riêng người nói, có thể kèm giờ nhắc.
-- - `nhat-ky`: nhật ký một ngày làm việc của người nói.
--
-- Ai được giao cho ai là luật vai, kiểm ở máy chủ trước khi gọi hàm này
-- (`app/erp/tro-ly-ghi-actions.ts`). Hàm ở đây giữ phần cấu trúc: người nhận
-- phải có trong sổ và còn hoạt động, chỉ người nhận hoặc người giao đổi được
-- trạng thái, chỉ người giao huỷ được việc. Không có hàm xoá (cố ý): việc huỷ
-- thì để trạng thái huỷ.

begin;

create table public.erp_viec_ghi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loai text not null check (loai in ('viec', 'ghi-chu', 'nhat-ky')),
  nguoi_tao text not null,
  nguoi_nhan text,
  site_id uuid references public.sites(id) on delete restrict,
  noi_dung text not null check (char_length(btrim(noi_dung)) between 1 and 1000),
  han timestamptz,
  ngay date not null,
  khan boolean not null default false,
  trang_thai text not null default 'mo' check (trang_thai in ('mo', 'xong', 'huy')),
  nguon text not null default 'go-tay' check (nguon in ('giong-noi', 'go-tay')),
  cau_goc text check (cau_goc is null or char_length(cau_goc) <= 1000),
  bo_hieu text check (bo_hieu is null or bo_hieu in ('luat', 'claude')),
  tao_luc timestamptz not null default now(),
  xong_luc timestamptz,
  check ((loai = 'viec') = (nguoi_nhan is not null)),
  foreign key (nguoi_tao, tenant_id)
    references public.erp_account_registry(account_id, tenant_id) on delete restrict,
  foreign key (nguoi_nhan, tenant_id)
    references public.erp_account_registry(account_id, tenant_id) on delete restrict
);
create index erp_viec_ghi_theo_nguoi_nhan on public.erp_viec_ghi (tenant_id, nguoi_nhan, trang_thai) where nguoi_nhan is not null;
create index erp_viec_ghi_theo_nguoi_tao on public.erp_viec_ghi (tenant_id, nguoi_tao, tao_luc desc);

alter table public.erp_viec_ghi enable row level security;
revoke all on table public.erp_viec_ghi from public, anon, authenticated;
grant select, insert, update on table public.erp_viec_ghi to service_role;

create or replace function public.erp_viec_ghi_tao(
  p_tenant_id uuid,
  p_nguoi_tao text,
  p_loai text,
  p_nguoi_nhan text,
  p_site_id uuid,
  p_noi_dung text,
  p_han timestamptz,
  p_ngay date,
  p_khan boolean,
  p_nguon text,
  p_cau_goc text,
  p_bo_hieu text
)
returns public.erp_viec_ghi
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_dong public.erp_viec_ghi;
begin
  if p_loai not in ('viec', 'ghi-chu', 'nhat-ky') then
    raise exception using errcode = '22023', message = 'VIEC_GHI_LOAI_SAI';
  end if;
  if not exists (
    select 1 from public.erp_account_registry
    where tenant_id = p_tenant_id and account_id = p_nguoi_tao and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'VIEC_GHI_NGUOI_TAO_KHONG_HOP_LE';
  end if;
  if p_loai = 'viec' then
    if p_nguoi_nhan is null or not exists (
      select 1 from public.erp_account_registry
      where tenant_id = p_tenant_id and account_id = p_nguoi_nhan and status = 'active'
    ) then
      raise exception using errcode = '22023', message = 'VIEC_GHI_NGUOI_NHAN_KHONG_HOP_LE';
    end if;
    if p_han is not null and p_han <= now() then
      raise exception using errcode = '22023', message = 'VIEC_GHI_HAN_DA_QUA';
    end if;
  end if;
  if char_length(pg_catalog.btrim(coalesce(p_noi_dung, ''))) = 0 then
    raise exception using errcode = '22023', message = 'VIEC_GHI_THIEU_NOI_DUNG';
  end if;

  insert into public.erp_viec_ghi (
    tenant_id, loai, nguoi_tao, nguoi_nhan, site_id, noi_dung, han, ngay, khan, nguon, cau_goc, bo_hieu
  )
  values (
    p_tenant_id, p_loai, p_nguoi_tao,
    case when p_loai = 'viec' then p_nguoi_nhan end,
    p_site_id, pg_catalog.btrim(p_noi_dung), p_han, p_ngay, coalesce(p_khan, false),
    coalesce(p_nguon, 'go-tay'), nullif(pg_catalog.btrim(coalesce(p_cau_goc, '')), ''), p_bo_hieu
  )
  returning * into v_dong;
  return v_dong;
end;
$ham$;

create or replace function public.erp_viec_ghi_doi_trang_thai(
  p_tenant_id uuid, p_id uuid, p_account_id text, p_trang_thai text
)
returns public.erp_viec_ghi
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_dong public.erp_viec_ghi;
begin
  select * into v_dong from public.erp_viec_ghi where id = p_id and tenant_id = p_tenant_id for update;
  if v_dong.id is null or (v_dong.nguoi_tao <> p_account_id and v_dong.nguoi_nhan is distinct from p_account_id) then
    raise exception using errcode = 'P0002', message = 'VIEC_GHI_KHONG_CO';
  end if;
  if p_trang_thai not in ('mo', 'xong', 'huy') then
    raise exception using errcode = '22023', message = 'VIEC_GHI_TRANG_THAI_SAI';
  end if;
  if p_trang_thai = 'huy' and v_dong.nguoi_tao <> p_account_id then
    raise exception using errcode = '42501', message = 'VIEC_GHI_CHI_NGUOI_GIAO_HUY';
  end if;
  if v_dong.trang_thai = 'huy' then
    raise exception using errcode = '22023', message = 'VIEC_GHI_DA_HUY';
  end if;

  update public.erp_viec_ghi
  set trang_thai = p_trang_thai,
      xong_luc = case when p_trang_thai = 'xong' then now() else null end
  where id = p_id
  returning * into v_dong;
  return v_dong;
end;
$ham$;

-- Việc và ghi chú của một người: thứ mình tạo và việc giao cho mình. Bỏ những
-- dòng đã xong hay đã huỷ quá 30 ngày; tối đa 300 dòng.
create or replace function public.erp_viec_ghi_cua_toi(p_tenant_id uuid, p_account_id text)
returns setof public.erp_viec_ghi
language sql
stable
security definer
set search_path = ''
as $ham$
  select * from public.erp_viec_ghi
  where tenant_id = p_tenant_id
    and (nguoi_tao = p_account_id or nguoi_nhan = p_account_id)
    and (trang_thai = 'mo' or coalesce(xong_luc, tao_luc) > now() - interval '30 days')
  order by (trang_thai = 'mo') desc, coalesce(han, tao_luc) asc
  limit 300;
$ham$;

revoke all on function public.erp_viec_ghi_tao(uuid, text, text, text, uuid, text, timestamptz, date, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_viec_ghi_doi_trang_thai(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_viec_ghi_cua_toi(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_viec_ghi_tao(uuid, text, text, text, uuid, text, timestamptz, date, boolean, text, text, text) to service_role;
grant execute on function public.erp_viec_ghi_doi_trang_thai(uuid, uuid, text, text) to service_role;
grant execute on function public.erp_viec_ghi_cua_toi(uuid, text) to service_role;

commit;
