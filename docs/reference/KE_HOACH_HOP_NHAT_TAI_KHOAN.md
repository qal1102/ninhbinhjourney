# KẾ HOẠCH HỢP NHẤT TÀI KHOẢN & PHÂN QUYỀN — 02/08/2026

> Trả lời câu hỏi của chủ dự án: hai màn hình `/ops` và `/erp` xử lý ra sao, có nên dùng thẳng tài khoản Supabase không, có nên làm module quản lý tài khoản với giám đốc là superadmin không, và mô hình "quản lý khu nào chỉ thấy khu đó trừ khi giám đốc mở thêm" có ổn không.
>
> **Đây là kế hoạch — chưa sửa gì.** Toàn bộ số liệu dưới đây lấy trực tiếp từ Supabase production ngày 02/08/2026 bằng truy vấn, không suy đoán từ mã nguồn.

---

## 0. Ba phát hiện làm thay đổi toàn bộ cách nhìn

Bản rà soát hôm qua nhìn từ ngoài nên chỉ thấy *"có hai màn hình đăng nhập"*. Đào xuống tầng dữ liệu thì vấn đề khác hẳn về bản chất.

### 🔴 Phát hiện 1 — Có một lỗi thật đang chặn 3/4 quản lý dùng module Đối tác & NCC

RPC `erp_ap_submit_supplier_invoice` chặn bằng đúng câu này:

```sql
if v_actor.account_id is null
   or not public.erp_account_has_active_role(tenant, actor, 'regional-manager', site_id) then
  raise exception 'AP_MANAGER_ROLE_REQUIRED';
```

Nó tra `erp_account_registry` — một bảng tài khoản **có thật trong Supabase mà app chưa từng đọc**. Chạy đúng hàm đó trên production:

| Tài khoản | Cơ sở | Gửi được hoá đơn NCC? |
|---|---|---|
| `manager-trang-an` | Tràng An | ✅ **true** |
| `manager-tam-chuc` | Tam Chúc | ❌ **false** |
| `manager-tam-coc` | Tam Cốc | ❌ **false** |
| `manager-bai-dinh` | Bái Đính | ❌ **false** |

**Nguyên nhân:** V12 (01/08) tách một quản lý vùng thành bốn quản lý cơ sở trong `lib/erp/demo-data.ts`, nhưng **không ai cập nhật bảng tài khoản dưới Supabase**. Registry vẫn giữ ảnh chụp cũ: 10 tài khoản, **chỉ có đúng 1 quản lý**, và quản lý đó đang giữ vai trò `regional-manager` trên **cả 4 cơ sở**.

**Vì sao chưa ai phát hiện:** `prod-smoke-ap.spec.ts` đăng nhập bằng `ql.vanhanh` — đúng cái tài khoản duy nhất còn chạy được. Test xanh, tính năng hỏng ở 3/4 cơ sở.

**Hệ quả thứ hai, về dữ liệu:** truy vấn cho thấy **toàn bộ hoá đơn NCC ở cả bốn cơ sở đều đang mang tên `manager-trang-an`** — kể cả hoá đơn của Tam Chúc, Tam Cốc, Bái Đính. Trong một hệ thống lấy maker≠checker làm giá trị cốt lõi, đây là **ghi sai người chịu trách nhiệm**, không phải lỗi hiển thị.

**Hệ quả thứ ba, về nguyên tắc:** app nói *"quản lý Tràng An chỉ thấy Tràng An"* (V12/V14), cơ sở dữ liệu nói *"manager-trang-an là quản lý vùng của cả bốn cơ sở"*. **Hai tầng đang mâu thuẫn nhau về quyền.** Hôm nay chưa khai thác được vì tầng app chặn trước, nhưng tầng dữ liệu mới là tầng đáng tin — và nó đang sai.

### 🔴 Phát hiện 2 — `/ops` không phải "hệ thống thứ hai". Nó là một hệ thống bị bỏ dở, rỗng hoàn toàn

| Bảng | Số dòng |
|---|---|
| `auth.users` | **0** |
| `user_profiles` | **0** |
| `tenant_memberships` | **0** |
| `erp_site_assignments` | **0** |

