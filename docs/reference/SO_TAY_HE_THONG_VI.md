# SỔ TAY HỆ THỐNG — NINH BÌNH JOURNEY

> **Tài liệu này trả lời: hệ thống này là gì, làm được những gì, và vận hành theo nguyên tắc nào.**
> Dùng được cho hai người đọc: khách hàng muốn hiểu sản phẩm, và người tiếp nhận dự án ở phiên làm việc sau.
>
> ⚠️ **Đây KHÔNG phải tài liệu trạng thái.** Nó mô tả *thiết kế* và *chức năng*. Muốn biết hôm nay cái gì đã chạy thật trên production, cái gì còn dở, đọc `docs/HANDOFF.md` — đó là nguồn duy nhất về hiện trạng. Trong tài liệu này, mọi mục đều có nhãn trạng thái để không ai đọc nhầm ý định thành thực tế.
>
> Cập nhật: **02/08/2026**

---

## 1. Hệ thống này là gì

Ninh Bình Journey gồm **hai nửa, không ngang nhau về ưu tiên**:

| | Dành cho | Ưu tiên |
|---|---|---|
| 🏢 **ERP nội bộ** (`/erp`) | Người trong doanh nghiệp: giám đốc, quản lý cơ sở, kế toán, nhân viên hiện trường | **Số 1.** Phải đạt chất lượng chạy thật |
| 🌐 **Web du khách** (`/`) | Khách du lịch tra cứu, xem điểm đến, quét mã QR | Quan trọng, nhưng làm sau |

ERP quản lý **4 khu du lịch** như bốn đơn vị vận hành tách biệt:

**Tràng An** · **Tam Chúc** · **Tam Cốc** · **Bái Đính**

Tách biệt ở đây là thật, không phải nhãn hiển thị: quản lý Tam Chúc không đọc được dữ liệu Tràng An, hóa đơn ghi đúng cơ sở phát sinh, và mỗi con số trên báo cáo đều truy được về một cơ sở cụ thể.

---

## 2. Nguyên tắc gốc — Danh tính và quyền hạn

**Đây là nguyên tắc quan trọng nhất của toàn hệ thống. Mọi thứ khác dựa lên nó.**

> **Không có tài khoản nào tự tồn tại. Mọi tài khoản đều do giám đốc tạo ra, được gán chức danh, được cấp vai trò tại một cơ sở cụ thể — rồi mới làm được việc.**

### Chuỗi cấp quyền

```
   Giám đốc (system-admin)
         │
         ├─▶ ① Tạo tài khoản        → có danh tính: họ tên, mã nhân viên, liên hệ
         │
         ├─▶ ② Gán hồ sơ & chức danh → "Quản lý vận hành", "Thu ngân", loại hợp đồng
         │
         ├─▶ ③ Cấp vai trò tại cơ sở → vai trò nào, ở khu nào, từ ngày nào
         │
         └─▶ ④ Kích hoạt đăng nhập   → mật khẩu riêng của cá nhân đó
                     │
                     ▼
              Từ đây mọi thao tác người này làm
              đều mang tên họ, vĩnh viễn, không xoá được
```

Thiếu bước nào cũng không dùng được: có tài khoản mà chưa cấp vai trò thì đăng nhập vào không thấy gì; có vai trò mà chưa gán cơ sở thì không mở được khu nào.

### Vì sao phải làm chặt như vậy

Vì **toàn bộ giá trị của hệ thống nằm ở chỗ quy được trách nhiệm**. Nếu tài khoản xuất hiện tùy tiện, hoặc nhiều người dùng chung một mật khẩu, thì câu *"không phải tôi làm, ai cũng đăng nhập được tài khoản đó"* là **đúng sự thật** — và mọi dòng nhật ký trở thành vô giá trị đúng lúc cần đến nó nhất, là lúc có tranh chấp.

Một tài khoản = một con người = một người chịu trách nhiệm. Không có ngoại lệ.

