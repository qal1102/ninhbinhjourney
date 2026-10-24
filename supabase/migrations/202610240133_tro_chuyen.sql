-- Trò chuyện trong ERP (24/10/2026).
--
-- Chủ dự án 24/10: "chat real-time, share file các thứ… nút + chuyển file
-- chuyển hình, hoặc đơn giản là tag một phần nào đó trong dự án yêu cầu người
-- bên kia cửa sổ chat làm việc phần đó".
--
-- Ba bảng: phòng (riêng hai người hoặc nhóm), thành viên (kèm mốc đã đọc),
-- tin. Một tin có chữ, tối đa 6 tệp (kho `erp-tro-chuyen`, riêng tư, đọc qua
-- đường dẫn ký), tối đa 4 thẻ gắn (một màn/chức năng của hệ thống, một văn bản
-- đã nhận), và có thể trỏ tới một việc ở `erp_viec_ghi` khi người gửi bật "Giao
-- thành việc": việc vẫn nằm ở Việc & ghi chú như mọi việc khác, tin chỉ trỏ
-- tới (không dựng nguồn thứ hai).
--
-- Thời gian thực: máy chủ gửi tín hiệu "có tin mới" qua Supabase Realtime
-- Broadcast vào kênh mang mã ngẫu nhiên `kenh` của phòng; tín hiệu không chở
-- nội dung, trình duyệt tự hỏi lại API có kiểm đăng nhập. Không có hàm xoá tin
-- (cố ý: trò chuyện công việc là chứng cứ giao việc).

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-tro-chuyen', 'erp-tro-chuyen', false, 4194304,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

create table if not exists public.erp_tc_phong (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loai text not null check (loai in ('rieng', 'nhom')),
  ten text check (ten is null or char_length(btrim(ten)) between 1 and 80),
  khoa_rieng text,
  kenh text not null default encode(extensions.gen_random_bytes(16), 'hex') check (kenh ~ '^[0-9a-f]{32}$'),
  tao_boi text not null,
  tao_luc timestamptz not null default now(),
  tin_cuoi_luc timestamptz not null default now(),
  la_mau boolean not null default false,
  check ((loai = 'rieng') = (khoa_rieng is not null)),
  check (loai = 'rieng' or ten is not null)
);
create unique index if not exists erp_tc_phong_rieng on public.erp_tc_phong (tenant_id, khoa_rieng) where khoa_rieng is not null;
create unique index if not exists erp_tc_phong_kenh on public.erp_tc_phong (kenh);

create table if not exists public.erp_tc_thanh_vien (
  phong_id uuid not null references public.erp_tc_phong(id) on delete cascade,
  account_id text not null,
  ten text not null default '',
  vao_luc timestamptz not null default now(),
  doc_den timestamptz not null default now(),
  primary key (phong_id, account_id)
);
create index if not exists erp_tc_thanh_vien_theo_nguoi on public.erp_tc_thanh_vien (account_id);

create table if not exists public.erp_tc_tin (
  id uuid primary key default gen_random_uuid(),
  phong_id uuid not null references public.erp_tc_phong(id) on delete cascade,
  nguoi_gui text not null,
  ten_nguoi_gui text not null default '',
  loai text not null default 'chu' check (loai in ('chu', 'he-thong')),
  noi_dung text not null default '' check (char_length(noi_dung) <= 4000),
  tep jsonb not null default '[]'::jsonb check (jsonb_typeof(tep) = 'array' and jsonb_array_length(tep) <= 6),
  gan jsonb not null default '[]'::jsonb check (jsonb_typeof(gan) = 'array' and jsonb_array_length(gan) <= 4),
  viec_id uuid,
  tao_luc timestamptz not null default now(),
  la_mau boolean not null default false,
  check (char_length(btrim(noi_dung)) > 0 or jsonb_array_length(tep) > 0 or jsonb_array_length(gan) > 0)
);
create index if not exists erp_tc_tin_theo_phong on public.erp_tc_tin (phong_id, tao_luc desc);