**Không một ai có thể đăng nhập vào `/ops`.** Màn hình đăng nhập vẫn công khai trên production (HTTP 200), nhưng phía sau không có một tài khoản nào.

Và không chỉ tài khoản — **cả mô hình dữ liệu của nó cũng rỗng**:

| Bảng thời `/ops` | Dòng | Bảng ERP làm cùng việc đó | Dòng |
|---|---|---|---|
| `incidents` | 0 | `erp_incidents` | 12 |
| `erp_projects` + `erp_project_work_items` | 0 | `erp_project_events` + `erp_project_action_items` | 4 + 12 |
| `erp_ticket_scans` | 0 | `erp_gate_scan_events` | 7 |
| `erp_attendance_events` | 0 | `erp_staff_attendance_events` | có dữ liệu |
| `erp_site_assignments` | 0 | `erp_employee_access` | 10 |
| `erp_partners` + 3 bảng con | 0 | `erp_ap_suppliers` + hệ AP | có dữ liệu |
| `erp_camera_sources`, `erp_camera_events`, `erp_decision_items`, `erp_operational_signals`, `erp_finance_ledger_entries`, `erp_push_subscriptions`, `bookings`, `passes`, `quotes` | **0 tất cả** | | |

Trên tổng số **81 bảng**, khoảng **20 bảng là mô hình dữ liệu chết** — dựng ở migration 002 cho `/ops`, rồi bị bỏ và **xây lại từ đầu dưới tên khác** cho `/erp` ở các migration 003–024.

> **Đây mới là sự thật về "hai màn hình":** không phải hai sản phẩm cạnh tranh nhau, mà là **một cuộc chuyển kiến trúc bị bỏ dở giữa chừng.** Việc cần làm không phải "chọn một cái", mà là **hoàn tất cuộc chuyển đó cho tử tế.**

### 🟢 Phát hiện 3 — Thứ anh muốn xây thì phần khó nhất đã có sẵn, chỉ chưa nối

`erp_account_registry` (migration 006, **10 dòng, app chưa từng đọc**):

```sql
account_id     text primary key          -- trùng đúng id trong demo-data.ts
auth_user_id   uuid unique references auth.users(id)   -- ⭐ cầu nối sang Supabase Auth ĐÃ CÓ
display_name   text
job_title      text
employment_type text  -- permanent | seasonal | management | finance | executive
status         text  -- active | suspended | revoked   ⭐ khoá/thu hồi tài khoản ĐÃ CÓ
```

`erp_account_role_assignments` (**13 dòng**): **một dòng cho mỗi (tài khoản × vai trò × cơ sở)**, có `effective_from`.

Và nó **đã chứng minh mô hình nhiều-cơ-sở chạy được**: `manager-trang-an` hiện có đúng 4 dòng, một dòng mỗi cơ sở. Tức là điều anh muốn — *"nhiều quản lý có thể quản lý tất cả khu vực"* — **bảng này đã làm được rồi**, chỉ là dữ liệu trong đó đã cũ và app không đọc nó.

Ngược lại, bảng mà app **đang** dùng thì không làm được:

```sql
erp_employee_access (
  employee_account_id text primary key,   -- một dòng cho mỗi người
  site_id uuid,                            -- ⚠️ MỘT cơ sở duy nhất
  module_ids text[]
)
```

Một tài khoản = một cơ sở. `sanitizeAccessState` còn cắt cứng `.slice(0, 1)`. **Cấu trúc hiện tại không thể diễn đạt "quản lý X phụ trách 3 khu"** — đúng yêu cầu anh vừa nêu.

---

## 1. Trả lời thẳng bốn câu hỏi của anh

### "Hai màn hình này sửa sao?"

**Gỡ `/ops` và `/demo/ops` khỏi production, giữ `/erp` làm hệ thống duy nhất.**

Vì: `/ops` có 0 tài khoản, 0 dữ liệu vận hành, và mọi bảng của nó đều rỗng. Không có gì để mất, không có dữ liệu để di trú. Đây là quyết định **rẻ nhất và có tác động lớn nhất** trong toàn bộ danh sách việc.

