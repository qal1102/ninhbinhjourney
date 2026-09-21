# Danh sách kỹ năng giao diện — để chủ dự án chọn

> Mục đích của trang ngoài **không phải bán hàng**. Nó là chỗ phô kỹ năng.
> Tệp này là **thực đơn**: mỗi món ghi rõ làm gì, tốn bao nhiêu, rủi ro ở đâu.
> Anh đánh dấu món nào muốn, tôi làm món đó. Không đánh dấu thì tôi không làm —
> làm hết một lượt là cách chắc chắn nhất để trang thành nặng và rối.

Soạn 22/09/2026, sửa lại cùng ngày sau khi chủ dự án nói rõ mục đích.

> **Mục đích, nói thẳng từ chủ dự án:** *"ý tao là nhồi hết các loại skills đỉnh
> cao của Awwwards mà mày có thể làm được, chứ không phải mục đích làm sao để
> đoạt giải. Mục đích chính là lên đó copy kỹ năng, sao chép các thứ hay ho mà
> mình có thể làm được xong bỏ vào — những cái fancy đẳng cấp nhất."*
>
> Và: *"design ở đây là kiểu Designer kết hợp của frontend — nhìn vào phải wow,
> chứ cái bấm bấm hoạt động đương nhiên phải được rồi."*
>
> Nên bảng dưới đây **không xếp theo thang điểm của ban giám khảo**. Nó xếp theo
> *nhìn vào có sững lại một nhịp không*. Chuyện bấm được, không vỡ, không giật
> là mức sàn — không tính là thành tích.

---

## 0. Hai điều rút ra từ mấy trang đỉnh nhất 2026

Không phải luật thi. Là hai điều quan sát được từ chính những trang nhìn đã
nhất năm nay, và cả hai đều đáng chép:

1. **Nghề nằm ở nhịp, không nằm ở số lượng hiệu ứng.** Mấy trang đẹp nhất 2026
   đều chỉ có **một** ý tưởng lớn chạy suốt trang, rồi diễn nó thật kỹ: một
   cảnh 3D được chiếu đèn như tác phẩm trưng bày, một bộ chữ co giãn theo cuộn,
   một cú chuyển khối giữa các phần giống máy quay lia. Nhồi mười hiệu ứng rời
   rạc lên một trang thì ra hội chợ, không ra đẳng cấp.
2. **Hiệu ứng chở được dữ kiện thật thì sang gấp đôi.** Đa số trang đẹp đều
   rỗng. Trang này có thứ hiếm: pha trăng tính được, lịch mùa thật, toạ độ
   thật, hồ sơ hợp tác tra được nguồn. Một vòng trăng **đúng với bầu trời đêm
   nay** gây ấn tượng hơn hẳn một vòng trăng vẽ cho đẹp — vì khách nhận ra nó
   thật.

Nên mỗi món dưới đây đều ghi thêm một dòng: **nó nói được điều gì thật?** Món
không nói được gì vẫn làm, nếu nhìn đủ đã; nhưng khi phải chọn, món nói được
điều thật đi trước.

---

## 1. Đang có sẵn trong kho (không phải làm lại)

| Thứ | Nằm ở đâu |
|---|---|
| GSAP + ScrollTrigger | 4 chỗ: dòng chảy Tràng An, zigzag điểm đến, chuyện ghim, xã luận hợp tác |
| Chuyển trang View Transitions gốc của trình duyệt | 17 liên kết, có chiều tiến/lùi riêng |
| Thanh tiến trình cuộn, hiện dần khi vào khung nhìn | `components/shared/` |
| Bản đồ chặng vẽ bằng canvas | `mini-route-map-canvas.tsx` |
| Vòng trăng tính thật, tự biết hôm nay là đêm nào của mùa | `moon-dial.tsx` + `domain/lunar-phase.ts` |
| Thanh chuyển thế giới dính đầu trang | `world-switcher.tsx` |

Nghĩa là: **không cần thêm thư viện nặng nào** cho phần lớn thực đơn dưới đây.
GSAP đã trả tiền rồi, dùng tiếp thôi.

---

## 2. Thế giới "Du lịch Ninh Bình" — trang chủ và `/explore`

