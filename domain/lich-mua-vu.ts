import { amSangDuong, soNgayJulius } from "@/domain/am-lich";

/**
 * Lịch mùa vụ: mười hai tháng tới có những dịp nào đáng làm.
 *
 * ## Vì sao có tệp này
 *
 * Chủ dự án mở màn hình Marketing và hỏi: *"cái phần đó để làm gì, sao không
 * hoàn thiện nó đi? Liên hệ các nhãn hàng hợp tác, campaign và tất cả các thứ
 * sẽ có trong tương lai kiểu draft ý tưởng theo mùa seasonal cả năm đều phải
 * có ở đây chứ? Các đại lễ Phật đản hoặc lễ lớn đều nên có ở đây hết, event
 * liên tục để bắt đầu xu thế."*
 *
 * Màn hình cũ chỉ làm được **một** việc: đổi đích của mã QR đã in. Đó là một
 * công cụ, không phải một cuốn lịch. Người làm marketing cần biết **ba tháng
 * nữa có gì** để còn kịp chuẩn bị, chứ không phải nhớ ra vào đúng hôm khai
 * hội.
 *
 * ## Hai điều tệp này cố ý làm
 *
 * 1. **Tính ngày, không chép ngày.** Gần hết các dịp lớn ở Ninh Bình tính
 *    theo âm lịch, nên ngày dương của chúng đổi mỗi năm. Chép tay từng năm là
 *    vài năm sau cuốn lịch nói sai mà không ai biết. Ở đây ngày dương tính ra
 *    từ `domain/am-lich.ts`, đúng cho mọi năm.
 * 2. **Mỗi dịp mang theo hạn chuẩn bị.** Biết ngày khai hội mà biết muộn thì
 *    cũng bằng không. Vì thế mỗi dịp khai luôn "phải bắt đầu trước bao nhiêu
 *    ngày", và lịch tự nói dịp nào **đã tới lúc phải làm**.
 *
 * Ngày của các lễ hội đều tra từ nguồn công khai và ghi nguồn ngay tại chỗ.
 * Không suy đoán: dịp nào không tra chắc được ngày thì không đưa vào.
 *
 * ## Dịp không theo âm hay dương lịch cố định (04/10/2026)
 *
 * Có lễ đổi ngày mỗi năm mà không theo âm lịch, như Sắc Hồng Tam Cốc (2025
 * tổ chức cuối tuần 22–23/11). Dịp ấy khai `cuoiTuanGan`: năm nào ban tổ chức
 * đã công bố thì ghi vào `daCongBo` và dùng đúng ngày ấy; năm chưa công bố
 * thì lịch tính cuối tuần gần mốc nhất và **ghi rõ là dự kiến**. Mùa hoa,
 * mùa lúa có ngày ước lượng thì khai `uocLuong`. Nhờ vậy Future planning
 * nhìn được nhiều năm tới mà không giả vờ chắc chắn.
 */

export type KieuLich = "am" | "duong";

/** Lễ hội, một mùa kéo dài (hoa, lúa), hay chỉ là dịp làm chiến dịch. */
export type LoaiDip = "le" | "mua" | "chien-dich";

/** Ngày đã chắc tới đâu: theo lịch cố định, ban tổ chức đã công bố, hay dự kiến. */
export type ChacChan = "theo-lich" | "da-cong-bo" | "du-kien";

export const NHAN_CHAC_CHAN: Record<ChacChan, string> = {
  "theo-lich": "Ngày cố định theo lịch",
  "da-cong-bo": "Ban tổ chức đã công bố",
  "du-kien": "Dự kiến, chờ công bố",
};

