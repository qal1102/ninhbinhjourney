"use client";

import QRCode from "qrcode";
import { useActionState, useState } from "react";
import { ganSoChoVeAction, traKhachAction, type TraKhachState } from "@/app/erp/tra-khach-actions";
import type { KetQuaTraKhach, VeTraKhach } from "@/domain/tra-khach";

function ngay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}
function gio(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}
function tien(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

const KENH: Record<string, string> = { "quay-ve": "Quầy", website: "Web", moi: "Vé mời", "doi-tac": "Đối tác" };

function MaQrVe({ code }: { code: string }) {
  const [anh, setAnh] = useState<string | null>(null);
  async function mo() {
    if (anh) {
      setAnh(null);
      return;
    }
    setAnh(await QRCode.toDataURL(code, { margin: 1, width: 280, color: { dark: "#10231d", light: "#ffffff" } }));
  }
  return (
    <div>
      <button type="button" onClick={mo} className="inline-flex min-h-9 items-center rounded-lg border border-[#c9d6cf] px-3 text-xs font-black text-[#183f34]">
        {anh ? "Ẩn mã QR" : "Mở mã QR cho khách"}
      </button>
      {anh ? (
        <figure className="mt-2 w-fit rounded-xl bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR sinh tại chỗ */}
          <img src={anh} alt={`Mã QR vé ${code}`} className="size-44" />
          <figcaption className="mt-1 text-center font-mono text-xs">{code}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function DongVe({ ve }: { ve: VeTraKhach }) {
  const conLuot = Math.max(0, ve.entriesAllowed - ve.entriesUsed);
  return (
    <li className="rounded-xl border border-[#e3e8e4] bg-white p-3" data-ma-ve={ve.code}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-black text-[#203a30]">{ve.code}</p>
          <p className="text-xs text-[#5f6f67]">
            {ve.site} · {KENH[ve.channel] ?? ve.channel} · ngày đi {ngay(ve.validOn)}
            {ve.saleCode ? ` · phiếu ${ve.saleCode}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${ve.status === "void" ? "bg-[#fbe6df] text-[#8a3a12]" : conLuot === 0 ? "bg-[#e3f2eb] text-[#245e48]" : "bg-[#fff1d6] text-[#7a5310]"}`}>
          {ve.status === "void" ? "Đã huỷ" : conLuot === 0 ? `Đã qua cổng ${ve.entriesUsed}/${ve.entriesAllowed}` : `Còn ${conLuot}/${ve.entriesAllowed} lượt`}
        </span>
      </div>
      {ve.lanQuet.length > 0 ? (
        <p className="mt-1 text-xs text-[#5f6f67]">
          Quét gần nhất: {ve.lanQuet.slice(0, 2).map((q) => `${gio(q.luc)} ${q.ketQua === "accepted" ? "nhận" : q.ketQua}${q.nguoi ? ` (${q.nguoi})` : ""}`).join(" · ")}
        </p>
      ) : null}
      {ve.status !== "void" && conLuot > 0 ? <div className="mt-2"><MaQrVe code={ve.code} /></div> : null}
    </li>
  );
}

function GanSo({ ma }: { ma: string }) {
  const [s, hanhDong, dang] = useActionState(ganSoChoVeAction, { status: "idle", message: "", nhap: "", ketQua: null, luc: 0 } as TraKhachState);
  return (
    <form action={hanhDong} className="mt-3 rounded-xl border border-dashed border-[#c89a55] bg-[#fffaf0] p-3" data-testid="gan-so-erp">
      <input type="hidden" name="ma" value={ma} />
      <p className="text-sm font-black text-[#3f3524]">Vé này chưa gắn số điện thoại</p>
      <p className="text-xs text-[#5d5240]">Hỏi khách số điện thoại để giữ vé và tích lượt; lần sau khách tự tra bằng số ở trang Vé đã mua.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input name="so" inputMode="tel" required placeholder="09xx xxx xxx" aria-label="Số điện thoại của khách" className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d8c49c] bg-white px-3 text-sm" />
        <button type="submit" disabled={dang} className="min-h-10 rounded-lg bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">Gắn số</button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs text-[#3f3524]"><input type="checkbox" name="dong_y" value="co" required className="mt-0.5" /> Khách đồng ý dùng số để giữ vé và tích lượt.</label>
      <label className="mt-1 flex items-start gap-2 text-xs text-[#3f3524]"><input type="checkbox" name="tiep_thi" value="co" className="mt-0.5" /> Khách muốn nhận tin ưu đãi (không bắt buộc).</label>
      {s.status !== "idle" ? <p role="status" className={`mt-2 text-xs font-bold ${s.status === "ok" ? "text-[#245e48]" : "text-[#8a3a12]"}`}>{s.message}{s.status === "ok" ? " Tra lại để xem hồ sơ." : ""}</p> : null}
    </form>
  );
}

function HoSo({ kq, nhap }: { kq: Extract<KetQuaTraKhach, { timThay: true }>; nhap: string }) {
  const td = kq.tichDiem;
  const veQuayChuaGan = !kq.coSo ? kq.veKhac.find((v) => v.channel === "quay-ve" && v.status !== "void") : undefined;
  return (
    <div className="mt-4 space-y-4" data-testid="ket-qua-tra-khach">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#5f6f67]">Số điện thoại</p><p className="font-black">{kq.coSo ? kq.so ?? "Đã có số" : "Chưa gắn số"}</p></div>
        <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#5f6f67]">Lượt đã đi · điểm</p><p className="font-black tabular-nums">{td ? `${td.visits} · ${td.points.toLocaleString("vi-VN")}` : "—"}</p></div>
        <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#5f6f67]">Mã mời · bạn đã đi</p><p className="font-black">{td?.referralCode ? `${td.referralCode} · ${td.referrals}` : "—"}</p></div>
        <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#5f6f67]">Nhận tin ưu đãi</p><p className="font-black">{kq.tiepThi === "granted" ? "Đồng ý" : kq.coSo ? "Không" : "—"}</p></div>
      </div>
      {td?.nextMilestone ? <p className="text-sm text-[#4f5f57]">Còn {td.nextMilestone.remaining} lượt nữa: {td.nextMilestone.reward.toLowerCase()}.</p> : null}

      {kq.donWeb.length > 0 ? (
        <section>
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5b7c6e]">Đơn web ({kq.donWeb.length})</h3>
          <ul className="mt-2 space-y-3">
            {kq.donWeb.map((d) => (
              <li key={d.orderCode} className="rounded-2xl border border-[#d8e0db] p-3">
                <p className="font-black text-[#203a30]"><span className="font-mono">{d.orderCode}</span> · {d.product}</p>
                <p className="text-xs text-[#5f6f67]">
                  Ngày đi {ngay(d.visitDate)} · {d.adults} lớn{d.children ? ` ${d.children} trẻ` : ""} · {tien(d.totalVnd)}
                  {d.giamVnd ? ` (mã mời ${d.maMoi} −${tien(d.giamVnd)})` : ""} · {d.status === "confirmed" ? "đã xác nhận" : d.status}
                </p>
                <ul className="mt-2 space-y-2">{d.ve.map((v) => <DongVe key={v.code} ve={v} />)}</ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {kq.veKhac.length > 0 ? (
        <section>
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5b7c6e]">Vé quầy, vé đoàn ({kq.veKhac.length})</h3>
          <ul className="mt-2 space-y-2">{kq.veKhac.map((v) => <DongVe key={v.code} ve={v} />)}</ul>
        </section>
      ) : null}
      {veQuayChuaGan ? <GanSo ma={veQuayChuaGan.code} /> : null}

      {td && td.vouchers.length > 0 ? (
        <section>
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5b7c6e]">Quà và voucher</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {td.vouchers.map((v) => (
              <li key={v.code} className="rounded-xl bg-[#fff8eb] px-3 py-2 text-sm"><span className="font-mono font-black">{v.code}</span> · {v.label} · {v.status === "redeemed" ? "đã đổi" : `hạn ${ngay(v.expiresOn)}`}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {kq.suKien.length > 0 || kq.thiAnh.length > 0 ? (
        <section className="grid gap-2 sm:grid-cols-2">
          {kq.suKien.map((s) => (
            <p key={s.ma} className="rounded-xl bg-[#f3f6f4] px-3 py-2 text-sm">Sự kiện {s.ten}: <span className="font-mono">{s.ma}</span>{s.trung ? ` · trúng suất ${s.trung}, mã ${s.maNhan}` : ""}</p>
          ))}
          {kq.thiAnh.map((a, i) => (
            <p key={`${a.thang}-${i}`} className="rounded-xl bg-[#f3f6f4] px-3 py-2 text-sm">Thi ảnh {a.thang}: {a.trangThai === "da-duyet" ? "đã duyệt" : a.trangThai === "tu-choi" ? "không dùng" : "chờ duyệt"}{a.maNhan ? ` · mã ${a.maNhan}` : ""}</p>
          ))}
        </section>
      ) : null}
      {!kq.coSo && kq.donWeb.length === 0 && kq.veKhac.length === 0 ? <p className="text-sm text-[#5f6f67]">Không có vé nào cho {nhap}.</p> : null}
    </div>
  );
}

/**
 * Tra khách (ERP, 13/10/2026): một ô nhận số điện thoại hoặc mã. Khách quên
 * mã, mất máy: nhân viên gõ số, mở mã QR của vé ngay trên màn hình này.
 */
export function TraKhachPanel({ banDau }: { banDau?: { nhap: string; ketQua: KetQuaTraKhach | null } }) {
  const [s, hanhDong, dang] = useActionState(traKhachAction, {
    status: banDau?.ketQua ? "ok" : "idle",
    message: banDau && banDau.ketQua && !banDau.ketQua.timThay ? "Không tìm thấy khách hay vé nào khớp." : "",
    nhap: banDau?.nhap ?? "",
    ketQua: banDau?.ketQua ?? null,
    luc: 0,
  } as TraKhachState);
  return (
    <section
      id="tra-khach"
      className="mb-6 scroll-mt-24 rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
      data-testid="tra-khach"
      data-chi="tra-khach"
      data-chi-loi="Gõ số điện thoại hoặc mã vé, mã đơn, mã phiếu thu: ra mọi vé, lượt qua cổng, quà của khách ấy."
    >
      <h2 className="text-2xl font-black text-[#203a30]">Tra khách</h2>
      <p className="mt-1 text-sm leading-6 text-[#4f5f57]">
        Số điện thoại hoặc bất kỳ mã nào: NBJ- (đơn web), WEB-, QUAY-, TV- (vé), PT- (phiếu thu). Ra đơn, vé, lượt qua cổng, điểm, quà của khách ấy.
        Khách quên mã hay mất máy: tra số, bấm &quot;Mở mã QR cho khách&quot; để quét ở cổng.
      </p>
      <form action={hanhDong} className="mt-3 flex flex-wrap gap-2">
        <input
          name="nhap"
          defaultValue={s.nhap}
          required
          autoComplete="off"
          aria-label="Số điện thoại hoặc mã"
          placeholder="0912 345 678 hoặc WEB-…, QUAY-…, NBJ-…"
          className="min-h-11 min-w-0 flex-[999_1_16rem] rounded-xl border border-[#ced8d1] px-4"
        />
        <button type="submit" disabled={dang} className="min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white disabled:opacity-60">
          {dang ? "Đang tra…" : "Tra"}
        </button>
      </form>
      {s.message ? <p role="status" className={`mt-3 text-sm font-bold ${s.status === "error" ? "text-[#8a3a12]" : "text-[#4f5f57]"}`}>{s.message}</p> : null}
      {s.ketQua?.timThay ? <HoSo kq={s.ketQua} nhap={s.nhap} /> : null}
    </section>
  );
}
