import type { ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Trợ lý ghi việc bằng giọng nói: biến một câu nói tự nhiên thành bản nháp
 * việc giao, ghi chú hay nhật ký ngày, để người nói xem lại rồi mới lưu.
 *
 * Đây là bộ hiểu **bằng luật**, chạy ngay trong máy chủ, không tốn tiền và
 * không gửi câu nói ra ngoài. Nó bắt được những câu nói thường ngày ở bến:
 * "Giao cho Hùng sáng mai kiểm lại áo phao bến Tam Cốc trước 9 giờ", "Ghi chú
 * gọi lại nhà cung cấp nước", "Nhật ký: hôm nay đón 3 đoàn khách Hàn". Câu
 * lạ hơn thì bản nháp vẫn ra, nhưng thiếu ô nào thì thẻ xác nhận hỏi lại.
 *
 * Khi có khoá API của Claude (`ANTHROPIC_API_KEY`), máy chủ dùng Claude để
 * hiểu câu và vẫn đưa kết quả qua cùng bước dò người nhận ở đây
 * (`lib/erp/tro-ly-hieu.ts`), nên đổi bộ hiểu không đổi gì ở màn hình.
 */

export type LoaiGhi = "viec" | "ghi-chu" | "nhat-ky";

export type NguoiTrongDanhBa = {
  id: string;
  ten: string;
  vai: ErpRole;
  coSo: readonly ErpSiteId[];
};

export type BanNhap = {
  loai: LoaiGhi;
  noiDung: string;
  /** Người nhận việc đã dò được trong danh bạ. */
  nguoiNhanId: string | null;
  /** Những người khớp tên nghe được, để thẻ xác nhận cho chọn. */
  ungVien: { id: string; ten: string }[];
  /** Tên nghe được trong câu (khi chưa chắc là ai). */
  tenNghe: string | null;
  /** Hạn, dạng ISO. */
  han: string | null;
  /** Ngày của nhật ký, `YYYY-MM-DD` giờ Việt Nam. */
  ngay: string;
  coSo: ErpSiteId | null;
  khan: boolean;
  /** Điều cần người nói xem lại, viết sẵn để hiện trên thẻ. */
  canXemLai: string[];
  cauGoc: string;
};

export function chuanHoa(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9:/\s]/g, " ")
    // Giữ dấu ":" và "/" chỉ khi nằm giữa hai chữ số (9:30, 12/10).
    .replace(/(?<!\d)[:/]|[:/](?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const XUNG_HO = new Set(["anh", "chi", "em", "co", "chu", "bac", "ban", "ong", "ba", "cau", "di", "thim", "con", "a", "e", "c"]);
const BAN_THAN = new Set(["toi", "minh", "tao"]);
const TU_VAI = /^(quan ly|ke toan|giam doc|nhan vien|to truong|doi truong|bao ve|le tan)\b/;

const CO_SO: { id: ErpSiteId; tu: string[] }[] = [
  { id: "trang-an", tu: ["trang an"] },
  { id: "tam-coc", tu: ["tam coc", "van lam"] },
  { id: "bai-dinh", tu: ["bai dinh"] },
  { id: "tam-chuc", tu: ["tam chuc"] },
];

const SO_CHU: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10,
};

const THU: Record<string, number> = {
  "chu nhat": 0, "thu hai": 1, "thu ba": 2, "thu tu": 3, "thu nam": 4, "thu sau": 5, "thu bay": 6,
  "thu 2": 1, "thu 3": 2, "thu 4": 3, "thu 5": 4, "thu 6": 5, "thu 7": 6, cn: 0,
};

type Tu = { goc: string; chuan: string; dung: boolean };

function tachTu(cau: string): Tu[] {
  return cau
    .replace(/([,.;!?])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean)
    .map((goc) => ({ goc, chuan: chuanHoa(goc), dung: false }));
}

/** Chuỗi chuẩn hoá từ vị trí i, dài n từ (bỏ qua dấu câu). */
function cum(tu: Tu[], i: number, n: number) {
  const out: string[] = [];
  for (let k = i; k < tu.length && out.length < n; k++) if (tu[k].chuan) out.push(tu[k].chuan);
  return out.join(" ");
}

function khop(tu: Tu[], i: number, mau: string) {
  const n = mau.split(" ").length;
  return cum(tu, i, n) === mau;
}

function danhDau(tu: Tu[], i: number, n: number) {
  let dem = 0;
  for (let k = i; k < tu.length && dem < n; k++) {
    if (!tu[k].chuan) continue;
    tu[k].dung = true;
    dem++;
  }
}

/** Vị trí từ có nghĩa đầu tiên kể từ i. */
function tiep(tu: Tu[], i: number) {
  let k = i;
  while (k < tu.length && !tu[k].chuan) k++;
  return k;
}

// ---------- Giờ Việt Nam ----------

const VN_MS = 7 * 3_600_000;

function ngayVn(ms: number) {
  const d = new Date(ms + VN_MS);
  return { nam: d.getUTCFullYear(), thang: d.getUTCMonth() + 1, ngay: d.getUTCDate(), thu: d.getUTCDay(), gio: d.getUTCHours() + d.getUTCMinutes() / 60 };
}

function msVn(nam: number, thang: number, ngay: number, gio: number, phut: number) {
  return Date.UTC(nam, thang - 1, ngay, gio, phut) - VN_MS;
}

function chuoiNgay(nam: number, thang: number, ngay: number) {
  return `${nam}-${String(thang).padStart(2, "0")}-${String(ngay).padStart(2, "0")}`;
}

type MocNgay = { lechNgay: number } | { thang: number; ngay: number };
type Buoi = "sang" | "trua" | "chieu" | "toi";

const GIO_MAC_DINH_BUOI: Record<Buoi, number> = { sang: 9, trua: 12, chieu: 15, toi: 19 };

function docBuoi(chuan: string): Buoi | null {
  if (chuan === "sang") return "sang";
  if (chuan === "trua") return "trua";
  if (chuan === "chieu") return "chieu";
  if (chuan === "toi" || chuan === "dem") return "toi";
  return null;
}

function docSo(chuan: string | undefined): number | null {
  if (!chuan) return null;
  if (/^\d{1,2}$/.test(chuan)) return Number(chuan);
  return SO_CHU[chuan] ?? null;
}

type KetQuaThoiGian = { han: string | null; ngay: string; coMoc: boolean };

function docThoiGian(tu: Tu[], bayGio: Date, loai: LoaiGhi): KetQuaThoiGian {
  let moc: MocNgay | null = null;
  let buoi: Buoi | null = null;
  let gio: number | null = null;
  let phut = 0;
  let cuoiNgay = false;

  for (let i = 0; i < tu.length; i++) {
    if (tu[i].dung || !tu[i].chuan) continue;
    const c = tu[i].chuan;
    const truoc = (n: number) => {
      // Ăn luôn giới từ đứng trước mốc thời gian: "trước 9 giờ", "lúc 3 giờ".
      for (let k = i - 1; k >= 0 && k >= i - 2; k--) {
        if (["truoc", "luc", "vao", "khoang", "den", "toi", "han", "trong", "cho"].includes(tu[k].chuan) && !tu[k].dung) {
          if (tu[k].chuan === "toi" && docBuoi(tu[k + 1]?.chuan ?? "")) break;
          tu[k].dung = true;
        } else break;
      }
      danhDau(tu, i, n);
    };

    // Buổi đứng trước ngày: "sáng mai", "chiều nay", "tối thứ sáu".
    const b = docBuoi(c);
    if (b && (khop(tu, i + 1, "mai") || khop(tu, i + 1, "nay") || khop(tu, i + 1, "hom nay") || khop(tu, i + 1, "ngay mai") || Object.keys(THU).some((t) => khop(tu, i + 1, t)))) {
      buoi = b;
      truoc(1);
      continue;
    }

    if (khop(tu, i, "hom nay")) { moc = { lechNgay: 0 }; truoc(2); continue; }
    if (khop(tu, i, "hom qua")) { moc = { lechNgay: -1 }; truoc(2); continue; }
    if (khop(tu, i, "ngay mai")) { moc = { lechNgay: 1 }; truoc(2); continue; }
    if (khop(tu, i, "ngay kia")) { moc = { lechNgay: 2 }; truoc(2); continue; }
    if (khop(tu, i, "cuoi ngay")) { moc = { lechNgay: 0 }; cuoiNgay = true; truoc(2); continue; }
    if (khop(tu, i, "cuoi tuan")) {
      const t = ngayVn(bayGio.getTime()).thu;
      moc = { lechNgay: (6 - t + 7) % 7 || 7 };
      truoc(2);
      continue;
    }
    if (c === "mai" && i > 0 && (docBuoi(tu[i - 1].chuan) || ["sang", "chieu", "toi"].includes(tu[i - 1].chuan) || tu[i - 1].dung)) {
      moc = { lechNgay: 1 };
      truoc(1);
      continue;
    }
    if (c === "mai" && (i === tiep(tu, 0) || /^\d/.test(tu[tiep(tu, i + 1)]?.chuan ?? "") || ["phai", "can", "nho", "kiem", "gui", "goi", "lam", "bao", "di"].includes(tu[tiep(tu, i + 1)]?.chuan ?? ""))) {
      moc = { lechNgay: 1 };
      truoc(1);
      continue;
    }
    if (c === "mot" && i > 0 && ["ngay"].includes(tu[i - 1].chuan)) { moc = { lechNgay: 2 }; truoc(1); continue; }
    if (c === "nay" && i > 0 && tu[i - 1].dung && docBuoi(tu[i - 1].chuan)) { moc = { lechNgay: 0 }; truoc(1); continue; }

    const thu = Object.keys(THU).find((t) => khop(tu, i, t));
    if (thu) {
      const t = ngayVn(bayGio.getTime()).thu;
      let lech = (THU[thu] - t + 7) % 7 || 7;
      const n = thu.split(" ").length;
      if (khop(tu, i + n, "tuan sau") || khop(tu, i + n, "tuan toi")) {
        lech += lech <= 7 && THU[thu] > t ? 7 : 0;
        danhDau(tu, i + n, 2);
      }
      moc = { lechNgay: lech };
      truoc(n);
      continue;
    }

    // "12/10", "ngày 12 tháng 10".
    const ngayThang = c.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (ngayThang) {
      moc = { ngay: Number(ngayThang[1]), thang: Number(ngayThang[2]) };
      if (i > 0 && tu[i - 1].chuan === "ngay") tu[i - 1].dung = true;
      truoc(1);
      continue;
    }
    if (c === "ngay" && /^\d{1,2}$/.test(tu[i + 1]?.chuan ?? "") && tu[i + 2]?.chuan === "thang" && /^\d{1,2}$/.test(tu[i + 3]?.chuan ?? "")) {
      moc = { ngay: Number(tu[i + 1].chuan), thang: Number(tu[i + 3].chuan) };
      truoc(4);
      continue;
    }

    // Giờ: "9h", "9h30", "9:30", "9 giờ", "9 giờ 30", "9 giờ rưỡi", "chín giờ".
    const gioLien = c.match(/^(\d{1,2})(?:h|:)(\d{1,2})?$/);
    if (gioLien) {
      gio = Number(gioLien[1]);
      phut = gioLien[2] ? Number(gioLien[2]) : 0;
      let n = 1;
      if (!gioLien[2] && /^\d{1,2}$/.test(tu[i + 1]?.chuan ?? "") && Number(tu[i + 1].chuan) < 60) {
        phut = Number(tu[i + 1].chuan);
        n = 2;
        if (tu[i + 2]?.chuan === "phut") n = 3;
      }
      truoc(n);
      const sau = docBuoi(tu[i + n]?.chuan ?? "");
      if (sau) { buoi = sau; danhDau(tu, i + n, 1); }
      continue;
    }
    const so = docSo(c);
    if (so !== null && (tu[i + 1]?.chuan === "gio" || tu[i + 1]?.chuan === "h")) {
      gio = so;
      let n = 2;
      if (tu[i + 2]?.chuan === "ruoi") { phut = 30; n = 3; }
      else if (/^\d{1,2}$/.test(tu[i + 2]?.chuan ?? "") && Number(tu[i + 2].chuan) < 60) {
        phut = Number(tu[i + 2].chuan);
        n = tu[i + 3]?.chuan === "phut" ? 4 : 3;
      }
      truoc(n);
      const sau = docBuoi(tu[i + n]?.chuan ?? "");
      if (sau) { buoi = sau; danhDau(tu, i + n, 1); }
      continue;
    }
    // Buổi đứng một mình cuối câu: "gửi báo cáo trong chiều".
    if (b && (khop(tu, i + 1, "nay") === false) && i > 0 && ["trong", "buoi", "vao"].includes(tu[i - 1].chuan)) {
      buoi = b;
      truoc(1);
      continue;
    }
  }

  const homNay = ngayVn(bayGio.getTime());
  const coMoc = moc !== null || gio !== null || buoi !== null || cuoiNgay;

  let nam = homNay.nam;
  let thang = homNay.thang;
  let ngay = homNay.ngay;
  if (moc && "lechNgay" in moc) {
    const d = ngayVn(msVn(homNay.nam, homNay.thang, homNay.ngay, 12, 0) + moc.lechNgay * 86_400_000);
    ({ nam, thang, ngay } = d);
  } else if (moc) {
    thang = moc.thang;
    ngay = moc.ngay;
    // Ngày đã qua trong năm nay thì hiểu là năm sau.
    if (chuoiNgay(nam, thang, ngay) < chuoiNgay(homNay.nam, homNay.thang, homNay.ngay)) nam += 1;
  }
  const ngayChuoi = chuoiNgay(nam, thang, ngay);

  if (loai === "nhat-ky" || !coMoc) return { han: null, ngay: ngayChuoi, coMoc };

  let h: number;
  if (gio !== null) {
    h = gio;
    if ((buoi === "chieu" || buoi === "toi") && h < 12) h += 12;
    if (buoi === "trua" && h <= 2) h += 12;
    // Không nói buổi: 1–5 giờ trong giờ làm việc hiểu là buổi chiều.
    if (!buoi && h >= 1 && h <= 5) h += 12;
  } else if (buoi) {
    h = GIO_MAC_DINH_BUOI[buoi];
  } else {
    h = 17;
  }
  let ms = msVn(nam, thang, ngay, h, phut);
  // Chỉ nói giờ mà giờ ấy đã qua hôm nay thì hiểu là ngày mai.
  if (!moc && ms <= bayGio.getTime()) ms += 86_400_000;
  return { han: new Date(ms).toISOString(), ngay: ngayChuoi, coMoc };
}

// ---------- Người nhận ----------

function khoaTen(ten: string) {
  const t = chuanHoa(ten).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let n = 1; n <= t.length; n++) out.add(t.slice(t.length - n).join(" "));
  return out;
}

