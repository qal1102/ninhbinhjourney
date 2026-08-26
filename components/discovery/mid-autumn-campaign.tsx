import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import {
  SeasonalExperienceBrowser,
  type SeasonalGroup,
} from "@/components/discovery/seasonal-experience-browser";

type Language = "en" | "vi";

const campaign = {
  vi: {
    eyebrow: "Rằm tháng Tám · 25.09.2026",
    title: "Trăng lên trên dòng Ngô Đồng.",
    body: "Mùa trăng năm nay mở ra nhiều hơn một hộp bánh: một bàn tối bên sông, một đêm diễn giữa núi đá, một chuyến đi dành riêng cho hai người, hay một ý tưởng được cùng nhau làm thành hình.",
    primaryCta: "Khám phá theo dịp",
    planningCta: "Lên hành trình mùa trăng",
    collectionLabel: "Bộ quà mùa trăng 2026",
    collectionTitle: "Nguyệt Viên",
    collectionBody: "Hương vị địa phương trong một dáng quà thanh nhã — để mang về sau chuyến đi, gửi tới gia đình, hoặc thay lời chào dành cho đối tác.",
    browser: {
      explore: "Khám phá mùa trăng theo dịp",
      openDetail: "Mở chi tiết",
      close: "Đóng",
      fromPrice: "Từ",
      actions: {
        booking: "Xem lịch và giữ chỗ",
        contact: "Mở lời kết nối",
        gift: "Hỏi về bộ quà",
        planning: "Đưa vào hành trình",
      },
      call: "Gọi tư vấn",
      email: "Gửi email",
      contactNote: "Đội ngũ Xuân Trường sẽ xác nhận lịch, quy mô và phương án phù hợp trước khi triển khai",
      conceptLabel: "Ý tưởng mở",
      conceptNotice: "Đây là đề xuất sáng tạo độc lập để bắt đầu trao đổi, không phải thông báo về một quan hệ hợp tác hoặc tài trợ đã được xác lập.",
      editorialLabel: "Biên tập · 2026",
      editorialNotice: "Bộ hình biên tập độc lập cho hồ sơ kết nối thương hiệu · Ninh Bình 2026.",
      atelierNavigation: "Mục lục năm nhà mốt",
      archiveNavigation: "Mục lục hồ sơ chiến dịch",
      selectStory: "Chọn câu chuyện",
      previousStory: "Câu chuyện trước",
      nextStory: "Câu chuyện tiếp theo",
      galleryLabel: "Các khung hình",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Quà mùa trăng",
        title: "Một phần Ninh Bình để mang về.",
        body: "Ba quy cách quà từ lời thăm hỏi nhỏ đến bộ quà dành cho gia đình và đối tác. Mỗi lựa chọn có thể trao đổi thêm về thiệp, số lượng và cách bàn giao.",
        ratio: "portrait",
        layout: "catalog",
        items: [
          {
            id: "trang-non",
            kicker: "Hai bánh · hộp gọn",
            title: "Trăng Non",
            body: "Một món quà vừa đủ để mang theo sau chuyến Tam Cốc, dành cho người thân hoặc một lời cảm ơn giản dị.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp",
            price: "390.000 VND",
            action: "gift",
          },
          {
            id: "trang-an",
            kicker: "Bốn bánh · trà tuyển chọn",
            title: "Trăng An",
            body: "Một dáng quà cân bằng cho gia đình và đối tác: đủ đầy, trang nhã và không phô trương.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-gift-box.webp",
            price: "890.000 VND",
            action: "gift",
          },
          {
            id: "nguyet-vien",
            kicker: "Sáu bánh · trà · hộp lưu niệm",
            title: "Nguyệt Viên",
            body: "Bộ quà chủ đạo của mùa 2026, dành cho những cuộc gặp cần một dấu ấn trang trọng hơn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-flavour-guide.webp",
            price: "1.590.000 VND",
            action: "gift",
          },
        ],
      },
      {
        id: "dining",
        eyebrow: "Bàn tối & ẩm thực",
        title: "Khi phong cảnh trở thành một phần của bữa tối.",
        body: "Từ bàn riêng trên sông đến tiệc nhỏ bên hồ, mỗi trải nghiệm được mở theo ngày, số khách và nhịp đi riêng của hành trình.",
        ratio: "landscape",
        layout: "feature",
        items: [
          {
            id: "moon-table-ngo-dong",
            kicker: "19:00–21:30 · hai khách",
            title: "Bàn Trăng bên Ngô Đồng",
            body: "Bữa tối theo mùa, trà và bánh dùng tại chỗ, khép lại bằng một hộp Trăng Non mang về.",
            image: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp",
            price: "2.480.000 VND / bàn",
            action: "booking",
            href: "/packages/ban-trang-tam-coc-2026?lang=vi&source=mid-autumn-2026",
          },
          {
            id: "golden-hour-table",
            kicker: "Hoàng hôn · thực đơn theo mùa",
            title: "Bữa tối giữa sắc vàng Tam Cốc",
            body: "Một bàn ăn chậm, nơi rau trái địa phương và ánh chiều cùng kể câu chuyện về vùng đất.",
            image: "/images/campaigns/mid-autumn-2026/experiences/seasonal-dining-sunset.webp",
            action: "contact",
          },
          {
            id: "waterfront-feast",
            kicker: "Nhóm riêng · theo quy mô",
            title: "Tiệc nhỏ bên mặt nước",
            body: "Dành cho gia đình, nhóm bạn hoặc một cuộc gặp thân mật cần không gian riêng và cách phục vụ trọn vẹn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/waterfront-feast.webp",
            action: "contact",
          },
          {
            id: "mountain-symphony-dinner",
            kicker: "Ẩm thực · âm nhạc · cảnh quan",
            title: "Giao hưởng giữa đất trời",
            body: "Một ý tưởng bàn tối có âm nhạc sống, đặt giữa đường nét núi đá và khoảng trời mở của Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mountain-symphony-dinner.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "nights",
        eyebrow: "Lễ hội & đêm diễn",
        title: "Di sản được nhìn thấy trong một ánh sáng khác.",
        body: "Những phác thảo cho mùa lễ hội: trình diễn ánh sáng, âm nhạc, hoa và nghệ thuật bản địa. Mỗi ý tưởng đều mở để cùng địa phương, nghệ sĩ và đối tác phát triển.",
        ratio: "landscape",
        layout: "stories",
        items: [
          {
            id: "lotus-drone-show",
            kicker: "Bầu trời đêm · hoa sen",
            title: "Sen nở trên trời Ninh Bình",
            body: "Một màn trình diễn drone lấy chuyển động của cánh sen và dòng nước làm ngôn ngữ thị giác.",
            image: "/images/campaigns/mid-autumn-2026/experiences/lotus-drone-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "cliff-light-show",
            kicker: "Ánh sáng · vách núi",
            title: "Dấu thời gian trên đá",
            body: "Trình diễn ánh sáng kể chuyện địa chất, lịch sử và những lớp ký ức trên cảnh quan tự nhiên.",
            image: "/images/campaigns/mid-autumn-2026/experiences/cliff-light-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "traditional-dance-night",
            kicker: "Vũ điệu · âm nhạc bản địa",
            title: "Nhịp di sản",
            body: "Một đêm diễn đưa chất liệu múa truyền thống vào không gian đương đại, gần gũi với người xem.",
            image: "/images/campaigns/mid-autumn-2026/experiences/traditional-dance-night.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "flower-festival",
            kicker: "Mùa hoa · đường dạo",
            title: "Lối hoa giữa miền di sản",
            body: "Không gian đi bộ theo mùa, kết nối cảnh quan, thủ công và những điểm dừng dành cho gia đình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/flower-festival.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "private-moments",
        eyebrow: "Những dịp riêng",
        title: "Một ngày chỉ thuộc về những người có mặt.",
        body: "Chuyến nghỉ dưới trời sao, bộ ảnh cưới hay một đường dạo ban đêm — có thể bắt đầu từ một ý thích rồi được đội ngũ thiết kế thành hành trình riêng.",
        ratio: "landscape",
        layout: "mosaic",
        items: [
          {
            id: "heritage-glamping",
            kicker: "Cắm trại · trời sao",
            title: "Một đêm ngoài hiên núi",
            body: "Trải nghiệm lưu trú ngắn giữa thiên nhiên, với bữa tối nhẹ và buổi sáng bắt đầu thật chậm.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-glamping.webp",
            action: "planning",
            concept: true,
          },
          {
            id: "heritage-wedding",
            kicker: "Ảnh cưới · địa điểm riêng",
            title: "Lời hẹn giữa non nước",
            body: "Khảo sát bối cảnh, chọn khung giờ và kết nối ekip để một bộ ảnh giữ được vẻ tự nhiên của Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-wedding.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "heritage-walking-path",
            kicker: "Đường dạo · sau hoàng hôn",
            title: "Dạo bước trong miền sáng",
            body: "Một cung đi bộ nhẹ vào buổi tối, phù hợp để nối bữa ăn, phố cổ và điểm ngắm cảnh trong cùng hành trình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-walking-path.webp",
            action: "planning",
            concept: true,
          },
        ],
      },
      {
        id: "collaborations",
        eyebrow: "Cùng tạo dấu ấn",
        title: "Ninh Bình là một lời mời mở.",
        body: "Dành cho thương hiệu, nhà sáng tạo, doanh nghiệp và cộng đồng muốn cùng làm nên một sản phẩm, một cuộc gặp hay một câu chuyện có gốc rễ tại vùng đất này.",
        ratio: "landscape",
        layout: "index",
        items: [
          {
            id: "international-gathering",
            kicker: "Gặp gỡ quốc tế · kết nối địa phương",
            title: "Bàn tròn giữa miền di sản",
            body: "Không gian gặp gỡ cho những cuộc trao đổi quốc tế cần chiều sâu địa phương và cách đón tiếp riêng.",
            image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "destination-photoshoot",
            kicker: "Biên tập hình ảnh · sản xuất tại điểm đến",
            title: "Ninh Bình trong khung hình mới",
            body: "Kết nối bối cảnh, sản xuất và câu chuyện địa phương cho chiến dịch hình ảnh hoặc bộ sưu tập.",
            image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "ninh-binh-fragrance",
            kicker: "Hương thơm · ký ức điểm đến",
            title: "Một mùi hương của Ninh Bình",
            body: "Ý tưởng đồng sáng tạo sản phẩm lấy sen, đá vôi, mặt nước và ký ức chuyến đi làm điểm khởi đầu.",
            image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "local-gift-atelier",
            kicker: "Thủ công · quà tặng doanh nghiệp",
            title: "Xưởng quà từ Ninh Bình",
            body: "Một đầu mối để kết nối sản vật, nghệ nhân và thiết kế thành bộ quà có câu chuyện rõ ràng.",
            image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "luxury-campaign-archive",
        eyebrow: "Hồ sơ chiến dịch · 12 khung hình mới",
        title: "Khi một thương hiệu tìm thấy bối cảnh của riêng mình.",
        body: "Tám cuộc đối thoại bằng hình ảnh, đi từ đồng hồ, trang sức và nước hoa đến thủ công địa phương. Chọn từng tên để xem trọn bộ khung hình và mở một cuộc trao đổi sản xuất tại Ninh Bình.",
        ratio: "landscape",
        layout: "archive",
        items: [
          {
            id: "bvlgari-night-salon",
            kicker: "01 · High jewellery · đêm bên hồ",
            title: "Bvlgari · Một salon mở về phía núi",
            body: "Ánh xanh của đêm, mặt nước tĩnh và những ô trưng bày sáng vừa đủ. Một gợi ý cho buổi xem riêng có cảnh quan làm phần nền, không làm lu mờ món đồ chính.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/bvlgari-night-salon.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Mở hồ sơ kết nối",
          },
          {
            id: "dior-lotus-beauty",
            kicker: "02 · Hương thơm · mùa sen",
            title: "Dior · Hương sen đi qua miền đá",
            body: "Hai cách đặt một câu chuyện nước hoa giữa Ninh Bình: gần gũi bên mặt hồ và giàu tính trải nghiệm trên lối đi giữa đồng sen.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-beauty.webp",
            gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-atelier.webp"],
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem hai khung hình",
          },
          {
            id: "gucci-evening",
            kicker: "03 · Âm nhạc · hoàng hôn · dạ tiệc",
            title: "Gucci · Từ khúc nhạc chiều đến đêm hội",
            body: "Một câu chuyện có thể bắt đầu bằng ban nhạc nhỏ bên hồ rồi mở rộng thành buổi tối dành cho khách mời, vẫn giữ phong cảnh Ninh Bình ở trung tâm.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-sunset-music.webp",
            gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-evening-gala.webp"],
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem hai chương",
          },
          {
            id: "rolex-river-explorer",
            kicker: "04 · Đồng hồ · hành trình · sông núi",
            title: "Rolex · Thời gian của người lên đường",
            body: "Chiếc thuyền đi giữa những vách đá đưa tinh thần khám phá trở lại với điều căn bản nhất: một con người, một hướng đi và khoảnh khắc cần được ghi nhớ.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/rolex-river-explorer.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Mở câu chuyện",
          },
          {
            id: "vacheron-heritage",
            kicker: "05 · Horology · kiến trúc di sản",
            title: "Vacheron Constantin · Một nhịp chậm qua miền cổ",
            body: "Đường nét kiến trúc, sắc đá và một dáng người điềm tĩnh tạo nên bối cảnh kín đáo cho câu chuyện về độ chính xác và thời gian dài.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/vacheron-constantin-heritage.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Mở câu chuyện",
          },
          {
            id: "cartier-heritage-night",
            kicker: "06 · Đồng hồ · trang sức · đêm di sản",
            title: "Cartier · Sắc đỏ trong hai khoảnh khắc",
            body: "Từ cánh cổng cổ đến bàn tiệc bên hồ, sắc đỏ dẫn mạch cho một cuộc trưng bày đồng hồ và trang sức, đi từ riêng tư đến trang trọng.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-heritage-watch.webp",
            gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-night-gala.webp"],
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem hai khoảnh khắc",
          },
          {
            id: "bottega-kim-son-craft",
            kicker: "07 · Kim Sơn · cói · bàn tay làm nghề",
            title: "Bottega Veneta · Khi chất liệu gặp người làm",
            body: "Không gian xưởng, sợi cói và bàn tay nghệ nhân đưa câu chuyện về bề mặt đan trở về nơi nó có chiều sâu thật: quá trình làm nên một vật đẹp.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/bottega-kim-son-craft.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Gặp câu chuyện thủ công",
          },
          {
            id: "hermes-river-journey",
            kicker: "08 · Lụa · da thuộc · dòng Ngô Đồng",
            title: "Hermès · Dòng sông giữ lại ánh chiều",
            body: "Hai khung hình đặt lụa và da thuộc vào chuyển động chậm của Tam Cốc: một chuyến thuyền giữa sen và một khoảng dừng dưới mái hiên khi ngày vừa xuống.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp",
            gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp"],
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem chương Hermès",
          },
        ],
      },
      {
        id: "brand-atelier",
        eyebrow: "Biên tập hình ảnh · Ninh Bình 2026",
        title: "Năm nhà mốt, một miền di sản.",
        body: "Năm cách nhìn đặt cạnh núi đá, mặt nước và mùa sen của Ninh Bình. Mỗi bộ hình giữ một nhịp riêng; càng đi sâu, câu chuyện càng ấm và gần với bàn tay làm nghề.",
        ratio: "portrait",
        layout: "atelier",
        items: [
          {
            id: "celine-concept",
            kicker: "01 · Áo dài · hồ sen · sớm mai",
            title: "Celine · Một khoảng lặng có đường nét",
            body: "Sắc đen đi cùng tà áo dài màu kem và mặt hồ buổi sớm. Ninh Bình hiện lên gọn ghẽ, tĩnh tại, gần như không cần thêm lời.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/celine-concept.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem dấu ấn",
            atelierTone: "linen",
          },
          {
            id: "chanel-concept",
            kicker: "02 · Tweed · ngọc trai · mùa sen",
            title: "Chanel · Hoa nở bên miền đá cổ",
            body: "Tweed, ngọc trai và những cánh sen bắt lấy ánh nước. Vẻ cổ điển được đặt giữa non xanh, nhẹ nhàng mà vẫn có điểm nhìn riêng.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/chanel-concept.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Bước vào khung hình",
            atelierTone: "pearl",
          },
          {
            id: "prada-concept",
            kicker: "03 · Phom dáng · mặt nước · núi đá",
            title: "Prada · Sắc mới giữa miền tĩnh lặng",
            body: "Phom dáng gọn ghẽ đứng giữa mặt hồ phẳng và núi đá vôi. Một Ninh Bình trẻ, sắc sảo, nhưng chưa bao giờ cần phải ồn ào.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/prada-concept.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Xem câu chuyện",
            atelierTone: "sage",
          },
          {
            id: "bottega-veneta-concept",
            kicker: "04 · Bề mặt đan · sắc xanh · ánh chiều",
            title: "Bottega Veneta · Vẻ đẹp nằm trong cách làm",
            body: "Sắc xanh, bề mặt đan và nhịp chèo trên sông cùng kể về đôi tay làm nghề. Mỗi chi tiết được làm chậm lại để người xem có thời gian nhìn thật kỹ.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp",
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Nhìn gần hơn",
            atelierTone: "forest",
          },
          {
            id: "hermes-concept",
            kicker: "05 · Da thuộc · lụa · dòng Ngô Đồng",
            title: "Hermès · Đi xa để trở về",
            body: "Da thuộc màu mật, dải lụa cam và chiếc thuyền nan đi qua Tam Cốc. Chương cuối giữ lại vẻ đẹp của một chuyến đi không vội.",
            image: "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp",
            gallery: [
              "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp",
              "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp",
            ],
            action: "contact",
            concept: true,
            editorial: true,
            editorialAction: "Đi tiếp",
            atelierTone: "cognac",
            atelierFinale: true,
          },
        ],
      },
    ] satisfies SeasonalGroup[],
  },
  en: {
    eyebrow: "The eighth lunar full moon · 25 September 2026",
    title: "Moonrise over the Ngo Dong River.",
    body: "This Mid-Autumn season holds more than a box of cakes: a river table, a night performance among limestone peaks, a journey for two, or an idea made tangible together.",
    primaryCta: "Explore by occasion",
    planningCta: "Plan a moonlit journey",
    collectionLabel: "Mid-Autumn collection 2026",
    collectionTitle: "Nguyet Vien",
    collectionBody: "Local flavours in a composed presentation — to carry home, share with family, or offer as a thoughtful greeting to a partner.",
    browser: {
      explore: "Explore the season by occasion",
      openDetail: "Open details",
      close: "Close",
      fromPrice: "From",
      actions: {
        booking: "View dates and hold a table",
        contact: "Start a conversation",
        gift: "Enquire about this gift",
        planning: "Add to my journey",
      },
      call: "Call the team",
      email: "Send an email",
      contactNote: "The Xuan Truong team will confirm timing, scale and the most suitable arrangement before delivery",
      conceptLabel: "Open concept",
      conceptNotice: "This is an independent creative proposal intended to begin a conversation; it does not announce an established commercial partnership or sponsorship.",
      editorialLabel: "Editorial · 2026",
      editorialNotice: "An independent editorial series for brand outreach · Ninh Binh 2026.",
      atelierNavigation: "Index of five fashion houses",
      archiveNavigation: "Campaign archive index",
      selectStory: "Select story",
      previousStory: "Previous story",
      nextStory: "Next story",
      galleryLabel: "Campaign frames",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Gifts of the moon",
        title: "A little of Ninh Binh to take home.",
        body: "Three gift formats, from a quiet gesture to a family or corporate presentation. Cards, quantities and collection can be arranged with the team.",
        ratio: "portrait",
        layout: "catalog",
        items: [
          { id: "trang-non", kicker: "Two cakes · compact box", title: "Trang Non", body: "A thoughtful gift light enough to carry home from Tam Coc.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp", price: "VND 390,000", action: "gift" },
          { id: "trang-an", kicker: "Four cakes · selected tea", title: "Trang An", body: "A balanced presentation for family and partners: generous, composed and never needlessly grand.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-gift-box.webp", price: "VND 890,000", action: "gift" },
          { id: "nguyet-vien", kicker: "Six cakes · tea · keepsake box", title: "Nguyet Vien", body: "The signature 2026 gift for gatherings that call for a more formal gesture.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-flavour-guide.webp", price: "VND 1,590,000", action: "gift" },
        ],
      },
      {
        id: "dining",
        eyebrow: "Tables & dining",
        title: "When the landscape becomes part of dinner.",
        body: "From a private river table to a gathering by the lake, each experience begins with a date, a party size and the rhythm of your journey.",
        ratio: "landscape",
        layout: "feature",
        items: [
          { id: "moon-table-ngo-dong", kicker: "7:00–9:30 pm · two guests", title: "Moon Table by the Ngo Dong", body: "A seasonal dinner, tea and mooncake at the table, followed by a Trang Non box to take home.", image: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp", price: "VND 2,480,000 / table", action: "booking", href: "/packages/ban-trang-tam-coc-2026?lang=en&source=mid-autumn-2026" },
          { id: "golden-hour-table", kicker: "Golden hour · seasonal menu", title: "Dinner in the Tam Coc light", body: "A slow table where local produce and the final light of day tell one story.", image: "/images/campaigns/mid-autumn-2026/experiences/seasonal-dining-sunset.webp", action: "contact" },
          { id: "waterfront-feast", kicker: "Private group · arranged to scale", title: "A gathering by the water", body: "For families, friends or an intimate meeting in need of its own setting and considered service.", image: "/images/campaigns/mid-autumn-2026/experiences/waterfront-feast.webp", action: "contact" },
          { id: "mountain-symphony-dinner", kicker: "Food · music · landscape", title: "A symphony between earth and sky", body: "An open idea for a dinner with live music among the limestone silhouettes of Ninh Binh.", image: "/images/campaigns/mid-autumn-2026/experiences/mountain-symphony-dinner.webp", action: "contact", concept: true },
        ],
      },
      {
        id: "nights",
        eyebrow: "Festivals & nights",
        title: "Heritage, seen in another light.",
        body: "Open sketches for light, music, flowers and local performance — ready to be developed with communities, artists and partners.",
        ratio: "landscape",
        layout: "stories",
        items: [
          { id: "lotus-drone-show", kicker: "Night sky · lotus", title: "Lotus over Ninh Binh", body: "A drone performance shaped by the movement of lotus petals and water.", image: "/images/campaigns/mid-autumn-2026/experiences/lotus-drone-show.webp", action: "contact", concept: true },
          { id: "cliff-light-show", kicker: "Light · limestone", title: "Time written on stone", body: "A light-led story of geology, history and memory across the natural landscape.", image: "/images/campaigns/mid-autumn-2026/experiences/cliff-light-show.webp", action: "contact", concept: true },
          { id: "traditional-dance-night", kicker: "Dance · local music", title: "Rhythms of heritage", body: "Traditional movement reimagined in a contemporary setting close to its audience.", image: "/images/campaigns/mid-autumn-2026/experiences/traditional-dance-night.webp", action: "contact", concept: true },
          { id: "flower-festival", kicker: "Seasonal flowers · promenade", title: "A garden through heritage", body: "A seasonal walking landscape connecting craft, nature and moments for families.", image: "/images/campaigns/mid-autumn-2026/experiences/flower-festival.webp", action: "contact", concept: true },
        ],
      },
      {
        id: "private-moments",
        eyebrow: "Private occasions",
        title: "A day belonging only to those present.",
        body: "A night under the stars, a wedding portrait or an evening walk can begin as a wish and become a journey of its own.",
        ratio: "landscape",
        layout: "mosaic",
        items: [
          { id: "heritage-glamping", kicker: "Camp · night sky", title: "A night beneath the peaks", body: "A short stay in nature with a light dinner and an unhurried morning.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-glamping.webp", action: "planning", concept: true },
          { id: "heritage-wedding", kicker: "Wedding portrait · private setting", title: "A promise among the karsts", body: "Location scouting, timing and local production for imagery that remains true to Ninh Binh.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-wedding.webp", action: "contact", concept: true },
          { id: "heritage-walking-path", kicker: "Promenade · after sunset", title: "A walk through light", body: "An easy evening route connecting dinner, the old town and a final view in one journey.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-walking-path.webp", action: "planning", concept: true },
        ],
      },
      {
        id: "collaborations",
        eyebrow: "Create together",
        title: "Ninh Binh is an open invitation.",
        body: "For brands, makers, businesses and communities ready to create a product, a gathering or a story rooted in this place.",
        ratio: "landscape",
        layout: "index",
        items: [
          { id: "international-gathering", kicker: "International exchange · local connection", title: "A round table in heritage", body: "A considered setting for international conversations that need local depth and a distinctive welcome.", image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp", action: "contact", concept: true },
          { id: "destination-photoshoot", kicker: "Editorial · destination production", title: "Ninh Binh in a new frame", body: "Locations, production and local narratives for an editorial campaign or collection.", image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp", action: "contact", concept: true },
          { id: "ninh-binh-fragrance", kicker: "Scent · memory of place", title: "A fragrance of Ninh Binh", body: "A co-creation beginning with lotus, limestone, water and the memory of a journey.", image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp", action: "contact", concept: true },
          { id: "local-gift-atelier", kicker: "Craft · corporate gifting", title: "The Ninh Binh gift atelier", body: "One point of connection for produce, makers and design to become a gift with a clear story.", image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp", action: "contact", concept: true },
        ],
      },
      {
        id: "luxury-campaign-archive",
        eyebrow: "Campaign archive · 12 new frames",
        title: "When a house finds a landscape of its own.",
        body: "Eight visual conversations spanning watches, jewellery, fragrance and local craft. Select a name to see every frame and begin a production conversation in Ninh Binh.",
        ratio: "landscape",
        layout: "archive",
        items: [
          { id: "bvlgari-night-salon", kicker: "01 · High jewellery · lakeside night", title: "Bvlgari · A salon opening towards the mountains", body: "Blue hour, still water and display light held in careful balance — a private viewing where the landscape supports, rather than overwhelms, each piece.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/bvlgari-night-salon.webp", action: "contact", concept: true, editorial: true, editorialAction: "Open the connection brief" },
          { id: "dior-lotus-beauty", kicker: "02 · Fragrance · lotus season", title: "Dior · A lotus note through limestone country", body: "Two settings for a fragrance story in Ninh Binh: intimate at the water's edge, then experiential along a path through the lotus fields.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-beauty.webp", gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-atelier.webp"], action: "contact", concept: true, editorial: true, editorialAction: "View both frames" },
          { id: "gucci-evening", kicker: "03 · Music · sunset · gala", title: "Gucci · From an evening song to a night gathering", body: "A story beginning with musicians by the lake and growing into an evening for guests, while keeping the Ninh Binh landscape at its centre.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-sunset-music.webp", gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-evening-gala.webp"], action: "contact", concept: true, editorial: true, editorialAction: "View both chapters" },
          { id: "rolex-river-explorer", kicker: "04 · Watch · journey · river", title: "Rolex · Time kept by the traveller", body: "A sampan between limestone walls returns exploration to its essentials: one person, one direction and a moment worth keeping.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/rolex-river-explorer.webp", action: "contact", concept: true, editorial: true, editorialAction: "Open the story" },
          { id: "vacheron-heritage", kicker: "05 · Horology · heritage architecture", title: "Vacheron Constantin · A slower passage through history", body: "Stone, architecture and a composed silhouette create a discreet setting for precision and the idea of time measured across generations.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/vacheron-constantin-heritage.webp", action: "contact", concept: true, editorial: true, editorialAction: "Open the story" },
          { id: "cartier-heritage-night", kicker: "06 · Watch · jewellery · heritage night", title: "Cartier · Red, held across two moments", body: "From an old gate to a lakeside table, red becomes the thread for a watch and high-jewellery activation moving from private encounter to formal evening.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-heritage-watch.webp", gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-night-gala.webp"], action: "contact", concept: true, editorial: true, editorialAction: "View both moments" },
          { id: "bottega-kim-son-craft", kicker: "07 · Kim Son · sedge · hands at work", title: "Bottega Veneta · Where material meets its maker", body: "Workshop, sedge and the artisan's hand return a story of woven surfaces to the place where it holds real depth: the making of a beautiful object.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/bottega-kim-son-craft.webp", action: "contact", concept: true, editorial: true, editorialAction: "Meet the craft story" },
          { id: "hermes-river-journey", kicker: "08 · Silk · leather · Ngo Dong River", title: "Hermès · The river keeps the final light", body: "Two frames place silk and leather within the slow movement of Tam Coc: a sampan among lotus flowers and a pause beneath the pavilion as daylight falls.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp", gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp"], action: "contact", concept: true, editorial: true, editorialAction: "View the Hermès chapter" },
        ],
      },
      {
        id: "brand-atelier",
        eyebrow: "Editorial series · Ninh Binh 2026",
        title: "Five houses, one heritage landscape.",
        body: "Five points of view set among Ninh Binh's limestone, water and lotus season. Each chapter keeps its own pace; the deeper we go, the closer the story comes to material and craft.",
        ratio: "portrait",
        layout: "atelier",
        items: [
          { id: "celine-concept", kicker: "01 · Ao dai · lotus lake · morning", title: "Celine · A study in stillness", body: "Black meets a cream ao dai and the first light on the lake. Ninh Binh feels composed, quiet and almost beyond the need for words.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/celine-concept.webp", action: "contact", concept: true, editorial: true, editorialAction: "View the study", atelierTone: "linen" },
          { id: "chanel-concept", kicker: "02 · Tweed · pearls · lotus season", title: "Chanel · Flowers against ancient stone", body: "Tweed, pearls and lotus petals catch the light on the water. A classic silhouette finds a fresh setting among the limestone peaks.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/chanel-concept.webp", action: "contact", concept: true, editorial: true, editorialAction: "Enter the frame", atelierTone: "pearl" },
          { id: "prada-concept", kicker: "03 · Silhouette · water · limestone", title: "Prada · A sharper kind of calm", body: "A precise silhouette stands between still water and limestone. The mood is young and decisive, without ever needing to raise its voice.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/prada-concept.webp", action: "contact", concept: true, editorial: true, editorialAction: "See the story", atelierTone: "sage" },
          { id: "bottega-veneta-concept", kicker: "04 · Weave · green · evening light", title: "Bottega Veneta · Beauty in the making", body: "Green, woven surfaces and the river's steady rhythm speak of the hand behind the work. The pace slows, leaving room to look closely.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp", action: "contact", concept: true, editorial: true, editorialAction: "Look closer", atelierTone: "forest" },
          { id: "hermes-concept", kicker: "05 · Leather · silk · Ngo Dong River", title: "Hermès · Far away, then home", body: "Honeyed leather, orange silk and a sampan pass through Tam Coc. The final chapter keeps the unhurried beauty of a journey well made.", image: "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp", gallery: ["/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp", "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp"], action: "contact", concept: true, editorial: true, editorialAction: "Continue", atelierTone: "cognac", atelierFinale: true },
        ],
      },
    ] satisfies SeasonalGroup[],
  },
} as const;

export function MidAutumnCampaign({ lang, source }: { lang: Language; source: string }) {
  const t = campaign[lang];
  const campaignSource = source || "mid-autumn-2026";
  const planHref = `/plan?lang=${lang}&source=${encodeURIComponent(campaignSource)}`;

  return (
    <section id="mid-autumn" data-customer-section="home-mid-autumn" className="overflow-x-clip bg-[#17231f] pb-24 text-[#FBFAF6] sm:pb-32 lg:pb-40">
      <div className="border-y border-white/12 lg:grid lg:min-h-[88svh] lg:grid-cols-[0.78fr_1.22fr]">
        <div className="flex items-end bg-[#13251f] px-5 py-16 sm:px-8 sm:py-20 lg:py-24 lg:pl-[max(2rem,calc((100vw-80rem)/2))] lg:pr-12">
          <Reveal className="max-w-xl">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.3em] text-[#E7B96A]">{t.eyebrow}</p>
            <RevealHeading as="h2" text={t.title} className="font-display mt-6 max-w-2xl text-5xl leading-[0.92] sm:text-7xl lg:text-[5.35rem]" />
            <p className="mt-7 max-w-lg text-base leading-8 text-white/68 sm:text-lg">{t.body}</p>
            <div className="mt-10 grid max-w-lg border-y border-white/18 sm:grid-cols-2">
              <a href="#seasonal-moon-gifts" className="group flex min-h-14 items-center justify-between border-b border-white/18 py-3 text-sm font-extrabold text-white transition hover:text-[#E7B96A] sm:border-b-0 sm:border-r sm:pr-5">
                {t.primaryCta}<span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-1.5">↘</span>
              </a>
              <a data-customer-track="mid-autumn-plan" data-customer-content-id="mid-autumn-seasonal-plan" data-customer-content-type="secondary-cta" href={planHref} className="group flex min-h-14 items-center justify-between py-3 text-sm font-extrabold text-white transition hover:text-[#E7B96A] sm:pl-5">
                {t.planningCta}<span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-1.5">→</span>
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={120} className="grid min-h-[660px] grid-rows-[1fr_auto] bg-[#24362f] lg:min-h-0">
          <div className="relative min-h-[480px] overflow-hidden lg:min-h-0">
            <Image src="/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp" alt={t.collectionTitle} fill priority sizes="(min-width: 1024px) 62vw, 100vw" className="object-cover object-[center_42%]" />
            <span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            <span aria-hidden="true" className="absolute right-5 top-5 font-display text-7xl leading-none text-white/78 mix-blend-difference sm:right-8 sm:top-7 sm:text-8xl">2026</span>
          </div>
          <div className="grid gap-4 border-t border-white/12 bg-[#20342d] p-6 sm:grid-cols-[0.7fr_1.3fr] sm:items-end sm:p-8">
            <div>
              <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">{t.collectionLabel}</p>
              <h3 className="font-display mt-3 text-4xl leading-none sm:text-5xl">{t.collectionTitle}</h3>
            </div>
            <p className="max-w-lg text-sm leading-6 text-white/66 sm:text-base sm:leading-7">{t.collectionBody}</p>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SeasonalExperienceBrowser groups={t.groups as unknown as SeasonalGroup[]} copy={t.browser} lang={lang} source={campaignSource} />
      </div>
    </section>
  );
}
