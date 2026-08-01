# RÀ SOÁT TỪ GÓC NHÌN KHÁCH HÀNG — 02/08/2026

> Yêu cầu của chủ dự án: đứng ở vị trí khách hàng, đi lại toàn bộ ERP và web công khai, đối chiếu quy trình với đời thực, trả lời câu hỏi "có nên làm account switcher không", và nói thẳng: **nếu tôi là khách, tôi có xuống tiền đầu tư dự án này không?**
>
> **Đây là bản ghi chú — chưa sửa gì.** Mọi khẳng định dưới đây đều đã kiểm trực tiếp trên mã nguồn hoặc trên production ngày 02/08/2026, không lấy lại từ tài liệu cũ.

---

## 1. Câu hỏi về account switcher — trả lời thẳng

**Khách hoàn toàn đúng.** Bắt người đánh giá đăng xuất/đăng nhập lại 10 lần để xem 5 vai trò là một trải nghiệm tệ, và tệ nhất đúng vào lúc quan trọng nhất: lúc khách đang quyết định có tin hệ thống này không.

### Hiện trạng thật (đã kiểm)

Đã **có** tính năng chuyển vai trò (V3, `components/erp/role-switch-control.tsx`), đang bật trên production. Nhưng nó không giải quyết được việc khách cần:

| Vấn đề | Hệ quả với người đi demo |
|---|---|
| **Chỉ giám đốc thấy** | Muốn xem quản lý → nhân viên, phải biết trước là phải đăng nhập bằng `giamdoc`. Không ai đoán ra điều này. |
| **Chỉ nhảy được một chặng** | `startRoleSwitch` ném lỗi nếu phiên đang ở vai trò khác: *"quay lại giám đốc trước khi đổi tiếp"*. Từ quản lý Tam Chúc sang nhân viên Tràng An mất **3 lượt điều hướng**. Đây đúng là thứ khách phàn nàn, chỉ là dạng nhẹ hơn đăng xuất. |
| **Nút nằm khuất** | Một `<details>` chữ nhỏ trên thanh đầu trang, không có gợi ý nào cho biết nó tồn tại. |
| **Mật khẩu in thẳng trên trang đăng nhập** | Đã kiểm trên production: `/erp/login` hiện đủ 9 tài khoản kèm mật khẩu. Tiện cho demo, nhưng người mua nhìn vào sẽ nghĩ ngay: *"hệ thống quản trị mà mật khẩu dán ngoài cửa"*. |

### Nên làm gì (đề xuất, chưa làm)

**Có — nên làm, và nên làm đúng dạng "bảng điều khiển trình diễn", không phải nút giấu trong menu.**

1. **Cho nhảy thẳng giữa hai vai trò bất kỳ.** Bỏ ràng buộc phải quay về giám đốc. An toàn vẫn giữ nguyên vì `actingAsFor` luôn giữ danh tính giám đốc thật — chỉ cần cho phép đổi tiếp thay vì ném lỗi. Đây là thay đổi nhỏ nhất mang lại lợi ích lớn nhất.
2. **Một thanh trình diễn luôn hiện** khi bật chế độ demo: đang xem với vai trò nào, và các chip bấm một phát để đổi (Giám đốc · QL Tràng An · NV Tràng An · Kế toán · KT trưởng). Kèm câu giải thích: *"Đây là phiên đăng nhập thật của tài khoản đó — kể cả những chỗ họ bị chặn."*
3. **Giữ nguyên phần đang làm đúng:** băng thông báo thường trực, ghi nhật ký kiểm toán, và việc chuyển vai trò là **đổi phiên thật** chứ không phải cờ giao diện. Đây là điểm mạnh, đừng đánh đổi để lấy tốc độ.
4. **Ẩn mật khẩu trên trang đăng nhập theo biến môi trường** (đã có trong backlog là V10). Trong chế độ demo thì thay bằng nút "đăng nhập nhanh theo vai trò" — vừa nhanh hơn gõ tay, vừa không phô mật khẩu.
5. **Chốt chặn bắt buộc:** toàn bộ khối này phải tắt được bằng một biến môi trường và **phải tắt khi bàn giao thật**. Một hệ thống cho phép người này hoá thân thành người kia mà không tắt được là lỗ hổng, không phải tính năng.

**Rủi ro cần nói trước với khách:** chính tính năng tiện này là thứ kiểm toán viên sẽ hỏi đầu tiên. Phải trình bày nó như *chế độ trình diễn có kiểm soát*, kèm nhật ký, chứ không phải "ai cũng vào được tài khoản người khác".

---

## 2. Rà soát ERP từ trên xuống — đối chiếu với vận hành thật

