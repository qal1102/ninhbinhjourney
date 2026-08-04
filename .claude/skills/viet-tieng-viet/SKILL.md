---
name: viet-tieng-viet
description: Viết hoặc sửa mọi câu tiếng Việt hiển thị cho người dùng trong dự án này (copy trang web, nhãn UI, mô tả điểm đến, thông báo lỗi, nội dung ERP). Dùng NGAY khi sắp viết/sửa bất kỳ chuỗi tiếng Việt nào lộ ra mắt người dùng, kể cả khi chỉ sửa một dòng.
---

# Viết tiếng Việt (không phải dịch từ tiếng Anh)

## Vấn đề gốc phải chặn

Lỗi cố hữu: **dựng câu bằng tiếng Anh trong đầu rồi dịch sang tiếng Việt.** Kết quả là văn "nửa nạc nửa mỡ" — đúng ngữ pháp, đủ nghĩa, nhưng người Việt đọc thấy ngán vì nó không phải nhịp tiếng Việt.

**Quy trình bắt buộc:** nghĩ bằng tiếng Việt trước, viết ra tiếng Việt trước. Nếu cần bản tiếng Anh thì dịch **ngược lại từ bản tiếng Việt đã hay** — không bao giờ làm chiều ngược lại.

Cách tự kiểm nhanh: đọc to câu vừa viết. Nếu nghe như phụ đề phim Mỹ hoặc như bản tin dịch, viết lại.

## 12 dấu vết dịch máy — thấy là sửa

Đây là những thứ làm lộ ra "câu này vốn là tiếng Anh". Tất cả ví dụ dưới đây là lỗi **có thật đã xảy ra trong dự án này**.

### 1. Danh từ hoá thay vì dùng động từ
Tiếng Anh thích danh từ (`the arranging`, `your selection`), tiếng Việt thích động từ.

- ❌ "phần sắp xếp còn lại xin để chúng tôi lo"
- ✅ "còn lại cứ để chúng tôi sắp"

### 2. "Mong muốn / nhu cầu / trải nghiệm" dùng như danh từ trống
Đây là từ của giới marketing dịch, không phải lời người nói.

- ❌ "Bạn có thể mô tả mong muốn bằng lời thường"
- ✅ "Bạn cứ nói bạn muốn đi kiểu gì"

### 3. Thừa "một" (dịch từ a/an)
Tiếng Việt không cần mạo từ. Mỗi chữ "một" phải hỏi: bỏ đi có mất nghĩa không?

- ❌ "mỗi nơi đòi một nhịp đi riêng"
- ✅ "mỗi nơi một nhịp riêng"

### 4. Thừa "của" (dịch từ 's / of)
- ❌ "nhịp thở của mỗi vùng đất"
- ✅ "nhịp thở mỗi vùng"

### 5. Thừa "sẽ" (dịch từ will)
Tiếng Việt để thì hiện tại là đủ khi ngữ cảnh đã rõ.

- ❌ "chúng tôi sẽ dựng lịch trình từ đó"
- ✅ "chúng tôi dựng lịch trình từ đó"

### 6. Lạm dụng "được" (dịch từ bị động)
- ❌ "Giữ chỗ qua website được giảm 10%"
- ✅ "Đặt qua website giảm 10%"

### 7. "và" nối mệnh đề như tiếng Anh
Tiếng Việt ngắt câu hoặc dùng dấu phẩy, ít khi nối bằng "và".

- ❌ "bạn có mấy ngày, đi cùng ai và muốn thong thả tới đâu"
- ✅ "bạn có mấy ngày, đi với ai, muốn thong thả tới đâu"

### 8. Mệnh đề quan hệ chồng ("nơi mà…", "điều mà…")
- ❌ "những nơi mà bạn chỉ có thể đến bằng thuyền"
- ✅ "có nơi chỉ đến được bằng thuyền"

### 9. Gạch ngang kiểu editorial Anh dùng thay dấu chấm
Một câu một gạch ngang là cùng. Cả đoạn toàn gạch ngang là văn dịch.