Cụ thể:
- Gỡ route `/ops/**` và `/demo/ops` khỏi bản production (giữ mã nguồn trong repo, đặt sau cờ môi trường nếu muốn xem lại lịch sử).
- Giữ nguyên hạ tầng Supabase Auth (`auth.users`, `user_profiles`, `tenant_memberships`, `has_tenant_role`) — **đây là thứ ta sắp dùng đến**, không phải thứ cần xoá.
- ~20 bảng chết: **chưa xoá vội.** Đánh dấu và để lại một migration dọn riêng sau khi chốt, vì một vài bảng còn bị policy hoặc hàm cũ tham chiếu.

### "Sao không dùng luôn tài khoản Supabase?"

**Nên — và đúng là hướng phải đi.** Nhưng cần nói rõ vì sao hiện chưa dùng, để không lặp lại sai lầm cũ:

`/erp` chạy bằng **service role**, tức là app dùng khoá quản trị và **tự kiểm quyền bằng TypeScript**. Đổi lại: RLS ở tầng dữ liệu **không bảo vệ được gì cho `/erp`** — nó chỉ chặn `anon`, mà `anon` thì vốn đã không đi qua đường này. Toàn bộ 143 policy RLS đang bảo vệ một mô hình không ai dùng.

Chuyển sang Supabase Auth nghĩa là: **quyền được thực thi ở tầng cơ sở dữ liệu**, đúng như tài liệu `/ops` từng hứa. Đó là bước đưa hệ thống từ "chặt ở tầng ứng dụng" lên "chặt ở tầng dữ liệu" — thứ mà kiểm toán viên hỏi tới.

**Nhưng đây là việc lớn** và phải làm có lộ trình (mục 2), không đổi một phát.

### "Làm module quản lý tài khoản, giám đốc là superadmin?"

**Đồng ý, với một chỉnh nhỏ về khái niệm.** Không nên gộp "giám đốc" và "superadmin" làm một:

| Vai trò | Làm gì | Vì sao tách |
|---|---|---|
| **Quản trị hệ thống** (superadmin) | Tạo/khoá tài khoản, gán vai trò, đổi mật khẩu | Đây là **quyền kỹ thuật**. Người giữ nó có thể tự cấp cho mình mọi quyền khác |
| **Giám đốc** | Xem toàn bộ, quyết định ngoại lệ, duyệt vượt ngưỡng | Đây là **quyền nghiệp vụ** |

Trong doanh nghiệp thật, giám đốc **thường được cấp cả hai** — không sao. Nhưng nếu hệ thống chỉ có một khái niệm gộp thì **nhật ký kiểm toán không phân biệt được** "giám đốc duyệt một khoản chi" với "giám đốc tự sửa quyền của chính mình rồi duyệt". Tách ra thì mỗi dòng nhật ký trả lời được câu hỏi *"lúc đó anh ta hành động với tư cách gì?"*.

Đề xuất: `erp_account_role_assignments` thêm vai trò `system-admin`; giám đốc mặc định được cấp cả `director` lẫn `system-admin`; **mọi thao tác dùng quyền `system-admin` ghi nhật ký riêng.**

### "Quản lý khu nào chỉ thấy khu đó, trừ khi giám đốc mở thêm — nhiều quản lý quản được nhiều khu?"

**Đúng hướng, và đây là mô hình chuẩn.** Nhưng phải nói thẳng: **cấu trúc hiện tại không làm được**, cần đổi bảng (mục 2, bước 2).

Mô hình đề xuất — mọi thứ đều là *cấp phát*, không có gì cứng trong mã nguồn:

```
tài khoản  ──< gán vai trò >──  (vai trò, cơ sở)
                                      │
                                      └──< cấp module >── module
```

- Quản lý cơ sở: mặc định **1 dòng** (vai trò `manager` × cơ sở của họ).
- Giám đốc mở thêm khu cho một quản lý = **thêm một dòng**. Không sửa mã nguồn, không deploy.
- Một quản lý phụ trách cả 4 khu = **4 dòng**. Đây chính là điều `manager-trang-an` đang có sẵn trong registry.
- Kế toán / kế toán trưởng: dòng có `site_id = null` nghĩa là **toàn vùng** — cơ chế này registry cũng đã hỗ trợ.
- Giám đốc: `director` toàn vùng. **Không còn cấp cứng 15 module trong `demo-session.ts`** như hiện nay, mà là một cấp phát thật, để nhật ký ghi được và để về sau có thể có nhiều giám đốc/phó giám đốc với phạm vi khác nhau.

