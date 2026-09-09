-- GATE-OFFLINE-02: bản kê quét ngoại tuyến bỏ sót cả đoàn mua tại quầy.
--
-- ## Chuyện thật ở cổng
--
-- Nhân viên quầy lập một phiếu đoàn 45 người, đưa khách bộ mã QR riêng từng
-- người (`TV-…`). Xe tới cổng đúng lúc sóng rớt. Máy quét chuyển sang đối
-- chiếu bản kê đã tải sẵn: mã VÉ của đoàn (`QUAY-…`) vẫn qua, nhưng cả 45 mã
-- `TV-…` đều báo "không có trong danh sách". Cả đoàn đứng ngoài cổng, còn
-- nhân viên thì không hiểu vì sao cùng một tấm phiếu mà lúc có mạng thì được,
-- lúc mất mạng lại không.
--
-- ## Vì sao thiếu — đọc thẳng trong mã, không đoán
--
-- `public.erp_prepare_offline_gate_manifest` (bản đang chạy nằm ở
-- `202608310057_customer_pay_on_site.sql`, mục 6) ráp mã thành viên bằng đúng
-- một đường:
--
--     join public.customer_order_tickets bridge
--       on bridge.order_id = grp.order_id and bridge.tenant_id = grp.tenant_id
--       and bridge.guest_group = member.guest_group
--
-- Đường ấy đi qua đơn web. Còn đoàn quầy, dựng ở
-- `202609060063_erp_counter_visitor_groups.sql`, treo thẳng vào MỘT tấm vé:
-- hàng `erp_visitor_groups` của nó chỉ có `ticket_id`, `order_id` để trống,
-- và không hề có hàng `customer_order_tickets` nào — quầy phát vé tại chỗ,
-- không đi qua `customer_orders`. Nên nhánh trên trả về 0 hàng cho mọi đoàn
-- quầy, mọi lần.
--
-- Nhánh TRỰC TUYẾN đã được vá đúng ở migration 063 (`erp_gate_scan_ticket_at`:
-- thử `g.ticket_id` trước, có thì dùng thẳng tấm vé đó, không tách theo
-- `guest_group` vì quầy không bán vé trẻ em riêng). Migration 063 tự ghi rõ ở
-- đầu tệp là nhánh ngoại tuyến chưa được vá theo, để tránh chạm cùng lúc vào
-- phần TC-16/TC-21 đang làm song song. Đây là lượt vá còn thiếu ấy.
--
-- ## Sửa đúng một chỗ
--
-- Lấy nguyên thân hàm ở 057 làm nền, thêm đúng MỘT nhánh `union all` thứ ba
-- vào CTE `moi_ma`: thành viên của đoàn có `ticket_id` trỏ thẳng tới một tấm
-- vé đang nằm trong `ve_con_hieu_luc`, và chưa từng có lượt quét `accepted`
-- cho đúng cặp (người ấy, tấm vé ấy). Mọi thứ còn lại giữ nguyên từng dòng:
-- hàng rào TC-22 (vé còn nợ tiền không phát ra ngoại tuyến), `v_service_date`,
-- `v_expires_at`, cách băm mã, phần `insert` bản kê, `revoke`/`grant`.
--
-- Chữ ký giữ nguyên đúng bốn tham số `(uuid, uuid, text, uuid)`. Đổi một chữ
-- trong chữ ký là sinh ra hàm nạp chồng thứ hai chứ không phải thay thế —
-- cái bẫy đã sập một lần trong dự án này.
--
-- ## Vì sao KHÔNG đếm trùng một mã thành viên
--
-- Lo ngại đúng: một đoàn vừa có `order_id` vừa có `ticket_id` thì mã của
-- người trong đoàn ấy khớp cả nhánh 2 lẫn nhánh 3, và `union all` không dọn
-- trùng. Trường hợp đó không tồn tại được: migration 063 đã đặt ràng buộc
--
--     erp_visitor_groups_origin_xor_check check (num_nonnulls(order_id, ticket_id) = 1)
--
-- nên mỗi hàng đoàn có đúng một nguồn gốc, không bao giờ hai. Ràng buộc ấy
-- được PostgreSQL quét toàn bảng lúc thêm, nên nó đúng cho cả hàng cũ.
--
-- Không dựa vào một mình ràng buộc: nhánh mới còn ghi thẳng `grp.order_id is
-- null`. Với ràng buộc đang có thì mệnh đề ấy luôn đúng, không đổi một hàng
-- kết quả nào; nó ở đây để nếu một phiên sau lỡ nới ràng buộc, nhánh mới vẫn
-- tự nhường đoàn web cho nhánh cũ thay vì lặng lẽ phát ra hai mã. Đổi
-- `union all` thành `union` KHÔNG phải cách chặn: `union` sẽ dọn nhầm cả hai
-- người khác nhau tình cờ cùng số lượt còn lại — mà mã thành viên là duy nhất
-- nên chuyện đó xảy ra thường xuyên, và bản kê sẽ thiếu người.
--
-- ## Vé quầy và hàng rào tiền của TC-22
--
-- Vé quầy không có cầu nối `customer_order_tickets` nào, nên câu `not exists`
-- của TC-22 tự nhiên không khớp hàng nào và vé quầy luôn được phát ra bản kê.
-- Đúng thực tế: quầy thu tiền ngay lúc bán, không có khái niệm "nợ rồi thu
-- sau". Giống hệt nhánh trực tuyến, nơi `v_payment_due` giữ nguyên 0.
--
-- ## Đo được gì
--
-- Đọc thẳng ba tệp migration (045, 057, 063) chứ không đoán: chỉ có đúng một
-- đường ráp mã thành viên trong bản kê, và nó đi qua `customer_order_tickets`;
-- hàm tạo đoàn quầy chèn `erp_visitor_groups` với `ticket_id`, không có
-- `order_id`; ràng buộc xor có thật và nằm ngoài mọi thân hàm. Bài kiểm hợp
-- đồng `tests/security/erp-offline-manifest-counter-groups-migration-contract.test.ts`
-- canh giữ ba điều này, và đã được thử đột biến hai lần (bỏ nhánh mới, đổi
-- `union all` thành `union`) — cả hai lần đều đỏ đúng chỗ.
--
-- Nói thẳng cái CHƯA chứng minh: migration này chưa chạy trên PostgreSQL thật,
-- chưa ai lập một phiếu đoàn quầy rồi rút mạng quét thử. Bài kiểm đọc chuỗi
-- SQL, không chạy nó.
--
-- ## Chỉ tiến tới
--
-- Production không có PITR, không có bản sao lưu vật lý. Migration này chỉ có
-- đúng một câu lệnh `create or replace function` cùng cặp `revoke`/`grant`
-- khôi phục nguyên trạng quyền. Không `drop` một thứ gì, không `update` một
-- hàng dữ liệu nào, không đụng tới bảng nào.