### Năm vai trò

| Vai trò | Làm được gì |
|---|---|
| **Nhân viên** | Việc hiện trường tại cơ sở được phân: chấm công, báo cáo, quét vé, ghi nhận sự cố |
| **Quản lý cơ sở** | Toàn bộ vận hành **một hoặc nhiều cơ sở được giao**: duyệt hồ sơ, xử lý sự cố, gửi hóa đơn NCC, quản lý nhân sự cơ sở mình |
| **Kế toán** | Lập chứng từ, ghi nhận công nợ, đề nghị chi — **không tự duyệt cái mình lập** |
| **Kế toán trưởng** | Duyệt chứng từ kế toán, khóa kỳ, duyệt chi |
| **Giám đốc** | Nhìn toàn bộ 4 cơ sở, quyết định các việc vượt thẩm quyền quản lý, quản trị tài khoản |

Ngoài ra có quyền kỹ thuật **`system-admin`** — quản trị tài khoản. Hiện gắn cho giám đốc, nhưng **tách rời khỏi vai trò giám đốc** để sau này giao cho người khác mà không phải trao toàn bộ quyền điều hành.

### ⚠️ Chức danh không phải vai trò

Hai thứ dễ nhầm nhất, và nhầm là mất kiểm soát quyền:

| | Là gì | Ai đổi được |
|---|---|---|
| **Chức danh** | Cái nhãn trên danh thiếp — "Trưởng bộ phận vé" | Quản lý (trong cơ sở mình) hoặc giám đốc |
| **Vai trò** | **Quyền lực thật** trong hệ thống | **Chỉ giám đốc** |

Một quản lý đổi chức danh nhân viên thành "Giám đốc" thì đó vẫn chỉ là mấy chữ trên hồ sơ — **không thêm một quyền nào**. Đây là cố ý: nếu chức danh sinh ra quyền thì ai sửa được chức danh sẽ tự nâng mình lên.

### Ranh giới quyền của giám đốc

Giám đốc là "superadmin" — nhưng **chỉ trong phạm vi nghiệp vụ**:

| ✅ Giám đốc tự làm được, không cần lập trình viên | ❌ Không đụng tới được |
|---|---|
| Tạo / khóa / thu hồi tài khoản | Thêm bớt khu du lịch |
| Đổi hồ sơ, chức danh, thông tin liên hệ của bất kỳ ai | Thêm bớt module chức năng |
| Cấp và thu hồi vai trò ở từng cơ sở | Sửa quy tắc nghiệp vụ, công thức, luồng duyệt |
| Mở cho một quản lý giữ thêm cơ sở | Xóa nhật ký kiểm toán |

Ranh giới này là cố ý: những thứ ở cột phải mà mở ra thì một cú bấm nhầm làm gãy hệ thống, hoặc phá mất chính cái tính toàn vẹn khiến hệ thống đáng tin.

---

## 3. Các module chức năng

15 module. **11 có nghiệp vụ thật, 4 nói thẳng là chưa làm** — trong sản phẩm, 4 cái đó mang nhãn "Giai đoạn sau" ngay trên menu và ghi rõ còn thiếu dữ liệu gì, chứ không vẽ số cho đẹp.

### Đang chạy được (11)

