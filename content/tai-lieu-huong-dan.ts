import type { NhomWeb } from "@/domain/ban-do-chuc-nang";

/**
 * Lời của sổ tay hướng dẫn (`/erp/huong-dan/tai-lieu`, in ra PDF).
 *
 * Các bước bấm của từng chức năng nằm ở `domain/ban-do-chuc-nang.ts`, dùng
 * chung với màn Dạo một vòng. Tệp này chỉ giữ phần sổ tay có thêm: lời đầu,
 * lời mở từng chương, "để làm gì" của từng chức năng, một ngày vận hành từ A
 * tới Z và nguồn tư liệu văn hoá.
 *
 * 14/10/2026, chủ dự án: viết kiểu dạy học, dễ hiểu, gọn; phần mục đích có
 * văn, nói rõ hệ thống để tiết kiệm công sức, nhân công, cắt chi tiêu không
 * đáng, dành sức giám đốc cho việc lớn; có văn hoá Ninh Bình, tra trên mạng.
 * Dữ kiện văn hoá chỉ lấy từ `content/destinations.ts` (đã kiểm nguồn) và các
 * bài ghi ở `NGUON`; điều chưa chắc thì không viết.
 *
 * Thêm chức năng vào bản đồ thì thêm một dòng vào `DE_LAM_GI`; bài kiểm
 * `tests/unit/tai-lieu-huong-dan.test.ts` báo mục nào còn thiếu.
 */

export type AnhVanHoa = { tep: string; chu: string };

export const BIA: AnhVanHoa = { tep: "/huong-dan/van-hoa/trang-an.jpg", chu: "Đền giữa mặt nước Tràng An" };

export const LOI_DAU = {
  anh: { tep: "/huong-dan/van-hoa/trang-an-mua.jpg", chu: "Thuyền giữa sương sớm Tràng An" } satisfies AnhVanHoa,
  doan: [
    "Ninh Bình giữ một thứ hiếm có: núi đá vôi hàng triệu năm tuổi, trong hang còn dấu người ở suốt hơn 30.000 năm, giữa vòng núi là kinh đô Hoa Lư của nước Đại Cồ Việt thế kỷ X. Năm 2014, UNESCO ghi danh Quần thể danh thắng Tràng An là di sản kép, cả văn hoá lẫn thiên nhiên. Từ 01/7/2025, Hà Nam và Nam Định về chung một tỉnh với Ninh Bình, nên Tam Chúc cũng thành người nhà.",
    "Giữ một vùng đất như thế cần rất nhiều bàn tay. Riêng bến Tràng An có hơn 2.000 người chèo đò, phần đông là các chị, các cô quanh vùng; họ vừa chèo vừa kể chuyện đền phủ, vừa nhắc khách cúi đầu khi qua hang, đừng chạm tay vào nhũ đá. Sau lưng họ còn người bán vé, người soát cổng, người trực bến, kế toán, quản lý từng cơ sở.",
    "Hệ thống này làm ra để những bàn tay ấy bớt việc thừa. Việc lặp lại mỗi ngày như đếm tiền, cộng sổ, gọi lượt, dò hoá đơn thì máy làm, làm đúng và để lại dấu vết. Những khoản chi không đáng, như tiền lệch quỹ chẳng ai hay, hoá đơn vượt hợp đồng, hoa hồng trả cho khách chưa từng tới, bị chặn ngay từ cửa. Còn giám đốc, thay vì ngồi ký từng tờ phiếu, được trả lại thời gian cho việc lớn: một mùa lễ hội, một tuyến đi mới, một công ty lữ hành cần giữ chân.",
  ],
  baDieu: [
    { ten: "Bớt công", loi: "Việc lặp lại hằng ngày do máy làm: tính tiền, cộng ca, gọi lượt, lập bút toán, soát giấy tờ." },
    { ten: "Chặn chi tiêu không đáng", loi: "Mỗi đồng ra vào đều có người lập, người duyệt và nhật ký; khoản lạ tự dừng lại chờ người quyết." },
    { ten: "Trả thời gian cho giám đốc", loi: "Việc thường đi theo quy trình; trên bàn giám đốc chỉ còn những việc thật sự cần mình." },
  ],
};

export const CACH_DOC = [
  "Mỗi chức năng có bốn phần: để làm gì, ai làm và mở ở đâu, các bước bấm, ảnh màn hình. Trong ảnh hệ thống điều hành, khung viền cam là chỗ bắt đầu bấm.",
  "Số mục như A.1.2 dùng để tra chéo: phần Một ngày từ A tới Z gọi đúng số ấy.",
  "Phần A là hệ thống điều hành (ERP) cho người làm ở bốn cơ sở. Phần B là trang của khách, mở bằng điện thoại.",
];

export const BUOC_VAO: readonly { ten: string; loi: string }[] = [
  { ten: "Đăng nhập", loi: "Mở /erp, gõ tên đăng nhập và mật khẩu được cấp. Lần đầu, hệ thống mời đổi mật khẩu riêng." },
  { ten: "Cài lên điện thoại", loi: "Mở ERP bằng Chrome (Android) hay Safari (iPhone), chọn \"Thêm vào màn hình chính\". Bật thông báo để nhận báo khẩn cấp cả khi app đang đóng." },
  { ten: "Xem theo vai", loi: "Giám đốc bấm \"Vai trò\" trên thanh đầu trang để thấy hệ thống đúng như nhân viên, quản lý, kế toán thấy. Thanh trên cùng luôn có nút quay về." },
  { ten: "Tìm nhanh và trợ lý", loi: "Bấm kính lúp, gõ vài chữ không dấu là tới màn cần. Nút Trợ lý ở góc dưới nghe câu nói thường ngày." },
  { ten: "Dạo một vòng", loi: "Màn /erp/huong-dan đi cùng sổ tay này: bấm một việc là mở đúng màn, chỗ cần bấm được khoanh sáng." },
];