### 10. Xưng hô không nhất quán
Chọn một và giữ suốt: **"bạn"** (ấm, hiện đại — dùng cho web du lịch này) hoặc **"quý khách"** (trang trọng, dùng cho email/hoá đơn/ERP đối ngoại). Không trộn trong cùng một khối.

### 11. Câu dài đều tăm tắp
Tiếng Việt hay ở nhịp **dài – ngắn – dài**. Ba câu cùng độ dài liên tiếp là dấu hiệu văn dịch.

### 12. Ba câu cùng một khuôn
Lỗi đã mắc: "Tam Chúc không vội." / "Vân Long không phô diễn." / "Thung Nham là lúc hạ nhịp thở." — ba nhịp giống hệt nhau, đọc như điền vào chỗ trống.

## Bốn kỹ thuật phải dùng

Đã ghi ở `docs/reference/UI_UX_RULES.md#voice-rules`, nhắc lại vì đây là phần dễ quên nhất:

1. **Từ láy** — thong thả, lặng lẽ, chênh vênh, rì rào. Cho câu có chất.
2. **Vế đối** — "đá vôi hàng triệu năm tuổi, dấu chân người từ thời tiền sử". Hai vế cân nhau.
3. **Nhịp dài – ngắn – dài.**
4. **Đính chính định kiến** — gọi tên cái người ta tưởng, rồi chỉnh lại. "Người ta hay đóng khung Ninh Bình trong núi đá với sông nước. Phát Diệm nằm chếch về phía biển, kể chuyện khác."

## Năm lối cấm

1. Xếp chồng danh từ trừu tượng làm câu mở ("Trải nghiệm — Kết nối — Giá trị").
2. **"Không X, không Y" dùng làm vế đối quảng cáo** thay vì đính chính thật. Đây là lỗi tái phạm nhiều lần nhất trong dự án — kiểm riêng dòng này trước khi commit.
3. Bán bằng con số trần trong văn cảm xúc (số để dành cho bảng thông tin).
4. Thuật ngữ nội bộ/kỹ thuật lọt ra mắt khách ("collection", "tile mạng không khả dụng", "nhịp balanced").
5. Giọng cợt nhả, giận dỗi, kiểu văn chat ("Không sao — mười lăm nơi mà chọn ngay được mới lạ."). Lễ độ, điềm đạm.

## Phép thử bắt buộc trước khi commit

1. **Thử thay tên:** đổi "Ninh Bình" thành "Hạ Long". Câu vẫn đúng → câu đó rỗng, viết lại bằng thứ chỉ Ninh Bình có (tên riêng, con số thật, mùa cụ thể, hành vi cụ thể).
2. **Thử đọc to:** nghe như phụ đề phim dịch → viết lại.
3. **Thử ba câu liền:** ba câu cạnh nhau có cùng cấu trúc hoặc cùng độ dài → viết lại một câu.
4. **Đếm "một", "của", "sẽ", "được", "và":** mỗi chữ hỏi một lần "bỏ đi có mất nghĩa không?".
5. **Soát "không X, không Y".**

## Ưu tiên: lấy chữ có sẵn thay vì tự chế

Dự án đã có kho nội dung biên tập kỹ và **đã kiểm chứng nguồn**:
- `content/destinations.ts` — `description`, `story`, `press` (có trích dẫn thật), `realLimit`
- mảng `destinations` trong `app/ninh-binh-landing.tsx` — `tagline`, `description`, `history`, `highlights`

Khi cần chữ cho một khối UI mới, **lấy từ đây trước**. Bài học đã trả giá: tự chế câu "mood" mới trong khi dữ kiện thật hay hơn nhiều đang nằm sẵn cách đó vài dòng.

## Không bịa dữ kiện về nơi có thật

Số liệu, năm, danh hiệu (UNESCO, Ramsar, IUCN), trích báo — phải có nguồn thật, tra lại trước khi đưa vào code. Nếu không tra được thì viết cách khác, đừng đoán.

Ranh giới này **không áp cho nội dung thương mại của bản demo** (giá minh hoạ, khuyến mãi demo) — nhưng nếu câu chữ hứa một tính năng, tính năng đó phải thật sự chạy ở chế độ đang bật. Hứa rồi dẫn khách vào ngõ cụt còn tệ hơn không hứa.