| Module | Làm gì |
|---|---|
| 🎫 **Vé & đặt chỗ** | Quản lý vé, suất, đặt chỗ |
| 🚪 **Check-in khách** | Soát vé tại cổng: đối chiếu vé thật, trừ lượt, chống quét trùng, **ghi lại cả lượt bị từ chối**, tra cứu theo tên/SĐT/mã đặt chỗ |
| 📊 **Sức chứa & luồng khách** | Ngưỡng theo giờ tại điểm nghẽn, tính từ phương tiện × số chỗ × 60 ÷ phút/vòng; hiện nguồn và phép tính, dùng lượt check-in T8 trong giờ như proxy thượng nguồn cho tới khi có số đo tại điểm nghẽn |
| 📹 **Camera AI & hiện trường** | Theo dõi camera, tạo sự cố trực tiếp từ hình ảnh |
| 📝 **Báo cáo hiện trường** | Nhân viên gửi báo cáo tại chỗ, quản lý xử lý |
| 📅 **Dự án & sự kiện** | Gói việc, phụ thuộc, yêu cầu đổi phạm vi, nghiệm thu, quyết toán |
| 🚨 **Sự cố & điều phối** | Vòng đời sự cố, đồng hồ SLA, **tự động chuyển cấp khi quá hạn** |
| 👥 **Nhân sự & ca trực** | Phân ca, phân quyền nhân sự, **bàn giao ca có ký nhận hai người** (tiền mặt, sự cố còn mở, thiết bị) |
| ⏱️ **Chấm công nhân viên** | Vào/ra ca, phiếu công việc, duyệt |
| 🤝 **Đối tác & nhà cung ứng** | Công nợ NCC trọn vòng: ghi nhận nợ → hạch toán → đề nghị chi → duyệt chi → đã trả |
| 💰 **Tài chính & đối soát** | Bút toán, kỳ kế toán, đối soát |

### Giai đoạn sau (4)

| Module | Cần gì trước khi làm được |
|---|---|
| 🚌 **Xe trung chuyển** | Danh sách phương tiện, tuyến, tài xế |
| 🏗️ **Tài sản & nghiệm thu** | Danh mục tài sản, lịch bảo trì |
| 📋 **SOP & diễn tập** | Bộ quy trình ứng phó và ngưỡng kích hoạt |
| 📈 **Báo cáo & dự báo** | Đủ dữ liệu vận hành tích lũy |

### Màn hình quản trị

**Quản lý tài khoản** (`/erp/tai-khoan`) — nơi giám đốc thực hiện toàn bộ chuỗi cấp quyền ở mục 2.

---

## 4. Bốn nguyên tắc xuyên suốt mọi module

**① Người làm ≠ người duyệt.** Kế toán lập chứng từ thì kế toán trưởng duyệt. Quản lý không tự duyệt hồ sơ mình tạo. Người đề nghị chi tiền không phải người duyệt chi. Người bàn giao ca không phải người nhận ca. Điều này bị **cơ sở dữ liệu** ép, không phải chỉ giao diện — không có đường vòng nào.

**② Nhật ký chỉ ghi thêm, không sửa, không xóa.** Ghi sai thì ghi bút toán điều chỉnh. Kể cả giám đốc cũng không xóa được một dòng lịch sử.

**③ Số nào hiện lên cũng phải có nguồn.** Chưa có nguồn dữ liệu thì màn hình nói thẳng là chưa có. Một con số bịa trong một module thật sẽ phá hỏng lòng tin vào cả những module đúng.

**④ Dữ liệu nằm trong cơ sở dữ liệu, không nằm trong mã nguồn.** Thêm một nhân viên, đổi một giá vé, xóa toàn bộ dữ liệu tập dượt — đều phải làm được bằng thao tác trên màn hình, không cần lập trình viên. *(Còn vài chỗ chưa đạt — xem `HANDOFF.md`.)*

---

## 5. Nhật ký & truy vết trách nhiệm

**Mục đích: trả lời được câu "ai đã làm việc này" nhiều năm sau, kể cả khi người đó đã đổi tên, đổi cơ sở hoặc nghỉ việc.**

### Mỗi dòng nhật ký lưu hai thứ

| | Lưu gì | Để làm gì |
|---|---|---|
| **Ảnh chụp tại thời điểm** | Họ tên + chức danh + khu vực **lúc thao tác xảy ra** | Đọc lịch sử thấy đúng bối cảnh khi đó |
| **Mã tài khoản** | Mã không đổi, dùng làm đường dẫn tới hồ sơ | Bấm vào biết người đó hiện là ai |