/** Lời mở mỗi chương của phần A, theo `id` nhóm trong bản đồ chức năng. */
export const MO_NHOM_ERP: Record<string, { loi: string; anh: AnhVanHoa }> = {
  "cong-quay": {
    loi: "Xưa muốn sang sông phải qua bến, lên đò phải trả tiền đò. Cổng và quầy vé là bến đầu tiên của mỗi vị khách, cũng là nơi tiền mặt qua tay nhiều nhất. Chương này để mỗi tấm vé, mỗi đồng tiền đều có dấu vết, cuối ca cộng sổ trong vài phút thay vì cả buổi.",
    anh: { tep: "/huong-dan/van-hoa/tam-coc-lua.jpg", chu: "Thuyền nan giữa đồng lúa Tam Cốc" },
  },
  "hien-truong": {
    loi: "Tràng An là di sản sống: người chèo, khách, đền phủ, hang nước cùng chung một dòng sông. Giữ an toàn cho tất cả cần mắt ở khắp nơi. Chương này thay những cuộc gọi hỏi han bằng số liệu tức thì: thuyền đang ở đâu, bến đông tới đâu, trời sắp đổi chưa, ai đang cần giúp.",
    anh: { tep: "/huong-dan/van-hoa/van-long.jpg", chu: "Mặt nước Vân Long" },
  },
  "su-kien-ncc": {
    loi: "Tháng ba âm lịch, lễ hội Hoa Lư rước nước từ bến sông Hoàng Long về đền vua Đinh; lễ hội Tràng An rước kiệu, rước nước trên sông Sào Khê. Sau một mùa lễ là hàng trăm khoản mua sắm, hợp đồng, hoá đơn. Chương này giữ cho tiền chi ra khớp với việc đã làm.",
    anh: { tep: "/huong-dan/van-hoa/hoa-lu-pho.jpg", chu: "Đèn lồng trên mặt nước Phố cổ Hoa Lư" },
  },
  "nhan-su": {
    loi: "Một bến thuyền chạy êm là nhờ rất nhiều người: người chèo, người bán vé, người soát cổng, người trực bến. Chương này để chấm công, giao việc, bàn giao ca đều có sổ, mà sổ thì máy giữ, quản lý dành sức cho con người.",
    anh: { tep: "/huong-dan/van-hoa/bai-dinh.jpg", chu: "Chùa Bái Đính" },
  },
  "tai-chinh": {
    loi: "Tiền vé bốn cơ sở đi qua quầy, qua web, qua ngân hàng. Mỗi khoản có hai người: một người lập, một người ghi sổ, để chẳng ai một mình quyết đồng tiền. Chương này là đường đi của đồng tiền, từ quầy vé tới sổ cái.",
    anh: { tep: "/huong-dan/van-hoa/hoa-lu.jpg", chu: "Cổng và mái đền tại khu Cố đô Hoa Lư" },
  },
  "khach-marketing": {
    loi: "Khách tới Ninh Bình mang đủ kiểu mong ước: người lên Bái Đính, Tam Chúc thắp nén nhang, người tìm đồng lúa Tam Cốc mùa chín, gia đình có ông bà, con nhỏ. Hiểu khách để tiền quảng cáo rơi đúng chỗ, giữ được khách cũ thay vì tốn kém đi tìm người lạ.",
    anh: { tep: "/huong-dan/van-hoa/tam-chuc.jpg", chu: "Chùa Tam Chúc giữa hồ và núi" },
  },
  "cong-cu": {
    loi: "Lên đỉnh Hang Múa mới thấy dòng Ngô Đồng uốn quanh đồng lúa. Các công cụ này cho giám đốc góc nhìn ấy: cả vùng trên một màn, việc cần mình xếp thành một hàng, phần còn lại đã có quy trình lo.",
    anh: { tep: "/huong-dan/van-hoa/hang-mua.jpg", chu: "Đỉnh Hang Múa" },
  },
};

export const MO_NHOM_WEB: Record<NhomWeb, { loi: string; anh?: AnhVanHoa }> = {
  "kham-pha": {
    loi: "Khách tìm hiểu từ trước khi đi, nhiều khi lúc nửa đêm. Trang khách trả lời thay người tư vấn, cả ngày lẫn đêm, bằng hai thứ tiếng.",
    anh: { tep: "/huong-dan/van-hoa/tam-coc.jpg", chu: "Vùng núi Tam Cốc nhìn từ trên cao" },
  },
  "dat-ve": {
    loi: "Mua vé ở nhà thì quầy bớt hàng dài buổi sáng. Vé, hộ chiếu, quà tặng gom về điện thoại của khách; đơn chạy thẳng vào hệ thống điều hành, chẳng ai phải nhập lại.",
    anh: { tep: "/huong-dan/van-hoa/bich-dong.jpg", chu: "Chùa Bích Động" },
  },
  "tai-diem": {
    loi: "Tới nơi, điện thoại của khách thành vé vào cổng, thành số hàng chờ, thành người thuyết minh. Mỗi việc khách tự làm được là một việc nhân viên được nhẹ.",
    anh: { tep: "/huong-dan/van-hoa/trang-an-mua.jpg", chu: "Thuyền giữa sương sớm Tràng An" },
  },
  "doi-tac": {
    loi: "Đại lý, nhãn hàng, những mùa hoa, mùa trăng: các mối ấy mang khách về mà cơ sở chẳng phải tự đi tìm.",
    anh: { tep: "/huong-dan/van-hoa/hoa-sung.jpg", chu: "Bông súng buổi sớm. Ảnh: minh ha, Wikimedia Commons, CC0" },
  },
  "hieu-ung": {
    loi: "Ninh Bình đẹp ở sương sớm, ở nhịp đò chậm. Những hiệu ứng này đưa cái đẹp ấy lên màn hình để khách ở lại lâu hơn và tin vào chuyến đi trước khi đặt vé.",
  },
};

