-- WEB-PLAN-04 · 05/09/2026
--
-- Bộ canh dữ liệu cá nhân đang bắt nhầm định danh cơ sở, và vì thế
-- **/plan chưa bao giờ lưu được một lịch trình nào trên production**.
--
-- Đo thật, không suy đoán. Dựng đúng payload mà `/plan` gửi đi khi khách bấm
-- "Xác nhận và tạo hành trình" với chính "Ví dụ 1" in sẵn trên trang, rồi hỏi
-- thẳng cơ sở dữ liệu:
--
--   intent_summary      → không bị chặn
--   itinerary_snapshot  → BỊ CHẶN
--   riêng "10000000-0000-4000-8000-000000000001" → BỊ CHẶN
--
-- Luật số điện thoại là `(^|[^0-9])(\+?84|0)[0-9 .-]{8,12}($|[^0-9])`. Trong
-- một UUID có dấu gạch, đoạn `-0000-4000` thừa sức khớp: gạch nối là ký tự
-- không phải chữ số nên mở được vế đầu, `0` mở thân, rồi tám ký tự tiếp theo
-- đều nằm trong `[0-9 .-]`. Mọi `site_id` trong lịch trình vì thế bị coi là số
-- điện thoại Việt Nam, và cả hành trình bị từ chối với
-- `CUSTOMER_JOURNEY_PII_FORBIDDEN`. Khách chỉ thấy trang đứng im.
--
-- Đây là **lần thứ hai** cùng một cái bẫy: TC-22 đã vấp đúng nó khi nhét
-- `site_id` vào metadata sổ tiền, và lần ấy né bằng cách bỏ trường đó ra. Ở
-- đây không né được — `site_id` chính là nội dung của một lịch trình.
--
-- ⚠ Vì sao KHÔNG nới luật số điện thoại: nó đang làm đúng việc. Nới ra để lọt
-- một UUID thì cũng lọt luôn những chuỗi số thật sự là số điện thoại. Thay vào
-- đó **miễn trừ đúng một hình dạng**: chuỗi nào là UUID trọn vẹn từ đầu tới
-- cuối thì không phải số điện thoại — không số điện thoại nào trên đời có dạng
-- 8-4-4-4-12 chữ cái hệ mười sáu ngăn bằng gạch nối. Miễn trừ phải neo hai
-- đầu (`^...$`): một UUID nằm lẫn trong câu văn thì vẫn soi như thường, vì
-- phần còn lại của câu có thể đang giấu một số điện thoại thật.
--
-- An toàn khi thay hàm: 20 ràng buộc CHECK đang gọi nó, **không index nào**
-- (đã query `pg_indexes`), nên không có nguy cơ hỏng chỉ mục. Thay đổi chỉ
-- NỚI RA — thứ trước đây bị chặn nay có thể lọt, còn thứ trước đây lọt thì vẫn
-- lọt. Nên mọi hàng đang có vẫn thoả ràng buộc, không cần kiểm lại hàng nào.
--
-- Thân hàm dưới đây lấy nguyên văn `pg_get_functiondef` đọc từ production
-- ngày 05/09/2026, chỉ thêm đúng khối miễn trừ. Đã đối chiếu với
-- `202608180039_customer_data_backbone.sql`: không lệch một chữ.

begin;

create or replace function public.customer_json_contains_pii(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_child jsonb;
  v_text text;
begin
  if p_value is null then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from pg_catalog.jsonb_each(p_value)
    loop
      if lower(v_key) ~ '(email|e_mail|phone|mobile|telephone|full_?name|first_?name|last_?name|contact|address|raw_?text|prompt|message)' then
        return true;
      end if;
      if public.customer_json_contains_pii(v_child) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_child in select value from pg_catalog.jsonb_array_elements(p_value)
    loop
      if public.customer_json_contains_pii(v_child) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    v_text := p_value #>> '{}';

    -- Miễn trừ duy nhất, neo hai đầu: một UUID trọn vẹn là định danh, không
    -- phải số điện thoại. Chuỗi có UUID lẫn trong câu văn KHÔNG được miễn.
    if v_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;

    if v_text ~* '(^|[^[:alnum:]._%+-])[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}($|[^[:alnum:]._%+-])'
       or v_text ~ '(^|[^0-9])(\+?84|0)[0-9 .-]{8,12}($|[^0-9])' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

commit;
