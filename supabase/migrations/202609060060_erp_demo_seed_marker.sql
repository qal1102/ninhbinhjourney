-- ERP-FAKE-02 · 06/09/2026
--
-- Đánh dấu dữ liệu gieo mẫu, để con số giám đốc đọc là con số thật.
--
-- **Nguồn việc.** Chủ dự án hỏi có nên gieo vài dòng dữ liệu vào mỗi màn hình
-- cho đỡ trống. Đi kiểm kê để trả lời thì thấy chiều ngược lại đang xảy ra:
-- đã gieo sẵn từ lâu, và không nói cho ai biết. Đo trên production 05/09/2026:
--
--   erp_tickets      8 hàng — cả 8 gieo 02/08, bảng "Vé đã bán" đếm cả 8
--   erp_incidents   16 hàng — cả 16 gieo, trong đó **8 chưa đóng**
--
-- Tám sự cố chưa đóng ấy chảy thẳng vào khối "Cần giám đốc quyết định" ở
-- trang chủ. Giám đốc mở ERP ra, thấy tám việc chờ mình quyết. Không việc nào
-- có thật. Và ba trong tám tấm vé mang `channel = 'website'`, nên biểu đồ
-- "Khách đến từ đâu" khai có ba lượt mua qua web trong khi `customer_orders`
-- đúng bằng 0.
--
-- **Vì sao đánh dấu chứ không xoá.** Màn hình trống làm người xem kết luận sản
-- phẩm không chạy được, và đó cũng là một kiểu hiểu sai. Giữ dữ liệu để còn
-- thứ mà xem, nhưng phải nói thẳng nó là mẫu, và **không được để nó lọt vào
-- con số nào người ta dùng để ra quyết định**.
--
-- **Vì sao chỉ hai bảng này.** Hai bảng này giả làm *tình hình hôm nay* — vé
-- bán được, việc đang chờ quyết. Các bảng còn lại (`erp_shift_close_workflows`,
-- `erp_accounting_journals`, `erp_ap_supplier_invoices`) là *dữ liệu nền lịch
-- sử* mà luồng demo kế toán đi trên đó; gỡ chúng ra là luồng ấy hết chạy. Việc
-- của chúng là một quyết định riêng, chưa làm ở đây.
--
-- **Hình dạng cột.** `data_origin` mặc định `'real'`, nên mọi hàng sinh ra từ
-- nay đều là thật mà không cần ai nhớ đặt gì. Chỉ những hàng gieo đã biết mới
-- được đổi, bằng vị từ hẹp và **có khẳng định số lượng**: lệch một hàng là
-- migration dừng lại, chứ không âm thầm dán nhãn nhầm lên dữ liệu của khách.
--
-- Migration tiến về phía trước và giữ nguyên dữ liệu: chỉ thêm cột, không xoá
-- hàng nào, không đụng ràng buộc nào đang có.

begin;

-- 1. Vé
alter table public.erp_tickets
  add column if not exists data_origin text not null default 'real';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'erp_tickets_data_origin_check'
      and conrelid = 'public.erp_tickets'::regclass
  ) then
    alter table public.erp_tickets
      add constraint erp_tickets_data_origin_check
      check (data_origin in ('real', 'demo-seed'));
  end if;
end;
$$;

-- Vị từ là DẠNG MÃ, không phải khoảng thời gian. Hàng rào này đã có sẵn và
-- đang được dùng ở chỗ khác: `erp_refresh_demo_tickets` chỉ chạm những mã khớp
-- đúng biểu thức dưới đây (migration 202608300055), còn vé bán qua web mang mã
-- `WEB-` cộng mười hai ký tự nên không bao giờ khớp.
do $$
declare
  v_expected integer := 8;
  v_marked integer;
begin
  update public.erp_tickets
  set data_origin = 'demo-seed'
  where ticket_code ~ '^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$';
  get diagnostics v_marked = row_count;

  if v_marked <> v_expected then
    raise exception
      'ERP_DEMO_SEED_TICKET_COUNT_MISMATCH: cho doi % ve gieo mau, dan nhan duoc %',
      v_expected, v_marked;
  end if;
end;
$$;

-- 2. Sự cố
alter table public.erp_incidents
  add column if not exists data_origin text not null default 'real';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'erp_incidents_data_origin_check'
      and conrelid = 'public.erp_incidents'::regclass
  ) then
    alter table public.erp_incidents
      add constraint erp_incidents_data_origin_check
      check (data_origin in ('real', 'demo-seed', 'test-residue'));
  end if;
end;
$$;

-- Sự cố không có dạng mã riêng để nhận ra, nên vị từ phải neo vào thời điểm
-- gieo. Đó là lý do phải khẳng định số lượng: nếu ai đó đã tạo một sự cố THẬT
-- trong khoảng ấy thì con số lệch và migration dừng, thay vì gắn nhãn "mẫu"
-- lên một sự cố có người thật đang xử lý.
--
-- ⚠ Khẳng định này đã bắt được sai lệch của chính bản nháp đầu. Bản đầu gộp cả
-- 16 hàng vào một vị từ `< 02/08` và đòi 16; chạy thử thì chỉ dán được 12 và
-- migration dừng. Đo lại theo giờ Việt Nam mới thấy hai nhóm khác hẳn nhau:
--
--   12 hàng · 01/08 00:28 — cùng một mốc, đây là đợt gieo mẫu thật sự
--    4 hàng · 02/08 01:19, 01:20, 02:04, 02:06 — mỗi hàng một mốc riêng
--
-- Bốn hàng lẻ kia không phải dữ liệu gieo: chúng là **cặn của các lượt chạy
-- thử** hồi 02/08, thứ mà migration 019/020 đã phải dọn (xem `AGENTS.md`).
-- Cả bốn đều đã đóng nên không lọt vào hàng chờ quyết định, nhưng gọi chúng là
-- "dữ liệu mẫu" thì sai lịch sử. Ghi đúng tên: `test-residue`.
do $$
declare
  v_marked integer;
begin
  update public.erp_incidents
  set data_origin = 'demo-seed'
  where created_at < timestamptz '2026-08-01 12:00:00+07';
  get diagnostics v_marked = row_count;
  if v_marked <> 12 then
    raise exception
      'ERP_DEMO_SEED_INCIDENT_COUNT_MISMATCH: cho doi 12 su co gieo mau, dan nhan duoc %',
      v_marked;
  end if;

  update public.erp_incidents
  set data_origin = 'test-residue'
  where data_origin = 'real'
    and created_at < timestamptz '2026-08-03 00:00:00+07';
  get diagnostics v_marked = row_count;
  if v_marked <> 4 then
    raise exception
      'ERP_TEST_RESIDUE_INCIDENT_COUNT_MISMATCH: cho doi 4 su co can chay thu, dan nhan duoc %',
      v_marked;
  end if;
end;
$$;

commit;