### 2.1 Bức tranh tổng thể

15 module trong menu. Kiểm mã nguồn (`components/erp/module-workspace.tsx`): **10 module có màn hình nghiệp vụ thật**, **5 module rơi vào bảng số tĩnh dùng chung**:

| Có nghiệp vụ thật (10) | Chỉ là bảng số tĩnh (5) |
|---|---|
| Vé & đặt chỗ · Check-in khách · Camera AI · Báo cáo hiện trường · Dự án & sự kiện · Sự cố · Nhân sự · Chấm công · Đối tác & NCC · Tài chính & đối soát | **Sức chứa & luồng khách** · **Xe trung chuyển** · **Tài sản & nghiệm thu** · **SOP & diễn tập** · **Báo cáo & dự báo** |

Đáng chú ý: **Sức chứa** và **SOP** nằm trong nhóm tĩnh, mà đây lại đúng hai thứ tài liệu khách nhấn mạnh nhất (playbook ngưỡng đông khách Tam Chúc, điều kiện Go/No-Go trước giờ mở cửa). Menu đang hứa nhiều hơn sản phẩm giao.

### 2.2 Ba chỗ đứt gãy so với đời thực — đã kiểm ở tầng cơ sở dữ liệu

Đây là phần nghiêm trọng nhất của toàn bộ bản rà soát.

#### 🔴 A. Cổng soát vé không kiểm vé — chấp nhận bất kỳ chuỗi ký tự nào

`erp_gate_scan_events` (migration 012) chỉ có: `code text` (6–60 ký tự), ai quét, lúc nào.

- **Không có khoá ngoại** tới booking hay pass nào.
- **Không kiểm tra hợp lệ** — nhân viên gõ `ABC123` là hệ thống ghi nhận một lượt vào cổng.
- **Không chống quét trùng** — chỉ có index thường trên `(site_id, code, scanned_at)`, **không có ràng buộc `unique`**, cũng không có idempotency key (trong khi chấm công thì có, báo cáo hiện trường có `report_code` unique — nên đây là thiếu sót, không phải lựa chọn thiết kế).

**Đối chiếu đời thực:** cổng soát vé là **điểm kiểm soát doanh thu**. Một khu du lịch mà cổng ghi nhận được cả mã không tồn tại và ghi được cùng một vé nhiều lần thì con số "lượt khách" không dùng để đối soát tiền được, và cũng không dùng để tính sức chứa được. Đây là gốc rễ, không phải chi tiết.

#### 🔴 B. Chốt ca dừng ở bút toán, tiền không đi tiếp

`erp_ticket_shift_closures` có trạng thái cuối là `posted`. **Không có** trạng thái nộp quỹ / nộp ngân hàng / đối chiếu sao kê.

**Đối chiếu đời thực:** doanh nghiệp thu tiền mặt thì quy trình còn hai bước nữa sau khi ghi sổ. Thiếu hai bước đó thì tiền có thể được duyệt trên giấy mà **không bao giờ về đến két**, và hệ thống không phát hiện được. Tài liệu khách yêu cầu *"đối soát nguồn tiền 100%"* — hiện mới đối soát tới bút toán.

#### 🔴 C. Công nợ nhà cung cấp không có bước chi tiền

`erp_ap_supplier_invoices` có trạng thái cuối là `posted` / `reversed`. **Không có `paid`.**

**Đối chiếu đời thực:** hệ thống ghi nhận *nợ ai bao nhiêu* rất chặt (maker≠checker, đối chiếu 3 chiều, ngoại lệ lên giám đốc — phần này làm tốt thật), nhưng **không bao giờ ghi nhận đã trả**. Nhà cung cấp gọi điện hỏi "đã chuyển tiền chưa" thì mở hệ thống ra không trả lời được.

> **Tóm lại ba mục trên:** hệ thống kiểm soát rất chặt **khúc giữa** của quy trình, nhưng **cả hai đầu — tiền vào và tiền ra — đều hở.** Đây là điều một người mua có nghề sẽ nhìn ra trong 15 phút.

### 2.3 Mô hình tài khoản — chưa dùng được với người thật