const VAI_TU: { tu: string; vai: ErpRole }[] = [
  { tu: "ke toan truong", vai: "chief-accountant" },
  { tu: "ke toan", vai: "accountant" },
  { tu: "quan ly", vai: "manager" },
  { tu: "giam doc", vai: "director" },
];

type DoNguoi = { nguoiNhanId: string | null; ungVien: { id: string; ten: string }[]; tenNghe: string | null };

function doNguoi(tu: Tu[], i: number, danhBa: readonly NguoiTrongDanhBa[], coSoCau: ErpSiteId | null): DoNguoi {
  let k = tiep(tu, i);
  while (k < tu.length && XUNG_HO.has(tu[k].chuan) && tu[tiep(tu, k + 1)]) {
    tu[k].dung = true;
    k = tiep(tu, k + 1);
  }
  if (k >= tu.length) return { nguoiNhanId: null, ungVien: [], tenNghe: null };

  // Gọi theo vai: "quản lý Tam Cốc", "kế toán".
  for (const v of VAI_TU) {
    if (!khop(tu, k, v.tu)) continue;
    const n = v.tu.split(" ").length;
    let coSo = coSoCau;
    const sau = CO_SO.find((cs) => cs.tu.some((t) => khop(tu, k + n, t)));
    if (sau) coSo = sau.id;
    const hop = danhBa.filter((p) => p.vai === v.vai && (!coSo || p.coSo.includes(coSo)));
    danhDau(tu, k, n + (sau ? sau.tu.find((t) => khop(tu, k + n, t))!.split(" ").length : 0));
    return {
      nguoiNhanId: hop.length === 1 ? hop[0].id : null,
      ungVien: hop.map((p) => ({ id: p.id, ten: p.ten })),
      tenNghe: tu.slice(k, k + n).map((t) => t.goc).join(" "),
    };
  }

  // Gọi theo tên: thử cụm dài nhất trước (họ tên đầy đủ, rồi tên đệm + tên, rồi tên).
  for (let n = 3; n >= 1; n--) {
    const c = cum(tu, k, n);
    if (c.split(" ").length < n) continue;
    const hop = danhBa.filter((p) => khoaTen(p.ten).has(c));
    if (hop.length === 0) continue;
    danhDau(tu, k, n);
    const uuTien = coSoCau ? hop.filter((p) => p.coSo.includes(coSoCau)) : [];
    const chon = hop.length === 1 ? hop[0] : uuTien.length === 1 ? uuTien[0] : null;
    return {
      nguoiNhanId: chon?.id ?? null,
      ungVien: hop.map((p) => ({ id: p.id, ten: p.ten })),
      tenNghe: tu.slice(k, k + n).map((t) => t.goc).join(" "),
    };
  }

  // Không khớp ai: giữ lại tên nghe được nếu nó viết hoa như tên riêng.
  const goc = tu[k].goc;
  if (/^\p{Lu}/u.test(goc)) {
    tu[k].dung = true;
    return { nguoiNhanId: null, ungVien: [], tenNghe: goc };
  }
  return { nguoiNhanId: null, ungVien: [], tenNghe: null };
}

