"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ErpRole, ErpSiteId } from "@/domain/erp";
import {
  MAU_VAN_BAN,
  SUA_DIEU_KHOAN,
  TEN_CO_SO,
  docTien,
  vietTien,
  type BuocCong,
  type LoaiVanBan,
  type NhanXetAi,
  type PhatHien,
  type QuyetDinh,
} from "@/domain/van-ban";
import type { BanNop, DanhSachVanBan } from "@/lib/van-ban/van-ban-repository";
import { duyetVanBanAction } from "@/app/erp/van-ban-actions";

export type NguoiCheoChon = { coSo: "trang-an" | "tam-coc"; soThuyen: string; hoTen: string };

type KetQuaSoat = {
  maBamTep: string;
  tenTep: string;
  phatHanh: { id: string; loai: LoaiVanBan; soVanBan: string; coSo: ErpSiteId | null; kieu: string; phatHanhTen: string; phatHanhLuc: string; laMau: boolean } | null;
  cong: BuocCong[];
  giaTri: Record<string, string>;
  khongAi: PhatHien[];
  ai: NhanXetAi | null;
  quyet: QuyetDinh;
  lyDoTra: string;
  thoiGianMs: { congVaLuat: number; ai: number | null };
};

type Props = {
  ds: DanhSachVanBan;
  nguoiCheo: NguoiCheoChon[];
  coAi: boolean;
  vai: ErpRole;
  coSoCuaToi: ErpSiteId[];
  loaiPhatHanhDuoc: LoaiVanBan[];
  luuTru: "supabase" | "memory";
  loiDoc: string | null;
  maTra: string | null;
  traMa: { id: string; loai: LoaiVanBan; soVanBan: string; phatHanhTen: string; phatHanhLuc: string; daNop: "nhan" | "cho-duyet" | null } | null;
};

const BUOC_CHO = [
  "Mở tệp PDF",
  "Kiểm lớp mã hoá của hệ thống",
  "Đọc mã phát hành và chữ ký số",
  "So dấu băm phần chữ in sẵn",
  "Đọc các ô, soát bằng luật",
  "Đối chiếu sổ người chèo, danh mục nhà cung cấp, văn bản đã có",
  "AI đọc tệp và soát nghĩa",
];