| Vấn đề | Bằng chứng | Vì sao chặn triển khai |
|---|---|---|
| Không tạo được người mới | 10 tài khoản nằm cứng trong `lib/erp/demo-data.ts` | Tuyển một nhân viên mới phải sửa mã nguồn và deploy lại |
| Mật khẩu dùng chung theo cấp | 4 quản lý chung `Quanly@2026`, 5 nhân viên chung `Nhanvien@2026` | **Mọi dòng nhật ký kiểm toán đều chối bỏ được** — "ai cũng biết mật khẩu đó". Toàn bộ giá trị maker≠checker sụp đổ ngay tại đây |
| Mật khẩu in trên trang đăng nhập production | Đã kiểm bằng `curl` | Không thể để nguyên khi có người thật dùng |
| Không có đổi mật khẩu / bắt đổi lần đầu / 2FA | — | Vai trò tài chính không có lớp bảo vệ thứ hai |
| Thiếu vai trò **trưởng ca** | Chỉ có 5 vai trò | 4 cơ sở × nhiều ca/ngày mà không có cấp trung gian; người duyệt phiếu trong ca thực tế là trưởng ca, không phải quản lý ngồi văn phòng |

### 2.4 Thiếu cơ chế cho hiện trường thật

- **Không có chế độ ngoại tuyến.** Không có service worker, không xử lý mất mạng ở bất kỳ đâu trong ERP (đã tìm toàn bộ mã nguồn). Bến thuyền Tràng An, hang động, khu núi Tam Chúc — sóng chập chờn là chuyện thường ngày. Nhân viên soát vé mất mạng 5 phút là mất luôn 5 phút dữ liệu cổng.
- **Chưa có bàn giao ca** (V16, một trong tám tiêu chí nghiệm thu pilot của chính khách). Hết ca không có biên bản, không có người ký nhận, không tổng hợp việc còn treo.
- **Chưa có tìm kiếm / command palette.** 15 module × 4 cơ sở mà muốn mở một hồ sơ phải nhớ nó nằm ở đâu.
- **Dữ liệu demo có mốc thời gian cố định** nên mọi sự cố đang mở đều vĩnh viễn quá hạn — từ hôm nay còn tự chuyển cấp (V15). Đúng về mặt kỹ thuật, nhưng buổi demo sẽ mở ra là thấy toàn màu đỏ.

### 2.5 Những thứ thật sự tốt — cần nói rõ để không đánh giá sai

Phần này không phải lời khen xã giao; đây là những thứ hiếm gặp ở sản phẩm giai đoạn demo:

- **Nền bảo mật đạt chuẩn thật.** RLS bật trên **100%** bảng, **0 policy cho `anon`**, RPC nghiệp vụ chỉ `service_role` gọi được, **0 hàm thiếu `search_path`**. Đây là mức mà nhiều sản phẩm đã bán vẫn chưa đạt.
- **Phân tách nhiệm vụ có thật.** Kế toán lập ≠ người duyệt; quản lý không tự duyệt hồ sơ mình tạo; ngoại lệ đẩy lên giám đốc. Có khoá phiên bản, có idempotency, có nhật ký kiểm toán không sửa được.
- **Dữ liệu chảy thật xuyên tài khoản.** Đã kiểm chứng nhiều lần bằng hai trình duyệt tách biệt trên production thật: một người thao tác, người khác ở phiên khác thấy ngay.
- **Đã có cơ chế chạy theo thời gian** (V15, từ 02/08): sự cố quá hạn tự chuyển cấp, có nhật ký ghi rõ "Hệ thống" làm, chạy lại không nhân bản dữ liệu.
- **Trung thực trong hiển thị.** Chỗ chưa có dữ liệu thì ghi "chưa có nguồn dữ liệu"; trang gói dịch vụ ghi thẳng *"Indicative catalog · online booking unavailable"* thay vì gắn nút Mua giả. Đây là thái độ đúng và hiếm.

---

## 3. Web công khai — rà soát

### 3.1 🔴 Không bán được hàng, và bị chặn ở tầng cấu hình

`config/experience.ts`: `sandboxPaymentEnabled: isDemo`, kèm một luật kiểm tra **cấm** chế độ production bật thanh toán sandbox (*"Production mode cannot silently enable sandbox checkout"*).

Nghĩa là: **ở chế độ demo thì có checkout giả, ở chế độ production thì không có checkout nào cả.** Không hề có tích hợp cổng thanh toán thật. Đã kiểm trên production: trang `/packages` ghi rõ *"Indicative catalog · online booking unavailable"*, giá gắn nhãn "demo".

Trung thực — nhưng nghĩa là **một nửa lời hứa của sản phẩm ("destination commerce and operations") hiện chưa tồn tại.**

### 3.2 🟠 Web và ERP đang nói về hai doanh nghiệp khác nhau

| | Web công khai | ERP |
|---|---|---|
| Số điểm | **8** (Tràng An, Hoa Lư cố đô, Bái Đính, Phố cổ Hoa Lư, Tam Cốc–Bích Động, Hang Múa, Thung Nham, Vân Long) | **4** (Tràng An, Tam Chúc, Tam Cốc, Bái Đính) |
| Giao nhau | Chỉ 3 điểm | |

