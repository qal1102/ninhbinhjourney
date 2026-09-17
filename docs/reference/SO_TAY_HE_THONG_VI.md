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

15 module. **12 có nghiệp vụ thật, 3 nói thẳng là chưa làm** — trong sản phẩm, 3 cái đó mang nhãn "Giai đoạn sau" ngay trên menu và ghi rõ còn thiếu dữ liệu gì, chứ không vẽ số cho đẹp.

### Đang chạy được (12)

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
| 📋 **SOP & diễn tập** | Cổng mở cửa hằng ngày: quản lý xác nhận từng mục, giám đốc quyết định GO/NO-GO; lỗi trọng yếu chặn GO ở cơ sở dữ liệu, ngoại lệ phải có văn bản chấp nhận rủi ro và nhật ký bất biến. Bộ mục hiện tại là tóm tắt demo có nguồn, **chưa phải SOP được tổ chức phê duyệt** |
| 💰 **Tài chính & đối soát** | Bút toán, kỳ kế toán, đối soát |

### Giai đoạn sau (3)

| Module | Cần gì trước khi làm được |
|---|---|
| 🚌 **Xe trung chuyển** | Danh sách phương tiện, tuyến, tài xế |
| 🏗️ **Tài sản & nghiệm thu** | Danh mục tài sản, lịch bảo trì |
| 📈 **Báo cáo & dự báo** | Đủ dữ liệu vận hành tích lũy |

### Màn hình quản trị

| Màn hình | Làm gì |
|---|---|
| **Quản lý tài khoản** (`/erp/tai-khoan`) | Nơi giám đốc thực hiện toàn bộ chuỗi cấp quyền ở mục 2. Mã tài khoản **do máy đặt** từ họ tên, không ai gõ tay |
| **Khách hàng** (`/erp/khach-hang`) | Hồ sơ khách và những gì họ đã đi qua |
| **Kênh khách** (`/erp/marketing`) | Mã QR dán ở bến, ở quầy; đổi được nơi mã dẫn tới mà không phải in lại biển. Xem khách đến từ nguồn nào. Mã chiến dịch và mã QR **do máy đặt** theo tên |
| **Nhật ký** (`/erp/nhat-ky`) | Dòng thời gian việc đã làm; mọi vai đều vào được, phạm vi nhìn do máy chủ cắt |

Tên trên menu là tên chuẩn, dùng đúng chữ này ở mọi nơi. **"Marketing" là tên cũ, đã bỏ** — chủ dự án dùng thử 31/08 và hỏi thẳng nó là cái gì.

Trang `/erp/release` là bảng đối chiếu kỹ thuật trước khi bật tính năng, **không phải màn hình vận hành** và không có lối vào từ menu.

---

## 4. Bốn nguyên tắc xuyên suốt mọi module

**① Người làm ≠ người duyệt.** Kế toán lập chứng từ thì kế toán trưởng duyệt. Quản lý gửi checklist mở cửa thì giám đốc quyết định. Người đề nghị chi tiền không phải người duyệt chi. Người bàn giao ca không phải người nhận ca. Điều này bị **cơ sở dữ liệu** ép, không phải chỉ giao diện — không có đường vòng nào.

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
| **② Danh mục thật** | Nhân sự, tài khoản, nhà cung cấp, loại vé và giá vé, ngưỡng sức chứa, bộ SOP đã phê duyệt | **Khách nhập trước ngày chạy** — không phải điền dần; 20 tóm tắt SOP hiện có chỉ là dữ liệu demo có nguồn |
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
- **Production chưa có chế độ ngoại tuyến.** Code CUS-08 đã có preload vé tối thiểu, queue IndexedDB và đối soát lại với T8, nhưng migration/flag đang staged và chưa được phép bật; vì vậy vận hành live hiện tại mất mạng vẫn không quét được.
- **3 module ở mục 3 chưa có nghiệp vụ**, đang chờ dữ liệu từ khách.
- **SOP tổ chức chính thức và lịch diễn tập chưa có.** Cổng Go/No-Go đã chạy, nhưng 20 mục hiện tại được ghi rõ là tóm tắt demo chưa phê duyệt; khách phải duyệt phiên bản, ngày hiệu lực và người chịu trách nhiệm trước khi vận hành thật.
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

---

## 12. Căn cước hành trình — giải thích không dùng chữ kỹ thuật

> Ghi lại buổi trao đổi ngày **29/08/2026** giữa chủ dự án và phiên làm việc. Viết cho người không rành kỹ thuật đọc. Phần việc chia nhỏ nằm ở `docs/plans/PHAN_GIAO_VIEC_TAM_COC.md` mục 3b.
>
> ⚠️ **Toàn bộ mục này là dự định, chưa có dòng nào chạy thật.** Trừ những chỗ ghi rõ "đã có".

### 12.1 Ý tưởng gốc, nói bằng một câu

Mỗi khách có một tấm **căn cước hành trình** — như một cuốn hộ chiếu ghi những nơi họ đã đi qua ở Ninh Bình. Khách mở ra xem được, mang về được. Còn về phía mình, đó là cách biết dịch vụ nào đang phục vụ tốt và chỗ nào cần chăm thêm.