function ngayGio(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function doiTacCua(n: { loai: LoaiVanBan | null; giaTri: Record<string, string> }) {
  if (n.loai === "hop-dong-nguoi-cheo") return [n.giaTri.ho_ten, n.giaTri.so_thuyen ? `thuyền ${n.giaTri.so_thuyen}` : ""].filter(Boolean).join(" · ");
  return n.giaTri.ten_ncc ?? "";
}

function taiXuong(blob: Blob, ten: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const MAU_MUC: Record<PhatHien["mucDo"], string> = {
  loi: "border-[#f0c4b8] bg-[#fff4f0] text-[#8a2f17]",
  "canh-bao": "border-[#ecd7a8] bg-[#fff9ec] text-[#7a5520]",
  dat: "border-[#cfe3d6] bg-[#f2faf5] text-[#1f5a3f]",
};
const DAU_MUC: Record<PhatHien["mucDo"], string> = { loi: "✕", "canh-bao": "!", dat: "✓" };

export function VanBanWorkspace(props: Props) {
  const { ds, coAi, vai, luuTru, loiDoc } = props;
  const router = useRouter();
  const oChon = useRef<HTMLInputElement>(null);
  const [keo, setKeo] = useState(false);
  const [dangSoat, setDangSoat] = useState<{ ten: string; buoc: number } | null>(null);
  const [tep, setTep] = useState<File | null>(null);
  const [kq, setKq] = useState<KetQuaSoat | null>(null);
  const [phieu, setPhieu] = useState<string | null>(null);
  const [loi, setLoi] = useState("");
  const [daNop, setDaNop] = useState<{ ketQua: string; soVanBan: string | null; apDung: string | null; lyDo: string } | null>(null);
  const [dangNop, setDangNop] = useState(false);
  const [vuaTai, setVuaTai] = useState<{ tep: File; nhan: string } | null>(null);
  const congRef = useRef<HTMLElement>(null);

  const dem = useMemo(() => {
    const nhan = ds.nop.filter((n) => n.ketQua === "nhan").length;
    const cho = ds.nop.filter((n) => n.ketQua === "cho-duyet").length;
    const tra = ds.nop.filter((n) => n.ketQua === "tra-lai").length;
    return { nhan, cho, tra };
  }, [ds.nop]);

  async function soat(f: File) {
    setLoi("");
    setKq(null);
    setPhieu(null);
    setDaNop(null);
    setTep(f);
    if (f.size > 3_500_000) {
      setLoi("Tệp lớn quá 3,5MB. Văn bản hệ thống phát hành chỉ khoảng 300KB.");
      return;
    }
    congRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setDangSoat({ ten: f.name, buoc: 0 });
    // Bước chạy trên màn chỉ để người dùng biết cổng đang làm gì; kết quả thật đến từ máy chủ.
    const nhip = window.setInterval(() => setDangSoat((d) => (d ? { ...d, buoc: Math.min(d.buoc + 1, BUOC_CHO.length - 1) } : d)), 650);
    try {
      const body = new FormData();
      body.append("tep", f);
      const res = await fetch("/api/erp/van-ban/soat", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { ketQua?: KetQuaSoat; phieu?: string | null; message?: string } | null;
      if (!res.ok || !data?.ketQua) throw new Error(data?.message ?? "Cổng chưa soát được tệp này.");
      setKq(data.ketQua);
      setPhieu(data.phieu ?? null);
      if (data.ketQua.quyet === "tra-lai") router.refresh();
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Cổng chưa soát được tệp này.");
    } finally {
      window.clearInterval(nhip);
      setDangSoat(null);
    }
  }

  async function nop() {
    if (!tep || !phieu) return;
    setDangNop(true);
    setLoi("");
    try {
      const body = new FormData();
      body.append("tep", tep);
      body.append("phieu", phieu);
      const res = await fetch("/api/erp/van-ban/nop", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { ketQua?: string; soVanBan?: string | null; apDung?: string | null; lyDo?: string; message?: string } | null;
      if (!res.ok || !data?.ketQua) throw new Error(data?.message ?? "Chưa nộp được.");
      setDaNop({ ketQua: data.ketQua, soVanBan: data.soVanBan ?? null, apDung: data.apDung ?? null, lyDo: data.lyDo ?? "" });
      setPhieu(null);
      router.refresh();
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Chưa nộp được.");
    } finally {
      setDangNop(false);
    }
  }

  function chonTep(files: FileList | null) {
    const f = files?.[0];
    if (f) void soat(f);
    if (oChon.current) oChon.current.value = "";
  }

  return (
    <div className="space-y-6" data-testid="van-ban">
      <section className="rounded-3xl bg-[#173f34] p-5 text-white shadow-sm sm:p-7" data-chi="van-ban">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e7b96a]">Cổng nhận văn bản</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Văn bản &amp; hợp đồng</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
          Hợp đồng và biên bản đều tải mẫu từ đây: tệp PDF có chữ ký của hệ thống, đã mã hoá, chỉ điền được vào ô trống. Nộp lại thì cổng soát chữ ký,
          soát chữ in sẵn có bị sửa không, soát từng ô bằng luật, đối chiếu dữ liệu đang có, rồi mới để AI đọc lại cho chắc. Tệp nào không phải
          hệ thống phát hành thì cổng trả lại ngay.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Đã phát hành", ds.soPhatHanh],
            ["Trong hệ thống", dem.nhan],
            ["Chờ duyệt", dem.cho],
            ["Cổng đã chặn", dem.tra],
          ].map(([nhan, so]) => (
            <div key={nhan} className="rounded-2xl bg-white/10 px-4 py-3">
              <dt className="text-xs font-bold text-white/65">{nhan}</dt>
              <dd className="mt-0.5 text-2xl font-black tabular-nums">{so}</dd>
            </div>
          ))}
        </dl>
        {luuTru === "memory" ? (
          <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/75">Bản chạy thử ở máy: kho văn bản nằm trong bộ nhớ, khởi động lại là mất.</p>
        ) : null}
        {loiDoc ? <p className="mt-3 text-sm font-bold text-[#ffd0c4]">{loiDoc}</p> : null}
      </section>

      {props.maTra ? <KhoiTraMa maTra={props.maTra} traMa={props.traMa} /> : null}

      <section ref={congRef} className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-chi="cong-van-ban">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#20342c]">Nộp văn bản</h2>
            <p className="mt-1 text-sm text-[#5f7068]">Chỉ nhận PDF tải từ màn này. Tệp được soát xong mới vào hệ thống.</p>
          </div>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setKeo(true);
          }}
          onDragLeave={() => setKeo(false)}
          onDrop={(e) => {
            e.preventDefault();
            setKeo(false);
            chonTep(e.dataTransfer.files);
          }}
          className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            keo ? "border-[#2f7a5b] bg-[#eef7f1]" : "border-[#cbd6cf] bg-[#f7f9f7]"
          }`}
        >
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-[#173f34] text-xl text-[#e7b96a]">
            ⇪
          </span>
          <p className="text-sm font-bold text-[#34453e]">Kéo tệp PDF vào đây, hoặc</p>
          <button
            type="button"
            onClick={() => oChon.current?.click()}
            disabled={Boolean(dangSoat)}
            className="inline-flex min-h-12 items-center rounded-2xl bg-[#173f34] px-6 text-sm font-black text-white disabled:opacity-60"
            data-testid="van-ban-chon-tep"
          >
            Chọn tệp PDF
          </button>
          <input ref={oChon} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => chonTep(e.target.files)} data-testid="van-ban-o-tep" />
          {vuaTai && !dangSoat ? (
            <button
              type="button"
              onClick={() => void soat(vuaTai.tep)}
              className="min-h-10 rounded-full border border-[#e0b979] bg-[#fff8eb] px-4 text-sm font-bold text-[#7a5520]"
              data-testid="van-ban-nop-vua-tai"
            >
              Nộp luôn tệp vừa tải: {vuaTai.nhan}
            </button>
          ) : null}
        </div>
        {loi ? <p className="mt-3 rounded-xl bg-[#fff4f0] px-3 py-2 text-sm font-bold text-[#8a2f17]" role="alert">{loi}</p> : null}

        {dangSoat ? <KhoiDangSoat ten={dangSoat.ten} buoc={dangSoat.buoc} /> : null}
        {kq && !dangSoat ? (
          <KetQuaCong kq={kq} coAi={coAi} daNop={daNop} dangNop={dangNop} coTheNop={Boolean(phieu)} onNop={() => void nop()} vai={vai} />
        ) : null}

        <SoSanhHaiCach />
      </section>

      <KhoiTaiMau {...props} onTai={(f, nhan) => setVuaTai({ tep: f, nhan })} />

      <KhoVanBan ds={ds} vai={vai} />
    </div>
  );
}

function KhoiTraMa({ maTra, traMa }: { maTra: string; traMa: Props["traMa"] }) {
  return (
    <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm" data-testid="van-ban-tra-ma">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#738078]">Tra mã trên tệp</p>
      {traMa ? (
        <>
          <h2 className="mt-1 text-lg font-black text-[#20342c]">
            {traMa.id}: {MAU_VAN_BAN[traMa.loai].ten} {traMa.soVanBan}
          </h2>
          <p className="mt-1 text-sm text-[#5f7068]">
            Phát hành {ngayGio(traMa.phatHanhLuc)} bởi {traMa.phatHanhTen}.{" "}
            {traMa.daNop === "nhan" ? "Đã nộp và nhận vào hệ thống." : traMa.daNop === "cho-duyet" ? "Đã nộp, đang chờ duyệt." : "Chưa nộp lại."}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm font-bold text-[#8a2f17]">Không thấy mã {maTra} trong sổ phát hành. Tệp mang mã này không phải do hệ thống phát hành.</p>
      )}
    </section>
  );
}

function KhoiDangSoat({ ten, buoc }: { ten: string; buoc: number }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#d8e0db] bg-[#fbfcfb] p-4" aria-live="polite" data-testid="van-ban-dang-soat">
      <p className="text-sm font-black text-[#20342c]">Đang soát {ten}</p>
      <ol className="mt-3 space-y-1.5">
        {BUOC_CHO.map((b, i) => (
          <li key={b} className={`flex items-center gap-2 text-sm ${i < buoc ? "text-[#1f5a3f]" : i === buoc ? "font-bold text-[#20342c]" : "text-[#9aa6a0]"}`}>
            <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${i < buoc ? "bg-[#2f7a5b] text-white" : i === buoc ? "animate-pulse bg-[#e7b96a] text-[#173f34] motion-reduce:animate-none" : "bg-[#e5eae7]"}`}>
              {i < buoc ? "✓" : ""}
            </span>
            {b}
          </li>
        ))}
      </ol>
    </div>
  );
}

