-- 117 — Trợ lý ghi việc nhận thêm bộ hiểu "ai".
--
-- Chủ dự án 08/10/2026 có khoá Gemini miễn phí. `lib/erp/tro-ly-hieu.ts` nay
-- hỏi một mô hình theo chuẩn OpenAI (mặc định Gemini; Groq, OpenRouter, Ollama
-- cũng được) khi có `AI_API_KEY`, nên bản nháp lưu lại mang `bo_hieu = 'ai'`.
-- Chỉ nới ràng buộc của cột; không đổi dữ liệu nào.

begin;

alter table public.erp_viec_ghi drop constraint if exists erp_viec_ghi_bo_hieu_check;
alter table public.erp_viec_ghi
  add constraint erp_viec_ghi_bo_hieu_check
  check (bo_hieu is null or bo_hieu in ('luat', 'claude', 'ai'));

commit;