// ---------- Nhận loại câu ----------

const MO_DAU_GHI_CHU = ["ghi chu", "ghi lai", "ghi nho", "note", "luu y", "luu lai", "nho la", "nho"];
const MO_DAU_NHAT_KY = ["ghi nhat ky", "nhat ky", "bao cao ngay", "tong ket ngay", "nhat ki", "ghi nhat ki"];
const MO_DAU_VIEC = ["giao viec cho", "giao cho", "giao viec", "giao", "phan cong cho", "phan cong", "nho", "bao", "nhac", "yeu cau", "de nghi", "can"];

export type LoaiNhanRa = { loai: LoaiGhi; doDai: number } | null;

/** Câu có phải lời nhờ ghi lại không (khác câu hỏi số liệu hay mở màn hình). */
export function nhanLoaiCau(cau: string): LoaiNhanRa {
  const c = chuanHoa(cau);
  // "Nhờ" và "nhớ" bỏ dấu đều là "nho": theo sau là người (xưng hô, vai, tên
  // viết hoa) thì là nhờ việc, còn lại là tự nhắc mình.
  const tuThuHai = cau.trim().split(/\s+/)[1] ?? "";
  const sauNho = c.startsWith("nho ") ? c.slice(4) : "";
  const nhoNguoi =
    sauNho !== "" &&
    (/^(anh|chi|em|co|chu|ban|ong|ba|bac|cau)\b/.test(sauNho) ||
      TU_VAI.test(sauNho) ||
      (/^\p{Lu}/u.test(tuThuHai) && !/^nho (la|mua|goi|kiem|lam|gui)\b/.test(c)));
  const batDau = (m: string) => c === m || c.startsWith(`${m} `);
  const nk = MO_DAU_NHAT_KY.find(batDau);
  if (nk) return { loai: "nhat-ky", doDai: nk.split(" ").length };
  if (/^(hom nay )?(toi|em|minh) (da|vua) /.test(c)) return { loai: "nhat-ky", doDai: 0 };
  if (/^nhac (toi|minh|em|tao)\b/.test(c)) return { loai: "ghi-chu", doDai: 2 };
  if (batDau("nho") && !nhoNguoi) return { loai: "ghi-chu", doDai: 1 };
  const gc = MO_DAU_GHI_CHU.filter((m) => m !== "nho").find(batDau);
  if (gc) return { loai: "ghi-chu", doDai: gc.split(" ").length };
  const v = MO_DAU_VIEC.find(batDau);
  if (v) {
    const sau = c.slice(v.length).trim().split(" ")[0] ?? "";
    // "Cần" chỉ là giao việc khi theo sau là một người ("cần chị Lan…").
    if (v === "can" && !XUNG_HO.has(sau)) return null;
    if (v === "bao" && ["cao", "dong", "gia", "hong", "tri", "ve", "nhieu"].includes(sau)) return null;
    if (BAN_THAN.has(sau) && (v === "nhac" || v === "nho")) return { loai: "ghi-chu", doDai: 2 };
    return { loai: "viec", doDai: v.split(" ").length };
  }
  return null;
}