| # | Món | Nó nói được điều gì thật | Công | Rủi ro |
|---|---|---|---|---|
| A1 | **Bản đồ sống** — đổi Leaflet sang MapLibre + OpenFreeMap: nghiêng 3D, bấm tên điểm là bay tới, đường sông tự vẽ | Toạ độ thật, chặng thật, thời gian chèo thật | Vừa | Thấp — xem mục 6 |
| A2 | **Con thuyền chạy theo cuộn** trên đường sông SVG: cuộn tới đâu thuyền đi tới đó, nét sông hiện dần | Đúng hình dáng khúc sông Ngô Đồng | Nhỏ | Rất thấp, không thêm thư viện |
| A3 | **Trang đổi màu theo giờ thật ở Ninh Bình** — bình minh, trưa, chiều tà, đêm | Giờ thật, không phải ảnh chụp sẵn | Nhỏ | Thấp (đã có một nửa) |
| A4 | **Ống nhòm theo con trỏ** — di chuột thì lớp tranh mực hé ra ảnh thật bên dưới | Không | Vừa | Chỉ chạy desktop, mobile phải có bản thay thế |
| A5 | **Chữ tiêu đề tách nét chạy theo cuộn** (kinetic type) | Không | Nhỏ | Dễ thành rẻ tiền nếu quá tay |

## 3. Thế giới "Hợp tác thương hiệu" — `/collaborations`

Đây là trang anh nói thẳng "không có skills luôn". Đúng. Nó đang là một tờ tạp
chí phẳng.

| # | Món | Nó nói được điều gì thật | Công | Rủi ro |
|---|---|---|---|---|
| B1 | **Hồ sơ lật trang** — kéo hoặc bấm để lật như tập hồ sơ giấy, có bóng gáy sách | Mỗi hồ sơ là một đối tác có nguồn tra được | Vừa | Phải làm được bằng bàn phím, nếu không là mất điểm Usability |
| B2 | **Con dấu mộc dập xuống** khi cuộn tới phần cam kết | Ngày ký, phạm vi hợp tác | Nhỏ | Rất thấp |
| B3 | **Biểu đồ tự vẽ nét** + số tự đếm khi lọt vào khung nhìn | Số liệu tài trợ, lượt khách, diện tích phục dựng | Nhỏ | Thấp |
| B4 | **Thanh kéo so sánh trước/sau** cho hạng mục phục dựng | Ảnh trước và sau, cùng một góc | Nhỏ | Cần đúng cặp ảnh — xem `YEU_CAU_HINH_ANH.md` |
| B5 | **Chữ ký chạy nét** ở cuối mỗi hồ sơ | Tên người ký thật | Rất nhỏ | Không |

## 4. Thế giới "Trung thu" — `/seasonal/mid-autumn`

Anh nói cần **thêm nhiều nữa**, không phải chỉ vòng trăng. Danh sách này xếp
theo thứ tự tôi cho là đáng làm nhất trước.

| # | Món | Nó nói được điều gì thật | Công | Rủi ro |
|---|---|---|---|---|
| C1 | ✔ **Vòng trăng** — đã xong, đã tự biết giai đoạn mùa | Pha trăng tính theo lịch trời | — | — |
| C2 | **Trăng soi xuống sông** — vệt sáng gợn trên mặt nước, độ dài vệt đổi theo pha trăng đêm đó | Đêm khuyết thì vệt ngắn, đêm rằm thì vệt dài. Đúng vật lý | Vừa | Canvas, phải tắt khi người dùng chọn giảm chuyển động |
| C3 | **Cả trang đổi mặt theo giai đoạn mùa** — trước mùa / trong mùa / đúng rằm / qua rằm / hết mùa: đổi câu mở, đổi ảnh bìa, đổi lời mời | Hôm nay là ngày nào trong mùa | Vừa | Thấp — hạ tầng tính toán đã có |
| C4 | **Đồng hồ đếm ngược tới rằm**, đếm bằng **đêm** chứ không bằng giây | Số đêm còn lại | Nhỏ | Thấp |
| C5 | **Đèn lồng thả trôi**, bấm vào một chiếc thì hiện một câu chúc | Không — thuần không khí | Vừa | Dễ thành nặng trên điện thoại; phải giới hạn số lượng |
| C6 | **Bánh trung thu bổ ra** — kéo để cắt chiếc bánh, thấy nhân bên trong, gọi tên từng loại | Nhân thật của từng loại bánh trong hộp quà | Vừa | Thay hẳn chỗ "mooncake" cũ đang hỏng |
| C7 | **Bầu trời sao đúng đêm đó** ở toạ độ Ninh Bình | Chòm sao mùa thu, tính được | Lớn | Tốn công nhất bảng; chỉ nên làm nếu anh muốn một cú thật lớn |
| C8 | **Âm thanh tuỳ chọn** — tiếng nước chèo, tiếng trống lân; **mặc định tắt**, nút bật rõ ràng | Không | Nhỏ | Tự phát là mất điểm nặng, tuyệt đối không |

## 5. Thế giới "Đặt chỗ" — `/packages`, `/checkout`, `/doan`

