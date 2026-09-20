-- TC-13 (mục 2–3) · 21/09/2026
--
-- Hôm nay ai cần để ý — một bản đọc cho phòng điều hành, không phải một cái
-- chuông reo vào điện thoại nhân viên.
--
-- ## Vì sao không gửi thẳng cho người ở cổng
--
-- Người đứng cổng không cầm điện thoại trong giờ làm. Thiết kế "đẩy thông báo
-- tới từng nhân viên" là thiết kế cho người ngồi bàn giấy: nó trông hiện đại,
-- và nó không tới được đúng người. Ở đây ca trực đọc một bảng duy nhất trên
-- máy của phòng, rồi đọc lên bộ đàm — đúng cách họ vốn làm việc.
--
-- ## Thu ít nhất có thể, và chỉ thu thứ khách tự khai
--
-- Nhu cầu chăm sóc là do khách **tự chọn** trong ô của mình (`care_need`, có
-- từ migration `056`). Hàm này không suy diễn gì thêm: không đoán tuổi từ giá
-- vé, không đoán "người cao tuổi" từ nhóm vé, không đụng tới `customer_identities`.
--
-- Trả về đúng thứ ca trực cần để nói được một câu lên bộ đàm: đoàn nào, mấy
-- giờ tới, cần để ý mấy người và kiểu gì, người ấy đã qua cổng chưa, và số
-- trưởng đoàn để gọi khi cần. **Không** trả tên từng thành viên chưa tự khai,
-- vì phần lớn ô tên vốn để trống và một cái tên rỗng chẳng giúp ai.
--
-- ## Một đoàn đến từ hai đường
--
-- Đoàn web treo vào `order_id`, đoàn quầy treo vào `ticket_id` (migration
-- `063` đã mở đường thứ hai). Cả hai đều phải hiện ở bảng ca trực, nếu không
-- thì đúng những đoàn mua ngay tại cổng — nhóm dễ có người già đi cùng nhất —
-- lại là nhóm ca trực không thấy.
--
-- ## Chỉ đọc
--
-- Không tạo bảng, không ghi, không thêm cột. Mọi dữ liệu đã nằm sẵn từ TC-06
-- và TC-15; việc còn thiếu chỉ là một đường đọc đúng chiều.

begin;

create or replace function public.erp_ca_truc_can_de_y(
  p_tenant_id uuid,
  p_site_id uuid,
  p_visit_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_tenant_id is null or p_site_id is null or p_visit_date is null then
    raise exception using errcode = '22023', message = 'CA_TRUC_INPUT_INVALID';
  end if;

  select coalesce(jsonb_agg(x order by x.gio_toi nulls last, x.group_code), '[]'::jsonb)
  into v_rows
  from (
    select g.group_code,
           g.group_label,
           g.leader_name,
           g.leader_phone,
           g.member_count,
           case when g.order_id is not null then 'web' else 'quay' end as nguon,
           nguon_doan.gio_toi,
           can_de_y.so_nguoi,
           can_de_y.danh_sach
    from public.erp_visitor_groups g
    join lateral (
      -- Đoàn web: nơi và giờ lấy từ chính tấm vé của đơn tại cơ sở này.
      -- Đoàn quầy: lấy thẳng từ vé quầy, và vé quầy không có khung giờ.
      select cot.site_id, slot.starts_at as gio_toi
      from public.customer_order_tickets cot
      join public.customer_orders o
        on o.id = cot.order_id and o.tenant_id = cot.tenant_id
      left join public.customer_booking_slots slot
        on slot.id = cot.slot_id and slot.tenant_id = cot.tenant_id
      where g.order_id is not null
        and cot.order_id = g.order_id
        and cot.tenant_id = g.tenant_id
        and o.status = 'confirmed'
        and o.visit_date = p_visit_date
      union all
      select t.site_id, null::timestamptz as gio_toi
      from public.erp_tickets t
      where g.ticket_id is not null
        and t.id = g.ticket_id
        and t.tenant_id = g.tenant_id
        and t.status <> 'void'
        and t.valid_on = p_visit_date
    ) nguon_doan on nguon_doan.site_id = p_site_id
    join lateral (
      select count(*) as so_nguoi,
             jsonb_agg(jsonb_build_object(
               'member_index', m.member_index,
               'care_need', m.care_need,
               -- Tên chỉ có khi chính khách tự khai; rỗng là trạng thái bình
               -- thường và ca trực gọi theo số thứ tự trong đoàn.
               'display_name', m.display_name,
               'da_vao', exists (
                 select 1
                 from public.erp_gate_scan_events event
                 where event.tenant_id = m.tenant_id
                   and event.member_id = m.id
                   and event.site_id = p_site_id
                   and event.result = 'accepted'
                   and (event.scanned_at at time zone 'Asia/Ho_Chi_Minh')::date = p_visit_date
               )
             ) order by m.member_index) as danh_sach
      from public.erp_visitor_group_members m
      where m.tenant_id = g.tenant_id
        and m.group_id = g.id
        and m.care_need <> 'none'
    ) can_de_y on can_de_y.so_nguoi > 0
    where g.tenant_id = p_tenant_id
  ) x;

  return v_rows;
end;
$$;

revoke all on function public.erp_ca_truc_can_de_y(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.erp_ca_truc_can_de_y(uuid, uuid, date) to service_role;

commit;
