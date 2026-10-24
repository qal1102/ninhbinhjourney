import "server-only";

import { z } from "zod";
import type { ErpSiteId } from "@/domain/erp";
import {
  MAU_VAN_BAN,
  kiemKhongAi,
  quyetDinh,
  type BuocCong,
  type LoaiVanBan,
  type NguCanhSoat,
  type NhanXetAi,
  type PhatHien,
  type QuyetDinh,
} from "@/domain/van-ban";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";
import { soNguoiCheo } from "@/lib/erp/thuyen-repository";
import { docMaPhatHanh } from "./ky-so";
import { bamTep, docTepTaiLen } from "./pdf-van-ban";
import { danhSachVanBan, layPhatHanh, vanBanDaCo, type PhatHanh } from "./van-ban-repository";

/**
 * Cổng nhận văn bản: soát kỹ thuật → đọc ô → luật và đối chiếu → AI soát nghĩa.
 *
 * Luật và chữ ký quyết; AI chỉ được giữ lại (chờ người duyệt). AI vẫn được hỏi
 * cả khi cổng đã trả tệp (miễn đọc được ô), để màn hình cho thấy hai cách soát
 * khác nhau thế nào: AI đọc bản bị sửa điều khoản thường thấy bình thường,
 * chỉ lớp băm nội dung mới bắt được.
 */

export type KetQuaSoat = {
  maBamTep: string;
  tenTep: string;
  phatHanh: Pick<PhatHanh, "id" | "loai" | "soVanBan" | "coSo" | "kieu" | "phatHanhTen" | "phatHanhLuc" | "laMau"> | null;
  cong: BuocCong[];
  giaTri: Record<string, string>;
  khongAi: PhatHien[];
  ai: NhanXetAi | null;
  quyet: QuyetDinh;
  lyDoTra: string;
  thoiGianMs: { congVaLuat: number; ai: number | null };
};

function homNayVn() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export async function nguCanhSoat(loai: LoaiVanBan, coSo: ErpSiteId | null): Promise<NguCanhSoat> {
  const [ds, nccRaw, nguoi] = await Promise.all([
    danhSachVanBan(),
    listSupplierAp({ siteIds: ["trang-an", "tam-coc", "bai-dinh", "tam-chuc"] }).catch(() => ({ suppliers: [] })),
    loai === "hop-dong-nguoi-cheo" && (coSo === "trang-an" || coSo === "tam-coc")
      ? soNguoiCheo(coSo).then((d) => ({ ok: d.length > 0, d })).catch(() => ({ ok: false, d: [] }))
      : Promise.resolve({ ok: false, d: [] }),
  ]);
  return {
    homNay: homNayVn(),
    coSo,
    nguoiCheo: nguoi.d.map((n) => ({ soThuyen: n.soThuyen, hoTen: n.hoTen })),
    coSoNguoiCheo: nguoi.ok,
    danhMucNcc: nccRaw.suppliers.map((s) => ({ ten: s.name, mst: s.taxCode, coSo: s.siteId })),
    daCo: vanBanDaCo(ds),
  };
}

const KhuonAi = z.object({
  tomTat: z.string(),
  diem: z.array(z.object({ muc: z.string(), mucDo: z.enum(["nghiem-trong", "luu-y"]), noi: z.string() })),
});
const KHUON_AI: Record<string, unknown> = { ...z.toJSONSchema(KhuonAi) };
delete KHUON_AI.$schema;

/** Văn bản gốc liên quan, gửi kèm để AI so nghĩa (luật chỉ so được số và chữ trùng khớp). */
function boiCanhCho(loai: LoaiVanBan, giaTri: Record<string, string>, nc: NguCanhSoat | null) {
  if (!nc || loai !== "bien-ban-nghiem-thu") return "";
  const hd = nc.daCo.find((v) => v.loai === "hop-dong-nha-cung-cap" && v.soVanBan === giaTri.can_cu_hop_dong);
  if (!hd) return "";
  return `\n\nHợp đồng gốc ${hd.soVanBan} trong hệ thống: nội dung "${hd.giaTri.noi_dung}", giá trị trước thuế ${hd.giaTri.gia_tri} đồng, hiệu lực ${hd.giaTri.tu_ngay}–${hd.giaTri.den_ngay}. Hãy xem nội dung nghiệm thu có thuộc phạm vi hợp đồng này không.`;
}

