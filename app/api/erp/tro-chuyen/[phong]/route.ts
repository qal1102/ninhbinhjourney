import { NextResponse } from "next/server";
import { z } from "zod";
import { kiemTep, kiemTheGan, tenPhong, type TheGan } from "@/domain/tro-chuyen";
import { coQuyenGiaoViec } from "@/domain/tro-ly-ghi";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { dayTinNhan } from "@/lib/erp/day-thong-bao";
import { ViecGhiLoi, taoViecGhi } from "@/lib/erp/viec-ghi-repository";
import { conLuot, danhBa, docViecMay, giaoDuocTrong, maVanBanDaNhan } from "@/lib/tro-chuyen/dich-vu";
import { kenhHopThu, kenhPhong, phatTinHieu } from "@/lib/tro-chuyen/thoi-gian-thuc";
import { TroChuyenLoi, daDoc, dsPhong, guiTin, luuTruTroChuyen, tinCuaPhong } from "@/lib/tro-chuyen/tro-chuyen-repository";

/** Tin của một phòng (GET, đánh dấu đã đọc) và gửi tin (POST). */

const KHUON_ID = /^[0-9a-f-]{36}$/;

async function phongCuaToi(phongId: string, accountId: string) {
  return (await dsPhong(accountId)).find((p) => p.id === phongId) ?? null;
}

