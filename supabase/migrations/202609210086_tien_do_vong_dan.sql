-- Mạch dẫn (giai đoạn 3) · 21/09/2026
--
-- Nhớ giúp người dùng họ đang đi tới chặng nào của vòng dẫn.
--
-- ## Vì sao không để trong trình duyệt
--
-- Chủ dự án xem hệ thống bằng cả điện thoại lẫn máy bàn. Để trong trình duyệt
-- thì mỗi máy một trí nhớ: đi nửa vòng trên điện thoại, mở máy bàn ra lại thấy
-- vòng dẫn chào từ đầu như chưa từng gặp. Tệ hơn, ý "lần đầu đăng nhập thì
-- phải chỉ việc đầu tiên nên làm" sẽ sai — xoá dữ liệu trình duyệt một cái là
-- người dùng lâu năm bỗng thành người mới.
--
-- ## Bảng này cố ý nhỏ và nhạt
--
-- Nó không giữ gì về nghiệp vụ: không tiền, không khách, không hồ sơ. Đúng ba
-- thứ — đang ở chặng mấy, đã đi hết chưa, có bấm bỏ qua không. Mất sạch bảng
-- này thì hậu quả lớn nhất là vòng dẫn chào lại từ đầu.
--
-- ## Một người một vòng một hàng
--
-- Khoá chính `(tenant_id, account_id, vong_id)` để sau này thêm vòng dẫn thứ
-- hai (cho quản lý, cho kế toán) không phải đụng lại schema. Ghi bằng upsert
-- nên bấm nhanh hai lần không đẻ ra hai hàng.
--
-- ## Chặng chỉ được tiến, không được lùi ngầm
--
-- `chang_hien_tai` lấy giá trị lớn hơn giữa cũ và mới. Người dùng lỡ tải lại
-- trang giữa chừng, hoặc một nhịp mạng tới muộn mang theo số chặng cũ, thì vòng
-- dẫn không bị kéo ngược về chặng 2 trong khi họ đang đọc chặng 5. Muốn đi lại
-- từ đầu thì có đường riêng: `p_di_lai`.

begin;

create table if not exists public.erp_huong_dan_tien_do (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Cùng kiểu với `actor_account_id` ở các bảng nhật ký khác: tài khoản ERP là
  -- chuỗi, không phải người dùng auth của Supabase.
  account_id text not null check (char_length(trim(account_id)) between 1 and 120),
  vong_id text not null check (char_length(trim(vong_id)) between 1 and 60),
  chang_hien_tai integer not null default 1 check (chang_hien_tai between 1 and 50),
  da_xong_at timestamptz,
  bo_qua_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, account_id, vong_id)
);

alter table public.erp_huong_dan_tien_do enable row level security;

-- 1. Đọc tiến độ của đúng một người, đúng một vòng.
--
-- Chưa có hàng thì trả về trạng thái "chưa từng đi", chứ không trả null —
-- màn hình gọi hàm này lúc dựng trang và không được phép vỡ vì thiếu hàng.
create or replace function public.erp_doc_tien_do_huong_dan(
  p_tenant_id uuid,
  p_account_id text,
  p_vong_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account text := trim(coalesce(p_account_id, ''));
  v_vong text := trim(coalesce(p_vong_id, ''));
  v_hang public.erp_huong_dan_tien_do;
begin
  if p_tenant_id is null or v_account = '' or v_vong = '' then
    raise exception using errcode = '22023', message = 'HUONG_DAN_INPUT_INVALID';
  end if;

  select * into v_hang
  from public.erp_huong_dan_tien_do
  where tenant_id = p_tenant_id and account_id = v_account and vong_id = v_vong;

  if not found then
    return jsonb_build_object(
      'chang_hien_tai', 1,
      'da_xong', false,
      'bo_qua', false,
      'tung_di', false
    );
  end if;

  return jsonb_build_object(
    'chang_hien_tai', v_hang.chang_hien_tai,
    'da_xong', v_hang.da_xong_at is not null,
    'bo_qua', v_hang.bo_qua_at is not null,
    'tung_di', true
  );
end;
$$;

-- 2. Ghi tiến độ.
--
-- Một hàm cho cả ba việc (đi tiếp, đi hết, bỏ qua) vì chúng luôn ghi vào cùng
-- một hàng; tách ba hàm chỉ tạo ba đường cùng sửa một chỗ.
create or replace function public.erp_ghi_tien_do_huong_dan(
  p_tenant_id uuid,
  p_account_id text,
  p_vong_id text,
  p_chang integer,
  p_xong boolean,
  p_bo_qua boolean,
  p_di_lai boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account text := trim(coalesce(p_account_id, ''));
  v_vong text := trim(coalesce(p_vong_id, ''));
  v_chang integer := coalesce(p_chang, 1);
  v_di_lai boolean := coalesce(p_di_lai, false);
begin
  if p_tenant_id is null or v_account = '' or v_vong = '' then
    raise exception using errcode = '22023', message = 'HUONG_DAN_INPUT_INVALID';
  end if;
  if v_chang < 1 or v_chang > 50 then
    raise exception using errcode = '22023', message = 'HUONG_DAN_CHANG_INVALID';
  end if;

  -- Đi lại từ đầu: xoá sạch dấu vết cũ của đúng vòng này, rồi ghi như mới.
  -- Không đụng tới vòng khác và không đụng tới người khác.
  if v_di_lai then
    insert into public.erp_huong_dan_tien_do
      (tenant_id, account_id, vong_id, chang_hien_tai, da_xong_at, bo_qua_at, updated_at)
    values (p_tenant_id, v_account, v_vong, 1, null, null, now())
    on conflict (tenant_id, account_id, vong_id) do update
      set chang_hien_tai = 1,
          da_xong_at = null,
          bo_qua_at = null,
          updated_at = now();
  else
    insert into public.erp_huong_dan_tien_do
      (tenant_id, account_id, vong_id, chang_hien_tai, da_xong_at, bo_qua_at, updated_at)
    values (
      p_tenant_id,
      v_account,
      v_vong,
      v_chang,
      case when coalesce(p_xong, false) then now() else null end,
      case when coalesce(p_bo_qua, false) then now() else null end,
      now()
    )
    on conflict (tenant_id, account_id, vong_id) do update
      set chang_hien_tai = greatest(public.erp_huong_dan_tien_do.chang_hien_tai, excluded.chang_hien_tai),
          da_xong_at = coalesce(public.erp_huong_dan_tien_do.da_xong_at, excluded.da_xong_at),
          bo_qua_at = coalesce(public.erp_huong_dan_tien_do.bo_qua_at, excluded.bo_qua_at),
          updated_at = now();
  end if;

  return public.erp_doc_tien_do_huong_dan(p_tenant_id, v_account, v_vong);
end;
$$;

revoke all on function public.erp_doc_tien_do_huong_dan(uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_doc_tien_do_huong_dan(uuid, text, text) to service_role;

revoke all on function public.erp_ghi_tien_do_huong_dan(uuid, text, text, integer, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.erp_ghi_tien_do_huong_dan(uuid, text, text, integer, boolean, boolean, boolean) to service_role;

commit;