function KetQuaCong({
  kq,
  coAi,
  daNop,
  dangNop,
  coTheNop,
  onNop,
  vai,
}: {
  kq: KetQuaSoat;
  coAi: boolean;
  daNop: { ketQua: string; soVanBan: string | null; apDung: string | null; lyDo: string } | null;
  dangNop: boolean;
  coTheNop: boolean;
  onNop: () => void;
  vai: ErpRole;
}) {
  const mau = kq.phatHanh ? MAU_VAN_BAN[kq.phatHanh.loai] : null;
  const loiLuat = kq.khongAi.filter((p) => p.mucDo === "loi").length;
  const canhBao = kq.khongAi.filter((p) => p.mucDo === "canh-bao").length;
  const congTruot = kq.cong.some((b) => !b.dat);
  const banner =
    kq.quyet === "tra-lai"
      ? { mau: "bg-[#8a2f17] text-white", tieuDe: "Cổng trả lại", phu: kq.lyDoTra }
      : kq.quyet === "cho-duyet"
        ? { mau: "bg-[#e7b96a] text-[#3d2a0c]", tieuDe: "AI giữ lại, chờ người duyệt", phu: "Chữ ký và luật đều đạt, nhưng AI thấy điều đáng xem lại. Nộp thì văn bản vào hàng chờ duyệt." }
        : { mau: "bg-[#2f7a5b] text-white", tieuDe: "Qua cổng", phu: "Đúng tệp hệ thống phát hành, chữ in sẵn còn nguyên, mọi ô đạt luật. Sẵn sàng đưa vào hệ thống." };

  return (
    <div className="mt-5 space-y-4" data-testid="van-ban-ket-qua" data-quyet={kq.quyet}>
      <div className={`rounded-2xl p-4 sm:p-5 ${banner.mau}`}>
        <p className="text-lg font-black">{banner.tieuDe}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">{banner.phu}</p>
        {kq.phatHanh && mau ? (
          <p className="mt-2 text-xs font-bold opacity-80">
            {mau.ten} {kq.phatHanh.soVanBan} · mã {kq.phatHanh.id} · {kq.tenTep}
            {kq.phatHanh.laMau ? " · bản thử" : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs font-bold opacity-80">{kq.tenTep}</p>
        )}
      </div>

      <div className="rounded-2xl border border-[#d8e0db] p-4">
        <h3 className="text-sm font-black text-[#20342c]">Lớp 1 · Có đúng tệp hệ thống phát hành không</h3>
        <ol className="mt-3 space-y-2">
          {kq.cong.map((b) => (
            <li key={b.muc} className="flex gap-2.5 text-sm">
              <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${b.dat ? "bg-[#2f7a5b] text-white" : "bg-[#c4482a] text-white"}`}>
                {b.dat ? "✓" : "✕"}
              </span>
              <span>
                <span className="font-bold text-[#20342c]">{b.muc}.</span> <span className="text-[#4f5f58]">{b.noi}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#d8e0db] p-4" data-testid="van-ban-cot-luat">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-black text-[#20342c]">Lớp 2 · Soát không AI</h3>
            <span className="rounded-full bg-[#173f34] px-2.5 py-0.5 text-[11px] font-black text-white">Được quyết nhận hay trả</span>
          </div>
          <p className="mt-1 text-xs text-[#6e7b75]">
            Luật cố định và đối chiếu dữ liệu đang có · {kq.thoiGianMs.congVaLuat} ms · không tốn lượt AI
          </p>
          {congTruot ? (
            <p className="mt-3 text-sm text-[#6e7b75]">Không soát tiếp vì tệp không qua lớp 1.</p>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold text-[#34453e]">
                {loiLuat ? `${loiLuat} lỗi` : "Không có lỗi"}
                {canhBao ? ` · ${canhBao} điều cần để ý` : ""}
              </p>
              <ul className="mt-2 space-y-1.5">
                {kq.khongAi.map((p, i) => (
                  <li key={`${p.muc}-${i}`} className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${MAU_MUC[p.mucDo]}`}>
                    <span aria-hidden="true" className="font-black">{DAU_MUC[p.mucDo]}</span>
                    <span className="min-w-0">
                      {p.noi}
                      {p.nguon === "doi-chieu" ? <span className="ml-1.5 whitespace-nowrap rounded-full bg-white/70 px-1.5 text-[10px] font-black uppercase tracking-wide">đối chiếu</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#e0b979] bg-[#fffdf8] p-4" data-testid="van-ban-cot-ai">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-black text-[#20342c]">Lớp 3 · ✦ AI soát nghĩa</h3>
            <span className="rounded-full bg-[#e7b96a] px-2.5 py-0.5 text-[11px] font-black text-[#3d2a0c]">Chỉ góp ý, giữ lại được</span>
          </div>
          <p className="mt-1 text-xs text-[#6e7b75]">
            AI đọc chính tệp như một người soát có kinh nghiệm
            {kq.thoiGianMs.ai !== null ? ` · ${(kq.thoiGianMs.ai / 1000).toFixed(1)} giây` : ""}
          </p>
          {!kq.ai ? (
            <p className="mt-3 text-sm text-[#6e7b75]">{coAi ? "Không hỏi AI vì tệp không qua lớp 1, không đọc được ô nào." : "AI chưa bật cho hệ thống này."}</p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-[#34453e]">{kq.ai.tomTat}</p>
              {kq.ai.diem.length ? (
                <ul className="mt-2 space-y-1.5">
                  {kq.ai.diem.map((d, i) => (
                    <li key={i} className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${d.mucDo === "nghiem-trong" ? MAU_MUC.loi : MAU_MUC["canh-bao"]}`}>
                      <span aria-hidden="true" className="font-black">{d.mucDo === "nghiem-trong" ? "!!" : "·"}</span>
                      <span>{d.noi}</span>
                    </li>
                  ))}
                </ul>
              ) : kq.ai.trangThai === "co" ? (
                <p className="mt-2 text-sm text-[#1f5a3f]">AI không thấy điều gì đáng nói thêm.</p>
              ) : null}
              {congTruot && kq.ai.trangThai === "co" ? (
                <p className="mt-3 rounded-xl bg-[#173f34] px-3 py-2 text-xs font-bold leading-5 text-white">
                  {kq.phatHanh?.kieu === "bi-sua"
                    ? `Bản thử này đã đổi “${SUA_DIEU_KHOAN[kq.phatHanh.loai].cu}” thành “${SUA_DIEU_KHOAN[kq.phatHanh.loai].moi}”. Đối chiếu với nhận xét của AI ở trên: chữ bị sửa trông y như chữ thật, chỉ dấu băm của hệ thống bắt chắc chắn.`
                    : "Chữ bị sửa trông y như chữ thật, AI không có bản gốc để so. Chỉ dấu băm của hệ thống bắt chắc chắn."}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {Object.keys(kq.giaTri).length && mau ? (
        <details className="rounded-2xl border border-[#d8e0db] p-4">
          <summary className="cursor-pointer text-sm font-black text-[#20342c]">Số liệu đọc được từ tệp ({mau.o.length} ô)</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {mau.o.map((o) => (
              <div key={o.khoa} className="flex flex-col border-b border-[#eef2ef] pb-1.5">
                <dt className="text-xs text-[#6e7b75]">
                  {o.nhan} {o.ai === "he-thong" ? <span className="text-[10px] font-black text-[#2f7a5b]">· hệ thống điền</span> : null}
                </dt>
                <dd className="font-bold text-[#20342c]">{kq.giaTri[o.khoa] || <span className="font-normal text-[#a3aea8]">(trống)</span>}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      {daNop ? (
        <div className={`rounded-2xl p-4 ${daNop.ketQua === "nhan" ? "bg-[#eef7f1] text-[#1f5a3f]" : "bg-[#fff8eb] text-[#7a5520]"}`} role="status" data-testid="van-ban-da-nop">
          <p className="font-black">{daNop.ketQua === "nhan" ? `Đã nhận ${daNop.soVanBan ?? ""} vào hệ thống.` : `Đã nộp ${daNop.soVanBan ?? ""}, đang chờ duyệt.`}</p>
          {daNop.apDung ? <p className="mt-1 text-sm">{daNop.apDung}</p> : null}
          {daNop.lyDo ? <p className="mt-1 text-sm">{daNop.lyDo}</p> : null}
        </div>
      ) : kq.quyet !== "tra-lai" && coTheNop ? (
        <button
          type="button"
          onClick={onNop}
          disabled={dangNop}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#173f34] px-6 text-sm font-black text-white disabled:opacity-60 sm:w-auto"
          data-testid="van-ban-dua-vao"
        >
          {dangNop
            ? "Đang đưa vào…"
            : kq.quyet === "cho-duyet" || !(kq.phatHanh && MAU_VAN_BAN[kq.phatHanh.loai].vaiPhatHanh.includes(vai))
              ? "Nộp để người có quyền duyệt"
              : "Đưa vào hệ thống"}
        </button>
      ) : null}
    </div>
  );
}

function SoSanhHaiCach() {
  const dong: [string, string, string][] = [
    ["Biết tệp có phải hệ thống phát hành không", "Có, bằng chữ ký số. Chắc chắn.", "Không. Tệp giả in đẹp thì AI cũng thấy thật."],
    ["Biết điều khoản có bị sửa một chữ không", "Có, bằng dấu băm SHA-256.", "Không, vì không có bản gốc để so."],
    ["Ô trống, sai khuôn, ngày sai, căn cước thiếu số", "Có, lần nào cũng bắt.", "Thường bắt được, nhưng có lúc sót."],
    ["Đối chiếu sổ người chèo, nhà cung cấp, hợp đồng cũ", "Có, đọc thẳng dữ liệu trong hệ thống.", "Chỉ biết những gì được gửi kèm."],
    ["Hiểu nghĩa: nội dung mơ hồ, tiền bất thường, tên bịa", "Không, luật chỉ biết điều đã viết sẵn.", "Có. Đây là chỗ AI hơn hẳn."],
    ["Tốc độ, chi phí", "Vài chục mili giây, không tốn gì.", "Vài giây, tốn lượt gọi AI."],
  ];
  return (
    <details className="mt-5 rounded-2xl bg-[#f3f6f4] p-4" data-testid="van-ban-so-sanh">
      <summary className="cursor-pointer text-sm font-black text-[#20342c]">Soát không AI và soát bằng AI khác nhau thế nào?</summary>
      <p className="mt-2 text-sm leading-6 text-[#4f5f58]">
        Hai cách bắt hai loại lỗi khác nhau, nên cổng dùng cả hai. Chữ ký và luật quyết nhận hay trả, vì chúng không bao giờ đổi ý. AI chỉ được giữ
        văn bản lại cho người xem, không bao giờ tự cho một văn bản qua cổng.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="text-xs text-[#6e7b75]">
              <th className="py-2 pr-3 font-bold">Việc</th>
              <th className="py-2 pr-3 font-bold">Không AI (chữ ký, luật)</th>
              <th className="py-2 font-bold">AI</th>
            </tr>
          </thead>
          <tbody>
            {dong.map(([viec, khong, ai]) => (
              <tr key={viec} className="border-t border-[#dfe6e1] align-top">
                <td className="py-2 pr-3 font-bold text-[#20342c]">{viec}</td>
                <td className="py-2 pr-3 text-[#34453e]">{khong}</td>
                <td className="py-2 text-[#34453e]">{ai}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type KieuTai = "trong" | "dien-dung" | "dien-sai" | "bi-sua" | "ngoai";

function KhoiTaiMau(props: Props & { onTai: (f: File, nhan: string) => void }) {
  const { loaiPhatHanhDuoc } = props;
  if (!loaiPhatHanhDuoc.length) {
    return (
      <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-[#20342c]">Tải mẫu</h2>
        <p className="mt-1 text-sm text-[#5f7068]">Mẫu văn bản do quản lý, kế toán hoặc giám đốc phát hành. Bạn nhận tệp từ họ, điền vào ô trống rồi nộp ở trên.</p>
      </section>
    );
  }
  return (
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-chi="tai-mau-van-ban">
      <h2 className="text-xl font-black text-[#20342c]">Tải mẫu</h2>
      <p className="mt-1 max-w-3xl text-sm text-[#5f7068]">
        Mỗi lần tải là một bản phát hành có số riêng. Gửi mẫu trống cho đối tác điền bằng Edge, Chrome hay Acrobat rồi nộp lại. Muốn thử cổng ngay,
        tải một bản thử đã điền sẵn.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {loaiPhatHanhDuoc.map((loai) => (
          <TheMau key={loai} loai={loai} {...props} />
        ))}
      </div>
    </section>
  );
}

function TheMau({ loai, nguoiCheo, coSoCuaToi, ds, onTai }: Props & { loai: LoaiVanBan; onTai: (f: File, nhan: string) => void }) {
  const mau = MAU_VAN_BAN[loai];
  const benThuyen = coSoCuaToi.filter((c): c is "trang-an" | "tam-coc" => c === "trang-an" || c === "tam-coc");
  const [coSo, setCoSo] = useState<ErpSiteId>(loai === "hop-dong-nguoi-cheo" ? (benThuyen[0] ?? "trang-an") : (coSoCuaToi[0] ?? "trang-an"));
  const thuyenCuaBen = nguoiCheo.filter((n) => n.coSo === coSo);
  const [soThuyen, setSoThuyen] = useState(thuyenCuaBen[0]?.soThuyen ?? "01");
  const hopDong = ds.nop.filter((n) => n.loai === "hop-dong-nha-cung-cap" && n.ketQua === "nhan" && n.soVanBan && (!n.coSo || coSoCuaToi.includes(n.coSo)));
  const [canCu, setCanCu] = useState(hopDong[0]?.soVanBan ?? "");
  const [dang, setDang] = useState<KieuTai | null>(null);
  const [loi, setLoi] = useState("");
  const [vua, setVua] = useState("");

  const daNghiemThu = (so: string) =>
    ds.nop
      .filter((n) => n.loai === "bien-ban-nghiem-thu" && n.ketQua === "nhan" && n.giaTri.can_cu_hop_dong === so && n.giaTri.ket_luan === "Đạt")
      .reduce((t, n) => t + (docTien(n.giaTri.gia_tri) ?? 0), 0);

  async function tai(kieu: KieuTai) {
    setDang(kieu);
    setLoi("");
    try {
      const res = await fetch("/api/erp/van-ban/phat-hanh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loai, kieu, coSo, soThuyen: loai === "hop-dong-nguoi-cheo" ? soThuyen : undefined, canCu: loai === "bien-ban-nghiem-thu" ? canCu : undefined }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(d?.message ?? "Chưa tải được mẫu.");
      }
      const blob = await res.blob();
      const ten = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "van-ban.pdf";
      taiXuong(blob, ten);
      const so = decodeURIComponent(res.headers.get("x-van-ban-so") ?? "");
      const nhan = kieu === "ngoai" ? "PDF tự soạn ngoài hệ thống" : `${so}${kieu === "trong" ? "" : ` (${({ "dien-dung": "điền đúng", "dien-sai": "điền sai", "bi-sua": "bị sửa" } as const)[kieu]})`}`;
      setVua(nhan);
      onTai(new File([blob], ten, { type: "application/pdf" }), nhan);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : "Chưa tải được mẫu.");
    } finally {
      setDang(null);
    }
  }

  const chon = "min-h-11 w-full rounded-xl border border-[#cbd6cf] bg-white px-3 text-sm font-bold text-[#20342c]";
  return (
    <article className="flex flex-col rounded-2xl border border-[#d8e0db] bg-[#fbfcfb] p-4" data-testid={`mau-${loai}`}>
      <h3 className="text-base font-black text-[#20342c]">{mau.ten}</h3>
      <p className="mt-1 text-sm leading-6 text-[#5f7068]">{mau.moTa}</p>
      <div className="mt-3 space-y-2">
        {loai === "hop-dong-nguoi-cheo" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-[#6e7b75]">
              Bến
              <select
                className={chon}
                value={coSo}
                onChange={(e) => {
                  const ben = e.target.value as ErpSiteId;
                  setCoSo(ben);
                  setSoThuyen(nguoiCheo.find((n) => n.coSo === ben)?.soThuyen ?? "01");
                }}
              >
                {(benThuyen.length ? benThuyen : (["trang-an", "tam-coc"] as const)).map((c) => (
                  <option key={c} value={c}>
                    {TEN_CO_SO[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[#6e7b75]">
              Thuyền số
              {thuyenCuaBen.length ? (
                <select className={chon} value={soThuyen} onChange={(e) => setSoThuyen(e.target.value)}>
                  {thuyenCuaBen.map((n) => (
                    <option key={n.soThuyen} value={n.soThuyen}>
                      {n.soThuyen} · {n.hoTen}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={chon} value={soThuyen} onChange={(e) => setSoThuyen(e.target.value.slice(0, 20))} inputMode="numeric" />
              )}
            </label>
          </div>
        ) : loai === "bien-ban-nghiem-thu" ? (
          <label className="block text-xs font-bold text-[#6e7b75]">
            Căn cứ hợp đồng
            {hopDong.length ? (
              <select className={chon} value={canCu} onChange={(e) => setCanCu(e.target.value)}>
                {hopDong.map((h) => {
                  const tong = docTien(h.giaTri.gia_tri) ?? 0;
                  return (
                    <option key={h.id} value={h.soVanBan ?? ""}>
                      {h.soVanBan} · {h.giaTri.ten_ncc} · còn {vietTien(Math.max(tong - daNghiemThu(h.soVanBan ?? ""), 0))}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="mt-1 block text-sm font-normal text-[#8a2f17]">Chưa có hợp đồng nhà cung cấp nào trong hệ thống.</span>
            )}
          </label>
        ) : (
          <label className="block text-xs font-bold text-[#6e7b75]">
            Cơ sở sử dụng
            <select className={chon} value={coSo} onChange={(e) => setCoSo(e.target.value as ErpSiteId)}>
              {coSoCuaToi.map((c) => (
                <option key={c} value={c}>
                  {TEN_CO_SO[c]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={() => void tai("trong")}
          disabled={Boolean(dang) || (loai === "bien-ban-nghiem-thu" && !canCu)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#173f34] px-4 text-sm font-black text-white disabled:opacity-50"
          data-testid={`tai-trong-${loai}`}
        >
          {dang === "trong" ? "Đang dựng PDF…" : "Tải mẫu trống (PDF)"}
        </button>
        <p className="mt-3 text-xs font-bold text-[#6e7b75]">Bản thử để nộp lại xem cổng làm gì:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              ["dien-dung", "Điền đúng"],
              ["dien-sai", "Điền sai"],
              ["bi-sua", "Bị sửa điều khoản"],
              ["ngoai", "PDF ngoài hệ thống"],
            ] as const
          ).map(([k, nhan]) => (
            <button
              key={k}
              type="button"
              onClick={() => void tai(k)}
              disabled={Boolean(dang) || (loai === "bien-ban-nghiem-thu" && !canCu)}
              className="min-h-9 rounded-full border border-[#cbd6cf] bg-white px-3 text-xs font-bold text-[#34453e] hover:border-[#8fa99f] disabled:opacity-50"
              data-testid={`tai-${k}-${loai}`}
            >
              {dang === k ? "Đang dựng…" : nhan}
            </button>
          ))}
        </div>
        {vua ? <p className="mt-2 text-xs text-[#1f5a3f]">Đã tải {vua}. Bấm &quot;Nộp luôn tệp vừa tải&quot; ở khung Nộp văn bản.</p> : null}
        {loi ? <p className="mt-2 text-xs font-bold text-[#8a2f17]">{loi}</p> : null}
      </div>
    </article>
  );
}

function KhoVanBan({ ds, vai }: { ds: DanhSachVanBan; vai: ErpRole }) {
  const [xem, setXem] = useState<"nhan" | "cho-duyet" | "tra-lai">(ds.nop.some((n) => n.ketQua === "cho-duyet") ? "cho-duyet" : "nhan");
  const [loc, setLoc] = useState<LoaiVanBan | "tat-ca">("tat-ca");
  const ds_ = ds.nop.filter((n) => n.ketQua === xem && (loc === "tat-ca" || n.loai === loc));
  const tab = (k: typeof xem, nhan: string) => {
    const so = ds.nop.filter((n) => n.ketQua === k).length;
    return (
      <button
        key={k}
        type="button"
        onClick={() => setXem(k)}
        aria-pressed={xem === k}
        className={`min-h-10 rounded-full px-4 text-sm font-bold ${xem === k ? "bg-[#173f34] text-white" : "bg-[#eef2ef] text-[#43554e]"}`}
      >
        {nhan} · {so}
      </button>
    );
  };
  return (
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-chi="kho-van-ban" data-testid="kho-van-ban">
      <h2 className="text-xl font-black text-[#20342c]">Kho văn bản</h2>
      <p className="mt-1 text-sm text-[#5f7068]">Văn bản đã vào hệ thống là thứ cổng đối chiếu cho lần nộp sau.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tab("nhan", "Trong hệ thống")}
        {tab("cho-duyet", "Chờ duyệt")}
        {tab("tra-lai", "Cổng đã chặn")}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["tat-ca", "hop-dong-nguoi-cheo", "hop-dong-nha-cung-cap", "bien-ban-nghiem-thu"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLoc(l)}
            aria-pressed={loc === l}
            className={`min-h-9 rounded-full border px-3 text-xs font-bold ${loc === l ? "border-[#173f34] bg-[#eef7f1] text-[#173f34]" : "border-[#dbe2dd] text-[#5f7068]"}`}
          >
            {l === "tat-ca" ? "Mọi loại" : MAU_VAN_BAN[l].ten}
          </button>
        ))}
      </div>
      {ds_.length ? (
        <ul className="mt-4 space-y-2">
          {ds_.slice(0, 60).map((n) => (
            <DongVanBan key={n.id} n={n} vai={vai} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-[#f7f9f7] p-4 text-sm text-[#6e7b75]">
          {xem === "tra-lai" ? "Cổng chưa chặn tệp nào." : xem === "cho-duyet" ? "Không có văn bản nào chờ duyệt." : "Chưa có văn bản nào."}
        </p>
      )}
    </section>
  );
}

function DongVanBan({ n, vai }: { n: BanNop; vai: ErpRole }) {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState("");
  const [dang, batDau] = useTransition();
  const mau = n.loai ? MAU_VAN_BAN[n.loai] : null;
  const tien = n.giaTri.gia_tri ? docTien(n.giaTri.gia_tri) : null;
  const coQuyen = Boolean(mau && mau.vaiPhatHanh.includes(vai));

  function duyet(quyet: "nhan" | "tra-lai") {
    setLoi("");
    batDau(async () => {
      const kq = await duyetVanBanAction(n.id, quyet, ghiChu);
      if (!kq.ok) setLoi(kq.loi);
      else router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-[#e2e8e4] bg-[#fbfcfb]">
      <button type="button" onClick={() => setMo((m) => !m)} aria-expanded={mo} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[#20342c]">
            {mau ? mau.ten : "Tệp không rõ nguồn"} {n.soVanBan ?? ""}
            {n.laMau ? <span className="ml-1.5 rounded-full bg-[#eef2ef] px-2 py-0.5 text-[10px] font-black text-[#5f7068]">Mẫu</span> : null}
          </span>
          <span className="block truncate text-xs text-[#6e7b75]">
            {[doiTacCua(n), tien ? vietTien(tien) : "", n.tenTep && n.ketQua === "tra-lai" ? n.tenTep : ""].filter(Boolean).join(" · ") || n.lyDo}
          </span>
        </span>
        <span className="text-xs text-[#6e7b75]">
          {ngayGio(n.nopLuc)} · {n.nopTen}
        </span>
        <span aria-hidden="true" className={`text-xs transition ${mo ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {mo ? (
        <div className="space-y-3 border-t border-[#e2e8e4] px-4 py-3 text-sm">
          {n.lyDo ? <p className="font-bold text-[#7a5520]">{n.lyDo}</p> : null}
          {n.apDung ? <p className="text-[#1f5a3f]">{n.apDung}</p> : null}
          {n.phatHien.filter((p) => p.mucDo !== "dat").length ? (
            <ul className="space-y-1">
              {n.phatHien
                .filter((p) => p.mucDo !== "dat")
                .map((p, i) => (
                  <li key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs ${MAU_MUC[p.mucDo]}`}>
                    {DAU_MUC[p.mucDo]} {p.noi}
                  </li>
                ))}
            </ul>
          ) : null}
          {n.ai?.trangThai === "co" ? (
            <div className="rounded-lg bg-[#fffdf8] px-3 py-2 text-xs text-[#5c4a26]">
              <span className="font-black">✦ AI: </span>
              {n.ai.tomTat}
              {n.ai.diem.map((d, i) => (
                <span key={i} className="mt-1 block">
                  {d.mucDo === "nghiem-trong" ? "!! " : "· "}
                  {d.noi}
                </span>
              ))}
            </div>
          ) : null}
          {mau ? (
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {mau.o
                .filter((o) => n.giaTri[o.khoa])
                .map((o) => (
                  <div key={o.khoa} className="flex justify-between gap-3 border-b border-[#eef2ef] py-1">
                    <dt className="text-[#6e7b75]">{o.nhan}</dt>
                    <dd className="text-right font-bold text-[#20342c]">{n.giaTri[o.khoa]}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {n.duyetTen && n.ketQua !== "tra-lai" ? (
            <p className="text-xs text-[#6e7b75]">
              Nhận bởi {n.duyetTen}
              {n.duyetLuc ? `, ${ngayGio(n.duyetLuc)}` : ""}
              {n.duyetGhiChu ? `: ${n.duyetGhiChu}` : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {n.coTep ? (
              <a href={`/api/erp/van-ban/tep/${n.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#cbd6cf] bg-white px-4 text-xs font-black text-[#34453e]">
                Tải tệp PDF đã nộp
              </a>
            ) : null}
          </div>
          {n.ketQua === "cho-duyet" && coQuyen ? (
            <div className="rounded-xl bg-[#fff8eb] p-3">
              <label className="block text-xs font-bold text-[#7a5520]">
                Ghi chú (bắt buộc khi trả lại)
                <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value.slice(0, 300))} className="mt-1 min-h-10 w-full rounded-lg border border-[#e0c99a] bg-white px-3 text-sm text-[#20342c]" />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={dang} onClick={() => duyet("nhan")} className="min-h-10 rounded-xl bg-[#173f34] px-4 text-xs font-black text-white disabled:opacity-60">
                  Nhận vào hệ thống
                </button>
                <button type="button" disabled={dang} onClick={() => duyet("tra-lai")} className="min-h-10 rounded-xl border border-[#c4482a] px-4 text-xs font-black text-[#8a2f17] disabled:opacity-60">
                  Trả lại
                </button>
              </div>
              {loi ? <p className="mt-2 text-xs font-bold text-[#8a2f17]">{loi}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
