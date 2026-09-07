-- TC-17: giấy tờ tuỳ thân — mở đường sẵn, khoá cửa lại, không mở.
--
-- Bối cảnh: dự án hiện bán vé tham quan trong ngày, không phải cơ sở lưu
-- trú, nên nghĩa vụ khai báo lưu trú (nếu có) CHƯA chạm tới sản phẩm này.
-- Chủ dự án muốn dựng sẵn kho trước khi một quy định như vậy xuất hiện, để
-- không phải vừa làm vừa lo an toàn dữ liệu. Migration này KHÔNG mở bất kỳ
-- đường thu thập nào: không màn hình tải ảnh, không API nhận giấy tờ, không
-- hàng dữ liệu nào được tạo ra từ chính migration. Nó chỉ dựng ba thứ:
--   1. một kho riêng, mã hoá, tách khỏi mọi bảng hành trình/gợi ý/phân khúc;
--   2. luật thu — lý do thu constrained (không phải text tự do) và hạn xoá
--      bắt buộc trên từng hàng, không phải một chính sách nằm ngoài dữ liệu;
--   3. một hàm xoá đúng những hàng đã hết hạn, trả về số hàng đã xoá làm
--      bằng chứng, không phải một lời hứa trong tài liệu.
--
-- Đường ghi (RPC nhận giấy tờ thật) CHƯA được viết trong lượt này và đứng
-- sau feature flag CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED, mặc định
-- TẮT — xem domain/customer-identity-document.ts. Hạn xoá 30 ngày kể từ
-- ngày đi là quyết định KINH DOANH của chủ dự án (IDENTITY_DOCUMENT_RETENTION_DAYS
-- trong cùng file domain đó), không phải một sự thật pháp lý đã tra cứu.
-- Thu thập giấy tờ THẬT của khách phải hỏi luật sư trước — không dòng nào ở
-- đây, hay bất kỳ đâu trong migration này, khẳng định nghĩa vụ pháp lý nào
-- của Việt Nam.
--
-- Cấm rõ: ảnh giấy tờ (nếu sau này có) không được đi qua đường nào khách
-- khác đọc được, không được đưa vào mã QR, không được đính vào hộ chiếu
-- chuyến đi. Cột document_ciphertext ở đây chỉ dành cho một payload JSON đã
-- mã hoá (số giấy tờ, họ tên, ngày cấp...) theo đúng khuôn AES-256-GCM mà
-- customer_identities đang dùng — KHÔNG dùng để nhét ảnh chụp; lưu trữ ảnh
-- là việc chưa quyết, chưa có UI, chưa có API nào ghi vào bảng này.
--
-- Chỉ tiến tới: bảng mới hoàn toàn, không update dữ liệu cũ ở bất kỳ bảng
-- nào khác. Production không có PITR, không có bản sao lưu vật lý.

begin;

create table if not exists public.customer_sealed_identity_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Tham chiếu tới customer_profiles, KHÔNG phải customer_identities: giấy
  -- tờ tuỳ thân gắn với một CON NGƯỜI (hồ sơ khách), không gắn với một kênh
  -- liên hệ đã xác minh (email/điện thoại) cụ thể. Một khách có thể chưa
  -- từng xác minh email/điện thoại nào (customer_identities rỗng) mà vẫn
  -- cần xuất trình giấy tờ tại cổng — ép buộc phải có một hàng
  -- customer_identities trước sẽ chặn đúng những trường hợp cần dùng bảng
  -- này nhất. profile_id cũng là khoá mọi bảng customer_* khác đã dùng
  -- (customer_consents, customer_sessions, customer_events), nên đây là
  -- lựa chọn nhất quán với toàn bộ backbone CUS-01.
  profile_id uuid not null,
  document_type text not null check (
    document_type in ('cccd', 'cmnd', 'ho_chieu', 'khac')
  ),
  -- Lý do thu: liệt kê có ràng buộc, không phải text tự do — ai hỏi "vì sao
  -- thu giấy tờ của khách này" thì tra được câu trả lời từ chính hàng dữ
  -- liệu, không phải đi hỏi trí nhớ người thu. Danh sách này phải khớp với
  -- IDENTITY_DOCUMENT_COLLECTION_REASONS trong
  -- domain/customer-identity-document.ts.
  collection_reason text not null check (
    collection_reason in (
      'authority_request',
      'incident_investigation',
      'partner_contract_requirement',
      'residence_notification_pending_legal_review',
      'other_approved_by_director'
    )
  ),
  document_ciphertext text not null check (
    char_length(document_ciphertext) between 24 and 8192
  ),
  encryption_key_version text not null check (
    char_length(trim(encryption_key_version)) between 1 and 40
  ),
  collected_at timestamptz not null default now(),
  -- Hạn xoá bắt buộc, tính sẵn LÚC THU bởi phía gọi (30 ngày kể từ ngày đi
  -- — xem computeIdentityDocumentExpiryAt trong
  -- domain/customer-identity-document.ts). Đây là chính sách nằm TRONG dữ
  -- liệu của từng hàng, không phải một con số đọc từ nơi khác lúc xoá.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  check (expires_at > collected_at)
);

create index if not exists customer_sealed_identity_documents_expiry_idx
  on public.customer_sealed_identity_documents(tenant_id, expires_at);

create index if not exists customer_sealed_identity_documents_profile_idx
  on public.customer_sealed_identity_documents(tenant_id, profile_id, collected_at desc);

alter table public.customer_sealed_identity_documents enable row level security;

-- Khoá cửa thật sự: không một vai nào (kể cả service_role) được cấp quyền
-- đọc/ghi trực tiếp lên bảng này. Đây là điểm khác với các bảng customer_*
-- khác trong migration 039 (vốn grant select cho service_role) — có chủ
-- đích, vì bảng này chưa có bất kỳ đường đọc/ghi hợp lệ nào từ ứng dụng.
-- Năng lực duy nhất được mở là quyền EXECUTE trên đúng một hàm bên dưới.
revoke all on table public.customer_sealed_identity_documents
  from public, anon, authenticated, service_role;

-- Hàm xoá hồ sơ đã hết hạn. security definer để chạy bằng quyền của chủ
-- hàm (không cần cấp quyền bảng cho người gọi), search_path rỗng để chặn
-- giả mạo hàm/bảng cùng tên từ một schema khác, trả về số hàng đã xoá làm
-- bằng chứng đã xoá thật.
create or replace function public.customer_purge_expired_identity_documents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  delete from public.customer_sealed_identity_documents
  where expires_at <= now();

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function public.customer_purge_expired_identity_documents()
  from public, anon, authenticated, service_role;

grant execute on function public.customer_purge_expired_identity_documents()
  to service_role;

commit;