alter table public.erp_tc_phong enable row level security;
alter table public.erp_tc_thanh_vien enable row level security;
alter table public.erp_tc_tin enable row level security;
revoke all on table public.erp_tc_phong, public.erp_tc_thanh_vien, public.erp_tc_tin from public, anon, authenticated;
grant select, insert, update on table public.erp_tc_phong, public.erp_tc_thanh_vien, public.erp_tc_tin to service_role;

create or replace function public.erp_tc_la_thanh_vien(p_phong uuid, p_account text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.erp_tc_thanh_vien where phong_id = p_phong and account_id = trim(coalesce(p_account, '')));
$$;

-- Mở (hoặc tạo) phòng riêng của hai người.
create or replace function public.erp_tc_mo_rieng(p_tenant_id uuid, p_a text, p_ten_a text, p_b text, p_ten_b text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a text := trim(coalesce(p_a, ''));
  v_b text := trim(coalesce(p_b, ''));
  v_khoa text;
  v_id uuid;
begin
  if v_a = '' or v_b = '' or v_a = v_b then
    raise exception using errcode = '22023', message = 'TC_NGUOI_KHONG_HOP_LE';
  end if;
  v_khoa := least(v_a, v_b) || '|' || greatest(v_a, v_b);
  select id into v_id from public.erp_tc_phong where tenant_id = p_tenant_id and khoa_rieng = v_khoa;
  if v_id is null then
    insert into public.erp_tc_phong (tenant_id, loai, khoa_rieng, tao_boi)
    values (p_tenant_id, 'rieng', v_khoa, v_a)
    on conflict (tenant_id, khoa_rieng) where khoa_rieng is not null do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.erp_tc_phong where tenant_id = p_tenant_id and khoa_rieng = v_khoa;
    end if;
  end if;
  insert into public.erp_tc_thanh_vien (phong_id, account_id, ten) values
    (v_id, v_a, left(coalesce(p_ten_a, ''), 120)),
    (v_id, v_b, left(coalesce(p_ten_b, ''), 120))
  on conflict (phong_id, account_id) do update set ten = excluded.ten where excluded.ten <> '';
  return v_id;
end;
$$;

-- Tạo nhóm. `p_thanh_vien`: [{ "id": "...", "ten": "..." }], người tạo tự có mặt.
create or replace function public.erp_tc_tao_nhom(p_tenant_id uuid, p_nguoi_tao text, p_ten_nguoi_tao text, p_ten text, p_thanh_vien jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_ten, ''))) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'TC_TEN_NHOM';
  end if;
  if jsonb_typeof(p_thanh_vien) <> 'array' or jsonb_array_length(p_thanh_vien) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'TC_THANH_VIEN';
  end if;
  insert into public.erp_tc_phong (tenant_id, loai, ten, tao_boi)
  values (p_tenant_id, 'nhom', btrim(p_ten), trim(p_nguoi_tao))
  returning id into v_id;
  insert into public.erp_tc_thanh_vien (phong_id, account_id, ten)
  select v_id, trim(x ->> 'id'), left(coalesce(x ->> 'ten', ''), 120)
  from jsonb_array_elements(p_thanh_vien) x
  where trim(coalesce(x ->> 'id', '')) <> ''
  on conflict do nothing;
  insert into public.erp_tc_thanh_vien (phong_id, account_id, ten)
  values (v_id, trim(p_nguoi_tao), left(coalesce(p_ten_nguoi_tao, ''), 120))
  on conflict do nothing;
  insert into public.erp_tc_tin (phong_id, nguoi_gui, ten_nguoi_gui, loai, noi_dung)
  values (v_id, trim(p_nguoi_tao), left(coalesce(p_ten_nguoi_tao, ''), 120), 'he-thong', left(coalesce(p_ten_nguoi_tao, ''), 120) || ' lập nhóm "' || btrim(p_ten) || '".');
  return v_id;
end;
$$;

