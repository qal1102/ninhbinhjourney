-- Hồ sơ người chèo: quê, năm vào nghề, tiếng chào khách.
-- Chủ dự án 06/10/2026 chê sổ người chèo "nhìn chán": mỗi người chỉ có tên và
-- dòng "Chưa có số điện thoại". Thêm ba cột để màn `/erp/thuyen` dựng được hồ
-- sơ, rồi điền cho 24 người mẫu của `111` (chỉ dòng `la_mau = true`; người
-- quản lý đã sửa tay thì không đụng). Mẫu vẫn không có số điện thoại để tránh
-- trùng số người thật.

begin;

alter table public.erp_nguoi_cheo
  add column if not exists que_quan text check (que_quan is null or char_length(btrim(que_quan)) between 2 and 80),
  add column if not exists nam_vao_nghe integer check (nam_vao_nghe is null or nam_vao_nghe between 1950 and 2100),
  add column if not exists ngon_ngu text check (ngon_ngu is null or char_length(btrim(ngon_ngu)) between 2 and 120);

update public.erp_nguoi_cheo n
set que_quan = m.que_quan,
    nam_vao_nghe = m.nam_vao_nghe,
    ngon_ngu = m.ngon_ngu,
    ghi_chu = m.ghi_chu
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, '01', 'Trường Yên', 2004, 'Tiếng Việt, tiếng Anh giao tiếp', 'Có chứng chỉ cứu đuối; hay nhận đoàn khách nước ngoài'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '02', 'Ninh Xuân', 2011, 'Tiếng Việt, chào hỏi tiếng Anh', 'Thuộc tích ba đền trên tuyến, kể cho khách nghe'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '03', 'Trường Yên', 2008, 'Tiếng Việt', 'Có chứng chỉ cứu đuối'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '04', 'Ninh Xuân', 2015, 'Tiếng Việt, chào hỏi tiếng Hàn', null),
  ('10000000-0000-4000-8000-000000000001'::uuid, '05', 'Trường Yên', 2001, 'Tiếng Việt', 'Chèo lâu năm nhất bến; kèm người mới'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '06', 'Ninh Xuân', 2018, 'Tiếng Việt, tiếng Anh giao tiếp', 'Biết sơ cứu'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '07', 'Trường Yên', 2013, 'Tiếng Việt', null),
  ('10000000-0000-4000-8000-000000000001'::uuid, '08', 'Ninh Xuân', 2006, 'Tiếng Việt, chào hỏi tiếng Anh', 'Có chứng chỉ cứu đuối'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '09', 'Trường Yên', 2019, 'Tiếng Việt', 'Hát chầu văn khi thuyền qua Đền Trình'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '10', 'Ninh Xuân', 2010, 'Tiếng Việt, chào hỏi tiếng Trung', null),
  ('10000000-0000-4000-8000-000000000001'::uuid, '11', 'Trường Yên', 2021, 'Tiếng Việt', 'Mới vào nghề, đi kèm người chèo số 05 tháng đầu'),
  ('10000000-0000-4000-8000-000000000001'::uuid, '12', 'Ninh Xuân', 2009, 'Tiếng Việt, tiếng Anh giao tiếp', 'Biết sơ cứu'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '01', 'Văn Lâm', 2003, 'Tiếng Việt, chào hỏi tiếng Anh', 'Chèo bằng chân suốt tuyến ba hang'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '02', 'Văn Lâm', 2010, 'Tiếng Việt', 'Có chứng chỉ cứu đuối'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '03', 'Ninh Hải', 2014, 'Tiếng Việt, tiếng Anh giao tiếp', 'Hay nhận khách Tây đi đò sớm mùa lúa chín'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '04', 'Văn Lâm', 2007, 'Tiếng Việt', null),
  ('10000000-0000-4000-8000-000000000005'::uuid, '05', 'Ninh Hải', 2016, 'Tiếng Việt, chào hỏi tiếng Pháp', 'Biết sơ cứu'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '06', 'Văn Lâm', 2002, 'Tiếng Việt', 'Chèo bằng chân; thuộc từng vách đá trong Hang Cả'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '07', 'Ninh Hải', 2012, 'Tiếng Việt, chào hỏi tiếng Anh', null),
  ('10000000-0000-4000-8000-000000000005'::uuid, '08', 'Văn Lâm', 2020, 'Tiếng Việt', 'Mới vào nghề'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '09', 'Ninh Hải', 2005, 'Tiếng Việt, tiếng Anh giao tiếp', 'Có chứng chỉ cứu đuối'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '10', 'Văn Lâm', 2017, 'Tiếng Việt', null),
  ('10000000-0000-4000-8000-000000000005'::uuid, '11', 'Ninh Hải', 2009, 'Tiếng Việt, chào hỏi tiếng Anh', 'Biết sơ cứu'),
  ('10000000-0000-4000-8000-000000000005'::uuid, '12', 'Văn Lâm', 2013, 'Tiếng Việt', 'Chèo bằng chân')
) as m(site_id, so_thuyen, que_quan, nam_vao_nghe, ngon_ngu, ghi_chu)
where n.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
  and n.site_id = m.site_id
  and n.so_thuyen = m.so_thuyen
  and n.la_mau = true;

commit;