// ---------- Ghép lại ----------

const DUOI_THUA = new Set(["nhe", "nha", "nhe", "nhi", "giup", "gium", "voi", "a", "nhen", "di", "nhes"]);
const DAU_THUA = new Set(["la", "rang", "de", "phai", "can", "hay", "viec", "lam", "nhe", ":", ",", "-"]);

function lamSachNoiDung(tu: Tu[]) {
  const con = tu.filter((t) => !t.dung);
  while (con.length && (DAU_THUA.has(con[0].chuan) || !con[0].chuan)) con.shift();
  while (con.length && (DUOI_THUA.has(con[con.length - 1].chuan) || !con[con.length - 1].chuan)) con.pop();
  let chu = con
    .map((t) => t.goc)
    .join(" ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/^[,.;:\-\s]+|[,;:\-\s]+$/g, "")
    .trim();
  if (chu) chu = chu[0].toLocaleUpperCase("vi-VN") + chu.slice(1);
  return chu;
}

export function phanTichCauNoi(
  cau: string,
  ngu: { bayGio: Date; danhBa: readonly NguoiTrongDanhBa[]; loaiEp?: LoaiGhi },
): BanNhap {
  const cauGoc = cau.trim();
  const nhan = nhanLoaiCau(cauGoc);
  const loai: LoaiGhi = ngu.loaiEp ?? nhan?.loai ?? "ghi-chu";
  const tu = tachTu(cauGoc);
  if (nhan && (!ngu.loaiEp || ngu.loaiEp === nhan.loai)) danhDau(tu, 0, nhan.doDai);

  const coSoCau = CO_SO.find((cs) => cs.tu.some((t) => ` ${chuanHoa(cauGoc)} `.includes(` ${t} `)))?.id ?? null;

  let nguoi: DoNguoi = { nguoiNhanId: null, ungVien: [], tenNghe: null };
  if (loai === "viec") {
    // Bỏ chữ "cho" sau "giao việc": "giao việc cho Hùng".
    const k = tiep(tu, 0);
    let dau = k;
    while (dau < tu.length && tu[dau].dung) dau++;
    if (tu[dau]?.chuan === "cho") { tu[dau].dung = true; dau++; }
    nguoi = doNguoi(tu, dau, ngu.danhBa, coSoCau);
  }

  const khan = tu.some((t) => !t.dung && ["gap", "khan", "khancap"].includes(t.chuan)) || /\bkhan cap\b|\bngay lap tuc\b|\buu tien\b/.test(chuanHoa(cauGoc));
  for (let i = 0; i < tu.length; i++) {
    if (!tu[i].dung && (tu[i].chuan === "gap" || tu[i].chuan === "khan")) {
      tu[i].dung = true;
      if (tu[i + 1]?.chuan === "cap") tu[i + 1].dung = true;
    }
  }

  const thoiGian = docThoiGian(tu, ngu.bayGio, loai);
  const noiDung = lamSachNoiDung(tu);

  const canXemLai: string[] = [];
  if (loai === "viec") {
    if (!nguoi.nguoiNhanId && nguoi.ungVien.length > 1) canXemLai.push(`Có ${nguoi.ungVien.length} người khớp "${nguoi.tenNghe}", chọn đúng người.`);
    else if (!nguoi.nguoiNhanId && nguoi.tenNghe) canXemLai.push(`Không thấy ai tên "${nguoi.tenNghe}" trong danh bạ, chọn người nhận.`);
    else if (!nguoi.nguoiNhanId) canXemLai.push("Chưa rõ giao cho ai.");
    if (!thoiGian.han) canXemLai.push("Chưa có hạn, mặc định 17:00 hôm nay nếu để trống.");
  }
  if (!noiDung) canXemLai.push("Chưa nghe rõ nội dung.");

  return {
    loai,
    noiDung,
    nguoiNhanId: nguoi.nguoiNhanId,
    ungVien: nguoi.ungVien,
    tenNghe: nguoi.tenNghe,
    han: thoiGian.han,
    ngay: thoiGian.ngay,
    coSo: coSoCau,
    khan,
    canXemLai,
    cauGoc,
  };
}

/** Hạn đọc cho người: "9:00 sáng mai", "17:00 thứ Sáu 09/10". */
export function hanDocDuoc(han: string | null, bayGio: Date): string {
  if (!han) return "Chưa có hạn";
  const ms = Date.parse(han);
  const d = ngayVn(ms);
  const h = Math.floor(d.gio);
  const p = Math.round((d.gio - h) * 60);
  const gioChu = `${String(h).padStart(2, "0")}:${String(p).padStart(2, "0")}`;
  const homNay = ngayVn(bayGio.getTime());
  const lech = Math.round(
    (msVn(d.nam, d.thang, d.ngay, 12, 0) - msVn(homNay.nam, homNay.thang, homNay.ngay, 12, 0)) / 86_400_000,
  );
  const tenThu = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"][d.thu];
  const ngayChu = lech === 0 ? "hôm nay" : lech === 1 ? "ngày mai" : lech === -1 ? "hôm qua" : `${tenThu} ${String(d.ngay).padStart(2, "0")}/${String(d.thang).padStart(2, "0")}`;
  return `${gioChu} ${ngayChu}`;
}

// ---------- Bản ghi đã lưu ----------

export type TrangThaiViecGhi = "mo" | "xong" | "huy";

export type ViecGhi = {
  id: string;
  loai: LoaiGhi;
  nguoiTao: string;
  nguoiNhan: string | null;
  coSo: ErpSiteId | null;
  noiDung: string;
  han: string | null;
  ngay: string;
  khan: boolean;
  trangThai: TrangThaiViecGhi;
  nguon: "giong-noi" | "go-tay";
  cauGoc: string | null;
  boHieu: "luat" | "claude" | null;
  taoLuc: string;
  xongLuc: string | null;
};

export const TEN_LOAI_GHI: Record<LoaiGhi, string> = {
  viec: "Giao việc",
  "ghi-chu": "Ghi chú",
  "nhat-ky": "Ghi chép ngày",
};

/** Việc quá hạn: còn mở mà hạn đã qua. */
export function quaHan(v: Pick<ViecGhi, "trangThai" | "han">, bayGio: Date): boolean {
  return v.trangThai === "mo" && v.han !== null && Date.parse(v.han) < bayGio.getTime();
}

/**
 * Ai giao việc được cho ai. Giám đốc giao cho mọi người; quản lý giao cho
 * người cùng cơ sở (trừ giám đốc); kế toán trưởng giao cho kế toán. Nhân viên
 * và kế toán chỉ ghi chú, ghi nhật ký cho mình.
 */
export function giaoDuocCho(
  nguoiGiao: { id: string; vai: ErpRole; coSo: readonly ErpSiteId[] },
  nguoiNhan: NguoiTrongDanhBa,
): boolean {
  if (nguoiGiao.vai === "director") return true;
  if (nguoiGiao.vai === "manager") {
    return nguoiNhan.vai !== "director" && nguoiNhan.coSo.some((cs) => nguoiGiao.coSo.includes(cs));
  }
  if (nguoiGiao.vai === "chief-accountant") return nguoiNhan.vai === "accountant";
  return false;
}

export function coQuyenGiaoViec(vai: ErpRole): boolean {
  return vai === "director" || vai === "manager" || vai === "chief-accountant";
}