begin;

create or replace function public.erp_prepare_offline_gate_manifest(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest_id uuid := gen_random_uuid();
  v_service_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_expires_at timestamptz;
  v_tickets jsonb;
  v_count integer;
  v_digest text;
begin
  if p_device_id is null or not public.erp_gate_actor_can_scan(p_tenant_id, p_site_id, p_actor_account_id) then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  v_expires_at := least(
    now() + interval '12 hours',
    ((v_service_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  );

  with ve_con_hieu_luc as (
    select ticket.id, upper(trim(ticket.ticket_code)) as ma,
           ticket.entries_allowed - ticket.entries_used as con_lai
    from public.erp_tickets ticket
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = p_site_id
      and ticket.valid_on = v_service_date
      and ticket.status in ('issued', 'partially-used')
      and ticket.entries_used < ticket.entries_allowed
      -- TC-22: ve con no tien thi khong phat ra ngoai tuyen. Doc y het cach
      -- cua o quet: co hang cho thu, va chua co hang da thu nao cho don do.
      --
      -- Ve doan quay khong co hang cau noi nao, nen cau nay khong khop gi va
      -- ve quay luon duoc phat ra — dung thuc te: quay thu tien ngay luc ban.
      and not exists (
        select 1
        from public.customer_order_tickets bridge
        join public.customer_payment_attempts cho_thu
          on cho_thu.order_id = bridge.order_id
         and cho_thu.tenant_id = bridge.tenant_id
         and cho_thu.mode = 'pay-on-site'
         and cho_thu.status = 'pending'
        where bridge.ticket_id = ticket.id
          and bridge.tenant_id = ticket.tenant_id
          and not exists (
            select 1 from public.customer_payment_attempts da_thu
            where da_thu.order_id = bridge.order_id
              and da_thu.tenant_id = bridge.tenant_id
              and da_thu.mode = 'pay-on-site'
              and da_thu.status = 'succeeded'
          )
      )
  ),
  moi_ma as (
    select ma, con_lai from ve_con_hieu_luc
    union all
    -- Ma thanh vien chua dung, thuoc dung tam ve cua nhom chieu cao cua ho.
    select member.member_code, ve.con_lai
    from public.erp_visitor_group_members member
    join public.erp_visitor_groups grp
      on grp.id = member.group_id and grp.tenant_id = member.tenant_id
    join public.customer_order_tickets bridge
      on bridge.order_id = grp.order_id and bridge.tenant_id = grp.tenant_id
      and bridge.guest_group = member.guest_group
    join ve_con_hieu_luc ve on ve.id = bridge.ticket_id
    where member.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.erp_gate_scan_events event
        where event.tenant_id = member.tenant_id
          and event.member_id = member.id
          and event.ticket_id = ve.id
          and event.result = 'accepted'
      )
    union all
    -- GATE-OFFLINE-02: doan mua tai quay treo thang vao MOT tam ve, khong qua
    -- don web. Khong tach theo `guest_group` vi quay khong ban ve tre em rieng
    -- — dung y het nhanh truc tuyen o migration 063.
    --
    -- `grp.order_id is null` la thua duoi rang buoc
    -- `erp_visitor_groups_origin_xor_check` (moi doan dung mot nguon goc), nen
    -- no khong doi mot hang ket qua nao. No o day de neu mot phien sau lo noi
    -- rang buoc, nhanh nay tu nhuong doan web cho nhanh tren thay vi phat ra
    -- hai lan cung mot ma.
    select member.member_code, ve.con_lai
    from public.erp_visitor_group_members member
    join public.erp_visitor_groups grp
      on grp.id = member.group_id and grp.tenant_id = member.tenant_id
    join ve_con_hieu_luc ve on ve.id = grp.ticket_id
    where member.tenant_id = p_tenant_id
      and grp.order_id is null
      and not exists (
        select 1 from public.erp_gate_scan_events event
        where event.tenant_id = member.tenant_id
          and event.member_id = member.id
          and event.ticket_id = ve.id
          and event.result = 'accepted'
      )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code_digest', encode(extensions.digest(ma, 'sha256'), 'hex'),
      'entries_remaining', con_lai
    ) order by ma), '[]'::jsonb),
    count(*)::integer
  into v_tickets, v_count
  from moi_ma;

  v_digest := encode(extensions.digest(v_tickets::text, 'sha256'), 'hex');

  insert into public.erp_gate_offline_manifests (
    id, tenant_id, site_id, device_id, actor_account_id, service_date,
    ticket_count, snapshot_digest, expires_at
  ) values (
    v_manifest_id, p_tenant_id, p_site_id, p_device_id, trim(p_actor_account_id),
    v_service_date, v_count, v_digest, v_expires_at
  );

  return jsonb_build_object(
    'manifest_id', v_manifest_id,
    'site_id', p_site_id,
    'device_id', p_device_id,
    'service_date', v_service_date,
    'issued_at', now(),
    'expires_at', v_expires_at,
    'ticket_count', v_count,
    'snapshot_digest', v_digest,
    'tickets', v_tickets
  );
end;
$$;

-- Khoá cửa lại đúng như migration 045 đã đặt. `create or replace` không xoá
-- quyền đang có, nên hai dòng này chỉ khẳng định lại nguyên trạng: chỉ
-- `service_role` gọi được, trình duyệt không có đường nào chạm tới.
revoke all on function public.erp_prepare_offline_gate_manifest(
  uuid, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.erp_prepare_offline_gate_manifest(
  uuid, uuid, text, uuid
) to service_role;

commit;
