-- Dọn lượt quét cổng và báo cáo hiện trường do bài smoke production để lại.
--
-- Nguồn: lượt kiểm tay của chủ dự án ngày 12/09/2026 đếm được 8 lượt quét
-- mang mã `PRODSMOKE…` nằm ngay trong danh sách "quét gần nhất" của cổng
-- Tràng An — nhân viên cổng đọc thấy, và đối soát cuối ca (TC-21) đếm luôn
-- chúng vào số lượt bị từ chối. Tất cả sinh ra ngày 01–02/08/2026.
--
-- Thủ phạm là `tests/e2e/prod-smoke-field-reports-and-gate-scans.spec.ts`.
-- Bài ấy đã bị chặn chạy trên production cùng lượt với migration này, nên
-- dọn một lần là xong, không mọc lại.
--
-- CHỈ dọn hai bảng lá, không đụng tài khoản nhân viên:
--
--   * `erp_gate_scan_events` — một khoá ngoại duy nhất trỏ vào bảng này là
--     `erp_gate_offline_sync_items.scan_event_id`, khai `on delete restrict`.
--     Lượt quét `PRODSMOKE` là quét trực tuyến nên không có hàng đồng bộ nào
--     trỏ tới; nếu lỡ có thì câu xoá tự hỏng và cả giao dịch cuộn lại, không
--     xoá nửa vời.
--   * `erp_field_operation_reports` — không bảng nào trỏ khoá ngoại vào.
--     Ảnh đính kèm nằm ở kho tệp, không nằm trong hàng; xoá hàng thì tệp ảnh
--     1×1 điểm ảnh ấy vẫn còn trong kho — vô hại, cố ý để nguyên vì xoá tệp
--     bằng SQL không xoá được tệp thật.
--
-- Tài khoản `qa-t6b-check-…` và `qa-t14b-…` KHÔNG dọn ở đây, cố ý: dự án
-- không có đường xoá tài khoản vì tài khoản giữ vết kiểm toán, và hai bài
-- smoke tạo ra chúng đã thu hồi chúng đúng luật. Chỗ sai là màn hình danh bạ
-- vẫn liệt kê — sửa ở tầng đọc, xem hàng QA-RESIDUE-02 trong docs/HANDOFF.md.
--
-- Vị từ bám đúng dấu mà bài smoke tự gõ vào, không theo khoảng thời gian.
-- Chạy lại lần nữa thì không xoá thêm hàng nào.
--
-- Đếm trước khi áp, để người áp tự đối chiếu với con số 8 ở trên:
--
--   select count(*) from public.erp_gate_scan_events
--   where code ~ '^PRODSMOKE[0-9]{13}$';
--
--   select count(*) from public.erp_field_operation_reports
--   where finance_code = 'PROD-SMOKE-CODE'
--     and task ~ '^Kiểm tra máy quét PROD-SMOKE-[0-9]{13}$';

begin;

delete from public.erp_gate_scan_events
where code ~ '^PRODSMOKE[0-9]{13}$';

delete from public.erp_field_operation_reports
where finance_code = 'PROD-SMOKE-CODE'
  and task ~ '^Kiểm tra máy quét PROD-SMOKE-[0-9]{13}$';

commit;
