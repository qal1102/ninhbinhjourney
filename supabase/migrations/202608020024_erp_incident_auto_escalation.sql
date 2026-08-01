-- V15 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md muc 10.2 L8, muc 12 dot 2):
-- sự cố quá hạn SLA phải tự chuyển cấp.
--
-- V13 (migration 015/016) đã làm đồng hồ SLA chạy thật, nhưng chuyển cấp
-- vẫn chỉ xảy ra khi có người bấm nút. Trong một trung tâm điều hành thật,
-- chuyển cấp là **do thời gian**, không do trí nhớ của người trực — đó
-- chính là lý do SLA tồn tại. Cho tới migration này, toàn hệ thống chưa có
-- bất kỳ cơ chế nào chạy theo thời gian: mọi thứ chỉ xảy ra khi có người
-- bấm. Đây là viên gạch đầu tiên cho nhóm tự động hoá đó.
--
-- Thiết kế, và những gì cố ý KHÔNG làm:
--
--   * Chỉ đặt cờ `escalated`, ghi lý do và thêm một dòng vào nhật ký. **Không
--     đổi `severity`** — chuyển cấp và mức nghiêm trọng là hai khái niệm
--     khác nhau; tự ý nâng P3 thành P2 sẽ làm sai lệch dữ liệu mà không ai
--     quyết định điều đó.
--   * **Không đụng `next_action`** để không giẫm lên máy trạng thái chuyển
--     bước của quản lý (`erp_incident_manager_transition`).
--   * Áp dụng cho cả sự cố đang `in-progress`, không chỉ `reported`: quá hạn
--     là quá hạn, kể cả khi đã có người đang xử lý — đó mới đúng tinh thần
--     SLA. Chỉ bỏ qua sự cố đã `closed`.
--   * Lọc `escalated = false` nên chạy bao nhiêu lần cũng cho cùng kết quả:
--     đã chuyển cấp rồi thì không ghi đè lý do hay nhân bản dòng nhật ký.
--
-- Lịch chạy mỗi phút. Ngưỡng SLA thấp nhất trong dữ liệu là 5 phút, nên một
-- phút là đủ mịn mà không tạo tải đáng kể (bảng chỉ vài chục dòng và câu
-- lệnh có điều kiện lọc hẹp).

begin;

create extension if not exists pg_cron;

create or replace function public.erp_incident_escalate_overdue()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_late_minutes integer;
  v_reason text;
  v_count integer := 0;
begin
  for v_row in
    select id, sla_minutes, reported_at_ts, timeline
    from public.erp_incidents
    where status <> 'closed'
      and escalated = false
      and now() > reported_at_ts + make_interval(mins => sla_minutes)
    for update
  loop
    v_late_minutes := greatest(
      0,
      floor(extract(epoch from (now() - v_row.reported_at_ts)) / 60)::integer - v_row.sla_minutes
    );
    v_reason :=
      'Quá hạn SLA ' || v_row.sla_minutes || ' phút (trễ ' || v_late_minutes
      || ' phút). Hệ thống tự chuyển cấp, không chờ thao tác của người trực.';

    update public.erp_incidents set
      escalated = true,
      escalation_reason = v_reason,
      timeline = jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
          'actor', 'Hệ thống',
          'action', 'Chuyển cấp tự động',
          'note', v_reason
        )
      ) || coalesce(v_row.timeline, '[]'::jsonb),
      updated_at = now()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.erp_incident_escalate_overdue() from public, anon, authenticated, service_role;
grant execute on function public.erp_incident_escalate_overdue() to service_role;

-- Đặt lịch một cách bình đẳng khi chạy lại: gỡ job cũ cùng tên (nếu có) rồi
-- đặt lại, thay vì tạo trùng.
do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'erp-incident-escalate-overdue' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'erp-incident-escalate-overdue',
  '* * * * *',
  $cron$select public.erp_incident_escalate_overdue();$cron$
);

commit;