**Vì sao phải lưu cả hai:**

- Chỉ lưu tên → có **hai anh Long**, một ở Tam Chúc một ở Bái Đính, không phân biệt được ai làm.
- Chỉ lưu mã rồi tra tên lúc hiển thị → anh Long chuyển từ Tam Chúc sang Bái Đính, **toàn bộ lịch sử cũ của anh ấy hiện thành Bái Đính**. Sai nơi, sai bối cảnh, và hỏng đúng cái việc quy trách nhiệm.

Hiển thị: `Trần Đức Long — Quản lý vận hành — Tam Chúc — 14:32 02/08/2026 — Duyệt hóa đơn NCC #1042`
Bấm vào tên → mở hồ sơ người đó → thấy toàn bộ hoạt động của riêng họ.

### Ai nhìn thấy nhật ký của ai

| Vai trò | Phạm vi |
|---|---|
| **Nhân viên** | Hoạt động của chính mình |
| **Quản lý** | Mọi việc do **người của cơ sở mình** làm, **cộng** mọi việc **tác động lên cơ sở mình** — kể cả do người ngoài làm (ví dụ kế toán duyệt hóa đơn của cơ sở đó) |
| **Giám đốc** | Toàn bộ 4 cơ sở |

Vế "cộng mọi việc tác động lên cơ sở mình" là cố ý: quản lý chịu trách nhiệm về cơ sở, nên phải thấy hết những gì xảy ra ở đó, không chỉ việc nhân viên mình làm.

**Phạm vi này được chặn ở máy chủ, không phải lọc ở giao diện** — lọc giao diện chỉ là giấu, người biết sửa địa chỉ web vẫn đọc được hết.

### Tìm kiếm

Ô tìm theo tên, tra **cả tên hiện tại lẫn tên trong nhật ký cũ** (đổi tên vẫn tìm ra việc làm dưới tên cũ). Lọc thêm theo cơ sở, khoảng thời gian, loại thao tác.

---

## 6. Hồ sơ nhân sự

Hồ sơ là **điểm đến của mọi đường truy vết** — từ một dòng nhật ký bấm ra hồ sơ, từ hồ sơ thấy toàn bộ hoạt động của người đó.

| Nhóm thông tin | Nội dung |
|---|---|
| **Danh tính** | Họ tên, ảnh, mã nhân viên, số điện thoại |
| **Công việc** | Chức danh, khu vực phụ trách, loại hợp đồng, ngày vào làm, trạng thái |
| **Quyền hạn** | Vai trò nào, tại cơ sở nào, **ai cấp và cấp lúc nào** |
| **Hoạt động** | Nhật ký của riêng người này |

### Ai sửa được gì

| | Xem hồ sơ | Sửa hồ sơ & chức danh | Cấp vai trò | Khóa tài khoản |
|---|:---:|:---:|:---:|:---:|
| **Nhân viên** | của mình | ✗ | ✗ | ✗ |
| **Quản lý** | nhân sự cơ sở mình | nhân sự cơ sở mình | ✗ | ✗ |
| **Giám đốc** | tất cả | tất cả | ✓ | ✓ |

Mọi thao tác trong bảng này đều sinh một dòng nhật ký theo mục 5.

### Đếm nhân sự theo khu vực

Từ sổ tài khoản đếm ra: mỗi khu bao nhiêu người, bao nhiêu đang hoạt động, bao nhiêu bị khóa, bao nhiêu thời vụ. Bấm vào ra danh sách, bấm tiếp ra hồ sơ. **Số đếm từ dữ liệu thật, không phải số nhập sẵn.**

---

## 7. Bốn loại dữ liệu, và chuyện "reset"

Câu hỏi thường gặp: *"Khi đưa vào dùng thật thì xóa hết dữ liệu cũ đi chứ?"* — Đúng, nhưng chỉ một phần. Có bốn loại, xử lý khác nhau:

| Loại | Ví dụ | Khi chạy thật |
|---|---|---|
| **① Cấu hình hệ thống** | 4 cơ sở, danh sách module, bộ vai trò, quy tắc hạch toán | **Giữ nguyên** — đây là phần mềm, không phải dữ liệu |
| **② Danh mục thật** | Nhân sự, tài khoản, nhà cung cấp, loại vé và giá vé, ngưỡng sức chứa, bộ SOP | **Khách nhập trước ngày chạy** — không phải điền dần |
| **③ Dữ liệu mồi / tập dượt** | Nhân sự mẫu, vé mẫu, sự cố mẫu, hóa đơn mẫu | **Xóa sạch** |
| **④ Dữ liệu vận hành** | Phát sinh sau ngày chạy thật | **Không bao giờ reset** |

**Về loại ③:** thoải mái nhập thử, spam, tập dượt. Xóa được sạch bằng một lệnh, vì toàn bộ nằm trong cơ sở dữ liệu chứ không nằm trong mã nguồn (nguyên tắc ④ ở mục 4).

**Về loại ④ — điều phải thống nhất với khách trước, không phải sau:**

> Sau ngày chạy thật, **không còn nút reset**. Sổ kế toán và nhật ký kiểm toán chỉ ghi thêm, không xóa. Ghi sai thì ghi bút toán điều chỉnh.

Đó là thiết kế đúng và là lý do hệ thống đáng tin. Nhưng nghĩa là **phải có giai đoạn chạy thử với người thật trên dữ liệu mồi trước**, rồi mới chuyển sang thật một lần dứt khoát.

---

## 8. Nói thẳng: những gì hệ thống chưa có

Để khách không kỳ vọng nhầm, và để phiên làm việc sau không tưởng là đã xong:

- **Chưa bán hàng trực tuyến.** Web du khách chưa có cổng thanh toán thật.
- **Chưa có chế độ ngoại tuyến.** Mất mạng là không thao tác được.
- **5 module ở mục 3 chưa có nghiệp vụ**, đang chờ dữ liệu từ khách.
- **Đầu tiền mặt chưa khép kín** — công nợ nhà cung cấp đã trọn vòng, nhưng nộp quỹ → ngân hàng → đối chiếu sao kê thì chưa.

Chi tiết trạng thái từng mục: `docs/HANDOFF.md`.

---

## 9. Thuật ngữ dễ nhầm

| Từ | Nghĩa ở đây |
|---|---|
| **Chức danh** | Nhãn mô tả công việc. Không sinh ra quyền |
| **Vai trò** | Quyền lực thật trong hệ thống. Chỉ giám đốc cấp |
| **Cơ sở / khu** | Một trong 4 khu du lịch. Đơn vị phân quyền cơ bản |
| **Maker ≠ checker** | Người lập chứng từ không được là người duyệt |
| **Sổ tài khoản (registry)** | Bảng danh tính gốc dưới cơ sở dữ liệu — nguồn sự thật về "ai là ai" |
| **Ảnh chụp (snapshot)** | Thông tin đóng băng tại thời điểm thao tác, không đổi theo hồ sơ hiện tại |

---

## 10. Tài liệu liên quan

| File | Nội dung |
|---|---|
| `docs/HANDOFF.md` | **Hiện trạng thật** — cái gì đã chạy, lỗi gì còn, việc gì tiếp theo |
| `docs/reference/TIEU_CHI_NGHIEM_THU.md` | Định nghĩa "xong" của từng module |
| `docs/reference/KE_HOACH_HOP_NHAT_TAI_KHOAN.md` | Kế hoạch chi tiết phần danh tính & đăng nhập |
| `docs/reference/TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md` | Yêu cầu gốc từ khách |
| `docs/reference/DATA_SOURCES.md` | Dữ liệu nào khách phải cung cấp |
| `AGENTS.md` | Quy tắc làm việc trong dự án |
