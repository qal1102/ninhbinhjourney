-- ERP thấy mọi đoàn, từ web lẫn từ quầy (13/10/2026).
--
-- Chủ dự án 13/10: "vé group ở ngoài web và ở trong thì sao, logic lại giúp
-- tao giống như ở ngoài đi, và ở đâu thì web cũng phải sync với trong ERP ra
-- nhé chứ không hiển thị trong ERP thì chịu đấy."
--
-- Đoàn web (trưởng đoàn tạo mã sau khi đặt, `order_id`) và đoàn quầy (bán ở ô
-- Vé đoàn, `ticket_id`) vốn cùng nằm ở `erp_visitor_groups` và cùng trang
-- trưởng đoàn `/doan/truong/<mã>`, nhưng ERP không có chỗ nào liệt kê. Hàm
-- này trả danh sách cả hai nguồn theo ngày đi, cùng những con số trang trưởng
-- đoàn hiện: số người, đã ghi tên, đã mở mã riêng, cần chăm sóc, đã qua cổng.
-- Số điện thoại trưởng đoàn chỉ hiện ba số cuối.

begin;

create or replace function public.erp_danh_sach_doan(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_tu date,
  p_den date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
begin
  if not (
    public.erp_account_has_active_role(p_tenant_id, v_actor, 'director', null)
    or exists (
      select 1 from public.erp_account_role_assignments a
      where a.tenant_id = p_tenant_id and a.account_id = v_actor and a.role = 'manager' and a.status = 'active'
    )
  ) then
    raise exception using errcode = '42501', message = 'DOAN_ROLE_REQUIRED';
  end if;
  if p_tu is null or p_den is null or p_den < p_tu or p_den - p_tu > 120 then
    raise exception using errcode = '22023', message = 'DOAN_INPUT_INVALID';
  end if;

  return coalesce((
    with doan as (
      select
        g.*,
        case when g.order_id is not null then 'web' else 'quay' end as nguon,
        coalesce(o.visit_date, t.valid_on) as ngay_di,
        o.order_code,
        o.total_vnd as tien_web,
        sale.sale_code,
        sale.total_vnd as tien_quay,
        sale.discount_percent,
        sale.invoice_requested,
        sale.status as sale_status,
        cty.name as cong_ty
      from public.erp_visitor_groups g
      left join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id
      left join public.erp_tickets t on t.id = g.ticket_id and t.tenant_id = g.tenant_id
      left join lateral (
        select s.* from public.erp_counter_sale_lines line
        join public.erp_counter_sales s on s.id = line.sale_id and s.tenant_id = line.tenant_id
        where line.tenant_id = g.tenant_id and line.ticket_id = g.ticket_id
        limit 1
      ) sale on true
      left join public.erp_travel_companies cty on cty.id = sale.travel_company_id and cty.tenant_id = g.tenant_id
      where g.tenant_id = p_tenant_id
    ),
    ve as (
      -- Vé của đoàn: đoàn quầy một tấm cho cả đoàn, đoàn web là các vé của đơn.
      select d.id as group_id, tk.id, tk.ticket_code, tk.site_id, tk.entries_used, tk.entries_allowed, tk.status
      from doan d
      join public.erp_tickets tk on tk.tenant_id = p_tenant_id and tk.id = d.ticket_id
      union all
      select d.id, tk.id, tk.ticket_code, tk.site_id, tk.entries_used, tk.entries_allowed, tk.status
      from doan d
      join public.customer_order_tickets bridge on bridge.tenant_id = p_tenant_id and bridge.order_id = d.order_id
      join public.erp_tickets tk on tk.tenant_id = p_tenant_id and tk.id = bridge.ticket_id
    )
    select jsonb_agg(jsonb_build_object(
      'group_code', d.group_code,
      'group_label', d.group_label,
      'leader_name', d.leader_name,
      'leader_phone', case when coalesce(d.leader_phone, '') = '' then null
        else '•••' || right(regexp_replace(d.leader_phone, '[^0-9]', '', 'g'), 3) end,
      'nguon', d.nguon,
      'ngay_di', d.ngay_di,
      'order_code', d.order_code,
      'sale_code', d.sale_code,
      'sale_status', d.sale_status,
      'cong_ty', d.cong_ty,
      'giam_phan_tram', d.discount_percent,
      'hoa_don', coalesce(d.invoice_requested, false),
      'tien_vnd', coalesce(d.tien_web, d.tien_quay),
      'so_nguoi', d.member_count,
      'ghi_ten', (select count(*) from public.erp_visitor_group_members m where m.group_id = d.id and trim(m.display_name) <> ''),
      'mo_ma', (select count(*) from public.erp_visitor_group_members m where m.group_id = d.id and m.activated_at is not null),
      'cham_soc', (select count(*) from public.erp_visitor_group_members m where m.group_id = d.id and m.care_need <> 'none'),
      'qua_cong', least(d.member_count, coalesce((select sum(v.entries_used) from ve v where v.group_id = d.id), 0)),
      'diem', coalesce((
        select jsonb_agg(distinct site.name) from ve v join public.sites site on site.id = v.site_id where v.group_id = d.id
      ), '[]'::jsonb),
      've', coalesce((select jsonb_agg(v.ticket_code order by v.ticket_code) from ve v where v.group_id = d.id), '[]'::jsonb),
      'tao_luc', d.created_at
    ) order by d.ngay_di desc, d.created_at desc)
    from doan d
    where d.ngay_di between p_tu and p_den
  ), '[]'::jsonb);
end;
$ham$;

revoke all on function public.erp_danh_sach_doan(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.erp_danh_sach_doan(uuid, text, date, date) to service_role;

commit;