**Tam Chúc không xuất hiện một lần nào trên web công khai** (đã kiểm: 0 lần nhắc) — trong khi nó là cơ sở được dùng nhiều nhất trong ERP. Ngược lại Hang Múa, Thung Nham, Vân Long, Hoa Lư có trên web nhưng ERP không vận hành.

Khách bấm vào một điểm trên web rồi hỏi "vậy tôi quản lý nó ở đâu trong hệ thống?" — hiện không có câu trả lời.

### 3.3 🟠 Ba hệ điều hành song song cùng chạy trên production

Đã kiểm, cả ba đều trả về HTTP 200 công khai:

| Đường dẫn | Là gì | Cơ chế đăng nhập |
|---|---|---|
| `/erp` | 15 module, dữ liệu Supabase thật | Cookie phiên ký, 10 tài khoản nằm trong mã nguồn |
| `/ops` | Bookings, sức chứa, check-in, sự cố, copilot | **Supabase Auth thật** — hệ tài khoản hoàn toàn khác |
| `/demo/ops` | Bảng điều hành trình diễn | Không cần đăng nhập, **số liệu hư cấu** |

Một người mua đi một vòng sẽ gặp **hai màn hình đăng nhập vận hành khác nhau** và một bảng điều hành thứ ba với số liệu bịa. Câu hỏi đầu tiên của họ sẽ là: *"Rốt cuộc tôi đang mua cái nào?"* — và đây là câu hỏi làm mất niềm tin nhanh nhất, nhanh hơn bất kỳ lỗi kỹ thuật nào ở trên.

### 3.4 🟡 Còn lại

- Nội dung nằm trong mã nguồn (`content/destinations.ts`) — sửa một dấu phẩy phải deploy lại.
- Chưa có video, audio thuyết minh, khu vực báo chí.
- Chưa có khái niệm khách sạn / nhà hàng / hướng dẫn viên — trong khi tài liệu khách xếp portal đối tác vào giai đoạn 3, nên chấp nhận được ở giai đoạn này.

---

## 4. Nếu tôi là khách, tôi có đầu tư không?

### Trả lời ngắn: **Có — nhưng có điều kiện, và không phải với số tiền của một sản phẩm hoàn chỉnh.**

### Vì sao "có"

Ba thứ này không mua được bằng tiền một cách nhanh chóng, và dự án đã có:

1. **Phần lõi kỹ thuật ở mức doanh nghiệp thật, không phải demo sơn phết.** RLS 100%, phân tách nhiệm vụ thật, nhật ký kiểm toán không sửa được, khoá phiên bản, idempotency. Một đội làm được phần này thì làm được phần còn lại.
2. **Kỷ luật kiểm chứng.** Mọi thứ được xác nhận trên production thật bằng nhiều phiên đăng nhập tách biệt, không phải "chạy được trên máy tôi". Trong phiên làm việc gần nhất, đội còn tự tìm ra và sửa một lỗi có thật đã âm thầm làm hỏng trợ lý điều hành, và tự dọn dữ liệu rác do chính bài test sinh ra.
3. **Trung thực về chỗ chưa có.** Ghi "chưa có nguồn dữ liệu" thay vì bịa số đẹp. Đây là chỉ dấu về tính cách của đội — quan trọng hơn bất kỳ tính năng nào khi đi đường dài.

### Vì sao "có điều kiện"

Ở trạng thái hôm nay, đây là **lõi vận hành cấp pilot**, chưa phải sản phẩm bán được:

- **Hai đầu dòng tiền đều hở** (cổng không kiểm vé, không có bước chi tiền, không có bước nộp quỹ). Không thể dùng để đối soát doanh thu thật.
- **Không thể có người thật dùng** — không tạo được tài khoản, mật khẩu dùng chung, in trên trang đăng nhập.
- **Ba hệ song song trên production** làm hỏng chính câu chuyện "một hệ thống chịu trách nhiệm duy nhất".
- **5/15 module rỗng**, trong đó có đúng hai thứ khách quan tâm nhất (sức chứa, SOP).
- **Web không thu được tiền** — nửa thương mại của sản phẩm chưa tồn tại.

### Nếu tôi ngồi ở ghế người mua, tôi sẽ nói thế này