/** Để làm gì: mỗi chức năng vài câu, nói việc nó gánh thay người và khoản nó giữ lại. */
export const DE_LAM_GI: Record<string, string> = {
  // A.1 Ở cổng và quầy vé
  "ban-quay": "Quầy vé là nơi tiền vào nhiều nhất trong ngày, cũng là nơi dễ thất thoát nhất. Máy tự tính tiền thừa, in phiếu có mã QR và ghi tên người bán, nên cuối ca khỏi ngồi cộng tay, tấm vé nào cũng có chủ.",
  "phieu-doan": "Một đoàn ba mươi người từng mất cả chục phút ghi chép, tính chiết khấu bằng tay. Nay máy tự đếm công ty đã đi mấy đoàn trong năm để áp đúng ưu đãi; mức giảm thôi phụ thuộc vào trí nhớ hay sự dễ dãi của người bán.",
  "cong-ty-lu-hanh": "Công ty lữ hành là mối làm ăn lâu dài. Thẻ này cho giám đốc thấy ai đang mang khách về đều đặn, ai sắp lên bậc ưu đãi, để giữ chân đúng người bằng con số thay vì cảm tính.",
  "ve-moi": "Vé mời là lộc của cơ sở, mà cũng dễ thành kẽ hở nếu chẳng ai ghi. Mỗi vé 0 đ phải có người mời và lý do, tách riêng khỏi tiền bán, nên cuối tháng biết rõ đã mời ai, tốn bao nhiêu.",
  "gan-so-khach": "Khách lẻ mua vé rồi đi, xưa nay cơ sở chẳng giữ lại được gì. Một số điện thoại gắn vào vé là đủ nhận ra người quay lại và mời họ mùa sau, đỡ tốn tiền quảng cáo đi tìm người lạ.",
  "doi-voucher": "Quà chỉ có nghĩa khi trao đúng người, đúng một lần. Quầy tra mã là biết quà gì, còn hạn hay đã đổi; vé miễn phí cũng vào sổ như vé mời.",
  "quet-cong": "Cổng soát vé giống bến đò ngày xưa: có vé mới được sang sông. Mỗi lần quét được ghi lại, vé hết lượt báo ngay, nên vé giả, vé dùng lại khó lọt qua, và số khách thật có sẵn cho mọi báo cáo phía sau.",
  "thu-tai-diem": "Khách đặt trên web mà muốn trả tiền ở nơi đến vẫn được phục vụ trọn vẹn. Số tiền cần thu hiện sẵn, thu xong mới mở cổng, nên chẳng có vé nào vào cửa khi chưa trả.",
  "nop-ca": "Cuối ca, người bán khai số đếm được, máy đặt cạnh số đã bán. Chênh lệch lộ ra ngay trong ca, lúc người còn đứng đó để giải thích, thay vì cả tuần sau mới vỡ lẽ.",
  "gia-ve-quay": "Giá vé một nguồn cho cả quầy lẫn web. Giám đốc đổi giá mùa lễ một lần, hẹn đúng ngày áp dụng; khỏi gọi điện dặn từng quầy, và chẳng có chuyện nơi bán giá cũ nơi bán giá mới.",

  // A.2 Hiện trường và an toàn
  "bao-cao": "Người đứng ở hiện trường thấy trước mọi người. Một tấm ảnh kèm vị trí gửi lên tức thì thay cho cuộc gọi tả bằng lời; quản lý xem là hiểu, đỡ phải đích thân chạy ra tận nơi.",
  "su-co": "Sự cố nào cũng có người nhận, có hạn xử lý. Quá hạn thì hồ sơ tự lên giám đốc, nên việc nhỏ chẳng bị bỏ quên tới lúc thành việc lớn, mà giám đốc cũng chỉ phải nhìn những việc thật sự cần mình.",
  "bao-khan-cap": "Trên sông nước, mỗi phút đều quý. Một chạm là vị trí, ảnh, loại việc tới máy cấp trên, máy rung tới khi có người nhận; quá hai phút chưa ai nhận thì tự gọi. An toàn của khách và người chèo thôi phụ thuộc vào chuyện ai đó kịp tìm ra số điện thoại.",
  "suc-chua": "Di sản có sức chứa của nó, như con thuyền chỉ chở được bốn khách. Thấy trước giờ nào sắp vượt ngưỡng thì giãn khách từ sớm, đỡ phải đóng luồng gấp, đỡ cảnh hàng dài dưới nắng làm khách bỏ về.",
  "hang-cho": "Khách lấy số rồi thong thả dạo bến, ăn sáng, tới lượt điện thoại báo. Bến bớt chen lấn, nhân viên thôi phải gào gọi tên, người chèo nhận khách theo đúng thứ tự.",
  "thuyen-tren-song": "Bản đồ sống cho biết còn bao nhiêu thuyền ở bến, bao nhiêu đang trên sông, ở đoạn nào. Quản lý điều thuyền theo số thật thay vì đứng ở bến đếm bằng mắt.",
  "so-nguoi-cheo": "Người chèo ở bến mỗi người một quê, một giọng chào khách. Sổ người chèo giữ đủ những điều ấy; bấm vào một thuyền là biết ai đang chèo, cần gì thì gọi đúng người.",
  "hop-dong-nguoi-cheo": "Người hết hợp đồng tự ra khỏi lượt gọi, người sắp hết được nhắc trước hai tuần. Chuyện gia hạn thôi trông vào trí nhớ của ai, và chẳng ai phải xuống thuyền khi giấy tờ đã hết hạn.",
  "gioi-thieu-nguoi-cheo": "Người chèo vừa chèo vừa kể chuyện đền phủ, nhiều khi là người bán hàng giỏi nhất của cơ sở. Mã giới thiệu ghi công cho họ: khách quét, đặt gói, tới cổng thì có hoa hồng, chi đúng cho khách thật.",
  "thoi-tiet-ben": "Trời Ninh Bình mùa hè đổi nhanh, dông kéo về chỉ trong một giờ. Dự báo từng giờ ở hai bến giúp quyết tạm dừng từ sớm, khách an toàn, cơ sở đỡ thiệt hơn là dừng giữa chừng.",
  "nguoi-cheo": "Điện thoại của người chèo thành máy định vị, khỏi mua thiết bị GPS cho từng thuyền. Quản lý thấy thuyền thật đang ở đâu và bao giờ về bến.",
  "sop": "Mỗi sáng trước giờ mở cửa, quản lý đi qua đủ các hạng mục an toàn, như người thủ từ soát lại đền trước khi mở cổng: áo phao, bến, lối đi. Giám đốc chốt mở cửa theo bảng ấy, khỏi gọi hỏi từng nơi.",
  "camera": "Hình dung một ca trực có camera đếm người từng khu: nơi nào đông quá thì biết ngay. Màn này đang chạy mô phỏng, ghi rõ trên màn, để thấy trước cách làm khi lắp camera thật.",

  // A.3 Sự kiện và nhà cung cấp
  "goi-viec": "Một mùa lễ có hàng chục đầu việc, từ rước kiệu tới dựng rạp. Gói việc cho thấy ai đang trễ, tiền đã chi bao nhiêu, nên giám đốc nắm tiến độ mà khỏi họp mỗi ngày.",
  "doi-pham-vi": "Ngân sách chỉ đổi khi giám đốc gật đầu, mỗi lần đổi đều có lý do và lịch sử. Chi phí phát sinh thôi lặng lẽ phình ra sau lưng người quyết.",
  "hoa-don-ncc": "Hoá đơn chỉ được ghi nợ khi khớp với đề nghị mua, hợp đồng và biên bản nghiệm thu. Vượt hợp đồng là dừng lại chờ giám đốc, nên tiền chẳng chảy ra cho thứ chưa từng giao.",
  "tro-chuyen": "Nhờ việc qua điện thoại hay mạng xã hội thì lời nhờ trôi mất, không ai biết đã xong chưa. Ở đây tin nhắn gắn thẳng vào đúng màn cần làm, bật một nút là thành việc có hạn, người nhận bấm xong là người giao thấy ngay. Trao đổi công việc nằm lại trong hệ thống, đổi người vẫn đọc lại được.",
  "van-ban": "Hợp đồng sửa một chữ trong điều khoản trông y như bản thật, người soát bằng mắt không thấy. Cổng này chỉ nhận đúng tệp hệ thống phát hành, bắt mọi chữ bị sửa, soát từng ô và đối chiếu dữ liệu sẵn có trong chưa tới một giây; AI đọc thêm phần nghĩa. Người duyệt chỉ còn quyết những văn bản thật sự cần xem.",
  "soat-giay-to": "Một kế toán dò mã số thuế, phép cộng, chữ ký trên chồng hoá đơn có khi mất cả buổi. AI đọc trong vài giây, chỉ ra chỗ thiếu, chỗ sai, rồi điền sẵn hồ sơ; người chỉ còn việc xem lại và quyết.",

  // A.4 Nhân sự và ca làm
  "cham-cong": "Vào ca bằng vị trí ngay tại cơ sở, nên chẳng ai chấm công hộ ai, cuối tháng khỏi ngồi dò sổ giấy.",
  "bang-cong-co-so": "Bảy ngày ai đi muộn, hôm nay ai đang trong ca, xem một lần là đủ. Bảng công tự lập, quản lý dành thời gian cho con người thay vì cho giấy tờ.",
  "giao-ca": "Việc giao bằng lời dễ quên, dễ cãi. Giao trên máy thì có người nhận, có hạn; người nhận vào ca là thấy việc của mình.",
  "tai-khoan": "Mỗi người một tài khoản, chỉ mở đúng màn mình cần. Người bán vé chẳng thấy sổ kế toán, kế toán chẳng tự duyệt cho mình; tách việc như thế là cách rẻ nhất để giữ tiền.",
  "ban-giao-ca": "Ca sau nhận đủ tiền mặt, sự cố còn dở, thiết bị cần để ý, có ký nhận. Lệch ở đâu biết ngay ca ấy, khỏi đổ cho nhau.",
  "ho-so": "Mỗi người một trang: vai, cơ sở, việc đã làm gần đây. Khi cần khen hay nhắc ai, giám đốc có sẵn dữ kiện trong tay.",

  // A.5 Tài chính
  "lap-but-toan": "Ca đã duyệt đi thẳng vào hàng lập bút toán, số liệu lấy từ phiếu thu thật. Kế toán bớt gõ lại, bớt sai vì chép tay.",
  "ghi-so": "Người lập và người ghi sổ là hai người khác nhau, đúng nguyên tắc kế toán. Kỳ đã khoá thì chẳng ai sửa lùi được, sổ giữ nguyên như ngày chốt.",
  "duyet-hoa-hong": "Hoa hồng đại lý ghi chi một lần, máy tự lập bút toán chia về từng cơ sở. Kế toán trưởng soát rồi ghi sổ; sai thì trả lại kèm lý do.",
  "ky-ke-toan": "Sang tháng là có kỳ mới, chẳng ai phải nhớ mở kỳ, cũng chẳng có ngày nào việc bị kẹt chỉ vì một thao tác quên.",
  "tien-ve-co-so": "Khách mua gói trên web đi qua nhiều nơi; tiền ấy chia về từng cơ sở theo lượt khách thật. Nơi nào cũng thấy đúng phần mình làm ra, cuối tháng khỏi tranh cãi.",
  "duyet-ngoai-le": "Chỉ những gì vượt khỏi quy tắc mới tới tay giám đốc: lệch quỹ, công nợ quá mức. Việc thường đã có quy trình, việc lạ thì người quyết.",
  "bao-cao-du-bao": "Tám tuần khách qua cổng cho biết ngày nào, giờ nào đông; dự báo bảy ngày tới giúp xếp người vừa đủ. Thừa người là phí lương, thiếu người là khách chờ lâu.",
  "doi-soat-ca": "Tiền khai đặt cạnh tiền máy đếm, kèm lời giải thích vì sao lệch. Đối soát xong trong vài phút thay vì một buổi chiều.",
  "nop-quy": "Tiền mặt rời quầy là phải tới ngân hàng. Ghép từng lượt nộp với sao kê, lệch đồng nào biết đồng ấy.",

  // A.6 Khách và marketing
  "tra-khach": "Khách gọi tới hỏi vé, quên mã, mất điện thoại: một số điện thoại là ra hết. Nhân viên trả lời ngay khi khách còn đứng đó, khỏi lục lại từng sổ.",
  "khach-hang": "Đơn web, cách trả, mã vé nằm chung một chỗ. Bấm \"Xem như khách\" là thấy đúng hộ chiếu khách đang cầm, giải đáp khỏi phải đoán.",
  "khach-thich-gi": "Đi cùng ai, mua gì, giờ nào đông, ai quay lại: số gộp ấy biến thành việc nên làm. Tiền quảng cáo dồn vào chỗ có khách, thôi rải đều cho may rủi.",
  "doan": "Đoàn đặt trên web và đoàn mua ở quầy về chung một danh sách: ai dẫn, mấy người, đã qua cổng bao nhiêu. Một màn thay cho hai cuốn sổ.",
  "su-kien": "Sự kiện gặp khách mời giữ chân khách cũ. Rút thăm có mã cam kết công bố trước nên ai cũng tự kiểm được, và sự minh bạch ấy là lời quảng bá rẻ mà bền.",
  "thi-anh": "Mỗi tấm ảnh khách gửi về là một lời mời người khác tới Ninh Bình. Duyệt ảnh, trao giải bằng vé mời: chi phí nhỏ, mà kho ảnh thật cứ đầy dần.",
  "so-dau-qr": "Người đi lễ xưa có lệ xin dấu ở mỗi đền chùa; nay khách quét mã ở từng điểm là có dấu vào sổ trên điện thoại. Điểm còn thiếu dấu tự mời khách mua vé, chẳng cần người đứng chào mời.",
  "khach-than-thiet": "Biết bao nhiêu khách để lại số, ai đồng ý nhận tin, quà đã trao. Chăm khách cũ tốn ít hơn nhiều so với tìm khách mới.",
  "marketing": "Mỗi tấm biển, mỗi tờ rơi một mã QR riêng, đếm được lượt quét và tiền mang về. Dịp nào chẳng ra khách thì năm sau bớt chi.",
  "dai-ly": "Hoa hồng chỉ tính cho khách đã qua cổng, trong tháng đã khép. Trả đúng người mang khách thật; đại lý tự xem cổng của mình nên khỏi gọi điện hỏi.",
  "danh-gia-khach": "Chỉ khách đã qua cổng mới được chấm, nên lời khen chê là thật. Cơ sở biết mình cần sửa gì từ chính người đã đi.",
  "lich-mua-vu": "Lễ hội Hoa Lư, lễ hội Tràng An tháng ba âm lịch, khai hội Bái Đính, mùa lúa chín và mùa hoa súng Tam Cốc: lịch tự đổi ngày âm ra dương, nhắc trước ngày nên chuẩn bị. Chiến dịch lên sớm, khỏi cảnh nước tới chân mới nhảy.",

  // A.7 Công cụ của giám đốc
  "toan-vung": "Bốn cơ sở trên một màn: khách, tiền, sự cố, việc chờ quyết. Giám đốc khỏi gọi bốn cuộc điện thoại mỗi sáng.",
  "suc-chua-ca-vung": "Giờ này nơi nào sắp đầy, nơi nào còn thoáng; biết vậy thì mời khách sang nơi vắng thay vì để một bến quá tải.",
  "ghi-bang-giong-noi": "Nói một câu như dặn đồng nghiệp, trợ lý viết thành việc có người nhận, có hạn. Việc nghĩ ra trên đường đi khỏi phải đợi về tới bàn.",
  "future-planning": "Lịch lễ hội ba năm tới và những công nghệ nên làm tiếp. Đây là chỗ giám đốc nghĩ việc lớn, khi việc hằng ngày đã có máy lo.",
  "de-xuat": "Mọi việc chờ gật đầu gom về một chỗ, việc nào cũng kèm lý do. Duyệt nhanh, trả lại rõ ràng, chẳng tờ trình nào nằm quên trong ngăn bàn.",
  "nhat-ky": "Ai làm gì, lúc nào, kể cả khi giám đốc đổi vai. Có nhật ký thì ai cũng cẩn thận hơn, và khi có chuyện thì lần lại được.",
  "xem-theo-vai": "Giám đốc nhìn hệ thống đúng như nhân viên, kế toán nhìn, kể cả chỗ họ bị chặn. Hướng dẫn người mới khỏi phải mượn máy ai.",
  "bang-lenh": "Gõ vài chữ, không dấu cũng được, là tới màn cần. Người mới khỏi học thuộc menu.",
  "viec-can-ban": "Mọi việc đang chờ giám đốc xếp thành một hàng, việc gấp lên đầu. Mỗi sáng làm từ trên xuống là xong; việc chưa làm được thì để mai, sáng mai tự hiện lại.",
  "tro-ly": "Nói hay gõ một việc, trợ lý đưa tới đúng màn. Người ít quen máy tính cũng dùng được.",
  "thong-bao": "Chuông chỉ kêu cho việc cần giám đốc quyết và sự cố đã chuyển cấp. Ít chuông, mà lần nào chuông kêu cũng đáng mở.",

  // B.1 Khám phá và lên kế hoạch
  "web-hoi-nhanh": "Một người tư vấn trực cả ngày đêm, giá và luật đặt chỗ lấy đúng từ web. Câu hỏi lặp đi lặp lại thôi chiếm giờ nhân viên; khách muốn đặt thì AI điền sẵn đơn.",
  "web-ban-do": "Mười lăm điểm đến trên bản đồ núi đá nổi khối, khách thấy đường đi và mức đi bộ trước khi tới. Hiểu trước thì ít hỏi lại, ít lạc đường.",
  "web-kham-pha": "Người đi cùng ông bà, người thích leo núi, mỗi người một sức. Bộ lọc giúp khách tự tìm nơi hợp với mình, khỏi gọi điện hỏi từng chỗ.",
  "web-lap-hanh-trinh": "Khách nói mình muốn đi kiểu gì, máy xếp lịch theo giờ và gợi ý gói gần nhất. Việc của một người tư vấn tour, làm trong vài giây.",
  "web-diem-den": "Mỗi nơi một câu chuyện: Hoa Lư từng là kinh đô Đại Cồ Việt, Tràng An là di sản kép. Trang còn nói thật giới hạn của nơi ấy, để khách tới khỏi thất vọng.",
  "web-dat-ve-noi-nay": "Đang đọc về nơi nào thì mua vé nơi ấy ngay trên trang. Hai điểm Hoa Lư là chặng ghé thăm, không bán vé, nên không có khối này.",
  "web-song-ngu": "Khách nước ngoài đọc trọn trang bằng tiếng Anh, chọn một lần là giữ suốt. Đỡ in tờ rơi hai thứ tiếng.",
  "web-goi": "Vé lẻ đúng giá quầy, lịch đi hai điểm rẻ hơn mua lẻ 10%. Khách mua trước ở nhà, quầy bớt hàng dài buổi sáng.",
  "web-ma-moi": "Khách cũ mời bạn mới, bạn được giảm 10%, người mời được cộng lượt. Lời giới thiệu của người quen thay cho tiền quảng cáo.",
  "web-su-kien": "Khách đăng ký rút thăm, gửi ảnh dự thi ngay trên điện thoại; kết quả ai cũng tự kiểm được.",
  "web-goi-y": "Biết bao nhiêu người vừa qua cổng, nhóm giống mình hay chọn gói nào, khách quyết nhanh hơn mà chẳng cần ai chào mời.",
  "web-so-dau": "Khách quét mã ở từng điểm là có dấu vào sổ, hứa giữ gìn Tràng An thì được thêm một dấu đỏ. Ô còn trống trong sổ là lời mời ghé thêm một nơi.",
  "web-dat-goi": "Chọn ngày, khung giờ, giữ chỗ 15 phút, trả bằng QR giả lập là có vé. Đơn về thẳng hệ thống điều hành, chẳng ai phải nhập tay.",
  "web-hom-nay": "Lượt khách theo giờ, thời tiết hai bến, giờ hoa súng nở, hàng chờ bến đò trên một trang. Khách tự chọn giờ vắng, cơ sở đỡ cảnh dồn cục.",
  "web-gio-vang": "Mỗi khung giờ ghi vắng, vừa hay đông. Khách tự giãn ra, bến đỡ quá tải mà chẳng phải từ chối ai.",
  "web-thanh-day": "Phần đông khách mở web bằng điện thoại, nên năm lối chính nằm ngay trong tầm ngón cái.",
  "web-tra-cuu-ve": "Lỡ đóng trang vé thì mở lại bằng mã hay số điện thoại; vào hang mất sóng, vé vẫn nằm trên máy. Quầy bớt hẳn những lần khách đứng chờ in lại vé.",
  "web-thanh-dat-cho": "Nút giữ chỗ luôn ở trong tầm tay lúc khách đang muốn mua, khỏi cuộn đi tìm.",
  "web-ho-so": "Mọi chuyến của một khách gom về một cuốn hộ chiếu, nơi đã tới có dấu mộc. Thêm một nơi là gần thêm một món quà, cớ để khách quay lại.",
  "web-dau-moc": "Từ trong hệ thống, giám đốc xem đúng hộ chiếu khách đang cầm, để giải đáp và chăm khách cho trúng.",
  "web-hang-cho": "Khách lấy số trên điện thoại rồi thong thả dạo bến, còn hai nhóm thì máy rung báo. Một mã QR dán ở bến làm thay phần việc của người cầm loa gọi tên.",
  "web-nghe": "Đi tới đâu, điện thoại kể chuyện nơi ấy, như có người thuyết minh đi cùng mà cơ sở chẳng phải thuê thêm.",
  "web-kiosk": "Màn hình đứng ở cổng cho khách tự xem gói, tự lấy số. Một chiếc kiosk gánh phần hỏi đáp của một người đứng quầy.",
  "web-tich-diem": "Vé đoàn hay vé quầy cũng thành vé riêng của từng người bằng một số điện thoại. Khách có cớ quay lại, cơ sở có danh sách khách để mời.",
  "web-doan": "Trưởng đoàn tự điền tên từng người trên điện thoại, quầy khỏi chép một danh sách dài.",
  "web-dai-ly": "Đại lý tự xem đơn, khách đã tới, hoa hồng từng tháng của mình; bớt hẳn những cuộc gọi hỏi đối soát.",
  "web-hop-tac": "Năm ý tưởng chụp ảnh với nhãn hàng thời trang, trình bày như tập hồ sơ tạp chí, để mở lời hợp tác cho chuyên nghiệp.",
  "web-hoa-sung": "Hoa súng Tam Cốc chỉ nở buổi sớm. Trang tự tính mùa cho mọi năm và bán chuyến đò sớm: bán đúng thứ chỉ Ninh Bình có, vào lúc nó đẹp nhất.",
  "web-trung-thu": "Vòng trăng đúng pha từng đêm, Bàn Trăng bên sông Ngô Đồng. Mùa đã khép vẫn giữ trang để khách hẹn năm sau.",
  "web-suong": "Sương sớm trên núi đá là hình ảnh nhiều người nhớ về Ninh Bình. Trang chủ mở đầu bằng làn sương ấy để khách dừng lại lâu hơn.",
  "web-suong-ven": "Vào một nơi, sương tan dần rồi ảnh mới hiện; màu sương theo giờ thật ở Ninh Bình, sáng trắng, chiều vàng, tối ánh trăng.",
  "web-nui-suong": "Bốn lớp núi vẽ như tranh mực, con đò trôi chậm: nhịp thong thả của vùng đất này nằm ngay trên trang lập lịch.",
  "web-thuyen-cuon": "Cuộn tới đâu thuyền đi tới đó, qua từng hang, từng đền của Tràng An. Khách đọc chuyện mà như đang ngồi thuyền.",
  "web-den-hoa-dang": "Đèn hoa đăng trôi dưới vòng trăng, gợi đêm rằm bên sông cho những ai chưa kịp tới.",
  "web-ve-giay": "Thẻ gói như tấm vé giấy có cuống răng cưa, nghiêng theo tay cầm, cho khách cảm giác cầm vé thật trên màn hình.",
  "web-con-tro": "Con trỏ hiện chữ Kéo, Xem, Mở đúng chỗ, khách khỏi đoán chỗ nào bấm được.",
  "web-ben-do": "Năm bước đặt chỗ là năm bến dọc một dòng sông, đò trôi tới bến của bước đang làm. Khách biết mình còn mấy bước, nên ít bỏ dở giữa chừng.",
  "web-hoa-no-theo-gio": "Kéo thanh giờ là thấy hoa súng xoè rồi khép theo giờ thật buổi sáng, để khách hiểu vì sao nên đi đò sớm.",
  "web-ke-mua": "Mùa đang tới và mùa đã khép xếp cạnh nhau; mùa đã qua vẫn xem lại được, để lời hẹn năm sau còn nguyên đó.",
};