| # | Món | Nó nói được điều gì thật | Công | Rủi ro |
|---|---|---|---|---|
| D1 | **Nối đường vào tấm hộ chiếu mở khoá** + hiệu ứng dấu mộc khi mở được một vùng | Vùng nào đã đi, vùng nào chưa | Nhỏ | Thấp. Hiện mất mã QR là mất luôn đường vào |
| D2 | **Thẻ gói kiểu vé giấy** — mép răng cưa, số seri, mã QR thật in trên thẻ | Mã vé thật | Nhỏ | Thấp |
| D3 | **Thanh tiến trình đặt chỗ kiểu bến tàu** — từng ga sáng lên | Bước thật trong luồng đặt chỗ | Nhỏ | Thấp |

## 6. Bản đồ: chọn nhà nào

Lỗi bản đồ liên tục là do đang gọi thẳng máy chủ ảnh miễn phí của
OpenStreetMap — nơi **cấm dùng cho mục đích thương mại** và bóp lưu lượng khi
bị gọi nhiều. Không phải lỗi code, là lỗi chọn nhà cung cấp.

| Nhà | Tiền | Cần tài khoản | Ghi chú |
|---|---|---|---|
| **OpenFreeMap** | 0 đ, không giới hạn lượt xem | **Không** — không khoá API, không đăng ký, không cookie | Cho dùng thương mại, bắt buộc ghi nguồn. **Không cam kết SLA** — chạy bằng tiền quyên góp |
| MapTiler | Gói miễn phí 0 đ, 100.000 lượt tải bản đồ/tháng, **không cần thẻ**; vượt hạn thì bản đồ ngừng chứ không phát sinh hoá đơn | Có — phải là tài khoản của anh | Có hỗ trợ, có SLA ở gói trả tiền |
| Mapbox / Google | Có phí khi vượt hạn, **cần thẻ tín dụng** | Có | Không khuyến nghị cho việc phô kỹ năng |

**Đề xuất:** chạy OpenFreeMap ngay, vì không cần ai mở tài khoản và không mất
tiền. Nếu sau này cần cam kết uptime thì chuyển sang MapTiler — cùng một thư
viện MapLibre, đổi đúng một dòng địa chỉ style.

---

## 7. Những thứ tôi đề nghị **không** làm

Ghi ra để khỏi phải cãi lại sau:

- **Hero WebGL/Three.js nặng.** Đây là thứ dễ ăn điểm Creativity nhất và cũng
  là thứ phá Usability nhanh nhất trên điện thoại. Trang đoạt giải 2026 dùng
  WebGL như gia vị, không dùng làm món chính.
- **Cướp thanh cuộn** (smooth-scroll hijack). Nhìn mượt trên máy của người làm,
  khó chịu trên máy người xem, và hỏng thao tác cuộn của trình đọc màn hình.
- **Âm thanh tự phát.** Mất điểm ngay, và khách đang ngồi họp sẽ đóng tab.
- **Con trỏ tuỳ biến khắp nơi.** Chỉ dùng trong một khu vực có chủ đích, và
  tuyệt đối không đụng tới vùng chữ đọc được.

---

## 8. Nếu anh chỉ chọn sáu món

Chủ dự án đã bảo tự chọn. Sáu món này gây ấn tượng nhiều nhất trên mỗi giờ bỏ
ra, và **năm trong sáu món chở được một dữ kiện thật**:

1. **A1 — bản đồ sống** (sửa hẳn lỗi đang có, đồng thời là món gây ấn tượng nhất)
2. **C3 — trang Trung thu đổi mặt theo giai đoạn mùa**
3. **C2 — trăng soi xuống sông**
4. **B1 — hồ sơ hợp tác lật trang** (chữa đúng câu "trang này không có skills")
5. **D1 — nối đường vào tấm hộ chiếu mở khoá**
6. **A2 — con thuyền chạy theo cuộn**

Mỗi món xong sẽ có ảnh chụp trước/sau, đo trên cả điện thoại lẫn máy bàn.

---

## 9. ⚠️ Ghi chú 22/09: ba nét vẽ và cái vòm ở đầu trang

**Chủ dự án hỏi:** *"cái ý tưởng về 3 cái sông uốn lượn ở đầu trang hình ngọn
núi đưa nào làm vậy? Nhìn nó cứ ngáo ngáo... như kiểu thằng nào vẽ vạch lên."*

**Đã chụp ảnh production và tô đỏ đúng hai nét ấy để xem chúng nằm đâu. Nhận
xét ấy đúng.** Ghi lại đây để phiên sau không cãi nhau bằng trí nhớ.

### Thật ra đang có BA thứ chồng lên nhau ở góc phải đầu trang