### 12.2 Điều bất ngờ: hệ thống đã ghi rồi, chỉ chưa ai mở ra xem

Đây là phần đáng nói nhất của buổi trao đổi.

Mỗi lần nhân viên soát vé ở cổng, hệ thống **đã ghi lại** ai vừa vào, nơi nào, lúc mấy giờ, vé loại gì. Kể cả lượt bị từ chối cũng ghi — vì một cái cổng chỉ ghi lượt thành công thì không trả lời được câu hỏi đầu tiên sau một ngày tệ ở lối vào: *hôm nay bao nhiêu người bị đuổi về, và vì sao*.

Nghĩa là **dữ liệu đang chảy vào một cái kho mà chưa ai mở cửa**. Việc phải làm không phải xây mới, mà là đọc lên và trình bày cho ra hình hài. Nhẹ hơn nhiều so với tưởng tượng ban đầu.

### 12.3 Mỗi người một mã, không phải mỗi đoàn một mã

Đoàn mười người thì mười mã, có liên kết với nhau thành một đoàn. Không gộp thành một mã đại diện.

Lý do đơn giản: người thứ bảy trong đoàn cũng là một khách thật, có sở thích riêng, và có thể quay lại một mình vào năm sau. Gộp chung là mất họ.

Tên khách đi kèm mã, để nhân viên biết mình đang giúp ai — chứ không phải nhìn vào một dãy số.

### 12.4 Giấy tờ tuỳ thân — chỗ phải cẩn thận nhất

Luật lưu trú yêu cầu ghi đúng danh tính khách, nên phần này không tránh được. Nguyên tắc:

- Lưu **ít nhất có thể**, khoá kín, để riêng một chỗ.
- Quầy vé chụp lại làm căn cứ thì được, nhưng **phải có hạn xoá**. Số ngày cụ thể còn chờ chủ dự án chốt.
- Giấy tờ **không được lẫn** vào phần gợi ý hay đánh giá. Hai thứ đó không cần biết số hộ chiếu của ai.

### 12.5 Hai loại đồng ý, và vì sao phải tách

Đây là chỗ dễ hiểu nhầm nhất, nên nói rõ.

**Đồng ý phục vụ** — khách mua vé, mình ghi lại họ đã vào cổng nào bằng chính tấm vé đó. Cái này **không cần hỏi**, và hỏi thì vô duyên. Khách trả tiền mua dịch vụ, việc ghi nhận để phục vụ chính chuyến đi đó là chuyện đương nhiên.

**Đồng ý tiếp thị** — gửi thông báo, gửi gợi ý, gửi thư. Cái này **là chuyện khác**, và luật Việt Nam (Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Điều 9: đồng ý theo từng mục đích, không được buộc đồng ý kèm mục đích khác) coi nó khác.

Chủ dự án đề nghị tích sẵn ô đồng ý cho nhanh. Nhưng luật quy định sự đồng ý phải **thể hiện rõ ràng, cụ thể** — im lặng hoặc không phản hồi không tính là đồng ý, và Nghị định 356/2025/NĐ-CP (khoản 3 Điều 6) cấm thiết lập phương thức mặc định đồng ý. Ô tích sẵn vì thế không có giá trị: khi có khiếu nại, mình không chứng minh được khách đã đồng ý.

Cách làm được mà vẫn cao tỉ lệ: một dòng duy nhất lúc đặt chỗ, **nói thẳng khách được gì** — *"Cho phép chúng tôi nhắn khi có khung giờ đẹp hoặc chỗ vắng gần bạn."* Ô để trống, khách tự tick. Người ta tick khi thấy có lợi cho mình, không phải khi bị tick hộ.

### 12.6 Nói với khách bằng chữ của khách

Không dùng *"soát vé"*, *"quét mã"*, *"điểm chạm"* — đó là chữ của cái máy ở cổng.

Nói: **"những nơi bạn đã đi qua"**.

### 12.7 Tấm bản đồ sáng dần

Phần khách nhìn thấy là một tấm bản đồ Ninh Bình của riêng họ. Đi tới đâu, chỗ đó sáng lên. Chỗ chưa tới còn mờ.

Nó làm được ba việc cùng lúc: là món quà mang về, là lời mời quay lại cho đủ, và **tự giải thích hệ thống đang ghi cái gì** mà không cần một dòng chính sách nào. Khách nhìn tấm bản đồ là hiểu ngay.

### 12.8 Biết trước mấy giờ hết chỗ

Hôm nay hệ thống chỉ biết *"đã đầy"*. Lúc đó thì muộn rồi — khách đã tới nơi, đã xếp hàng, rồi bị đuổi về.

Điều mình đã có đủ để làm tốt hơn: trần sức chứa từng giờ, số chỗ đã giữ, và giờ giấc của từng lượt giữ. Ba thứ đó đủ để tính ra **tốc độ lấp đầy**, và từ đó đoán mấy giờ chạm trần.