export type ChangTrongNgay = { luc: string; ten: string; loi: string; muc: readonly string[] };

/** Một ngày vận hành từ A tới Z, theo thứ tự việc thật ở cơ sở. `muc` là mã chức năng. */
export const MOT_NGAY: readonly ChangTrongNgay[] = [
  { luc: "05:30", ten: "Trước giờ mở cửa", loi: "Quản lý đi qua bảng kiểm an toàn, xem thời tiết hai bến. Trời xấu thì báo sự cố thời tiết ngay từ đây.", muc: ["sop", "thoi-tiet-ben"] },
  { luc: "06:30", ten: "Vào ca, nhận việc", loi: "Nhân viên vào ca bằng vị trí. Quản lý giao việc trong ca; người chèo hết hợp đồng đã tự ra khỏi lượt gọi.", muc: ["cham-cong", "giao-ca", "hop-dong-nguoi-cheo"] },
  { luc: "07:00", ten: "Mở quầy, mở cổng", loi: "Bán vé lẻ, vé đoàn, vé mời; hỏi số khách để tích điểm. Cổng quét mọi loại vé, thu nốt tiền của khách chọn trả tại điểm.", muc: ["ban-quay", "phieu-doan", "ve-moi", "gan-so-khach", "quet-cong", "thu-tai-diem"] },
  { luc: "08:00", ten: "Bến bắt đầu đông", loi: "Khách lấy số hàng chờ, nhân viên bến gọi lượt. Người chèo bấm bắt đầu chuyến, bản đồ thấy thuyền trên sông; màn Sức chứa báo trước khi chạm ngưỡng.", muc: ["hang-cho", "nguoi-cheo", "thuyen-tren-song", "suc-chua"] },
  { luc: "Giữa ngày", ten: "Khi có chuyện bất ngờ", loi: "Việc thường thì chụp ảnh báo cáo. Người gặp nạn thì bấm SOS. Quản lý giao người xử lý; quá hạn hồ sơ tự lên giám đốc.", muc: ["bao-cao", "bao-khan-cap", "su-co"] },
  { luc: "Buổi chiều", ten: "Khách hỏi, khách đổi quà", loi: "Khách quên mã thì tra bằng số điện thoại. Khách đủ lượt thì đổi quà. Đoàn nào cần chăm sóc thì xem ở màn Đoàn.", muc: ["tra-khach", "doi-voucher", "doan"] },
  { luc: "Cuối ca", ten: "Chốt ca, bàn giao", loi: "Người bán khai tiền đếm được, máy tính chênh lệch. Ca sau ký nhận tiền mặt và việc còn dở. Giám đốc xem đối soát khi có lệch.", muc: ["nop-ca", "ban-giao-ca", "doi-soat-ca"] },
  { luc: "Hôm sau", ten: "Kế toán vào sổ", loi: "Tiền mặt nộp ngân hàng, ghép với sao kê. Kế toán lập bút toán, kế toán trưởng ghi sổ. Hoá đơn nhà cung cấp được soát rồi mới ghi nợ.", muc: ["nop-quy", "lap-but-toan", "ghi-so", "soat-giay-to", "hoa-don-ncc"] },
  { luc: "Mỗi sáng", ten: "Mười lăm phút của giám đốc", loi: "Mở Việc cần bạn, làm từ trên xuống. Liếc Toàn vùng và chuông. Việc nghĩ ra thì nói một câu cho trợ lý giao.", muc: ["viec-can-ban", "toan-vung", "thong-bao", "duyet-ngoai-le", "ghi-bang-giong-noi"] },
  { luc: "Mỗi tuần", ten: "Nhìn khách, nhìn tiền", loi: "Đọc Khách thích gì, so tiền vé từng cơ sở, xem dự báo bảy ngày để xếp người. Công ty lữ hành nào sắp lên bậc thì giữ chân.", muc: ["khach-thich-gi", "tien-ve-co-so", "bao-cao-du-bao", "cong-ty-lu-hanh"] },
  { luc: "Mỗi tháng", ten: "Khép tháng", loi: "Chi hoa hồng đại lý và người chèo cho khách đã qua cổng; kế toán trưởng duyệt bút toán rồi khoá kỳ. Duyệt ảnh thi tháng.", muc: ["dai-ly", "duyet-hoa-hong", "ky-ke-toan", "thi-anh"] },
  { luc: "Mỗi mùa", ten: "Chuẩn bị mùa lễ", loi: "Lịch mùa vụ nhắc ngày chuẩn bị; mở chiến dịch có mã QR, hẹn giá mùa lễ, lập dự án lễ hội, mở sự kiện gặp khách. Nghĩ xa hơn ở Future planning.", muc: ["lich-mua-vu", "marketing", "gia-ve-quay", "goi-viec", "su-kien", "future-planning"] },
];

