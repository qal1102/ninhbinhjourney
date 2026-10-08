"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { doiTrangThaiViecGhiAction, hieuCauNoiAction, type KetQuaHieu } from "@/app/erp/tro-ly-ghi-actions";
import { TheBanNhap } from "@/components/erp/the-ban-nhap";
import { ERP_SITES } from "@/domain/erp";
import { hanDocDuoc, quaHan, type ViecGhi } from "@/domain/tro-ly-ghi";
import { useNgheGiongNoi } from "@/lib/use-nghe-giong-noi";

type Props = {
  dong: ViecGhi[];
  ten: Record<string, string>;
  toiId: string;
  luuTru: "supabase" | "memory";
  loiKho: string | null;
  boHieu: "luat" | "claude" | "ai";
};

const tenCoSo = (id: string | null) => (id ? (ERP_SITES.find((s) => s.id === id)?.shortName ?? null) : null);

function MicIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}

function DongViec({
  v,
  ten,
  toiId,
  bayGio,
}: {
  v: ViecGhi;
  ten: Record<string, string>;
  toiId: string;
  bayGio: Date;
}) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [loi, setLoi] = useState("");
  const tre = quaHan(v, bayGio);
  const coSo = tenCoSo(v.coSo);
  const doi = (trangThai: "mo" | "xong" | "huy") =>
    batDau(async () => {
      setLoi("");
      const kq = await doiTrangThaiViecGhiAction(v.id, trangThai);
      if (!kq.ok) setLoi(kq.loi ?? "Chưa đổi được.");
      else router.refresh();
    });

  const nguoi =
    v.loai === "viec"
      ? v.nguoiNhan === toiId
        ? `Từ ${ten[v.nguoiTao] ?? v.nguoiTao}`
        : `Giao cho ${ten[v.nguoiNhan ?? ""] ?? v.nguoiNhan}`
      : null;

  return (
    <li className={`rounded-2xl border bg-white p-4 ${tre ? "border-[#e8b4a8]" : "border-[#dde5e0]"} ${v.trangThai !== "mo" ? "opacity-60" : ""}`} data-viec-ghi={v.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        {v.khan ? <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[#9b2c1f]">Khẩn</span> : null}
        {nguoi ? <span className="text-[#42554c]">{nguoi}</span> : null}
        {coSo ? <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-[#35594b]">{coSo}</span> : null}
        {v.nguon === "giong-noi" ? (
          <span className="inline-flex items-center gap-1 text-[#6f8d7f]">
            <MicIcon className="h-3.5 w-3.5" /> Nói
          </span>
        ) : null}
        {v.trangThai === "xong" ? <span className="text-[#28654d]">Đã xong</span> : v.trangThai === "huy" ? <span className="text-[#8b9a92]">Đã huỷ</span> : null}
      </div>
      <p className={`mt-1.5 text-base font-bold leading-6 text-[#20342c] ${v.trangThai === "xong" ? "line-through decoration-[#9bb0a6]" : ""}`}>{v.noiDung}</p>
      {v.han ? (
        <p className={`mt-1 text-sm ${tre ? "font-bold text-[#b0412d]" : "text-[#5f7068]"}`}>
          {tre ? "Quá hạn · " : v.loai === "viec" ? "Hạn " : "Nhắc "}
          {hanDocDuoc(v.han, bayGio)}
        </p>
      ) : null}
      {v.cauGoc && v.cauGoc !== v.noiDung ? (
        <details className="mt-1.5 text-xs text-[#7d8c84]">
          <summary className="cursor-pointer">Câu gốc</summary>
          <p className="mt-1 italic">“{v.cauGoc}”</p>
        </details>
      ) : null}
      {loi ? <p role="alert" className="mt-2 text-xs font-bold text-[#9b2c1f]">{loi}</p> : null}
      {v.loai !== "nhat-ky" && v.trangThai !== "huy" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.trangThai === "mo" && (v.loai !== "viec" || v.nguoiNhan === toiId || v.nguoiTao === toiId) ? (
            <button type="button" disabled={dang} onClick={() => doi("xong")} className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">
              Xong
            </button>
          ) : null}
          {v.trangThai === "xong" ? (
            <button type="button" disabled={dang} onClick={() => doi("mo")} className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#42554c]">
              Mở lại
            </button>
          ) : null}
          {v.loai === "viec" && v.nguoiTao === toiId && v.trangThai === "mo" ? (
            <button type="button" disabled={dang} onClick={() => doi("huy")} className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#42554c]">
              Huỷ việc
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Khoi({ tieuDe, so, children, rong }: { tieuDe: string; so: number; children: React.ReactNode; rong: string }) {
  return (
    <section className="rounded-3xl border border-[#dce4df] bg-[#f8faf8] p-4 sm:p-5">
      <h2 className="flex items-baseline justify-between gap-3 text-lg font-black text-[#20342c]">
        {tieuDe}
        <span className="text-sm font-bold text-[#6e7b75]">{so}</span>
      </h2>
      {so === 0 ? <p className="mt-3 text-sm text-[#6e7b75]">{rong}</p> : <ul className="mt-3 space-y-2.5">{children}</ul>}
    </section>
  );
}

export function ViecGhiWorkspace({ dong, ten, toiId, luuTru, loiKho, boHieu }: Props) {
  const router = useRouter();
  const [cau, setCau] = useState("");
  const [nhap, setNhap] = useState<{ kq: Extract<KetQuaHieu, { ok: true }>; nguon: "giong-noi" | "go-tay"; khoa: number } | null>(null);
  const [thongBao, setThongBao] = useState("");
  const [dangHieu, batDauHieu] = useTransition();
  const [bayGio] = useState(() => new Date());

  const hieu = (chu: string, nguon: "giong-noi" | "go-tay") =>
    batDauHieu(async () => {
      setThongBao("");
      const kq = await hieuCauNoiAction(chu);
      if (!kq.ok) {
        setThongBao(kq.loi);
        return;
      }
      setNhap({ kq, nguon, khoa: Date.now() });
    });

  const nghe = useNgheGiongNoi((chu) => {
    setCau(chu);
    hieu(chu, "giong-noi");
  });

  const choToi = dong.filter((v) => v.loai === "viec" && v.nguoiNhan === toiId && v.trangThai === "mo");
  const toiGiao = dong.filter((v) => v.loai === "viec" && v.nguoiTao === toiId && v.nguoiNhan !== toiId && v.trangThai === "mo");
  const ghiChu = dong.filter((v) => v.loai === "ghi-chu" && v.trangThai === "mo");
  const ghiChep = dong.filter((v) => v.loai === "nhat-ky").sort((a, b) => b.ngay.localeCompare(a.ngay) || b.taoLuc.localeCompare(a.taoLuc));
  const daXong = dong.filter((v) => v.loai !== "nhat-ky" && v.trangThai !== "mo");
  const soQuaHan = [...choToi, ...toiGiao].filter((v) => quaHan(v, bayGio)).length;

  return (
    <div className="space-y-6" data-testid="viec-ghi">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Trợ lý ghi việc</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Việc &amp; ghi chú</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Bấm micro rồi nói như nói với đồng nghiệp: “Giao cho Hùng sáng mai kiểm áo phao bến Tam Cốc”, “Ghi chú gọi lại nhà in vé”,
          “Nhật ký hôm nay đón ba đoàn khách Hàn”. Trợ lý viết bản nháp, bạn xem lại rồi lưu.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-stretch">
          <button
            type="button"
            onClick={nghe.dangNghe ? nghe.dung : nghe.batDau}
            className={`flex min-h-16 items-center justify-center gap-3 rounded-2xl px-6 text-base font-black transition sm:min-w-56 ${
              nghe.dangNghe ? "animate-pulse bg-[#d45f49] text-white motion-reduce:animate-none" : "bg-[#e7c78d] text-[#173f34] hover:bg-[#f0d6a4]"
            }`}
            data-chi="ghi-bang-giong-noi"
            data-chi-loi="Bấm micro, nói một việc cần giao hay cần ghi, bấm lần nữa để dừng; xem bản nháp rồi bấm Lưu."
            data-testid="nut-mic-ghi"
          >
            <MicIcon />
            {nghe.dangNghe ? "Đang nghe · bấm để dừng" : "Bấm để nói"}
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (cau.trim()) hieu(cau.trim(), "go-tay");
            }}
          >
            <input
              value={nghe.dangNghe ? nghe.tamThoi : cau}
              onChange={(e) => setCau(e.target.value)}
              placeholder="Hoặc gõ: Giao cho chị Lan chiều nay gửi bảng kê"
              className="min-h-16 min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 outline-none focus:border-white/60"
              data-testid="o-ghi-nhanh"
            />
            <button type="submit" disabled={dangHieu || !cau.trim()} className="min-h-16 rounded-2xl bg-white px-5 text-sm font-black text-[#173f34] disabled:opacity-50">
              {dangHieu ? "Đang viết…" : "Viết nháp"}
            </button>
          </form>
        </div>
        {nghe.loi ? <p className="mt-3 rounded-xl bg-[#fff0dc] px-3 py-2 text-sm text-[#76501d]">{nghe.loi}</p> : null}
        {thongBao ? (
          <p role="status" className="mt-3 rounded-xl bg-white/12 px-3 py-2 text-sm font-bold text-white" data-testid="thong-bao-ghi">
            {thongBao}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-white/50">
          {boHieu === "luat"
            ? "Trợ lý hiểu câu theo mẫu câu tiếng Việt ngay trong hệ thống, không gửi câu nói ra ngoài."
            : "Câu nói được AI đọc để hiểu; AI chậm hay lỗi thì trợ lý hiểu theo mẫu câu."}
          {luuTru === "memory" ? " Bản chạy thử ở máy: lưu trong bộ nhớ, khởi động lại là mất." : ""}
        </p>
      </header>

      {nhap ? (
        <div className="mx-auto max-w-xl">
          <TheBanNhap
            key={nhap.khoa}
            banNhap={nhap.kq.banNhap}
            boHieu={nhap.kq.boHieu}
            nguoiNhanCo={nhap.kq.nguoiNhanCo}
            giaoDuoc={nhap.kq.giaoDuoc}
            nguon={nhap.nguon}
            onKetThuc={(kq) => {
              setNhap(null);
              setThongBao(kq.loiNhan);
              if (kq.trangThai === "da-luu") {
                setCau("");
                router.refresh();
              }
            }}
          />
        </div>
      ) : null}

      {loiKho ? <p className="rounded-2xl bg-[#fdecea] px-4 py-3 text-sm font-bold text-[#9b2c1f]">{loiKho}</p> : null}

      {soQuaHan > 0 ? (
        <p className="rounded-2xl border border-[#e8b4a8] bg-[#fff4f1] px-4 py-3 text-sm font-bold text-[#9b2c1f]">{soQuaHan} việc đã quá hạn.</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Khoi tieuDe="Việc giao cho tôi" so={choToi.length} rong="Chưa có việc nào giao cho bạn.">
          {choToi.map((v) => (
            <DongViec key={v.id} v={v} ten={ten} toiId={toiId} bayGio={bayGio} />
          ))}
        </Khoi>
        <Khoi tieuDe="Việc tôi đã giao" so={toiGiao.length} rong="Bạn chưa giao việc nào đang mở.">
          {toiGiao.map((v) => (
            <DongViec key={v.id} v={v} ten={ten} toiId={toiId} bayGio={bayGio} />
          ))}
        </Khoi>
        <Khoi tieuDe="Ghi chú" so={ghiChu.length} rong="Chưa có ghi chú.">
          {ghiChu.map((v) => (
            <DongViec key={v.id} v={v} ten={ten} toiId={toiId} bayGio={bayGio} />
          ))}
        </Khoi>
        <Khoi tieuDe="Ghi chép ngày" so={ghiChep.length} rong="Chưa có ghi chép nào. Cuối ca nói “Nhật ký hôm nay…” là xong.">
          {ghiChep.map((v, i) => (
            <li key={v.id}>
              {i === 0 || ghiChep[i - 1].ngay !== v.ngay ? (
                <p className="mb-1.5 mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#6e7b75]">{v.ngay.split("-").reverse().join("/")}</p>
              ) : null}
              <ul>
                <DongViec v={v} ten={ten} toiId={toiId} bayGio={bayGio} />
              </ul>
            </li>
          ))}
        </Khoi>
      </div>

      {daXong.length ? (
        <details className="rounded-3xl border border-[#dce4df] bg-[#f8faf8] p-4 sm:p-5">
          <summary className="cursor-pointer text-base font-black text-[#20342c]">Đã xong hoặc đã huỷ trong 30 ngày · {daXong.length}</summary>
          <ul className="mt-3 space-y-2.5">
            {daXong.map((v) => (
              <DongViec key={v.id} v={v} ten={ten} toiId={toiId} bayGio={bayGio} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
