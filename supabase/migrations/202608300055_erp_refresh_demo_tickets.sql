-- Vé mẫu để thử cổng: cho phép kéo về hôm nay.
--
-- ## Vì sao có
--
-- Chủ dự án mở ERP ngày 30/08 để thử soát vé và không thử được. Lý do đo ra
-- được ngay: production có đúng **8 tấm vé**, và cả 8 đều `valid_on =
-- 02/08/2026` — đã qua bốn tuần. Quét tấm nào cũng ra "Vé không dùng cho hôm
-- nay". Hàm quét đúng; **dữ liệu trình diễn thì đã chết**.
--
-- Đây là cùng một lớp lỗi đã sửa một lần ở ERP-SMOKE-02: một mốc thời gian neo
-- cứng trong dữ liệu mẫu, đúng vào ngày seed và sai mọi ngày sau đó.
--
-- ## Vì sao là một nút bấm, không phải một phép màu
--
-- Cách "tự trôi ngày" thì phải sửa cột lúc đọc, mà cổng lại đọc thẳng cột đó
-- để quyết định cho khách vào — đụng vào chỗ ấy để phục vụ việc thử là đổi
-- hành vi của một cái cổng đang chạy thật. Không đáng.
--
-- Nên: một hàm, giám đốc bấm khi cần. Rõ ràng, nhìn thấy được, bấm lại bao
-- nhiêu lần cũng ra cùng một kết quả.
--
-- ## Ranh giới: chỉ chạm đúng 8 tấm vé mẫu
--
-- Vé bán qua web mang mã `WEB-` + 12 ký tự. Tám vé mẫu mang mã dạng
-- `TA-2026-000101` — hai hoặc ba chữ cái, năm, rồi sáu chữ số. Hai dạng này
-- **không thể trùng nhau**, nên điều kiện lọc theo dạng mã là hàng rào cứng:
-- hàm này không có cách nào chạm tới một tấm vé khách thật đã mua.
--
-- Cố ý **không** lọc theo `channel`: ba trong tám vé mẫu mang `channel =
-- 'website'`, nên lọc theo kênh sẽ bỏ sót đúng những tấm hay dùng để thử nhất.

begin;

create or replace function public.erp_refresh_demo_tickets(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_codes text[];
begin
  -- Chi giam doc. Day la hanh dong doi du lieu, khong phai mot lan doc.
  if not public.erp_account_has_active_role(
       p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null
     ) then
    raise exception using errcode = '42501', message = 'DEMO_TICKET_REFRESH_DIRECTOR_ONLY';
  end if;

  update public.erp_tickets set
    valid_on = v_today,
    entries_used = 0,
    status = 'issued',
    updated_at = now()
  where tenant_id = p_tenant_id
    -- Hang rao cung: chi dung dang ma cua ve mau. Ve ban qua web la 'WEB-' +
    -- 12 ky tu nen khong bao gio khop.
    and ticket_code ~ '^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$';

  -- Doc lai sau khi cap nhat, thay vi `returning` — `returning` cua mot lenh
  -- update nhieu dong khong gom duoc vao mot mang trong plpgsql.
  select array_agg(ticket_code order by ticket_code) into v_codes
  from public.erp_tickets
  where tenant_id = p_tenant_id
    and ticket_code ~ '^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$'
    and valid_on = v_today;

  return jsonb_build_object(
    'valid_on', v_today,
    'ticket_count', coalesce(array_length(v_codes, 1), 0),
    'ticket_codes', coalesce(to_jsonb(v_codes), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.erp_refresh_demo_tickets(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.erp_refresh_demo_tickets(
  uuid, text
) to service_role;

commit;
