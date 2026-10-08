"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { luuViecGhiAction, type NguoiNhanChon } from "@/app/erp/tro-ly-ghi-actions";
import { ERP_SITES } from "@/domain/erp";
import { hanDocDuoc, TEN_LOAI_GHI, type BanNhap, type LoaiGhi } from "@/domain/tro-ly-ghi";

/**
 * Thẻ nháp sau khi trợ lý nghe một câu: mọi ô đều sửa được, bấm Lưu mới ghi
 * vào kho. Không bao giờ tự lưu, vì nghe nhầm tên người hay giờ giấc là
 * chuyện thường.
 */

const VN_MS = 7 * 3_600_000;
const sangOGio = (iso: string | null) => (iso ? new Date(Date.parse(iso) + VN_MS).toISOString().slice(0, 16) : "");
const tuOGio = (v: string) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

export type KetThucNhap = { trangThai: "da-luu" | "bo"; loiNhan: string };

export function TheBanNhap({
  banNhap,
  boHieu,
  nguoiNhanCo,
  giaoDuoc,
  nguon,
  onKetThuc,
  toi = false,
}: {
  banNhap: BanNhap;
  boHieu: "luat" | "claude" | "ai";
  nguoiNhanCo: NguoiNhanChon[];
  giaoDuoc: boolean;
  nguon: "giong-noi" | "go-tay";
  onKetThuc: (kq: KetThucNhap) => void;
  /** Nền sẫm (trong bảng trợ lý). */
  toi?: boolean;
}) {
  const [loai, setLoai] = useState<LoaiGhi>(banNhap.loai);
  const [noiDung, setNoiDung] = useState(banNhap.noiDung);
  const [nguoiNhanId, setNguoiNhanId] = useState(banNhap.nguoiNhanId ?? "");
  const [han, setHan] = useState(sangOGio(banNhap.han));
  const [coSo, setCoSo] = useState<string>(banNhap.coSo ?? "");
  const [khan, setKhan] = useState(banNhap.khan);
  const [loi, setLoi] = useState("");
  const [dangLuu, batDau] = useTransition();

  // Người khớp tên nghe được đứng đầu danh sách chọn.
  const uuTien = new Set(banNhap.ungVien.map((u) => u.id));
  const danhSach = [...nguoiNhanCo].sort((a, b) => Number(uuTien.has(b.id)) - Number(uuTien.has(a.id)));
  // Lời nhắc viết cho loại trợ lý đã đoán; đổi loại thì lời nhắc không còn đúng.
  const canXemLai = loai === banNhap.loai ? banNhap.canXemLai : [];

  const nen = toi ? "bg-white text-[#20342c]" : "bg-white text-[#20342c] border border-[#d5ded8]";
  const o = "min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c] outline-none focus:border-[#4f806f]";

  function luu() {
    setLoi("");
    batDau(async () => {
      const kq = await luuViecGhiAction({
        loai,
        noiDung,
        nguoiNhanId: loai === "viec" ? nguoiNhanId || null : null,
        han: loai === "nhat-ky" ? null : tuOGio(han),
        ngay: banNhap.ngay,
        coSo: (coSo || null) as "trang-an" | "tam-coc" | "bai-dinh" | "tam-chuc" | null,
        khan,
        nguon,
        cauGoc: banNhap.cauGoc || null,
        boHieu,
      });
      if (!kq.ok) {
        setLoi(kq.loi);
        return;
      }
      const hanChu = kq.ban.han ? ` ${loai === "viec" ? "Hạn" : "Nhắc lúc"} ${hanDocDuoc(kq.ban.han, new Date())}.` : "";
      onKetThuc({ trangThai: "da-luu", loiNhan: `${kq.loiNhan}${hanChu}` });
    });
  }

  return (
    <div className={`rounded-2xl p-3.5 ${nen}`} data-testid="the-ban-nhap">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f8d7f]">Bản nháp · xem lại rồi lưu</p>
        <span className="text-[0.68rem] text-[#8b9a92]">{boHieu === "claude" ? "Claude hiểu" : boHieu === "ai" ? "AI hiểu" : "Hiểu theo mẫu câu"}</span>
      </div>

      <div role="radiogroup" aria-label="Loại" className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-[#eef3f0] p-1">
        {(["viec", "ghi-chu", "nhat-ky"] as const).map((l) => {
          const khoa = l === "viec" && !giaoDuoc;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={loai === l}
              disabled={khoa}
              onClick={() => setLoai(l)}
              className={`min-h-10 rounded-lg px-1 text-xs font-black transition disabled:opacity-40 ${loai === l ? "bg-[#183f34] text-white" : "text-[#42554c]"}`}
            >
              {TEN_LOAI_GHI[l]}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block text-xs font-bold text-[#53675e]">
        Nội dung
        <textarea value={noiDung} onChange={(e) => setNoiDung(e.target.value)} rows={2} className={`${o} mt-1 py-2 leading-5`} data-testid="noi-dung-nhap" />
      </label>

      {loai === "viec" ? (
        <label className="mt-2.5 block text-xs font-bold text-[#53675e]">
          Giao cho
          <select value={nguoiNhanId} onChange={(e) => setNguoiNhanId(e.target.value)} className={`${o} mt-1`} data-testid="nguoi-nhan-nhap">
            <option value="">Chọn người nhận</option>
            {danhSach.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ten} · {p.vai}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loai !== "nhat-ky" ? (
        <div className={`mt-2.5 grid gap-2 ${toi ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <label className="block text-xs font-bold text-[#53675e]">
            {loai === "viec" ? "Hạn" : "Nhắc lúc"}
            <input type="datetime-local" value={han} onChange={(e) => setHan(e.target.value)} className={`${o} mt-1 px-2`} data-testid="han-nhap" />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Cơ sở
            <select value={coSo} onChange={(e) => setCoSo(e.target.value)} className={`${o} mt-1 px-2`}>
              <option value="">Không gắn</option>
              {ERP_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-[#53675e]">Ghi cho ngày {banNhap.ngay.split("-").reverse().join("/")}.</p>
      )}

      {loai === "viec" ? (
        <label className="mt-2.5 flex min-h-11 items-center gap-2 text-sm font-bold text-[#42554c]">
          <input type="checkbox" checked={khan} onChange={(e) => setKhan(e.target.checked)} className="h-5 w-5 accent-[#c2412d]" />
          Việc khẩn
        </label>
      ) : null}

      {canXemLai.length ? (
        <ul className="mt-2 space-y-1 rounded-xl bg-[#fff6e8] px-3 py-2 text-xs leading-5 text-[#7a5520]">
          {canXemLai.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {loi ? (
        <p role="alert" className="mt-2 rounded-xl bg-[#fdecea] px-3 py-2 text-xs font-bold text-[#9b2c1f]">
          {loi}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={luu}
          disabled={dangLuu}
          className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60"
          data-testid="luu-ban-nhap"
        >
          {dangLuu ? "Đang lưu…" : loai === "viec" ? "Giao việc" : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => onKetThuc({ trangThai: "bo", loiNhan: "Đã bỏ bản nháp." })}
          className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#53675e]"
        >
          Bỏ
        </button>
      </div>
    </div>
  );
}

export function LoiVaoViec({ toi = false }: { toi?: boolean }) {
  return (
    <Link href="/erp/viec" className={`mt-2 inline-flex min-h-10 items-center text-xs font-black underline underline-offset-4 ${toi ? "text-white" : "text-[#183f34]"}`}>
      Mở Việc &amp; ghi chú →
    </Link>
  );
}