export type DipMuaVu = {
  id: string;
  ten: string;
  /** Nơi diễn ra, để trống nếu là dịp chung cả nước. */
  noi?: string;
  lich: KieuLich;
  ngay: number;
  thang: number;
  /** Số ngày dịp kéo dài. Mặc định một ngày. */
  soNgay?: number;
  /** Phải bắt đầu chuẩn bị trước bao nhiêu ngày. */
  chuanBiTruoc: number;
  /** Một câu cho người làm marketing: dịp này làm được gì. */
  yNghia: string;
  /** Nguồn tra được cho ngày tổ chức. */
  nguon?: string;
  /** Mặc định là lễ hội ("le"). */
  loai?: LoaiDip;
  /** Ngày trong lịch chỉ là khoảng ước (mùa hoa, mùa lúa). */
  uocLuong?: true;
  /** Đổi ngày mỗi năm: lấy cuối tuần (thứ Bảy) gần ngày dương `ngay/thang` nhất. */
  cuoiTuanGan?: true;
  /** Ngày ban tổ chức đã công bố, theo năm dương lịch. */
  daCongBo?: Readonly<Record<number, { batDau: string; ketThuc: string; nguon: string }>>;
};

/**
 * Các dịp trong năm.
 *
 * Xếp theo âm lịch trước rồi dương lịch, không xếp theo mức độ quan trọng —
 * mức độ ấy tuỳ năm và tuỳ việc, để người dùng tự quyết.
 */
