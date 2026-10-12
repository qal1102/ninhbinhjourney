-- Hợp đồng người chèo: dài hạn hay thời vụ, ngày bắt đầu, ngày hết hạn (12/10/2026).
--
-- Chủ dự án: "Người chèo: hợp đồng dài hạn / thời vụ, ngày hết hạn, loại người
-- hết hợp đồng khỏi lượt gọi; sổ mẫu thêm người (hiện 12/bến)."
--
-- Luật lượt gọi ở `domain/thuyen-song.ts` (`trongHopDong`): người chưa tới
-- ngày bắt đầu hoặc đã qua ngày hết hạn không vào hàng gọi. Dài hạn được bỏ
-- trống ngày hết hạn (hợp đồng không thời hạn); thời vụ bắt buộc có ngày hết.
--
-- Dữ liệu: chỉ đụng dòng `la_mau = true` (người mẫu của 111). Dòng chủ dự án
-- đã sửa tay (thôi nhãn mẫu) giữ nguyên, mặc định dài hạn không thời hạn.
-- Ngày mẫu tính quanh mùa thu 2026: vài người thời vụ đã hết hợp đồng cuối
-- tháng 8 để thấy họ bị loại, vài người sắp hết trong tháng 10.

begin;

alter table public.erp_nguoi_cheo
  add column if not exists loai_hop_dong text not null default 'dai-han'
    check (loai_hop_dong in ('dai-han', 'thoi-vu')),
  add column if not exists hop_dong_tu date,
  add column if not exists hop_dong_den date;

alter table public.erp_nguoi_cheo
  drop constraint if exists erp_nguoi_cheo_hop_dong_check;
alter table public.erp_nguoi_cheo
  add constraint erp_nguoi_cheo_hop_dong_check check (
    (hop_dong_den is null or hop_dong_tu is null or hop_dong_den >= hop_dong_tu)
    and (loai_hop_dong <> 'thoi-vu' or hop_dong_den is not null)
  );

-- Mười tám người mẫu mỗi bến, số thuyền 13–30, không số điện thoại (như 111).
insert into public.erp_nguoi_cheo (tenant_id, site_id, so_thuyen, ho_ten, la_mau, que_quan, nam_vao_nghe, ngon_ngu)
select '00000000-0000-4000-8000-000000000001'::uuid, v.site_id, v.so_thuyen, v.ho_ten, true, v.que_quan, v.nam, v.ngon_ngu
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, '13', 'Trần Văn Quý', 'Trường Yên', 2009, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '14', 'Đinh Thị Hoà', 'Trường Yên', 2014, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '15', 'Phạm Văn Đức', 'Ninh Xuân', 2011, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '16', 'Lê Thị Ngọc', 'Ninh Hải', 2017, 'Tiếng Việt, chào hỏi tiếng Anh, tiếng Hàn'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '17', 'Bùi Văn Hưng', 'Trường Yên', 2006, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '18', 'Nguyễn Thị Thanh', 'Ninh Xuân', 2019, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '19', 'Vũ Văn Toàn', 'Gia Sinh', 2013, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '20', 'Đỗ Thị Hạnh', 'Trường Yên', 2016, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '21', 'Hoàng Văn Nam', 'Ninh Hải', 2022, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '22', 'Trịnh Thị Vân', 'Trường Yên', 2023, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '23', 'Lương Văn Dũng', 'Ninh Xuân', 2024, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '24', 'Phạm Thị Hiền', 'Gia Sinh', 2025, 'Tiếng Việt, chào hỏi tiếng Trung'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '25', 'Đinh Văn Long', 'Trường Yên', 2025, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '26', 'Nguyễn Thị Phượng', 'Ninh Hải', 2026, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '27', 'Tạ Văn Cường', 'Ninh Xuân', 2024, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '28', 'Mai Thị Xuân', 'Trường Yên', 2025, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '29', 'Hà Văn Thịnh', 'Gia Sinh', 2026, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '30', 'Bùi Thị Loan', 'Trường Yên', 2004, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '13', 'Phạm Văn Thành', 'Văn Lâm', 2008, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '14', 'Đinh Thị Hường', 'Ninh Hải', 2012, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '15', 'Nguyễn Văn Hậu', 'Văn Lâm', 2015, 'Tiếng Việt, chào hỏi tiếng Pháp'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '16', 'Vũ Thị Bích', 'Ninh Thắng', 2010, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '17', 'Trần Văn Lâm', 'Ninh Hải', 2018, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '18', 'Lê Thị Tuyết', 'Văn Lâm', 2007, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '19', 'Hoàng Thị Nga', 'Ninh Thắng', 2016, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '20', 'Đỗ Văn Tâm', 'Ninh Hải', 2013, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '21', 'Phạm Thị Thu', 'Văn Lâm', 2023, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '22', 'Bùi Văn Kiên', 'Ninh Hải', 2024, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '23', 'Đinh Thị Ngân', 'Văn Lâm', 2025, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '24', 'Nguyễn Văn Hoàng', 'Ninh Thắng', 2025, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '25', 'Trịnh Thị Hảo', 'Văn Lâm', 2026, 'Tiếng Việt, chào hỏi tiếng Anh'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '26', 'Lê Văn Thuận', 'Ninh Hải', 2026, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '27', 'Vũ Thị Diệp', 'Văn Lâm', 2024, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '28', 'Hà Văn Phúc', 'Ninh Thắng', 2025, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '29', 'Mai Thị Oanh', 'Ninh Hải', 2026, 'Tiếng Việt'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '30', 'Lương Văn Tiến', 'Văn Lâm', 2003, 'Tiếng Việt')
) as v(site_id, so_thuyen, ho_ten, que_quan, nam, ngon_ngu)
where not exists (
  select 1 from public.erp_nguoi_cheo old
  where old.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
    and old.site_id = v.site_id and upper(btrim(old.so_thuyen)) = v.so_thuyen
);

-- Hợp đồng mẫu theo số thuyền, chỉ dòng mẫu:
--   01–20 dài hạn, từ năm vào nghề, hết 31/12/2027;
--   21–26 thời vụ mùa thu 01/09–31/12/2026;
--   27–28 thời vụ mùa hè 01/05–31/08/2026 (đã hết, không vào lượt gọi);
--   29    thời vụ 15/09–20/10/2026 (sắp hết);
--   30    dài hạn hết 25/10/2026 (sắp hết, cần gia hạn).
update public.erp_nguoi_cheo n
set loai_hop_dong = case
      when n.so_thuyen ~ '^[0-9]+$' and n.so_thuyen::integer between 21 and 29 then 'thoi-vu'
      else 'dai-han'
    end,
    hop_dong_tu = case
      when n.so_thuyen ~ '^[0-9]+$' and n.so_thuyen::integer between 21 and 26 then date '2026-09-01'
      when n.so_thuyen ~ '^[0-9]+$' and n.so_thuyen::integer between 27 and 28 then date '2026-05-01'
      when n.so_thuyen = '29' then date '2026-09-15'
      else make_date(greatest(coalesce(n.nam_vao_nghe, 2020), 2000), 1, 1)
    end,
    hop_dong_den = case
      when n.so_thuyen ~ '^[0-9]+$' and n.so_thuyen::integer between 21 and 26 then date '2026-12-31'
      when n.so_thuyen ~ '^[0-9]+$' and n.so_thuyen::integer between 27 and 28 then date '2026-08-31'
      when n.so_thuyen = '29' then date '2026-10-20'
      when n.so_thuyen = '30' then date '2026-10-25'
      else date '2027-12-31'
    end,
    sua_luc = now()
where n.la_mau = true
  and n.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;

commit;