Quản lý cần đúng một câu, không cần bảng biểu:

> *"Tràng An giữ chỗ nhanh gấp đôi hôm qua, khoảng 14 giờ là kín. Vân Long còn trống hơn nửa."*

Báo trước ba tiếng thì còn kịp làm gì đó. Báo lúc đã đầy thì chỉ còn kịp xin lỗi.

### 12.9 Một cái bẫy đã nhìn thấy trước

Ý ban đầu là: chỗ nào nhiều khách tới thì đẩy lên cho nhiều người thấy hơn.

Nghe hợp lý, nhưng làm vậy thì **hệ thống tự cắn đuôi mình**. Chỗ đông càng được đẩy, càng đông thêm, tới lúc chạm trần thì chính hệ thống vừa đẩy khách tới đó lại phải quay ra chặn họ lại. Còn những nơi hay mà vắng thì vĩnh viễn không ngoi lên được, dù đang trống chỗ.

Nên thứ để xếp hạng không phải *"nơi nhiều người tới nhất"* mà là **"nơi hợp với người này nhất, trong số những nơi còn chỗ lúc này"**. Dấu chân vẫn dùng — nhưng để đo *hợp hay không hợp*, không phải đo *nổi tiếng hay không*.

Khi nghĩ như vậy thì sức chứa hết là cái phanh gấp, nó thành một tín hiệu chạy thường xuyên trong gợi ý.

### 12.10 Đánh giá: mở, nhưng không để bị phá

Ba nguyên tắc chốt trong buổi trao đổi:

**Chỉ ai thật sự đã tới mới được đánh giá.** Đây là thứ bản đồ đại chúng không làm được, còn mình thì làm được — hệ thống biết ai đã qua cổng. Riêng điều này đã làm phần lớn đánh giá rác tự rụng, không cần xoá tay.

**Xoá được, nhưng có hạn mức theo vai.** Quản trị hệ thống xoá hàng loạt khi gặp đợt phá hoại. Bộ phận chăm sóc khách hàng chỉ xoá được chừng mười tới hai mươi lượt — không được xoá sạch. Mỗi lượt xoá đều ghi lại ai xoá và vì sao.

**Không xoá đến mức toàn năm sao.** Một bảng điểm toàn năm sao trông giả, và khách nhận ra rất nhanh. Giữ lại các đánh giá hai ba sao thật — nó làm cả bảng đáng tin hơn.

Còn một ranh giới không được vượt: **chủ sạp không được tự xoá đánh giá xấu của chính mình.** Cho phép điều đó thì toàn bộ điểm số thành vô nghĩa.

### 12.11 Chuyện thu âm — đã thử và đã khép lại

Có ý tưởng: nghe khách nói chuyện qua micro trình duyệt để đoán họ đang muốn gì, rồi gợi ý chỗ ăn.

**Không làm được.** Trình duyệt không cho trang web bật micro âm thầm — bắt buộc hiện hộp xin phép, và trong lúc thu thì tab hiện chấm đỏ, máy cũng báo. Không có đường vòng. Kết quả thực tế sẽ là: khách thấy trang du lịch xin bật micro, và họ đóng tab.

Nhưng thứ mình muốn thì lấy được bằng đường khác, và đường đó **đã có sẵn**: ô cho khách nói mong muốn bằng lời thường, cộng với việc khách xem gói nào lâu, xem rồi không đặt, và vừa qua cổng nơi nào lúc mấy giờ.

Khách vừa rời Tràng An lúc 11 giờ trưa thì không cần nghe lén cũng biết họ sắp đi ăn. Suy từ việc họ **đã làm** còn chính xác hơn suy từ việc họ vô tình nói ra.

### 12.12 Khách cần chăm sóc riêng

Trẻ nhỏ, người cao tuổi, người khuyết tật — khách tự khai, mình không đoán.

Điều đáng nói là **đường báo tin**. Nhiều nhân viên hiện trường không dùng điện thoại trong giờ làm, nên gửi thông báo vào máy họ là thiết kế cho người ngồi bàn giấy chứ không phải cho người đứng cổng.

Cách hợp thực tế hơn: tin đi tới **tổng đài hoặc phòng điều hành**, người ở đó đọc lên bộ đàm cho anh em ở dưới.

### 12.13 Hai nơi không bán vé

**Cố đô Hoa Lư** và **Phố cổ Hoa Lư** không bán vé, nên không có gì để giữ chỗ và **không cần đo lượng khách** ở đó.

Chúng đóng vai khác trong hệ thống: là **nơi để gợi ý và dẫn khách tới**, rồi khách mua thứ khác ở đó. Khu vực còn có hàng quán do người khác thuê và vận hành, nên mình không cầm toàn bộ — quản một khu vực khác hẳn quản một hai sạp hàng.

Có một lần đã hiểu ngược điều này: bản ghi trước xếp hai nơi đó vào "món nợ, cần dựng ngưỡng sức chứa". Sai. Dựng ngưỡng cho nơi không bán vé là **bịa ra một điểm nghẽn không tồn tại** — đúng thứ dự án cấm.