export async function GET(request: Request, ctx: { params: Promise<{ phong: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const { phong: phongId } = await ctx.params;
  if (!KHUON_ID.test(phongId)) return NextResponse.json({ message: "Mã không hợp lệ." }, { status: 400 });
  const truocRaw = new URL(request.url).searchParams.get("truoc");
  const truoc = truocRaw && !Number.isNaN(Date.parse(truocRaw)) ? new Date(truocRaw).toISOString() : null;
  try {
    const phong = await phongCuaToi(phongId, user.id);
    if (!phong) return NextResponse.json({ message: "Bạn không ở trong cuộc trò chuyện này." }, { status: 403 });
    const tin = await tinCuaPhong(phongId, user.id, truoc, docViecMay);
    if (!truoc && phong.chuaDoc > 0) {
      await daDoc(phongId, user.id);
      // Người gửi thấy "Đã xem" ngay, không chờ lượt hỏi lại.
      void phatTinHieu([kenhPhong(phong.kenh)], "doc", { phong: phongId, ai: user.id });
    }
    if (luuTruTroChuyen() === "memory") {
      for (const t of tin) t.tep = t.tep.map((f) => ({ ...f, url: `/api/erp/tro-chuyen/tep?path=${encodeURIComponent(f.path)}` }));
    }
    return NextResponse.json({ tin, phong }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof TroChuyenLoi ? error.message : "Chưa đọc được tin." }, { status: 500 });
  }
}

const YeuCau = z.object({
  noiDung: z.string().max(4000).default(""),
  tep: z.array(z.unknown()).max(6).default([]),
  gan: z.array(z.unknown()).max(4).default([]),
  viec: z
    .object({
      nguoiNhan: z.string().min(1).max(80),
      han: z.string().max(40).nullable(),
      khan: z.boolean().default(false),
    })
    .nullable()
    .default(null),
});

function hanMacDinh(bayGio = Date.now()) {
  const ngay = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
  const homNay17 = Date.parse(`${ngay(bayGio)}T17:00:00+07:00`);
  return new Date(homNay17 > bayGio ? homNay17 : Date.parse(`${ngay(bayGio + 86_400_000)}T09:00:00+07:00`)).toISOString();
}

export async function POST(request: Request, ctx: { params: Promise<{ phong: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const { phong: phongId } = await ctx.params;
  if (!KHUON_ID.test(phongId)) return NextResponse.json({ message: "Mã không hợp lệ." }, { status: 400 });
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Tin chưa hợp lệ." }, { status: 400 });
  if (!conLuot(`tin:${user.id}`, 60, 60_000)) return NextResponse.json({ message: "Bạn gửi nhanh quá, xin chậm lại một chút." }, { status: 429 });

  const phong = await phongCuaToi(phongId, user.id).catch(() => null);
  if (!phong) return NextResponse.json({ message: "Bạn không ở trong cuộc trò chuyện này." }, { status: 403 });

  const vanBan = await maVanBanDaNhan();
  const gan = kiemTheGan(parsed.data.gan, { coSoMau: user.siteIds[0] ?? "trang-an", vanBan: new Set(vanBan.map((v) => v.id)) });
  const tep = kiemTep(parsed.data.tep, phongId);
  if (!gan || !tep) return NextResponse.json({ message: "Tệp hoặc phần gắn kèm không hợp lệ." }, { status: 400 });
  const noiDung = parsed.data.noiDung.trim();
  if (!noiDung && !tep.length && !gan.length) return NextResponse.json({ message: "Tin đang trống." }, { status: 400 });

  // "Giao thành việc": tạo việc ở Việc & ghi chú, theo đúng luật ai giao được cho ai.
  let viecId: string | null = null;
  let tenNguoiNhan = "";
  if (parsed.data.viec) {
    const v = parsed.data.viec;
    if (!coQuyenGiaoViec(user.role)) return NextResponse.json({ message: "Tài khoản của bạn không giao việc cho người khác; tin vẫn gửi được như lời nhờ." }, { status: 403 });
    if (!phong.thanhVien.some((t) => t.id === v.nguoiNhan)) return NextResponse.json({ message: "Người nhận việc phải ở trong cuộc trò chuyện." }, { status: 400 });
    const ds = await danhBa();
    if (!giaoDuocTrong(user, ds).has(v.nguoiNhan)) return NextResponse.json({ message: "Người này nằm ngoài phạm vi bạn giao việc được." }, { status: 403 });
    tenNguoiNhan = ds.find((p) => p.id === v.nguoiNhan)?.ten ?? "";
    const han = v.han && !Number.isNaN(Date.parse(v.han)) ? new Date(v.han).toISOString() : hanMacDinh();
    if (Date.parse(han) <= Date.now()) return NextResponse.json({ message: "Hạn đã qua, chọn hạn muộn hơn." }, { status: 400 });
    const phan = gan.map((g: TheGan) => g.ten).join(", ");
    try {
      const viec = await taoViecGhi({
        nguoiTao: user.id,
        loai: "viec",
        nguoiNhan: v.nguoiNhan,
        coSo: user.siteIds.length === 1 ? user.siteIds[0] : null,
        noiDung: [phan ? `Làm phần: ${phan}.` : "", noiDung, "(giao từ Trò chuyện)"].filter(Boolean).join(" ").slice(0, 1000),
        han,
        ngay: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
        khan: v.khan,
        nguon: "go-tay",
        cauGoc: null,
        boHieu: null,
      });
      viecId = viec.id;
    } catch (error) {
      return NextResponse.json({ message: error instanceof ViecGhiLoi ? error.message : "Chưa giao được việc." }, { status: 500 });
    }
  }

  try {
    const tin = await guiTin({ phongId, nguoi: { id: user.id, ten: user.name }, noiDung, tep, gan, viecId });
    const nguoiKhac = phong.thanhVien.filter((t) => t.id !== user.id).map((t) => t.id);
    await phatTinHieu([kenhPhong(phong.kenh), ...nguoiKhac.map(kenhHopThu)], "tin", { phong: phongId, tin: tin.id });
    const tomTat = noiDung || (gan.length ? `Gắn: ${gan.map((g) => g.ten).join(", ")}` : `Gửi ${tep.length} tệp`);
    void dayTinNhan(nguoiKhac, {
      tieuDe: phong.loai === "nhom" ? `${tenPhong(phong, user.id)} · ${user.name}` : user.name,
      noiDung: `${viecId ? `Giao việc cho ${tenNguoiNhan}. ` : ""}${tomTat}`.slice(0, 160),
      url: `/erp/tro-chuyen?phong=${phongId}`,
      tag: `tc-${phongId}`,
    }).catch(() => 0);
    return NextResponse.json({ id: tin.id, taoLuc: tin.taoLuc, viecId });
  } catch (error) {
    return NextResponse.json({ message: error instanceof TroChuyenLoi ? error.message : "Chưa gửi được tin." }, { status: 500 });
  }
}