/** Hành trình một vị khách, từ lúc tò mò tới lúc hẹn quay lại. */
export const HANH_TRINH_KHACH: readonly ChangTrongNgay[] = [
  { luc: "Ở nhà", ten: "Tìm hiểu", loi: "Hỏi AI, xem bản đồ, lọc nơi hợp sức mình, nhờ máy xếp lịch một ngày.", muc: ["web-hoi-nhanh", "web-kham-pha", "web-lap-hanh-trinh", "web-diem-den"] },
  { luc: "Trước chuyến", ten: "Mua vé", loi: "Chọn vé lẻ hay lịch đi hai điểm, chọn giờ vắng, trả bằng QR là có vé trên máy.", muc: ["web-goi", "web-gio-vang", "web-dat-goi"] },
  { luc: "Tới nơi", ten: "Ở điểm đến", loi: "Mở lại vé dù mất sóng, lấy số hàng chờ, nghe thuyết minh, đóng dấu sổ ở từng điểm.", muc: ["web-tra-cuu-ve", "web-hang-cho", "web-nghe", "web-so-dau"] },
  { luc: "Sau chuyến", ten: "Hẹn quay lại", loi: "Hộ chiếu có thêm dấu mộc, quà chờ chuyến sau; mời bạn bằng mã giảm 10%, gửi ảnh dự thi.", muc: ["web-ho-so", "web-tich-diem", "web-ma-moi", "web-su-kien"] },
];