async function soatBangAi(loai: LoaiVanBan, banDoc: Uint8Array, giaTri: Record<string, string>, khongAi: PhatHien[], boiCanh = ""): Promise<NhanXetAi> {
  if (!coMoHinhAi()) return { trangThai: "khong-bat", tomTat: "AI chưa bật cho hệ thống này, cổng chỉ soát bằng chữ ký và luật.", diem: [] };
  const mau = MAU_VAN_BAN[loai];
  const nhan = Object.fromEntries(mau.o.map((o) => [o.khoa, o.nhan]));
  const oDoc = Object.entries(giaTri)
    .map(([k, v]) => `- ${nhan[k] ?? k}: ${v || "(trống)"}`)
    .join("\n");
  const luat = khongAi.filter((p) => p.mucDo !== "dat").map((p) => `- ${p.noi}`).join("\n") || "- (không có)";
  try {
    const { noiDung, moHinh } = await hoiMoHinh({
      tinNhan: [
        {
          role: "system",
          content: [
            `Bạn là người soát văn bản của một doanh nghiệp du lịch ở Ninh Bình. Văn bản cần soát: ${mau.ten}.`,
            "Bộ luật của hệ thống đã soát khuôn (ô trống, ngày sai, số căn cước, mã số thuế) và đối chiếu với dữ liệu có sẵn; kết quả gửi kèm bên dưới, đừng nhắc lại.",
            "Việc của bạn là đọc tệp đính kèm như một người có kinh nghiệm và chỉ ra điều luật không bắt được: các ô mâu thuẫn nhau về nghĩa, nội dung mơ hồ khó nghiệm thu, số tiền bất thường so với công việc, điều khoản bất lợi hay khác thường so với một văn bản cùng loại, tên hay địa chỉ có vẻ bịa.",
            "Những điều sau là bình thường, đừng nêu: ký trước ngày bắt đầu hay ngày hiệu lực; ngày ký, ngày nghiệm thu sớm hơn ngày phát hành mẫu in ở chân trang; thời hạn không tròn tháng, tròn năm; ô không bắt buộc để trống; tên, số điện thoại trông như dữ liệu mẫu; một đợt nghiệm thu chỉ bằng một phần giá trị hợp đồng (hợp đồng nghiệm thu nhiều đợt, phần còn lại đã có luật cộng dồn).",
            "mucDo 'nghiem-trong' chỉ dành cho điều có thể gây mất tiền hay rủi ro pháp lý rõ (ví dụ nghiệm thu một việc không thuộc hợp đồng, tiền gấp nhiều lần mức hợp lý); còn lại là 'luu-y'. Không có gì đáng nói thì trả mảng rỗng.",
            "Viết tiếng Việt có dấu, mỗi điểm một câu ngắn. tomTat một câu nhận xét chung.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Các ô đọc được từ tệp:\n${oDoc}\n\nLuật đã báo:\n${luat}${boiCanh}` },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${Buffer.from(banDoc).toString("base64")}` } },
          ],
        },
      ],
      khuon: { ten: "soat_van_ban", schema: KHUON_AI },
      quyThoiGianMs: 25_000,
    });
    const kq = KhuonAi.safeParse(JSON.parse(noiDung));
    if (!kq.success) return { trangThai: "loi", tomTat: "AI trả lời sai khuôn, cổng dùng kết quả của luật.", diem: [] };
    return { trangThai: "co", tomTat: kq.data.tomTat.slice(0, 400), diem: kq.data.diem.slice(0, 8).map((d) => ({ ...d, noi: d.noi.slice(0, 300), muc: d.muc.slice(0, 60) })), moHinh };
  } catch (error) {
    console.error("Van ban AI review failed", error instanceof Error ? error.message : error);
    return { trangThai: "loi", tomTat: "AI đang bận, chưa soát được lúc này. Cổng dùng kết quả của chữ ký và luật.", diem: [] };
  }
}

const KHONG_XET = (muc: string): BuocCong => ({ muc, dat: false, noi: "Chưa xét vì bước trước đã trượt." });

