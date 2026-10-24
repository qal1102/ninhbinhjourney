-- Văn bản & hợp đồng, cổng nhận văn bản (24/10/2026).
--
-- Chủ dự án 24/10: "AI đóng vai người gác cổng check xem các văn bản có hợp lệ
-- không rồi mới đưa lên hệ thống… file xuất ra luôn là PDF và phải được mã
-- hoá… chỉ file PDF mẫu đã tải xuống từ hệ thống mới được phép tải lên… các
-- phần cần dữ liệu này cứ tự động chế tạo ra tạm thời."
--
-- Hai sổ:
-- - `erp_van_ban_phat_hanh`: mỗi lần tải một mẫu PDF là một dòng (mã VB-xxxxxx,
--   số văn bản, các ô hệ thống điền, băm nội dung trang). Cổng chỉ nhận tệp
--   mang mã có trong sổ này và băm nội dung trùng.
-- - `erp_van_ban_nop`: mỗi lần nộp. `nhan` là đã vào hệ thống, `cho-duyet` là AI
--   giữ lại hoặc người nộp không có quyền nhận, `tra-lai` là cổng chặn (ghi lại
--   để biết cổng đã chặn gì, không lưu tệp).
--
-- Một mã phát hành chỉ nhận một lần (chỉ mục duy nhất trên `nhan`/`cho-duyet`).
-- Nhận hợp đồng chèo đò thì sổ người chèo của bến cập nhật loại hợp đồng, ngày
-- và số điện thoại (thêm thuyền nếu chưa có). Hai loại còn lại không có bảng
-- nghiệp vụ riêng: chính sổ nộp là kho hợp đồng nhà cung cấp và biên bản
-- nghiệm thu mà cổng đối chiếu về sau.
--
-- Dữ liệu mẫu: hai hợp đồng nhà cung cấp, hai biên bản nghiệm thu, hai hợp
-- đồng chèo đò, đều `la_mau = true`, không có tệp. Không có hàm xoá (cố ý).

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('erp-van-ban', 'erp-van-ban', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

create table if not exists public.erp_van_ban_phat_hanh (
  id text primary key check (id ~ '^VB-[A-Z0-9]{6}$'),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loai text not null check (loai in ('hop-dong-nguoi-cheo', 'hop-dong-nha-cung-cap', 'bien-ban-nghiem-thu')),
  phien_ban integer not null check (phien_ban between 1 and 999),
  so_van_ban text not null check (char_length(so_van_ban) between 5 and 40),
  site_id uuid references public.sites(id) on delete restrict,
  he_thong jsonb not null default '{}'::jsonb check (jsonb_typeof(he_thong) = 'object'),
  kieu text not null default 'trong' check (kieu in ('trong', 'dien-dung', 'dien-sai', 'bi-sua')),
  ma_bam_noi_dung text check (ma_bam_noi_dung is null or ma_bam_noi_dung ~ '^[0-9a-f]{64}$'),
  ma_bam_tep text check (ma_bam_tep is null or ma_bam_tep ~ '^[0-9a-f]{64}$'),
  phat_hanh_boi text not null,
  phat_hanh_ten text not null default '',
  phat_hanh_luc timestamptz not null default now(),
  la_mau boolean not null default false
);
create unique index if not exists erp_van_ban_phat_hanh_so
  on public.erp_van_ban_phat_hanh (tenant_id, so_van_ban);

create table if not exists public.erp_van_ban_nop (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phat_hanh_id text references public.erp_van_ban_phat_hanh(id) on delete restrict,
  loai text check (loai is null or loai in ('hop-dong-nguoi-cheo', 'hop-dong-nha-cung-cap', 'bien-ban-nghiem-thu')),
  so_van_ban text,
  site_id uuid references public.sites(id) on delete restrict,
  ket_qua text not null check (ket_qua in ('nhan', 'cho-duyet', 'tra-lai')),
  ly_do text not null default '' check (char_length(ly_do) <= 400),
  gia_tri jsonb not null default '{}'::jsonb check (jsonb_typeof(gia_tri) = 'object'),
  phat_hien jsonb not null default '[]'::jsonb check (jsonb_typeof(phat_hien) = 'array'),
  ai_nhan_xet jsonb,
  ma_bam_tep text check (ma_bam_tep is null or ma_bam_tep ~ '^[0-9a-f]{64}$'),
  ten_tep text check (ten_tep is null or char_length(ten_tep) <= 200),
  tep_path text check (tep_path is null or tep_path ~ '^van-ban/[0-9]{4}/[0-9a-f-]{36}\.pdf$'),
  ap_dung text check (ap_dung is null or char_length(ap_dung) <= 300),
  nop_boi text not null,
  nop_ten text not null default '',
  nop_luc timestamptz not null default now(),
  duyet_boi text,
  duyet_ten text,
  duyet_luc timestamptz,
  duyet_ghi_chu text check (duyet_ghi_chu is null or char_length(duyet_ghi_chu) <= 300),
  la_mau boolean not null default false,
  check (ket_qua = 'tra-lai' or (phat_hanh_id is not null and loai is not null and so_van_ban is not null))
);
create unique index if not exists erp_van_ban_nop_mot_lan
  on public.erp_van_ban_nop (phat_hanh_id) where ket_qua in ('nhan', 'cho-duyet');
create index if not exists erp_van_ban_nop_theo_luc on public.erp_van_ban_nop (tenant_id, nop_luc desc);

alter table public.erp_van_ban_phat_hanh enable row level security;
alter table public.erp_van_ban_nop enable row level security;
revoke all on table public.erp_van_ban_phat_hanh, public.erp_van_ban_nop from public, anon, authenticated;
grant select, insert, update on table public.erp_van_ban_phat_hanh, public.erp_van_ban_nop to service_role;

-- Vai được phát hành và nhận: giám đốc, quản lý, kế toán (hai loại nhà cung cấp).
-- Sổ phân vai ghi quản lý là `regional-manager`, kế toán là `accountant-maker` /
-- `accounting-checker`; nhận cả tên vai trong mã cho chắc.
create or replace function public.erp_van_ban_co_vai(p_tenant_id uuid, p_account_id text, p_loai text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.erp_account_registry r
    join public.erp_account_role_assignments a on a.tenant_id = r.tenant_id and a.account_id = r.account_id
    where r.tenant_id = p_tenant_id
      and r.account_id = trim(coalesce(p_account_id, ''))
      and r.status = 'active'
      and a.status = 'active'
      and a.effective_from <= now()
      and (a.effective_until is null or a.effective_until > now())
      and (
        a.role in ('director', 'manager', 'regional-manager')
        or (
          a.role in ('accountant', 'chief-accountant', 'accountant-maker', 'accounting-checker')
          and p_loai in ('hop-dong-nha-cung-cap', 'bien-ban-nghiem-thu')
        )
      )
  );
$$;

-- Giữ số văn bản và ghi các ô hệ thống. Băm nội dung ghi ở bước sau, khi PDF đã dựng.
create or replace function public.erp_van_ban_phat_hanh_tao(
  p_tenant_id uuid,
  p_id text,
  p_loai text,
  p_phien_ban integer,
  p_tien_to text,
  p_site_id uuid,
  p_he_thong jsonb,
  p_kieu text,
  p_actor_account_id text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nam text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY');
  v_so integer;
  v_so_van_ban text;
begin
  if not public.erp_van_ban_co_vai(p_tenant_id, p_actor_account_id, p_loai) then
    raise exception using errcode = '42501', message = 'VAN_BAN_ROLE_REQUIRED';
  end if;
  if p_tien_to !~ '^[A-ZĐ-]{2,10}$' then
    raise exception using errcode = '22023', message = 'VAN_BAN_TIEN_TO';
  end if;
  perform pg_advisory_xact_lock(hashtext('erp_van_ban_so:' || p_tien_to));
  select coalesce(max(substring(so_van_ban from '([0-9]{4})$')::integer), 0) + 1 into v_so
  from public.erp_van_ban_phat_hanh
  where tenant_id = p_tenant_id and so_van_ban like p_tien_to || '-' || v_nam || '-%';
  v_so_van_ban := p_tien_to || '-' || v_nam || '-' || lpad(v_so::text, 4, '0');
  insert into public.erp_van_ban_phat_hanh (
    id, tenant_id, loai, phien_ban, so_van_ban, site_id, he_thong, kieu, phat_hanh_boi, phat_hanh_ten,
    la_mau
  ) values (
    p_id, p_tenant_id, p_loai, p_phien_ban, v_so_van_ban, p_site_id,
    coalesce(p_he_thong, '{}'::jsonb) || jsonb_build_object('so_van_ban', v_so_van_ban),
    coalesce(p_kieu, 'trong'), trim(p_actor_account_id), left(coalesce(p_actor_name, ''), 120),
    coalesce(p_kieu, 'trong') <> 'trong'
  );
  return jsonb_build_object('id', p_id, 'so_van_ban', v_so_van_ban, 'phat_hanh_luc', now());
end;
$$;

create or replace function public.erp_van_ban_phat_hanh_ky(
  p_tenant_id uuid,
  p_id text,
  p_ma_bam_noi_dung text,
  p_ma_bam_tep text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.erp_van_ban_phat_hanh
  set ma_bam_noi_dung = p_ma_bam_noi_dung, ma_bam_tep = p_ma_bam_tep
  where tenant_id = p_tenant_id and id = p_id and ma_bam_noi_dung is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'VAN_BAN_KHONG_THAY';
  end if;
end;
$$;

create or replace function public.erp_van_ban_lay_phat_hanh(p_tenant_id uuid, p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'loai', p.loai, 'phien_ban', p.phien_ban, 'so_van_ban', p.so_van_ban, 'site_id', p.site_id,
    'he_thong', p.he_thong, 'kieu', p.kieu, 'ma_bam_noi_dung', p.ma_bam_noi_dung,
    'phat_hanh_boi', p.phat_hanh_boi, 'phat_hanh_ten', p.phat_hanh_ten, 'phat_hanh_luc', p.phat_hanh_luc,
    'la_mau', p.la_mau,
    'da_nop', (
      select jsonb_build_object('ket_qua', n.ket_qua, 'nop_luc', n.nop_luc, 'nop_ten', n.nop_ten)
      from public.erp_van_ban_nop n
      where n.phat_hanh_id = p.id and n.ket_qua in ('nhan', 'cho-duyet')
    )
  )
  from public.erp_van_ban_phat_hanh p
  where p.tenant_id = p_tenant_id and p.id = p_id;
$$;

-- "dd/mm/yyyy" → date; sai thì null.
create or replace function public.erp_van_ban_ngay(p text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(p, '') !~ '^\s*[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{4}\s*$' then
    return null;
  end if;
  return to_date(regexp_replace(trim(p), '[.-]', '/', 'g'), 'DD/MM/YYYY');
exception when others then
  return null;
end;
$$;

-- Đưa văn bản đã nhận vào nghiệp vụ. Trả câu mô tả việc đã làm.
create or replace function public.erp_van_ban_ap_dung(p_nop_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.erp_van_ban_nop%rowtype;
  v_mau boolean;
  v_so_thuyen text;
  v_loai text;
  v_tu date;
  v_den date;
  v_dt text;
  v_id uuid;
begin
  select * into n from public.erp_van_ban_nop where id = p_nop_id;
  if n.loai is distinct from 'hop-dong-nguoi-cheo' or n.site_id is null then
    return case n.loai
      when 'hop-dong-nha-cung-cap' then 'Hợp đồng vào kho văn bản; biên bản nghiệm thu về sau đối chiếu với hợp đồng này.'
      when 'bien-ban-nghiem-thu' then 'Biên bản vào kho văn bản; giá trị cộng vào phần đã nghiệm thu của hợp đồng.'
      else null
    end;
  end if;
  select la_mau into v_mau from public.erp_van_ban_phat_hanh where id = n.phat_hanh_id;
  v_so_thuyen := upper(trim(coalesce(n.gia_tri ->> 'so_thuyen', '')));
  v_loai := case when lower(coalesce(n.gia_tri ->> 'loai_hop_dong', '')) like 'th%' then 'thoi-vu' else 'dai-han' end;
  v_tu := public.erp_van_ban_ngay(n.gia_tri ->> 'tu_ngay');
  v_den := public.erp_van_ban_ngay(n.gia_tri ->> 'den_ngay');
  if v_loai = 'dai-han' and v_den is not null and v_tu is not null and v_den < v_tu then v_den := null; end if;
  v_dt := nullif(regexp_replace(coalesce(n.gia_tri ->> 'so_dien_thoai', ''), '[^0-9]', '', 'g'), '');
  if v_dt is not null and char_length(v_dt) not between 8 and 20 then v_dt := null; end if;

  update public.erp_nguoi_cheo c
  set ho_ten = left(trim(n.gia_tri ->> 'ho_ten'), 120),
      so_dien_thoai = coalesce(v_dt, c.so_dien_thoai),
      loai_hop_dong = v_loai,
      hop_dong_tu = v_tu,
      hop_dong_den = case when v_loai = 'thoi-vu' then coalesce(v_den, c.hop_dong_den) else v_den end,
      la_mau = c.la_mau and coalesce(v_mau, false),
      sua_luc = now()
  where c.tenant_id = n.tenant_id and c.site_id = n.site_id and upper(btrim(c.so_thuyen)) = v_so_thuyen
  returning c.id into v_id;
  if v_id is null then
    if v_loai = 'thoi-vu' and v_den is null then
      return 'Chưa thêm vào sổ người chèo: hợp đồng thời vụ thiếu ngày kết thúc.';
    end if;
    insert into public.erp_nguoi_cheo (tenant_id, site_id, so_thuyen, ho_ten, so_dien_thoai, la_mau, loai_hop_dong, hop_dong_tu, hop_dong_den)
    values (n.tenant_id, n.site_id, v_so_thuyen, left(trim(n.gia_tri ->> 'ho_ten'), 120), v_dt, coalesce(v_mau, false), v_loai, v_tu, v_den);
    return 'Đã thêm thuyền số ' || v_so_thuyen || ' vào sổ người chèo, kèm hợp đồng.';
  end if;
  return 'Sổ người chèo: thuyền số ' || v_so_thuyen || ' cập nhật hợp đồng '
    || case v_loai when 'thoi-vu' then 'thời vụ' else 'dài hạn' end
    || coalesce(' từ ' || to_char(v_tu, 'DD/MM/YYYY'), '')
    || coalesce(' đến ' || to_char(v_den, 'DD/MM/YYYY'), '') || '.';
end;
$$;

create or replace function public.erp_van_ban_ghi_nop(
  p_tenant_id uuid,
  p_phat_hanh_id text,
  p_ket_qua text,
  p_ly_do text,
  p_gia_tri jsonb,
  p_phat_hien jsonb,
  p_ai jsonb,
  p_ma_bam_tep text,
  p_ten_tep text,
  p_tep_path text,
  p_actor_account_id text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.erp_van_ban_phat_hanh%rowtype;
  v_id uuid;
  v_ap_dung text;
begin
  if p_ket_qua not in ('nhan', 'cho-duyet', 'tra-lai') then
    raise exception using errcode = '22023', message = 'VAN_BAN_KET_QUA';
  end if;
  if p_phat_hanh_id is not null then
    select * into p from public.erp_van_ban_phat_hanh
    where tenant_id = p_tenant_id and id = p_phat_hanh_id
    for update;
  end if;

  if p_ket_qua = 'tra-lai' then
    -- Cổng chặn: ghi một dòng mỗi tệp mỗi người mỗi ngày, không lưu tệp.
    if exists (
      select 1 from public.erp_van_ban_nop
      where tenant_id = p_tenant_id and ket_qua = 'tra-lai' and nop_boi = trim(p_actor_account_id)
        and ma_bam_tep is not distinct from p_ma_bam_tep and nop_luc > now() - interval '1 day'
    ) then
      return jsonb_build_object('id', null, 'ket_qua', 'tra-lai');
    end if;
    insert into public.erp_van_ban_nop (
      tenant_id, phat_hanh_id, loai, so_van_ban, site_id, ket_qua, ly_do, gia_tri, phat_hien, ai_nhan_xet,
      ma_bam_tep, ten_tep, nop_boi, nop_ten, la_mau
    ) values (
      p_tenant_id, p.id, p.loai, p.so_van_ban, p.site_id, 'tra-lai', left(coalesce(p_ly_do, ''), 400),
      coalesce(p_gia_tri, '{}'::jsonb), coalesce(p_phat_hien, '[]'::jsonb), p_ai, p_ma_bam_tep,
      left(p_ten_tep, 200), trim(p_actor_account_id), left(coalesce(p_actor_name, ''), 120), coalesce(p.la_mau, false)
    ) returning id into v_id;
    return jsonb_build_object('id', v_id, 'ket_qua', 'tra-lai');
  end if;

  if p.id is null or p.ma_bam_noi_dung is null then
    raise exception using errcode = 'P0002', message = 'VAN_BAN_KHONG_THAY';
  end if;
  if exists (select 1 from public.erp_van_ban_nop where phat_hanh_id = p.id and ket_qua in ('nhan', 'cho-duyet')) then
    raise exception using errcode = '23505', message = 'VAN_BAN_DA_NOP';
  end if;
  if p_ket_qua = 'nhan' and not public.erp_van_ban_co_vai(p_tenant_id, p_actor_account_id, p.loai) then
    raise exception using errcode = '42501', message = 'VAN_BAN_ROLE_REQUIRED';
  end if;

  insert into public.erp_van_ban_nop (
    tenant_id, phat_hanh_id, loai, so_van_ban, site_id, ket_qua, ly_do, gia_tri, phat_hien, ai_nhan_xet,
    ma_bam_tep, ten_tep, tep_path, nop_boi, nop_ten, la_mau
  ) values (
    p_tenant_id, p.id, p.loai, p.so_van_ban, p.site_id, p_ket_qua, left(coalesce(p_ly_do, ''), 400),
    coalesce(p_gia_tri, '{}'::jsonb), coalesce(p_phat_hien, '[]'::jsonb), p_ai, p_ma_bam_tep,
    left(p_ten_tep, 200), p_tep_path, trim(p_actor_account_id), left(coalesce(p_actor_name, ''), 120), p.la_mau
  ) returning id into v_id;

  if p_ket_qua = 'nhan' then
    v_ap_dung := public.erp_van_ban_ap_dung(v_id);
    update public.erp_van_ban_nop
    set ap_dung = left(v_ap_dung, 300), duyet_boi = trim(p_actor_account_id), duyet_ten = left(coalesce(p_actor_name, ''), 120), duyet_luc = now()
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'ket_qua', p_ket_qua, 'ap_dung', v_ap_dung, 'so_van_ban', p.so_van_ban);
end;
$$;

-- Người có vai quyết văn bản đang chờ duyệt: nhận vào (và áp dụng) hoặc trả lại.
create or replace function public.erp_van_ban_duyet(
  p_tenant_id uuid,
  p_nop_id uuid,
  p_quyet text,
  p_ghi_chu text,
  p_actor_account_id text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.erp_van_ban_nop%rowtype;
  v_ap_dung text;
begin
  select * into n from public.erp_van_ban_nop where tenant_id = p_tenant_id and id = p_nop_id for update;
  if n.id is null then
    raise exception using errcode = 'P0002', message = 'VAN_BAN_KHONG_THAY';
  end if;
  if n.ket_qua <> 'cho-duyet' then
    raise exception using errcode = '22023', message = 'VAN_BAN_DA_DUYET';
  end if;
  if p_quyet not in ('nhan', 'tra-lai') then
    raise exception using errcode = '22023', message = 'VAN_BAN_KET_QUA';
  end if;
  if not public.erp_van_ban_co_vai(p_tenant_id, p_actor_account_id, n.loai) then
    raise exception using errcode = '42501', message = 'VAN_BAN_ROLE_REQUIRED';
  end if;
  if p_quyet = 'tra-lai' and char_length(trim(coalesce(p_ghi_chu, ''))) < 3 then
    raise exception using errcode = '22023', message = 'VAN_BAN_CAN_LY_DO';
  end if;
  update public.erp_van_ban_nop
  set ket_qua = p_quyet, duyet_boi = trim(p_actor_account_id), duyet_ten = left(coalesce(p_actor_name, ''), 120),
      duyet_luc = now(), duyet_ghi_chu = nullif(left(trim(coalesce(p_ghi_chu, '')), 300), '')
  where id = n.id;
  if p_quyet = 'nhan' then
    v_ap_dung := public.erp_van_ban_ap_dung(n.id);
    update public.erp_van_ban_nop set ap_dung = left(v_ap_dung, 300) where id = n.id;
  end if;
  return jsonb_build_object('id', n.id, 'ket_qua', p_quyet, 'ap_dung', v_ap_dung);
end;
$$;

create or replace function public.erp_van_ban_danh_sach(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nop', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.nop_luc desc)
      from (
        select n.id, n.phat_hanh_id, n.loai, n.so_van_ban, n.site_id, n.ket_qua, n.ly_do, n.gia_tri, n.phat_hien,
               n.ai_nhan_xet, n.ten_tep, n.tep_path is not null as co_tep, n.ap_dung, n.nop_boi, n.nop_ten, n.nop_luc,
               n.duyet_ten, n.duyet_luc, n.duyet_ghi_chu, n.la_mau
        from public.erp_van_ban_nop n
        where n.tenant_id = p_tenant_id
        order by (n.ket_qua <> 'tra-lai') desc, n.nop_luc desc
        limit 400
      ) x
    ), '[]'::jsonb),
    'phat_hanh', (select count(*) from public.erp_van_ban_phat_hanh where tenant_id = p_tenant_id and ma_bam_noi_dung is not null),
    'phat_hanh_gan', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.phat_hanh_luc desc)
      from (
        select p.id, p.loai, p.so_van_ban, p.kieu, p.phat_hanh_ten, p.phat_hanh_luc,
               exists (select 1 from public.erp_van_ban_nop n where n.phat_hanh_id = p.id and n.ket_qua in ('nhan', 'cho-duyet')) as da_nop
        from public.erp_van_ban_phat_hanh p
        where p.tenant_id = p_tenant_id and p.ma_bam_noi_dung is not null
        order by p.phat_hanh_luc desc
        limit 12
      ) y
    ), '[]'::jsonb)
  );
$$;

create or replace function public.erp_van_ban_tep(p_tenant_id uuid, p_nop_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tep_path from public.erp_van_ban_nop where tenant_id = p_tenant_id and id = p_nop_id;
$$;

revoke all on function public.erp_van_ban_co_vai(uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_phat_hanh_tao(uuid, text, text, integer, text, uuid, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_phat_hanh_ky(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_lay_phat_hanh(uuid, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_ngay(text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_ap_dung(uuid) from public, anon, authenticated;
revoke all on function public.erp_van_ban_ghi_nop(uuid, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_duyet(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.erp_van_ban_danh_sach(uuid) from public, anon, authenticated;
revoke all on function public.erp_van_ban_tep(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_van_ban_phat_hanh_tao(uuid, text, text, integer, text, uuid, jsonb, text, text, text) to service_role;
grant execute on function public.erp_van_ban_phat_hanh_ky(uuid, text, text, text) to service_role;
grant execute on function public.erp_van_ban_lay_phat_hanh(uuid, text) to service_role;
grant execute on function public.erp_van_ban_ghi_nop(uuid, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.erp_van_ban_duyet(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.erp_van_ban_danh_sach(uuid) to service_role;
grant execute on function public.erp_van_ban_tep(uuid, uuid) to service_role;

-- Văn bản mẫu đã có trong hệ thống, để cổng có cái mà đối chiếu.
insert into public.erp_van_ban_phat_hanh (id, tenant_id, loai, phien_ban, so_van_ban, site_id, he_thong, kieu, phat_hanh_boi, phat_hanh_ten, phat_hanh_luc, la_mau)
select v.id, '00000000-0000-4000-8000-000000000001'::uuid, v.loai, 1, v.so, v.site_id, v.he_thong, 'dien-dung', 'director-001', 'Dữ liệu mẫu', v.luc, true
from (values
  ('VB-MAU014', 'hop-dong-nha-cung-cap', 'HĐ-NCC-2026-0014', '10000000-0000-4000-8000-000000000001'::uuid,
    '{"so_van_ban":"HĐ-NCC-2026-0014","co_so":"Tràng An"}'::jsonb, '2026-02-26 09:00+07'::timestamptz),
  ('VB-MAU021', 'hop-dong-nha-cung-cap', 'HĐ-NCC-2026-0021', '10000000-0000-4000-8000-000000000005'::uuid,
    '{"so_van_ban":"HĐ-NCC-2026-0021","co_so":"Tam Cốc"}'::jsonb, '2026-04-10 09:00+07'::timestamptz),
  ('VB-MAU031', 'bien-ban-nghiem-thu', 'BB-NT-2026-0031', '10000000-0000-4000-8000-000000000001'::uuid,
    '{"so_van_ban":"BB-NT-2026-0031","co_so":"Tràng An","can_cu_hop_dong":"HĐ-NCC-2026-0014","ten_ncc":"Công ty Dịch vụ Tràng An Xanh","mst_ncc":"2700123456"}'::jsonb,
    '2026-06-30 15:00+07'::timestamptz),
  ('VB-MAU038', 'bien-ban-nghiem-thu', 'BB-NT-2026-0038', '10000000-0000-4000-8000-000000000001'::uuid,
    '{"so_van_ban":"BB-NT-2026-0038","co_so":"Tràng An","can_cu_hop_dong":"HĐ-NCC-2026-0014","ten_ncc":"Công ty Dịch vụ Tràng An Xanh","mst_ncc":"2700123456"}'::jsonb,
    '2026-09-30 15:00+07'::timestamptz),
  ('VB-MAU007', 'hop-dong-nguoi-cheo', 'HĐ-NC-2026-0007', '10000000-0000-4000-8000-000000000001'::uuid,
    '{"so_van_ban":"HĐ-NC-2026-0007","co_so":"Tràng An","so_thuyen":"03"}'::jsonb, '2025-12-28 09:00+07'::timestamptz),
  ('VB-MAU009', 'hop-dong-nguoi-cheo', 'HĐ-NC-2026-0009', '10000000-0000-4000-8000-000000000005'::uuid,
    '{"so_van_ban":"HĐ-NC-2026-0009","co_so":"Tam Cốc","so_thuyen":"05"}'::jsonb, '2026-04-28 09:00+07'::timestamptz)
) as v(id, loai, so, site_id, he_thong, luc)
where exists (select 1 from public.tenants where id = '00000000-0000-4000-8000-000000000001'::uuid)
  and exists (select 1 from public.sites where id = v.site_id)
on conflict do nothing;

insert into public.erp_van_ban_nop (tenant_id, phat_hanh_id, loai, so_van_ban, site_id, ket_qua, gia_tri, phat_hien, ap_dung, nop_boi, nop_ten, nop_luc, duyet_ten, duyet_luc, la_mau)
select p.tenant_id, p.id, p.loai, p.so_van_ban, p.site_id, 'nhan', p.he_thong || v.gia_tri,
       '[{"muc":"chung","mucDo":"dat","noi":"Văn bản mẫu, nhận vào hệ thống khi dựng dữ liệu thử.","nguon":"luat"}]'::jsonb,
       'Văn bản mẫu.', 'director-001', 'Dữ liệu mẫu', p.phat_hanh_luc + interval '2 days', 'Dữ liệu mẫu', p.phat_hanh_luc + interval '2 days', true
from public.erp_van_ban_phat_hanh p
join (values
  ('VB-MAU014', '{"ten_ncc":"Công ty Dịch vụ Tràng An Xanh","mst_ncc":"2700123456","dia_chi_ncc":"Số 18 đường Tràng An, phường Hoa Lư, tỉnh Ninh Bình","nguoi_dai_dien":"Bùi Thị Hạnh","noi_dung":"Thu gom rác trên sông và vệ sinh bến thuyền Tràng An, hai lượt mỗi ngày","gia_tri":"180.000.000","thue_suat":"8","tu_ngay":"01/03/2026","den_ngay":"31/12/2026","ngay_ky":"26/02/2026"}'::jsonb),
  ('VB-MAU021', '{"ten_ncc":"Hợp tác xã Dịch vụ Tam Cốc","mst_ncc":"2700765432","dia_chi_ncc":"Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình","nguoi_dai_dien":"Phạm Văn Thành","noi_dung":"Cho thuê 40 áo phao và bảo dưỡng áo phao hằng tháng ở bến Văn Lâm","gia_tri":"54.000.000","thue_suat":"8","tu_ngay":"15/04/2026","den_ngay":"14/04/2027","ngay_ky":"10/04/2026"}'::jsonb),
  ('VB-MAU031', '{"noi_dung":"Thu gom rác trên sông, vệ sinh bến thuyền tháng 3 đến tháng 6","gia_tri":"60.000.000","ngay_nghiem_thu":"30/06/2026","ket_luan":"Đạt","dai_dien_a":"Nguyễn Thị Thu Trang","dai_dien_b":"Bùi Thị Hạnh"}'::jsonb),
  ('VB-MAU038', '{"noi_dung":"Thu gom rác trên sông, vệ sinh bến thuyền tháng 7 đến tháng 9","gia_tri":"45.000.000","ngay_nghiem_thu":"30/09/2026","ket_luan":"Đạt","dai_dien_a":"Nguyễn Thị Thu Trang","dai_dien_b":"Bùi Thị Hạnh"}'::jsonb),
  ('VB-MAU007', '{"ho_ten":"Bùi Văn Thắng","ngay_sinh":"02/09/1979","so_cccd":"037079004321","dia_chi":"Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình","so_dien_thoai":"","loai_hop_dong":"Dài hạn","tu_ngay":"01/01/2026","den_ngay":"","tien_cong":"200.000","ngay_ky":"28/12/2025"}'::jsonb),
  ('VB-MAU009', '{"ho_ten":"Vũ Thị Hương","ngay_sinh":"11/05/1990","so_cccd":"037190005512","dia_chi":"Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình","so_dien_thoai":"","loai_hop_dong":"Thời vụ","tu_ngay":"01/05/2026","den_ngay":"31/10/2026","tien_cong":"170.000","ngay_ky":"28/04/2026"}'::jsonb)
) as v(id, gia_tri) on v.id = p.id
where not exists (select 1 from public.erp_van_ban_nop n where n.phat_hanh_id = p.id);

commit;
