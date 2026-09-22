-- Sổ liên hệ nhãn hàng đối tác · 22/09/2026
--
-- Chủ dự án: *"cái liên hệ các nhãn hàng hợp tác campaign và tất cả các thứ
-- sẽ có trong tương lai"*.
--
-- ## Bảng này giữ gì, và cố ý KHÔNG giữ gì
--
-- Giữ đúng những thứ trả lời được một câu: **hôm nay nên gọi lại cho ai.** Tên
-- nhãn hàng, người phụ trách hai bên, giai đoạn, ngày trao đổi gần nhất, dịp
-- đang nhắm tới, và một ô ghi chú.
--
-- KHÔNG giữ: hợp đồng, tiền, tệp đính kèm. Những thứ ấy có đường đi riêng và
-- nhét vào đây chỉ tạo ra nguồn sự thật thứ hai — đúng thứ bản giao kèo của dự
-- án cấm.
--
-- ## Vì sao ngày trao đổi gần nhất phải là một cột riêng
--
-- Hợp tác nhãn hàng chết vì **im lặng**, không phải vì bị từ chối: gọi một
-- lần, hẹn "để bàn thêm", rồi ba tháng sau không ai nhớ. Cột này để màn hình
-- tự đẩy mối đã nguội lên đầu. Nếu chỉ dựa vào `cap_nhat_luc` thì sửa một lỗi
-- chính tả trong tên cũng làm mối ấy trông như vừa được chăm sóc.
--
-- ## Về dữ liệu liên hệ
--
-- `cach_lien_he` là liên hệ **công việc của một doanh nghiệp**, không phải
-- thông tin khách tham quan, nên không đi qua lớp mã hoá dành cho dữ liệu
-- khách. Bù lại nó bị khoá kín ở đây: RLS bật, không cấp quyền nào cho `anon`
-- và `authenticated`, mọi lối vào đều qua hàm `security definer` mà chỉ
-- `service_role` gọi được. **Không được đưa cột này ra bất kỳ trang công khai
-- nào.**
--
-- ## Có hàm gỡ hẳn một dòng, và đó là tính năng chứ không phải lối tắt
--
-- Gõ nhầm tên một nhãn hàng rồi phải sống chung với nó mãi là một màn hình
-- tồi. Đây cũng là đường để bài kiểm trên production dọn sạch sau khi chạy,
-- đúng giao kèo "bài kiểm nào ghi thì phải trả hệ thống về nguyên trạng".

begin;

create table if not exists public.erp_doi_tac_nhan_hang (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ten text not null check (char_length(trim(ten)) between 1 and 160),
  nganh_hang text not null default '' check (char_length(nganh_hang) <= 80),
  nguoi_ben_ho text not null default '' check (char_length(nguoi_ben_ho) <= 120),
  cach_lien_he text not null default '' check (char_length(cach_lien_he) <= 200),
  nguoi_phu_trach text not null default '' check (char_length(nguoi_phu_trach) <= 120),
  giai_doan text not null default 'nham-truoc'
    check (giai_doan in ('nham-truoc', 'da-lien-he', 'dang-ban', 'da-chot', 'khep-lai')),
  -- Mã dịp trong `domain/lich-mua-vu.ts`. Cố ý KHÔNG khoá ngoại: danh sách dịp
  -- nằm trong mã nguồn chứ không phải trong kho, và một cuốn lịch mùa vụ tính
  -- lại theo từng năm không đáng để kéo thêm một bảng nữa.
  dip_nham_toi text not null default '' check (char_length(dip_nham_toi) <= 60),
  lan_trao_doi_cuoi date,
  ghi_chu text not null default '' check (char_length(ghi_chu) <= 1000),
  tao_luc timestamptz not null default now(),
  cap_nhat_luc timestamptz not null default now()
);

-- Một nhãn hàng một dòng. Gõ lại đúng cái tên ấy là sửa dòng cũ, không đẻ dòng
-- thứ hai — sổ liên hệ có hai dòng cùng tên là sổ vô dụng.
create unique index if not exists erp_doi_tac_nhan_hang_ten_duy_nhat
  on public.erp_doi_tac_nhan_hang (tenant_id, lower(trim(ten)));

create index if not exists erp_doi_tac_nhan_hang_theo_dip
  on public.erp_doi_tac_nhan_hang (tenant_id, dip_nham_toi)
  where dip_nham_toi <> '';

alter table public.erp_doi_tac_nhan_hang enable row level security;

-- 1. Đọc cả sổ.
create or replace function public.erp_doc_so_doi_tac(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $ham$
declare
  v_ra jsonb;
begin
  if p_tenant_id is null then
    raise exception using errcode = '22023', message = 'DOI_TAC_INPUT_INVALID';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'ten', d.ten,
      'nganh_hang', d.nganh_hang,
      'nguoi_ben_ho', d.nguoi_ben_ho,
      'cach_lien_he', d.cach_lien_he,
      'nguoi_phu_trach', d.nguoi_phu_trach,
      'giai_doan', d.giai_doan,
      'dip_nham_toi', d.dip_nham_toi,
      'lan_trao_doi_cuoi', coalesce(to_char(d.lan_trao_doi_cuoi, 'YYYY-MM-DD'), ''),
      'ghi_chu', d.ghi_chu,
      'cap_nhat_luc', to_char(d.cap_nhat_luc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
    order by d.cap_nhat_luc desc
  ), '[]'::jsonb)
  into v_ra
  from public.erp_doi_tac_nhan_hang d
  where d.tenant_id = p_tenant_id;

  return v_ra;
end;
$ham$;