export const CAC_DIP: readonly DipMuaVu[] = Object.freeze([
  {
    id: "tet-nguyen-dan",
    ten: "Tết Nguyên đán",
    lich: "am",
    ngay: 1,
    thang: 1,
    soNgay: 5,
    chuanBiTruoc: 75,
    yNghia:
      "Mùa cao điểm dài nhất năm. Khách nội địa đi theo gia đình nhiều thế hệ, cần tuyến đi chậm và chỗ ngồi cho người lớn tuổi.",
  },
  {
    id: "khai-hoi-bai-dinh",
    ten: "Khai hội chùa Bái Đính",
    noi: "Chùa Bái Đính, Gia Viễn",
    lich: "am",
    ngay: 6,
    thang: 1,
    chuanBiTruoc: 50,
    yNghia:
      "Hội kéo dài tới hết tháng Ba âm lịch, mở đầu mùa hành hương đầu năm. Lượng khách dồn vào buổi sáng.",
    nguon: "trangandanhthang.vn — Lễ hội chùa Bái Đính",
  },
  {
    id: "le-hoi-hoa-lu",
    ten: "Lễ hội Hoa Lư (Trường Yên)",
    noi: "Cố đô Hoa Lư",
    lich: "am",
    ngay: 8,
    thang: 3,
    soNgay: 3,
    chuanBiTruoc: 50,
    yNghia:
      "Di sản văn hoá phi vật thể quốc gia. Dịp mạnh nhất để kể phần lịch sử của vùng đất, hợp với báo chí và đoàn nghiên cứu.",
    nguon: "Sở Văn hoá và Thể thao Ninh Bình — hồ sơ di sản Lễ hội Hoa Lư",
  },
  {
    id: "gio-to-hung-vuong",
    ten: "Giỗ Tổ Hùng Vương",
    lich: "am",
    ngay: 10,
    thang: 3,
    chuanBiTruoc: 40,
    yNghia: "Ngày nghỉ lễ toàn quốc, thường ghép thành kỳ nghỉ ngắn giữa tuần.",
  },
  {
    id: "le-hoi-trang-an",
    ten: "Lễ hội Tràng An",
    noi: "Khu du lịch sinh thái Tràng An",
    lich: "am",
    ngay: 18,
    thang: 3,
    chuanBiTruoc: 45,
    yNghia:
      "Lễ rước nước trên sông, hình ảnh mạnh nhất trong năm cho ảnh và phim. Nên mời trước người chụp và đối tác thương hiệu.",
    nguon: "Tư liệu du lịch Ninh Bình — Lễ hội Tràng An 18 tháng Ba âm lịch",
  },
  {
    id: "phat-dan",
    ten: "Đại lễ Phật đản",
    lich: "am",
    ngay: 15,
    thang: 4,
    chuanBiTruoc: 45,
    yNghia:
      "Mùa của khách hành hương và đoàn nhà chùa. Cần lối đi riêng cho đoàn đông và suất ăn chay.",
  },
  {
    id: "vu-lan",
    ten: "Lễ Vu lan",
    lich: "am",
    ngay: 15,
    thang: 7,
    chuanBiTruoc: 35,
    yNghia:
      "Khách đi cùng cha mẹ. Hợp với gói đi chậm, ít leo, và quà tặng mang ý nghĩa gia đình.",
  },
  {
    id: "trung-thu",
    ten: "Tết Trung thu",
    lich: "am",
    ngay: 15,
    thang: 8,
    chuanBiTruoc: 60,
    yNghia:
      "Trên web đã có trang Trung thu riêng. Đây là dịp duy nhất trong năm bán được các hoạt động buổi tối.",
  },
  {
    id: "tet-duong-lich",
    ten: "Tết Dương lịch",
    lich: "duong",
    ngay: 1,
    thang: 1,
    chuanBiTruoc: 40,
    yNghia: "Kỳ nghỉ ngắn, khách trẻ đi tự túc và đặt sát ngày.",
  },
  {
    id: "gio-to-30-4",
    ten: "Giải phóng miền Nam và Quốc tế Lao động",
    lich: "duong",
    ngay: 30,
    thang: 4,
    soNgay: 2,
    chuanBiTruoc: 55,
    yNghia:
      "Kỳ nghỉ dài, đông nhất trong các dịp dương lịch. Phải chốt sức chứa và nhân sự từ sớm.",
  },
  {
    id: "quoc-khanh",
    ten: "Quốc khánh 2/9",
    lich: "duong",
    ngay: 2,
    thang: 9,
    chuanBiTruoc: 50,
    yNghia: "Kỳ nghỉ dài cuối hè, thường trùng mùa mưa nên cần phương án trong nhà.",
  },
  {
    id: "lua-chin-tam-coc",
    ten: "Mùa lúa chín Tam Cốc",
    noi: "Tam Cốc",
    lich: "duong",
    ngay: 25,
    thang: 5,
    soNgay: 17,
    chuanBiTruoc: 60,
    yNghia:
      "Khoảng cuối tháng Năm sang đầu tháng Sáu, tuỳ vụ gặt từng năm. Đây là hình ảnh được nhắc tới nhiều nhất của Ninh Bình trên báo nước ngoài.",
    nguon: "Ngày trong lịch chỉ là khoảng ước, vụ gặt thật đổi theo thời tiết từng năm",
    loai: "mua",
    uocLuong: true,
  },
  {
    id: "mua-hoa-sung-tam-coc",
    ten: "Mùa hoa súng Tam Cốc",
    noi: "Sông Ngô Đồng, Tam Cốc",
    lich: "duong",
    ngay: 25,
    thang: 10,
    soNgay: 52,
    chuanBiTruoc: 45,
    yNghia:
      "Hoa súng tím hồng nở dọc sông Ngô Đồng, mỗi ngày chỉ khoảng 7–10 giờ sáng rồi cụp lại. Bán đò sớm, dồn khách vào buổi sáng, chuẩn bị hàng chờ ảo ở bến Văn Lâm.",
    nguon: "Tuổi Trẻ 26/10/2025: mùa hoa từ cuối tháng 10 tới tháng 12, hoa nở 7–10 giờ sáng. Khoảng ngày trong lịch là ước lượng",
    loai: "mua",
    uocLuong: true,
  },
  {
    id: "sac-hong-tam-coc",
    ten: "Lễ hội Sắc Hồng Tam Cốc",
    noi: "Sông Ngô Đồng, Tam Cốc",
    lich: "duong",
    ngay: 22,
    thang: 11,
    soNgay: 2,
    cuoiTuanGan: true,
    daCongBo: {
      2025: {
        batDau: "2025-11-22",
        ketThuc: "2025-11-23",
        nguon: "Khu du lịch Tam Cốc – Bích Động: \"Sắc Hồng Tam Cốc 2025 – Bản tình ca mùa thu\", 22–23/11/2025",
      },
    },
    chuanBiTruoc: 50,
    yNghia:
      "Hàng trăm thuyền kết hình hoa súng diễu qua Hang Cả, Hang Hai, Hang Ba, có nhạc và ánh sáng, dâng hương ở đền Thái Vi. Năm chưa công bố ngày thì lịch tính cuối tuần gần 22/11 theo lần tổ chức 2025.",
    nguon: "dulichninhbinh.com.vn và vntravel.org.vn, lần tổ chức 2025",
  },
  {
    id: "cuoi-tuan-halloween",
    ten: "Cuối tuần Halloween",
    lich: "duong",
    ngay: 31,
    thang: 10,
    chuanBiTruoc: 30,
    yNghia:
      "Không phải lễ của Ninh Bình, chỉ nên là một chiến dịch cuối tuần cho khách trẻ từ Hà Nội và khách nước ngoài ở phố Tam Cốc: đò chiều, hoàng hôn, dạo phố đêm. Không dựng không khí ma quỷ quanh đền chùa.",
    loai: "chien-dich",
  },
]);