/** `aiSan`: kết quả AI đã có từ bước Soát (bước Nộp gửi kèm phiếu), dùng lại thay vì hỏi lần nữa. */
export async function soatTep(bytes: Uint8Array, tenTep: string, opts: { aiSan?: NhanXetAi | null } = {}): Promise<KetQuaSoat> {
  const batDau = Date.now();
  const maBamTep = bamTep(bytes);
  const cong: BuocCong[] = [];
  const tra = (lyDo: string, phatHanh: KetQuaSoat["phatHanh"] = null, giaTri: Record<string, string> = {}, ai: NhanXetAi | null = null, aiMs: number | null = null): KetQuaSoat => ({
    maBamTep,
    tenTep,
    phatHanh,
    cong,
    giaTri,
    khongAi: [],
    ai,
    quyet: "tra-lai",
    lyDoTra: lyDo,
    thoiGianMs: { congVaLuat: Date.now() - batDau - (aiMs ?? 0), ai: aiMs },
  });

  const doc = await docTepTaiLen(bytes);
  if (doc.loai === "khong-phai-pdf") {
    cong.push({ muc: "Tệp PDF", dat: false, noi: "Tệp này không phải PDF. Cổng chỉ nhận PDF do hệ thống phát hành." });
    return tra("Không phải tệp PDF.");
  }
  if (doc.loai === "hong") {
    cong.push({ muc: "Tệp PDF", dat: false, noi: "Tệp PDF hỏng, không mở được." });
    return tra("Tệp PDF hỏng.");
  }
  cong.push({ muc: "Tệp PDF", dat: true, noi: "Mở được tệp PDF." });
  if (doc.loai === "ma-hoa-la") {
    cong.push({ muc: "Lớp mã hoá của hệ thống", dat: false, noi: "Tệp bị khoá bằng mật khẩu không phải của hệ thống: không phải bản hệ thống phát hành." });
    return tra("Mã hoá không phải của hệ thống.");
  }
  cong.push({
    muc: "Lớp mã hoá của hệ thống",
    dat: true,
    noi: doc.coMaHoa
      ? "Tệp còn nguyên lớp mã hoá AES-256 của hệ thống."
      : "Tệp không còn lớp mã hoá (thường do lưu lại bằng phần mềm khác). Cổng soát tiếp bằng chữ ký và dấu băm.",
  });

  if (!doc.ma) {
    cong.push({ muc: "Mã phát hành", dat: false, noi: "Không có mã phát hành: tệp này không tải từ hệ thống, hoặc đã in lại thành PDF mới." });
    cong.push(KHONG_XET("Chữ ký số của hệ thống"));
    return tra("PDF ngoài hệ thống, không có mã phát hành.");
  }
  const ma = docMaPhatHanh(doc.ma);
  cong.push({ muc: "Mã phát hành", dat: true, noi: "Có mã phát hành trong tệp." });
  if (!ma.hopLe) {
    cong.push({
      muc: "Chữ ký số của hệ thống",
      dat: false,
      noi: ma.lyDo === "sai-chu-ky" ? "Chữ ký trên mã phát hành không khớp khoá của hệ thống: mã bị chép hay bị sửa." : "Mã phát hành sai khuôn.",
    });
    return tra("Chữ ký số không khớp.");
  }
  cong.push({ muc: "Chữ ký số của hệ thống", dat: true, noi: `Chữ ký HMAC-SHA256 trên mã ${ma.ma.id} khớp khoá của hệ thống.` });

  const ph = await layPhatHanh(ma.ma.id);
  const tomPh = ph
    ? { id: ph.id, loai: ph.loai, soVanBan: ph.soVanBan, coSo: ph.coSo, kieu: ph.kieu, phatHanhTen: ph.phatHanhTen, phatHanhLuc: ph.phatHanhLuc, laMau: ph.laMau }
    : null;
  if (!ph || ph.loai !== ma.ma.loai || ph.maBamNoiDung !== ma.ma.maBam) {
    cong.push({ muc: "Có trong sổ phát hành", dat: false, noi: `Không thấy mã ${ma.ma.id} trong sổ phát hành của hệ thống này.` });
    return tra("Mã phát hành không có trong sổ.", tomPh);
  }
  cong.push({ muc: "Có trong sổ phát hành", dat: true, noi: `${MAU_VAN_BAN[ph.loai].ten} ${ph.soVanBan}, phát hành bởi ${ph.phatHanhTen}.` });

  const mau = MAU_VAN_BAN[ph.loai];
  const giaTri: Record<string, string> = { ...ph.heThong };
  for (const o of mau.o) if (o.ai === "doi-tac") giaTri[o.khoa] = (doc.giaTri[o.khoa] ?? "").trim().slice(0, 400);

  const nguyenVen = doc.maBamNoiDung === ph.maBamNoiDung;
  cong.push({
    muc: "Chữ in sẵn còn nguyên",
    dat: nguyenVen,
    noi: nguyenVen
      ? "Dấu băm SHA-256 phần chữ in sẵn trùng bản phát hành: không ai sửa điều khoản."
      : "Dấu băm phần chữ in sẵn khác bản phát hành: có người đã sửa điều khoản, thông tin hệ thống điền hay chân trang.",
  });
  if (!nguyenVen) {
    const aiBatDau = Date.now();
    const ai = opts.aiSan !== undefined ? opts.aiSan : await soatBangAi(ph.loai, doc.banDoc, giaTri, []);
    return tra("Chữ in sẵn đã bị sửa.", tomPh, giaTri, ai, Date.now() - aiBatDau);
  }
  if (ph.daNop) {
    cong.push({ muc: "Chưa nộp lần nào", dat: false, noi: `Bản phát hành này đã nộp ngày ${new Date(ph.daNop.nopLuc).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (${ph.daNop.nopTen}).` });
    return tra("Bản phát hành đã nộp rồi.", tomPh, giaTri);
  }
  cong.push({ muc: "Chưa nộp lần nào", dat: true, noi: "Mã này chưa dùng để nộp văn bản nào." });

  const nc = await nguCanhSoat(ph.loai, ph.coSo);
  const khongAi = kiemKhongAi(ph.loai, giaTri, nc);
  const congVaLuat = Date.now() - batDau;
  const aiBatDau = Date.now();
  const ai = opts.aiSan !== undefined ? opts.aiSan : await soatBangAi(ph.loai, doc.banDoc, giaTri, khongAi, boiCanhCho(ph.loai, giaTri, nc));
  const aiMs = Date.now() - aiBatDau;
  const quyet = quyetDinh(cong, khongAi, ai);
  const loiDau = khongAi.find((p) => p.mucDo === "loi");
  return {
    maBamTep,
    tenTep,
    phatHanh: tomPh,
    cong,
    giaTri,
    khongAi,
    ai,
    quyet,
    lyDoTra: quyet === "tra-lai" ? (loiDau?.noi ?? "Văn bản chưa đạt.") : "",
    thoiGianMs: { congVaLuat, ai: aiMs },
  };
}