-- 2. Ghi một dòng — thêm mới hoặc sửa dòng đã có.
--
-- `p_ghi_trao_doi` tách riêng khỏi phần sửa nội dung: sửa lỗi chính tả trong
-- tên không được tính là "vừa trao đổi với họ hôm nay". Đó chính là chỗ một
-- cuốn sổ bắt đầu tự lừa dối người dùng.
create or replace function public.erp_ghi_doi_tac(
  p_tenant_id uuid,
  p_id uuid,
  p_ten text,
  p_nganh_hang text,
  p_nguoi_ben_ho text,
  p_cach_lien_he text,
  p_nguoi_phu_trach text,
  p_giai_doan text,
  p_dip_nham_toi text,
  p_ghi_chu text,
  p_ghi_trao_doi boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $ham$
declare
  v_ten text := trim(coalesce(p_ten, ''));
  v_giai_doan text := coalesce(nullif(trim(coalesce(p_giai_doan, '')), ''), 'nham-truoc');
  v_hom_nay date := ((now() at time zone 'Asia/Ho_Chi_Minh')::date);
  v_id uuid;
begin
  if p_tenant_id is null or v_ten = '' then
    raise exception using errcode = '22023', message = 'DOI_TAC_INPUT_INVALID';
  end if;
  if char_length(v_ten) > 160 then
    raise exception using errcode = '22023', message = 'DOI_TAC_TEN_QUA_DAI';
  end if;
  if v_giai_doan not in ('nham-truoc', 'da-lien-he', 'dang-ban', 'da-chot', 'khep-lai') then
    raise exception using errcode = '22023', message = 'DOI_TAC_GIAI_DOAN_INVALID';
  end if;

  if p_id is not null then
    update public.erp_doi_tac_nhan_hang
       set ten = v_ten,
           nganh_hang = left(trim(coalesce(p_nganh_hang, '')), 80),
           nguoi_ben_ho = left(trim(coalesce(p_nguoi_ben_ho, '')), 120),
           cach_lien_he = left(trim(coalesce(p_cach_lien_he, '')), 200),
           nguoi_phu_trach = left(trim(coalesce(p_nguoi_phu_trach, '')), 120),
           giai_doan = v_giai_doan,
           dip_nham_toi = left(trim(coalesce(p_dip_nham_toi, '')), 60),
           ghi_chu = left(trim(coalesce(p_ghi_chu, '')), 1000),
           lan_trao_doi_cuoi = case
             when coalesce(p_ghi_trao_doi, false) then v_hom_nay
             else lan_trao_doi_cuoi
           end,
           cap_nhat_luc = now()
     where id = p_id and tenant_id = p_tenant_id
     returning id into v_id;

    if v_id is null then
      raise exception using errcode = '22023', message = 'DOI_TAC_NOT_FOUND';
    end if;
  else
    insert into public.erp_doi_tac_nhan_hang (
      tenant_id, ten, nganh_hang, nguoi_ben_ho, cach_lien_he, nguoi_phu_trach,
      giai_doan, dip_nham_toi, ghi_chu, lan_trao_doi_cuoi
    )
    values (
      p_tenant_id,
      v_ten,
      left(trim(coalesce(p_nganh_hang, '')), 80),
      left(trim(coalesce(p_nguoi_ben_ho, '')), 120),
      left(trim(coalesce(p_cach_lien_he, '')), 200),
      left(trim(coalesce(p_nguoi_phu_trach, '')), 120),
      v_giai_doan,
      left(trim(coalesce(p_dip_nham_toi, '')), 60),
      left(trim(coalesce(p_ghi_chu, '')), 1000),
      case when coalesce(p_ghi_trao_doi, false) then v_hom_nay else null end
    )
    -- Gõ lại đúng tên đã có thì sửa dòng cũ. Người dùng không nhớ mình đã ghi
    -- nhãn hàng ấy từ tháng trước là chuyện bình thường; đẻ ra dòng thứ hai
    -- mới là lỗi.
    on conflict (tenant_id, lower(trim(ten))) do update
      set nganh_hang = excluded.nganh_hang,
          nguoi_ben_ho = excluded.nguoi_ben_ho,
          cach_lien_he = excluded.cach_lien_he,
          nguoi_phu_trach = excluded.nguoi_phu_trach,
          giai_doan = excluded.giai_doan,
          dip_nham_toi = excluded.dip_nham_toi,
          ghi_chu = excluded.ghi_chu,
          lan_trao_doi_cuoi = coalesce(
            excluded.lan_trao_doi_cuoi,
            public.erp_doi_tac_nhan_hang.lan_trao_doi_cuoi
          ),
          cap_nhat_luc = now()
    returning id into v_id;
  end if;

  return public.erp_doc_so_doi_tac(p_tenant_id);
end;
$ham$;

-- 3. Gỡ hẳn một dòng.
create or replace function public.erp_go_doi_tac(p_tenant_id uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $ham$
begin
  if p_tenant_id is null or p_id is null then
    raise exception using errcode = '22023', message = 'DOI_TAC_INPUT_INVALID';
  end if;

  delete from public.erp_doi_tac_nhan_hang
   where id = p_id and tenant_id = p_tenant_id;

  return public.erp_doc_so_doi_tac(p_tenant_id);
end;
$ham$;

revoke all on function public.erp_doc_so_doi_tac(uuid) from public, anon, authenticated;
grant execute on function public.erp_doc_so_doi_tac(uuid) to service_role;

revoke all on function public.erp_ghi_doi_tac(uuid, uuid, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.erp_ghi_doi_tac(uuid, uuid, text, text, text, text, text, text, text, text, boolean) to service_role;

revoke all on function public.erp_go_doi_tac(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_go_doi_tac(uuid, uuid) to service_role;

commit;