create or replace function public.erp_tc_ds_phong(p_tenant_id uuid, p_account text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.tin_cuoi_luc desc), '[]'::jsonb)
  from (
    select p.id, p.loai, p.ten, p.kenh, p.tin_cuoi_luc, p.la_mau,
      (select jsonb_agg(jsonb_build_object('id', v.account_id, 'ten', v.ten, 'docDen', v.doc_den) order by v.vao_luc)
         from public.erp_tc_thanh_vien v where v.phong_id = p.id) as thanh_vien,
      (select jsonb_build_object('nguoiGui', t.nguoi_gui, 'ten', t.ten_nguoi_gui, 'noiDung', left(t.noi_dung, 140), 'soTep', jsonb_array_length(t.tep), 'soGan', jsonb_array_length(t.gan), 'luc', t.tao_luc, 'loai', t.loai)
         from public.erp_tc_tin t where t.phong_id = p.id order by t.tao_luc desc limit 1) as tin_cuoi,
      (select count(*) from public.erp_tc_tin t where t.phong_id = p.id and t.tao_luc > me.doc_den and t.nguoi_gui <> me.account_id) as chua_doc
    from public.erp_tc_phong p
    join public.erp_tc_thanh_vien me on me.phong_id = p.id and me.account_id = trim(coalesce(p_account, ''))
    where p.tenant_id = p_tenant_id
    order by p.tin_cuoi_luc desc
    limit 100
  ) x;
$$;