---

## 2. Lộ trình đề xuất — 5 bước, mỗi bước tự đứng được

Nguyên tắc: **không có bước nào bắt buộc phải làm cùng lúc với bước sau.** Dừng ở bất kỳ đâu hệ thống vẫn chạy. Đây là điều kiện quan trọng nhất, vì lần trước cuộc chuyển kiến trúc bị bỏ dở chính giữa và để lại 20 bảng chết.

### Bước 0 — Vá lỗi AP ngay *(nhỏ, làm trước mọi thứ)*

Chỉ là dữ liệu: thêm 3 quản lý còn thiếu vào `erp_account_registry`, cấp `regional-manager` đúng cơ sở của từng người, và **thu hẹp `manager-trang-an` về đúng Tràng An**. Kèm sửa dữ liệu hoá đơn NCC đang gắn sai tên quản lý ở 3 cơ sở.

Kèm theo — quan trọng không kém: **sửa `prod-smoke-ap.spec.ts` chạy với cả 4 quản lý**, vì chính việc chỉ test một tài khoản đã giấu lỗi này suốt hai ngày.

> Bước này **không phụ thuộc** lộ trình dưới. Nên làm ngay dù sau đó có đổi kiến trúc hay không.

### Bước 1 — Registry thành nguồn sự thật duy nhất về *danh tính* *(vừa)*

- `getCurrentErpUser()` đọc tên, chức danh, trạng thái từ `erp_account_registry` thay vì `demo-data.ts`.
- `demo-data.ts` **chỉ còn giữ mật khẩu demo** — thu hẹp dần vai trò của nó.
- Thêm trạng thái `suspended`/`revoked` có tác dụng thật: khoá tài khoản là chặn đăng nhập ngay.
- **Chưa đụng tới đăng nhập.** Vẫn cookie phiên như hiện tại.

*Kết thúc bước này: tạo/khoá được người mà không cần deploy — giải quyết L12, thứ đang chặn triển khai thật.*

### Bước 2 — Phân quyền thành nhiều dòng *(vừa, đây là bước anh vừa yêu cầu)*

- Bỏ giới hạn một-cơ-sở: `erp_employee_access` chuyển sang khoá chính `(account_id, site_id)`, hoặc gộp thẳng module vào `erp_account_role_assignments`. **Nghiêng về phương án hai** — bớt được một bảng và bớt một nguồn sự thật.
- Bỏ `managedSiteIds`/`initialModuleIds` cứng trong `demo-data.ts`.
- Bỏ nhánh "giám đốc được cấp cứng 15 module" trong `demo-session.ts` — thay bằng cấp phát thật.
- Thêm vai trò `system-admin`.

*Kết thúc bước này: giám đốc mở thêm khu cho một quản lý bằng vài cú bấm; một quản lý phụ trách nhiều khu là chuyện bình thường.*

### Bước 3 — Module "Quản lý tài khoản" *(vừa)*

Một màn hình duy nhất cho superadmin: danh sách người · tạo mới · khoá/mở · gán vai trò × cơ sở · cấp module · xem nhật ký thay đổi quyền.

Gộp luôn màn hình phân quyền nhân viên hiện có trong `nhan-su` vào đây thay vì để hai chỗ làm cùng một việc.

### Bước 4 — Đăng nhập thật bằng Supabase Auth *(lớn — đây mới là bước đắt)*

- Mỗi dòng registry nối tới một `auth.users` qua `auth_user_id` (**cột này đã có sẵn**).
- Đăng nhập bằng email + mật khẩu riêng từng người, bắt đổi mật khẩu lần đầu, 2FA cho vai trò tài chính.
- **Bỏ mật khẩu dùng chung, bỏ mật khẩu in trên trang đăng nhập.**
- Chuyển dần từ service role sang RLS thật: viết lại policy theo `erp_account_role_assignments` — lúc này 143 policy RLS mới thực sự bảo vệ ERP.

*Đây là bước làm cho lời hứa "quyền được thực thi ở tầng dữ liệu" thành sự thật. Cũng là bước phải làm trước khi có người thật dùng.*