> *"Tôi tin đội này làm được. Nhưng tôi không ký hợp đồng trọn gói cho một sản phẩm mà tôi vừa nhìn thấy hai màn hình đăng nhập vận hành khác nhau, năm mục menu rỗng, và một cổng soát vé nhận bất kỳ chuỗi ký tự nào. Tôi sẽ cấp vốn cho **một giai đoạn tiếp theo có phạm vi rõ và có cổng nghiệm thu**, và tôi muốn ba thứ trước khi bàn tiếp: gộp về một hệ thống duy nhất, cổng soát vé kiểm được vé thật, và tài khoản là người thật với mật khẩu riêng."*

---

## 5. Thứ tự việc nên làm (ghi chú, chưa thực hiện)

Sắp theo **tác động lên quyết định của người mua**, không theo độ khó.

### Đợt A — Trước buổi demo tiếp theo (rẻ, đổi hẳn ấn tượng)

| # | Việc | Vì sao trước tiên |
|---|---|---|
| A1 | **Quyết định dứt điểm về `/ops` và `/demo/ops`**: gộp vào `/erp`, hoặc gỡ khỏi production, hoặc ghi rõ đây là bản trình diễn cũ | Đây là thứ làm mất niềm tin nhanh nhất, và **sửa gần như không tốn công code** — chỉ cần một quyết định |
| A2 | **Bảng chuyển vai trò nhanh** + cho nhảy thẳng giữa hai vai trò + ẩn mật khẩu trên trang đăng nhập | Đúng điều khách vừa nêu. Rẻ, và chạm vào cảm nhận của người đánh giá ngay từ phút đầu |
| A3 | **5 module rỗng: làm thật hoặc gỡ khỏi menu**, ghi rõ "giai đoạn sau" | Menu có mục rỗng làm hỏng niềm tin nhiều hơn là thiếu mục |
| A4 | **Làm mới mốc thời gian dữ liệu demo** trước mỗi buổi trình bày | Nếu không, mở ra là toàn màu đỏ quá hạn |

### Đợt B — Đóng hai đầu dòng tiền (đắt, nhưng là gốc rễ)

| # | Việc |
|---|---|
| B1 | **Cổng soát vé kiểm vé thật**: nối với booking/pass, chống quét trùng bằng ràng buộc `unique` ở cơ sở dữ liệu, tra cứu theo mã/tên/SĐT *(V6 trong backlog)* |
| B2 | **Nguồn vé thật** thay cho nhân viên gõ tay số vé/doanh thu *(V7)* |
| B3 | **Nộp quỹ → nộp ngân hàng → đối chiếu sao kê** sau chốt ca *(L9)* |
| B4 | **Đề nghị → duyệt → chi** cho công nợ nhà cung cấp, thêm trạng thái `paid` *(L10)* |

### Đợt C — Trước khi có người thật dùng

| # | Việc |
|---|---|
| C1 | **Bảng tài khoản thật trong Supabase**, tạo/khoá/đổi mật khẩu, một tài khoản một người, bắt đổi mật khẩu lần đầu *(V17)* |
| C2 | **Vai trò trưởng ca** + **bàn giao ca** *(V16, V19 — một trong tám tiêu chí nghiệm thu pilot)* |
| C3 | **Chế độ ngoại tuyến cho hiện trường** — ít nhất là hàng đợi quét cổng khi mất mạng |
| C4 | **Sức chứa có ngưỡng thật + SOP Go/No-Go** *(V8, V9 — đúng hai thứ khách nhấn mạnh nhất)* |

### Đợt D — Nửa thương mại

| # | Việc |
|---|---|
| D1 | Quyết định mô hình thanh toán thật (cổng nào, ai giữ tiền, ai chịu trách nhiệm hoàn/huỷ) — **đây là quyết định kinh doanh, không phải kỹ thuật** |
| D2 | Đồng bộ danh mục điểm giữa web và ERP (đặc biệt: Tam Chúc có trên ERP nhưng không có trên web) |
| D3 | Đưa nội dung ra khỏi mã nguồn |

---

## 6. Ba câu chốt

1. **Lõi kỹ thuật đã ở mức doanh nghiệp thật; hai đầu dây chuyền thì chưa nối.** Hệ thống kiểm soát rất chặt khúc giữa, nhưng tiền vào và tiền ra đều hở.
2. **Thứ làm mất điểm nặng nhất với người mua lại là thứ rẻ nhất để sửa:** ba hệ điều hành song song, năm mục menu rỗng, mật khẩu dán trên cửa. Không cần viết thêm nghiệp vụ nào — chỉ cần quyết định và dọn dẹp.
3. **Về account switcher: nên làm, làm nhanh, và phải tắt được khi bàn giao.** Nhưng nó là việc nhỏ. Đừng để nó che mất ba việc lớn ở mục 2.2.