-- Tin của một phòng, mới nhất trước; `p_truoc` để xem tin cũ hơn. Kèm trạng thái việc được giao.
create or replace function public.erp_tc_tin_phong(p_tenant_id uuid, p_phong uuid, p_account text, p_truoc timestamptz, p_gioi_han integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.erp_tc_phong p join public.erp_tc_thanh_vien v on v.phong_id = p.id
    where p.id = p_phong and p.tenant_id = p_tenant_id and v.account_id = trim(coalesce(p_account, ''))
  ) then
    raise exception using errcode = '42501', message = 'TC_KHONG_PHAI_THANH_VIEN';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.tao_luc desc)
    from (
      select t.id, t.nguoi_gui, t.ten_nguoi_gui, t.loai, t.noi_dung, t.tep, t.gan, t.tao_luc, t.la_mau, t.viec_id,
        (select jsonb_build_object('id', g.id, 'nguoiNhan', g.nguoi_nhan, 'nguoiTao', g.nguoi_tao, 'han', g.han, 'trangThai', g.trang_thai, 'noiDung', g.noi_dung)
           from public.erp_viec_ghi g where g.id = t.viec_id) as viec
      from public.erp_tc_tin t
      where t.phong_id = p_phong and (p_truoc is null or t.tao_luc < p_truoc)
      order by t.tao_luc desc
      limit least(greatest(coalesce(p_gioi_han, 40), 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.erp_tc_gui(
  p_tenant_id uuid,
  p_phong uuid,
  p_account text,
  p_ten text,
  p_loai text,
  p_noi_dung text,
  p_tep jsonb,
  p_gan jsonb,
  p_viec_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tin public.erp_tc_tin%rowtype;
begin
  if not exists (
    select 1 from public.erp_tc_phong p join public.erp_tc_thanh_vien v on v.phong_id = p.id
    where p.id = p_phong and p.tenant_id = p_tenant_id and v.account_id = trim(coalesce(p_account, ''))
  ) then
    raise exception using errcode = '42501', message = 'TC_KHONG_PHAI_THANH_VIEN';
  end if;
  insert into public.erp_tc_tin (phong_id, nguoi_gui, ten_nguoi_gui, loai, noi_dung, tep, gan, viec_id)
  values (
    p_phong, trim(p_account), left(coalesce(p_ten, ''), 120), coalesce(p_loai, 'chu'), coalesce(p_noi_dung, ''),
    coalesce(p_tep, '[]'::jsonb), coalesce(p_gan, '[]'::jsonb), p_viec_id
  )
  returning * into v_tin;
  update public.erp_tc_phong set tin_cuoi_luc = v_tin.tao_luc where id = p_phong;
  update public.erp_tc_thanh_vien set doc_den = v_tin.tao_luc where phong_id = p_phong and account_id = trim(p_account);
  return jsonb_build_object('id', v_tin.id, 'tao_luc', v_tin.tao_luc);
end;
$$;

create or replace function public.erp_tc_da_doc(p_tenant_id uuid, p_phong uuid, p_account text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.erp_tc_thanh_vien v set doc_den = now()
  from public.erp_tc_phong p
  where p.id = v.phong_id and p.tenant_id = p_tenant_id and v.phong_id = p_phong and v.account_id = trim(coalesce(p_account, ''));
$$;

create or replace function public.erp_tc_chua_doc(p_tenant_id uuid, p_account text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.erp_tc_thanh_vien me
  join public.erp_tc_phong p on p.id = me.phong_id and p.tenant_id = p_tenant_id
  join public.erp_tc_tin t on t.phong_id = me.phong_id and t.tao_luc > me.doc_den and t.nguoi_gui <> me.account_id
  where me.account_id = trim(coalesce(p_account, ''));
$$;

revoke all on function public.erp_tc_la_thanh_vien(uuid, text) from public, anon, authenticated;
revoke all on function public.erp_tc_mo_rieng(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_tc_tao_nhom(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.erp_tc_ds_phong(uuid, text) from public, anon, authenticated;
revoke all on function public.erp_tc_tin_phong(uuid, uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.erp_tc_gui(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.erp_tc_da_doc(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.erp_tc_chua_doc(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_tc_la_thanh_vien(uuid, text) to service_role;
grant execute on function public.erp_tc_mo_rieng(uuid, text, text, text, text) to service_role;
grant execute on function public.erp_tc_tao_nhom(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.erp_tc_ds_phong(uuid, text) to service_role;
grant execute on function public.erp_tc_tin_phong(uuid, uuid, text, timestamptz, integer) to service_role;
grant execute on function public.erp_tc_gui(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) to service_role;
grant execute on function public.erp_tc_da_doc(uuid, uuid, text) to service_role;
grant execute on function public.erp_tc_chua_doc(uuid, text) to service_role;

-- Một phòng mẫu giám đốc – quản lý Tràng An, ba tin, để mở màn là thấy cách
-- gắn một chức năng vào tin. Gieo một lần, không có nguồn sinh lặp lại.
do $$
declare
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_phong uuid;
begin
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;
  if exists (select 1 from public.erp_tc_phong where tenant_id = v_tenant and khoa_rieng = 'director-001|manager-trang-an') then
    return;
  end if;
  insert into public.erp_tc_phong (tenant_id, loai, khoa_rieng, tao_boi, tin_cuoi_luc, la_mau)
  values (v_tenant, 'rieng', 'director-001|manager-trang-an', 'manager-trang-an', now() - interval '2 hours', true)
  returning id into v_phong;
  insert into public.erp_tc_thanh_vien (phong_id, account_id, ten, vao_luc, doc_den) values
    (v_phong, 'manager-trang-an', 'Quản lý Tràng An', now() - interval '3 hours', now() - interval '2 hours'),
    (v_phong, 'director-001', 'Giám đốc', now() - interval '3 hours', now() - interval '3 hours');
  insert into public.erp_tc_tin (phong_id, nguoi_gui, ten_nguoi_gui, noi_dung, gan, tao_luc, la_mau) values
    (v_phong, 'manager-trang-an', 'Quản lý Tràng An', 'Thưa giám đốc, sáng nay bến Tràng An đông, hàng chờ lên tới 40 phút.', '[]'::jsonb, now() - interval '2 hours 20 minutes', true),
    (v_phong, 'manager-trang-an', 'Quản lý Tràng An', 'Em gửi màn sức chứa để giám đốc xem giờ cao điểm, có cần mở thêm thuyền buổi chiều không ạ?',
      '[{"kieu":"chuc-nang","id":"suc-chua-ca-vung","ten":"Sức chứa cả vùng theo giờ","duongDan":"/erp/toan-vung"}]'::jsonb, now() - interval '2 hours 18 minutes', true),
    (v_phong, 'manager-trang-an', 'Quản lý Tràng An', 'Hợp đồng thu gom rác HĐ-NCC-2026-0014 sắp hết giá trị, em đính kèm để giám đốc duyệt gia hạn.',
      '[{"kieu":"van-ban","id":"VB-MAU014","ten":"Hợp đồng nhà cung cấp HĐ-NCC-2026-0014","duongDan":"/erp/van-ban"}]'::jsonb, now() - interval '2 hours', true);
end;
$$;

commit;