export type TrangThaiDip =
  | "dang-dien-ra"
  | "toi-luc-chuan-bi"
  | "con-xa";

export type DipSapToi = {
  dip: DipMuaVu;
  /** Ngày bắt đầu, dạng `YYYY-MM-DD`. */
  ngayBatDau: string;
  /** Ngày kết thúc, dạng `YYYY-MM-DD`. */
  ngayKetThuc: string;
  /** Số ngày từ hôm nay tới ngày bắt đầu; âm nghĩa là đang diễn ra. */
  conBaoNhieuNgay: number;
  trangThai: TrangThaiDip;
  chacChan: ChacChan;
};

const MUI_GIO_VN_MS = 7 * 60 * 60 * 1000;

function homNayVN(bayGio: Date) {
  const d = new Date(bayGio.getTime() + MUI_GIO_VN_MS);
  return { ngay: d.getUTCDate(), thang: d.getUTCMonth() + 1, nam: d.getUTCFullYear() };
}

function iso(ngay: number, thang: number, nam: number) {
  return `${nam}-${String(thang).padStart(2, "0")}-${String(ngay).padStart(2, "0")}`;
}

/** Thứ Bảy gần ngày dương `ngay/thang/nam` nhất (cách đều thì lấy thứ Bảy trước). */
function thuBayGan(ngay: number, thang: number, nam: number): string {
  // Julius ngày + 1 chia 7 dư 0 là Chủ nhật; thứ Bảy dư 6.
  const thu = (soNgayJulius(ngay, thang, nam) + 1) % 7;
  const lui = (thu - 6 + 7) % 7;
  const toi = (6 - thu + 7) % 7;
  return cong(iso(ngay, thang, nam), toi < lui ? toi : -lui);
}

/** Ngày dương của một dịp trong một năm dương lịch, hoặc `null`. */
function ngayCuaDip(dip: DipMuaVu, nam: number): string | null {
  if (dip.daCongBo?.[nam]) return dip.daCongBo[nam].batDau;
  if (dip.cuoiTuanGan) return thuBayGan(dip.ngay, dip.thang, nam);
  if (dip.lich === "duong") return iso(dip.ngay, dip.thang, nam);
  const d = amSangDuong(dip.ngay, dip.thang, nam);
  return d ? iso(d.ngay, d.thang, d.nam) : null;
}

/** Ngày của dịp trong năm `nam` đã chắc tới đâu. */
export function doChacChan(dip: DipMuaVu, nam: number): ChacChan {
  if (dip.daCongBo?.[nam]) return "da-cong-bo";
  if (dip.cuoiTuanGan || dip.uocLuong) return "du-kien";
  return "theo-lich";
}