### Bước 5 — Dọn xác *(nhỏ, nhưng chỉ làm sau khi bước 4 xong)*

Xoá ~20 bảng chết của `/ops` và các policy đi kèm. **Không làm sớm** — vài bảng còn bị hàm/policy cũ tham chiếu, xoá sớm là tự tạo sự cố.

---

## 3. Rà từng tài khoản theo hướng mới — có ổn không?

| Tài khoản | Hiện tại | Theo mô hình mới | Vấn đề cần xử lý |
|---|---|---|---|
| `director-001` | Cấp cứng 4 cơ sở × 15 module trong mã nguồn | `director` toàn vùng + `system-admin` | Tách hai quyền để nhật ký phân biệt được tư cách hành động |
| `manager-trang-an` | App: chỉ Tràng An. **DB: cả 4 cơ sở** | `manager` × Tràng An | **Mâu thuẫn hai tầng — phải sửa ở Bước 0** |
| `manager-tam-chuc` | App có, **DB không có** | `manager` × Tam Chúc | **Không dùng được module NCC — Bước 0** |
| `manager-tam-coc` | App có, **DB không có** | `manager` × Tam Cốc | **Như trên** |
| `manager-bai-dinh` | App có, **DB không có** | `manager` × Bái Đính | **Như trên** |
| `accountant-001` | 4 cơ sở × 7 module cứng | `accountant` toàn vùng (`site_id = null`) | Registry đã đúng, chỉ cần app đọc nó |
| `chief-accountant-001` | 4 cơ sở × 7 module cứng | `chief-accountant` toàn vùng | Như trên |
| 6 nhân viên | `erp_employee_access`, 1 cơ sở/người | `employee` × cơ sở của họ + module được cấp | Chuyển thẳng được, đã đúng cấu trúc |

**Kết luận: hướng anh đưa ra là đúng, và rẻ hơn anh nghĩ** — vì phần khó nhất (bảng registry, cầu nối sang Auth, mô hình vai trò × cơ sở nhiều dòng) **đã được thiết kế và đã nằm sẵn trong Supabase từ migration 006**, chỉ là chưa ai nối vào app và dữ liệu trong đó đã cũ mất một ngày.

**Ba cảnh báo:**

1. **Bước 0 phải làm ngay, độc lập.** Hiện 3/4 quản lý không dùng được module Đối tác & NCC trên production. Đừng để nó chờ một cuộc tái kiến trúc.
2. **Bước 4 là bước đắt nhất và dễ bỏ dở nhất** — đúng chỗ mà lần trước dự án đã gãy và để lại 20 bảng chết. Chỉ bắt đầu khi có đủ thời gian đi hết, hoặc chia nhỏ đến mức dừng giữa chừng vẫn dùng được.
3. **Càng nhiều nguồn sự thật về quyền càng nguy hiểm.** Hiện có ba: `demo-data.ts`, `erp_employee_access`, `erp_account_role_assignments`. Lỗi AP hôm nay sinh ra chính vì hai trong ba cái đó lệch nhau. Đích đến phải là **một nguồn duy nhất**, không phải bốn.

---

## 4. Việc phát sinh cần ghi nhận

- **Slug cơ sở lệch nhau:** bảng `sites` ghi `tam-coc-bich-dong`, app dùng `tam-coc`. Hôm nay không gây lỗi vì app ánh xạ bằng UUID, nhưng là mầm lỗi khi có ai viết truy vấn theo slug.
- **Test xanh vẫn giấu được lỗi.** Bài AP chỉ chạy một tài khoản nên không thấy 3/4 quản lý hỏng. Nguyên tắc nên bổ sung: **bài kiểm chứng phân quyền phải chạy với mọi vai trò/cơ sở tương đương, không chỉ một đại diện.**
- **RLS đang bảo vệ nhầm mục tiêu.** 143 policy viết cho mô hình `auth.uid()` mà `/erp` không dùng. Không phải lỗ hổng (service role vốn đi vòng qua RLS, và app tự kiểm), nhưng đừng nhầm con số "RLS 100%" là ERP đã được cơ sở dữ liệu bảo vệ — hiện chưa.
