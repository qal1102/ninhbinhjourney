-- Sổ người chèo: thuyền số mấy do ai chèo, theo từng bến (Tràng An, Tam Cốc).
-- Chủ dự án 06/10/2026: bấm vào thuyền trên bản đồ ERP phải biết ai đang chèo.
--
-- Bản đồ dùng sổ này hai cách:
-- - thuyền có định vị (người chèo bấm "Bắt đầu chuyến") lấy số điện thoại theo
--   số thuyền;
-- - thuyền ước từ lượt khách qua cổng lấy người chèo theo lượt gọi xoay vòng
--   ở bến (`domain/thuyen-song.ts`, `ganNguoiCheo`): một người không chèo hai
--   thuyền cùng lúc, hết người rảnh thì nói thẳng là chưa có ai trong sổ.
--
-- Quản lý cơ sở và giám đốc sửa sổ ở màn `/erp/thuyen`; luật vai kiểm ở máy chủ
-- (`app/erp/nguoi-cheo-actions.ts`). Gieo 12 người mẫu mỗi bến, `la_mau = true`,
-- không có số điện thoại (chủ dự án cho phép riêng việc gieo mẫu này); xoá hay
-- sửa được ngay trong ERP.

begin;

create table public.erp_nguoi_cheo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  so_thuyen text not null check (char_length(btrim(so_thuyen)) between 1 and 20),
  ho_ten text not null check (char_length(btrim(ho_ten)) between 2 and 120),
  so_dien_thoai text check (so_dien_thoai is null or so_dien_thoai ~ '^[0-9 +.]{8,20}$'),
  ghi_chu text check (ghi_chu is null or char_length(ghi_chu) <= 300),
  la_mau boolean not null default false,
  tao_luc timestamptz not null default now(),
  sua_luc timestamptz not null default now()
);
create unique index erp_nguoi_cheo_mot_so_thuyen
  on public.erp_nguoi_cheo (tenant_id, site_id, upper(btrim(so_thuyen)));

alter table public.erp_nguoi_cheo enable row level security;
revoke all on table public.erp_nguoi_cheo from public, anon, authenticated;
grant select, insert, update, delete on table public.erp_nguoi_cheo to service_role;

insert into public.erp_nguoi_cheo (tenant_id, site_id, so_thuyen, ho_ten, la_mau)
select '00000000-0000-4000-8000-000000000001'::uuid, s.site_id, m.so_thuyen, m.ho_ten, true
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000005'::uuid)
) as s(site_id)
cross join lateral (
  select * from (values
    ('10000000-0000-4000-8000-000000000001'::uuid, '01', 'Đinh Văn Hải'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '02', 'Phạm Thị Lụa'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '03', 'Bùi Văn Thắng'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '04', 'Nguyễn Thị Mận'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '05', 'Trịnh Văn Tú'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '06', 'Vũ Thị Hằng'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '07', 'Đinh Thị Thơm'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '08', 'Phạm Văn Lực'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '09', 'Lê Thị Huệ'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '10', 'Hoàng Văn Bình'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '11', 'Tạ Thị Nụ'),
    ('10000000-0000-4000-8000-000000000001'::uuid, '12', 'Đỗ Văn Khánh'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '01', 'Phạm Thị Nhung'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '02', 'Đinh Thị Lan'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '03', 'Bùi Thị Yến'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '04', 'Nguyễn Văn Toản'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '05', 'Vũ Thị Hương'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '06', 'Trần Thị Mai'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '07', 'Đinh Văn Sơn'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '08', 'Phạm Thị Duyên'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '09', 'Lương Thị Hoa'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '10', 'Hà Văn Chiến'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '11', 'Mai Thị Thuỷ'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '12', 'Ngô Thị Liên')
  ) as v(site_id, so_thuyen, ho_ten)
  where v.site_id = s.site_id
) as m
where exists (select 1 from public.sites where id = s.site_id)
  and exists (select 1 from public.tenants where id = '00000000-0000-4000-8000-000000000001'::uuid)
on conflict do nothing;

commit;