| Thứ | Là gì | Vấn đề |
|---|---|---|
| Cái vòm nhạt hình quả trứng | `.hero-depth-window` — một **tấm ảnh thứ hai** (cảnh mưa Tràng An) bị cắt theo hình vòm, dán đè lên ảnh nền | Hai tấm ảnh khác nhau chồng nhau trong cùng một khung. Mắt không đọc ra "chiều sâu", chỉ đọc ra "ảnh bị lỗi" |
| Nét cong dài | `.hero-depth-contour` — định làm "nếp núi" | **Không trùng với nếp núi nào trong ảnh.** Nó cắt ngang mặt vách đá rồi chạy xuống mặt nước |
| Nét cong ngắn | `.hero-depth-river` — định làm "dòng sông" | Chạy vắt qua cả vách đá lẫn con thuyền, tức qua chỗ không thể có sông |

### Vì sao nó thành "vẽ vạch lên"

Một nét trang trí đặt lên **ảnh chụp thật** chỉ có hai đường sống được:

1. **Bám đúng một vật có thật trong ảnh** (đúng nếp núi ấy, đúng mép nước ấy), hoặc
2. **Nằm ở chỗ không có gì để mâu thuẫn** (trên nền trơn, ngoài lề ảnh).

Hai nét hiện tại không đi đường nào cả: chúng được vẽ tay theo cảm giác, rồi
đặt lên một tấm ảnh có địa hình rõ ràng. Mắt người so sánh trong nửa giây và
kết luận "cái này không thuộc về đây". Không cứu được bằng cách chỉnh màu hay
giảm độ mờ — sai ở chỗ **nó không nói gì thật**.

### Một lỗi nữa bắt được trong cùng lượt chụp

Ảnh chụp lúc ở Ninh Bình **02:00**, tức lớp phủ "ban đêm" đang bật. Ở khổ điện
thoại, lớp ấy dìm tấm ảnh xuống gần như **một mảng xanh đậm trơn** — không còn
nhìn ra núi, nước hay con thuyền. Ý tưởng "trang đổi màu theo giờ thật" là hay,
nhưng bản đêm hiện tại đang giết mất tấm ảnh trên điện thoại.

### Bốn hướng thay, xếp theo mức độ tôi tin tưởng

**H1 — Bỏ hẳn hai nét và cái vòm.** Tấm ảnh đủ mạnh để đứng một mình. Mất 15
phút, không rủi ro, và ngay lập tức hết cái cảm giác "ai đó vẽ bậy lên ảnh".
Đây là việc nên làm trước, bất kể sau đó chọn hướng nào.

**H2 — Thay bằng một tấm biển ấn phẩm.** Góc dưới ảnh có một dòng nhỏ kiểu
chú thích của tạp chí: *Tràng An · 20°15′N 105°54′E · 06:12*. Một đường kẻ
mảnh, một dòng chữ. Nó **nói một điều thật** (đúng nơi, đúng toạ độ, đúng giờ
chụp), và chính cái sự tiết chế ấy là thứ làm một trang trông "bài bản từ A tới
Z". Rẻ, và hợp với chỗ này nhất.

**H3 — Đường đi thật của con thuyền, chỉ vẽ trên mặt nước.** Nếu vẫn muốn có
nét, thì nét ấy phải là **tuyến chèo thật của Tràng An**, che mặt nạ để chỉ
hiện ở vùng nước, và một chấm nhỏ trôi dọc tuyến khi khách cuộn. Lúc đó nét
không còn là trang trí: nó là một tuyến đường, nằm đúng chỗ tuyến đường được
phép nằm. Tốn công vừa, nhưng đây là hướng duy nhất giữ được ý "có nét vẽ".

**H4 — Lấy chiều sâu bằng lớp, không bằng nét.** Tách ảnh thành hai–ba lớp
(núi xa, núi gần, mặt nước) rồi cho chúng trôi lệch tốc độ khi cuộn. Chiều sâu
đến từ chuyển động thật chứ không từ một đường kẻ giả. Cần người tách ảnh —
đã ghi vào `YEU_CAU_HINH_ANH.md`.

**Đề nghị:** làm **H1 + H2** ngay (bỏ nét, thêm biển chú thích), rồi tính H3
hoặc H4 sau khi có ảnh tách lớp. Và sửa riêng lớp phủ ban đêm ở khổ điện thoại.

---

## 10. Nguồn

- Cách chấm của Awwwards (trọng số, ngưỡng điểm, nhánh Mobile Excellence):
  <https://www.hontran.dev/blog/awwwards-judging-criteria>
- Kỹ thuật ở các trang đoạt giải 2026:
  <https://www.hontran.dev/blog/best-award-winning-websites-2026>,
  <https://www.utsubo.com/blog/best-threejs-websites-2026>
- Điều khoản OpenFreeMap: <https://openfreemap.org/>
- Bảng giá MapTiler: <https://www.maptiler.com/cloud/pricing/>