function cong(isoNgay: string, soNgay: number): string {
  const [y, m, d] = isoNgay.split("-").map(Number);
  const jd = soNgayJulius(d, m, y) + soNgay;
  // Đi vòng qua số ngày Julius thay vì `Date`: tránh mọi chuyện múi giờ.
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((b * 146097) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return iso(
    e - Math.floor((153 * mm + 2) / 5) + 1,
    mm + 3 - 12 * Math.floor(mm / 10),
    b * 100 + dd - 4800 + Math.floor(mm / 10),
  );
}

function khoangNgay(tu: string, den: string): number {
  const [y1, m1, d1] = tu.split("-").map(Number);
  const [y2, m2, d2] = den.split("-").map(Number);
  return soNgayJulius(d2, m2, y2) - soNgayJulius(d1, m1, y1);
}

/**
 * Ngày bắt đầu và kết thúc (`YYYY-MM-DD`) của một dịp trong năm `nam`.
 * Dịp âm lịch thì `nam` là năm âm lịch. Không tra được ngày thì `null`.
 */
export function ngayCuaDipTrongNam(dip: DipMuaVu, nam: number): { batDau: string; ketThuc: string } | null {
  const congBo = dip.daCongBo?.[nam];
  if (congBo) return { batDau: congBo.batDau, ketThuc: congBo.ketThuc };
  const batDau = ngayCuaDip(dip, nam);
  return batDau ? { batDau, ketThuc: cong(batDau, (dip.soNgay ?? 1) - 1) } : null;
}

/** Cộng (hay trừ) số ngày vào một ngày `YYYY-MM-DD`. */
export function congNgay(isoNgay: string, soNgay: number): string {
  return cong(isoNgay, soNgay);
}

/** Số ngày từ `tu` tới `den` (âm nếu `den` trước `tu`). */
export function soNgayGiua(tu: string, den: string): number {
  return khoangNgay(tu, den);
}

/** Hôm nay theo giờ Việt Nam, dạng `YYYY-MM-DD`. */
export function homNayTheoGioVN(bayGio: Date): string {
  const h = homNayVN(bayGio);
  return iso(h.ngay, h.thang, h.nam);
}

/**
 * Các dịp trong `soThang` tháng tới, xếp theo ngày gần nhất trước.
 *
 * Một dịp đã qua trong năm nay sẽ hiện lần tổ chức của **năm sau**, nên cuốn
 * lịch luôn nhìn về phía trước — đúng thứ người làm marketing cần, khác hẳn
 * một bảng liệt kê ngày lễ cố định.
 */
export function lichMuaVu(bayGio: Date, soThang = 12): DipSapToi[] {
  const h = homNayVN(bayGio);
  const homNay = iso(h.ngay, h.thang, h.nam);
  const hetHan = cong(homNay, Math.round(soThang * 30.44));

  const ra: DipSapToi[] = [];
  for (const dip of CAC_DIP) {
    for (const nam of [h.nam, h.nam + 1]) {
      const ngay = ngayCuaDipTrongNam(dip, nam);
      if (!ngay) continue;
      const { batDau, ketThuc } = ngay;
      // Đang diễn ra thì vẫn giữ lại, dù ngày bắt đầu đã qua.
      if (khoangNgay(homNay, ketThuc) < 0) continue;
      if (khoangNgay(homNay, batDau) > khoangNgay(homNay, hetHan)) continue;
      const con = khoangNgay(homNay, batDau);
      ra.push({
        dip,
        ngayBatDau: batDau,
        ngayKetThuc: ketThuc,
        conBaoNhieuNgay: con,
        trangThai:
          con <= 0 ? "dang-dien-ra" : con <= dip.chuanBiTruoc ? "toi-luc-chuan-bi" : "con-xa",
        chacChan: doChacChan(dip, nam),
      });
      break;
    }
  }
  return ra.sort((a, b) => a.ngayBatDau.localeCompare(b.ngayBatDau));
}

/** Câu trạng thái ngắn cho một dịp. */
export function loiDip(d: DipSapToi): string {
  if (d.trangThai === "dang-dien-ra") return "đang diễn ra";
  if (d.conBaoNhieuNgay === 1) return "ngày mai";
  if (d.trangThai === "toi-luc-chuan-bi") {
    return `còn ${d.conBaoNhieuNgay} ngày · đã tới lúc chuẩn bị`;
  }
  return `còn ${d.conBaoNhieuNgay} ngày · bắt đầu chuẩn bị trước ${d.dip.chuanBiTruoc} ngày`;
}