/** Nguồn tư liệu văn hoá dùng trong sổ tay ngoài `content/destinations.ts`. */
export const NGUON: readonly { ten: string; url: string }[] = [
  { ten: "Đại Đoàn Kết, 01/09/2026: Những \"đại sứ\" thầm lặng trên dòng sông di sản (hơn 2.000 người chèo đò ở bến Tràng An)", url: "https://daidoanket.vn/nhung-dai-su-tham-lang-tren-dong-song-di-san.html" },
  { ten: "Nhân Dân: Lễ hội Hoa Lư, tinh hoa hội tụ trên kinh đô đá", url: "https://nhandan.vn/le-hoi-hoa-lu-tinh-hoa-hoi-tu-tren-kinh-do-da-post642916.html" },
  { ten: "Báo Văn hoá: Hàng vạn người dân, du khách tham gia Lễ hội Tràng An", url: "https://baovanhoa.vn/diem-den/hang-van-nguoi-dan-du-khach-tham-gia-le-hoi-trang-an-50225.html" },
  { ten: "Báo Văn hoá: Cơ hội của du lịch khi đường biên hành chính được vẽ lại", url: "https://baovanhoa.vn/du-lich/khi-di-san-duoc-ket-noi-141358.html" },
  { ten: "Thư viện Pháp luật: tỉnh Ninh Bình sau sáp nhập (hiệu lực 01/7/2025)", url: "https://thuvienphapluat.vn/hoi-dap-phap-luat/ma-don-vi-hanh-chinh-tinh-ninh-binh-sau-sap-nhap-la-bao-nhieu-138057208.html" },
  { ten: "UNESCO: Trang An Landscape Complex", url: "https://whc.unesco.org/en/list/1438" },
];
