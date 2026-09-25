-- Gắn chiến dịch vào dịp trong lịch mùa vụ · 23/09/2026
--
-- Chủ dự án muốn biết **dịp nào ra tiền**. Chuỗi ghi nguồn đã có sẵn: mã QR →
-- chiến dịch → khách → giữ chỗ → thanh toán → vào cổng (xem
-- `lib/customer-data/funnel-repository.ts`). Thiếu đúng một mắt xích: chiến
-- dịch chưa biết mình thuộc dịp nào. Bảng này thêm mắt xích ấy, không hơn.
--
-- ## Vì sao là một cột chữ, không phải khoá ngoại
--
-- Danh sách dịp nằm trong mã nguồn (`domain/lich-mua-vu.ts`) và ngày của nó
-- tính lại theo từng năm; không có bảng dịp nào để trỏ tới. Cùng quyết định
-- với `erp_doi_tac_nhan_hang.dip_nham_toi` ở migration 087.
--
-- ## Vì sao đổi dịp phải để lại dấu
--
-- Đổi dịp của một chiến dịch là đổi con số doanh thu của hai dịp cùng lúc.
-- Không có dấu thì về sau không ai giải thích được vì sao báo cáo Trung thu
-- năm ngoái hôm nay khác hôm qua. Nên mỗi lần đổi ghi một dòng vào nhật ký
-- chiến dịch sẵn có, cũ và mới.

begin;

alter table public.marketing_campaigns
  add column if not exists dip_id text not null default ''
    check (char_length(dip_id) <= 60 and dip_id !~ '[[:cntrl:]]');

create index if not exists marketing_campaigns_theo_dip
  on public.marketing_campaigns (tenant_id, dip_id)
  where dip_id <> '';

-- Nhật ký chiến dịch nhận thêm một loại sự kiện. Chỉ nới danh sách được phép,
-- không đụng tới dòng nào đã ghi.
alter table public.marketing_qr_audit_events
  drop constraint if exists marketing_qr_audit_events_event_type_check;
alter table public.marketing_qr_audit_events
  add constraint marketing_qr_audit_events_event_type_check
  check (event_type in (
    'campaign-created',
    'qr-created',
    'qr-destination-updated',
    'campaign-occasion-set'
  ));

create or replace function public.marketing_gan_dip_chien_dich(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_actor_account_id uuid,
  p_dip_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $ham$
declare
  v_dip text := trim(coalesce(p_dip_id, ''));
  v_cu text;
begin
  if p_tenant_id is null or p_campaign_id is null or p_actor_account_id is null then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_ID_REQUIRED';
  end if;
  if char_length(v_dip) > 60 or v_dip ~ '[[:cntrl:]]' or (v_dip <> '' and v_dip !~ '^[a-z0-9-]+$') then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_OCCASION_INVALID';
  end if;

  select dip_id into v_cu
    from public.marketing_campaigns
   where id = p_campaign_id and tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_NOT_FOUND';
  end if;

  -- Không đổi gì thì không ghi nhật ký: bấm lưu hai lần không được đẻ ra hai
  -- dòng "đổi dịp" giống hệt nhau.
  if v_cu is distinct from v_dip then
    update public.marketing_campaigns
       set dip_id = v_dip, updated_at = now()
     where id = p_campaign_id and tenant_id = p_tenant_id;

    insert into public.marketing_qr_audit_events (
      tenant_id, campaign_id, actor_account_id, event_type, before_state, after_state
    ) values (
      p_tenant_id, p_campaign_id, p_actor_account_id, 'campaign-occasion-set',
      jsonb_build_object('dip_id', v_cu),
      jsonb_build_object('dip_id', v_dip)
    );
  end if;

  return jsonb_build_object('campaign_id', p_campaign_id, 'dip_id', v_dip);
end;
$ham$;

revoke all on function public.marketing_gan_dip_chien_dich(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.marketing_gan_dip_chien_dich(uuid, uuid, uuid, text) to service_role;

commit;
