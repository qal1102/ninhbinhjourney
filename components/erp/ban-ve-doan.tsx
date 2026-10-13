"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { docMaKhachQuetAction } from "@/app/erp/actions";
import {
  banVeDoanTienMatAction,
  docDoanVuaBanAction,
  taoMaDoanKhachQuetAction,
  themCongTyAction,
} from "@/app/erp/ve-doan-actions";
import type { ErpSite } from "@/domain/erp";
import {
  COUNTER_GROUP_MIN,
  COUNTER_SALE_MAX_PARTY,
  bacUuDai,
  counterCashSuggestions,
  counterChange,
  formatVnd,
  giaVeDoan,
  type CounterPrice,
  type CounterSaleReceipt,
  type TravelCompanyStanding,
} from "@/domain/erp-counter-sale";
import type { DienPhieuDoan } from "@/domain/soat-giay-to";
import type { VisitorGroupStatus } from "@/domain/visitor-group";
import { DuaVeChoKhach } from "./dua-ve-cho-khach";

/**
 * Bán vé đoàn ở quầy (12/10/2026, migration 118). Chủ dự án: "Thường sẽ
 * trưởng đoàn là hướng dẫn viên ABC, thuộc công ty ABC cho xuất hoá đơn vé cho
 * công ty và công ty này năm nay đã hợp tác bao nhiêu… có nằm trong diện ưu
 * đãi không."
 *
 * Giá = giá người lớn × số người, trừ ưu đãi của công ty. Màn hình tính trước
 * để người bán đọc cho khách; kho tính lại khi ghi phiếu.
 */

function khoaMoi() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const O_NHAP =
  "mt-1 min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c] outline-none focus:border-[#4f806f]";

type Props = {
  site: ErpSite;
  prices: CounterPrice[];
  congTy: TravelCompanyStanding[];
  dienSan: DienPhieuDoan | null;
  onDaBan: (receipt: CounterSaleReceipt, message: string) => void;
};

export function BanVeDoan({ site, prices, congTy: congTyBanDau, dienSan, onDaBan }: Props) {
  const [soNguoi, setSoNguoi] = useState(dienSan ? String(Math.max(COUNTER_GROUP_MIN, dienSan.partySize)) : "");
  const [truongDoan, setTruongDoan] = useState("");
  const [sdt, setSdt] = useState("");
  const [nhan, setNhan] = useState(dienSan?.groupLabel ?? "");
  const [congTy, setCongTy] = useState(congTyBanDau);
  const [congTyId, setCongTyId] = useState("");
  const [hoaDon, setHoaDon] = useState(false);
  const [moThemCty, setMoThemCty] = useState(false);
  const [cachTra, setCachTra] = useState<"cash" | "qr-transfer">("cash");
  const [tienText, setTienText] = useState("");
  const [daDem, setDaDem] = useState(false);
  const [loi, setLoi] = useState("");
  const [pending, startTransition] = useTransition();
  const khoa = useRef(khoaMoi());
  const [maCho, setMaCho] = useState<{ url: string; manKhachUrl: string; expiresAt: number; totalVnd: number } | null>(null);
  const [conGiay, setConGiay] = useState(0);
  const [vuaBan, setVuaBan] = useState<CounterSaleReceipt | null>(null);
  const [doan, setDoan] = useState<VisitorGroupStatus | null>(null);
  const [qrDoan, setQrDoan] = useState("");
  const [tenAi, setTenAi] = useState<string[]>(dienSan?.ten ?? []);
  const [dangGanTen, setDangGanTen] = useState(false);
  const [loiGanTen, setLoiGanTen] = useState("");

  const n = Math.trunc(Number(soNguoi)) || 0;
  const gia = prices.find((price) => price.product === "adult");
  const cty = congTy.find((item) => item.id === congTyId) ?? null;
  const tinh = useMemo(
    () => giaVeDoan({ unitPriceVnd: gia?.unitPriceVnd ?? 0, partySize: n, discountPercent: cty?.discountPercent ?? 0 }),
    [gia, n, cty],
  );
  const tien = Number(tienText.replace(/[^0-9]/g, "")) || 0;
  const thoi = counterChange(tien, tinh.tongVnd);
  const soHopLe = n >= COUNTER_GROUP_MIN && n <= COUNTER_SALE_MAX_PARTY;
  const sdtSach = sdt.replace(/\s+/g, "");
  const thieu = !gia
    ? "Quầy chưa có giá người lớn. Xin báo quản lý."
    : !soHopLe
      ? `Vé đoàn từ ${COUNTER_GROUP_MIN} đến ${COUNTER_SALE_MAX_PARTY} người.`
      : truongDoan.trim().length < 2
        ? "Ghi tên trưởng đoàn hoặc hướng dẫn viên."
        : sdtSach && !/^\+?[0-9]{8,15}$/.test(sdtSach)
          ? "Số điện thoại chỉ gồm chữ số."
          : hoaDon && !cty
            ? "Muốn xuất hoá đơn thì chọn công ty."
            : "";

  // Đổi bất cứ thông tin nào thì mã cũ và dấu đã đếm tiền không còn đúng.
  function doi(fn: () => void) {
    fn();
    setDaDem(false);
    if (maCho) {
      setMaCho(null);
      khoa.current = khoaMoi();
    }
  }

  const thongTin = () => ({
    siteId: site.id,
    partySize: n,
    leaderName: truongDoan,
    leaderPhone: sdtSach,
    travelCompanyId: cty?.id ?? null,
    invoiceRequested: hoaDon,
    groupLabel: nhan,
    requestKey: khoa.current,
  });

  function xong(receipt: CounterSaleReceipt, message: string) {
    setVuaBan(receipt);
    onDaBan(receipt, message);
    setSoNguoi("");
    setTruongDoan("");
    setSdt("");
    setNhan("");
    setCongTyId("");
    setHoaDon(false);
    setTienText("");
    setDaDem(false);
    setMaCho(null);
    khoa.current = khoaMoi();
    if (receipt.groupCode) {
      void docDoanVuaBanAction({ siteId: site.id, groupCode: receipt.groupCode }).then(setDoan);
    }
  }

  function banTienMat() {
    if (thieu || pending || !daDem || thoi === null) return;
    setLoi("");
    startTransition(async () => {
      const kq = await banVeDoanTienMatAction({ ...thongTin(), cashReceivedVnd: tien, cashCountedConfirmed: true });
      if (kq.ok) xong(kq.receipt, kq.message);
      else setLoi(kq.message);
    });
  }

  function taoMa() {
    if (thieu || pending) return;
    setLoi("");
    startTransition(async () => {
      const kq = await taoMaDoanKhachQuetAction(thongTin());
      if (kq.ok) {
        setMaCho({ url: kq.url, manKhachUrl: kq.manKhachUrl, expiresAt: kq.expiresAt, totalVnd: kq.totalVnd });
        setConGiay(Math.ceil((kq.expiresAt - Date.now()) / 1000));
      } else {
        setLoi(kq.message);
      }
    });
  }

  // Chờ khách quét: hỏi kho hai giây một lần.
  useEffect(() => {
    if (!maCho) return;
    let huy = false;
    const key = khoa.current;
    const dem = window.setInterval(() => setConGiay(Math.max(0, Math.ceil((maCho.expiresAt - Date.now()) / 1000))), 1000);
    const hoi = window.setInterval(async () => {
      const kq = await docMaKhachQuetAction({ siteId: site.id, requestKey: key }).catch(() => null);
      if (huy || !kq?.receipt) return;
      huy = true;
      xong(kq.receipt, `Trưởng đoàn đã quét và trả ${formatVnd(kq.receipt.totalVnd)}. Phiếu ${kq.receipt.saleCode}.`);
    }, 2000);
    return () => {
      huy = true;
      window.clearInterval(dem);
      window.clearInterval(hoi);
    };
    // xong chỉ đặt state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maCho, site.id]);

  useEffect(() => {
    if (!vuaBan?.groupCode) return;
    let huy = false;
    void QRCode.toDataURL(vuaBan.groupCode, { width: 240, margin: 1, errorCorrectionLevel: "M", color: { dark: "#183f34", light: "#ffffff" } }).then(
      (url) => {
        if (!huy) setQrDoan(url);
      },
    );
    return () => {
      huy = true;
    };
  }, [vuaBan]);

  async function ganTenAi() {
    if (!doan || dangGanTen) return;
    setDangGanTen(true);
    setLoiGanTen("");
    const cap = doan.members.slice(0, tenAi.length);
    let duoc = 0;
    for (const [i, nguoi] of cap.entries()) {
      try {
        const res = await fetch("/api/customer-group-members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ member_code: nguoi.memberCode, display_name: tenAi[i] }),
        });
        if (res.ok) duoc += 1;
      } catch {
        // Người này để trưởng đoàn tự điền.
      }
    }
    if (duoc === cap.length) setTenAi([]);
    else setLoiGanTen(`Mới gắn được ${duoc}/${cap.length} tên. Bấm lại để thử tiếp, hoặc để trưởng đoàn tự điền.`);
    setDangGanTen(false);
  }

  async function themCty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoi("");
    const kq = await themCongTyAction({
      siteId: site.id,
      name: String(form.get("ten") ?? ""),
      taxCode: String(form.get("mst") ?? ""),
      address: String(form.get("diaChi") ?? ""),
      invoiceEmail: String(form.get("email") ?? ""),
      phone: String(form.get("sdtCty") ?? ""),
      contactName: String(form.get("lienHe") ?? ""),
    });
    if (kq.ok) {
      setCongTy((cu) => (cu.some((c) => c.id === kq.company.id) ? cu : [...cu, kq.company]));
      doi(() => setCongTyId(kq.company.id));
      setMoThemCty(false);
    } else {
      setLoi(kq.message);
    }
  }

  const bac = cty ? bacUuDai(cty.groupsThisYear) : null;

  return (
    <div className="space-y-4" data-testid="ban-ve-doan">
      <Link href="/erp/doan" className="inline-flex text-xs font-black text-[#2f6b56] underline underline-offset-4">
        Xem mọi đoàn, cả đoàn đặt trên web →
      </Link>
      {dienSan && !vuaBan ? (
        <p className="rounded-xl border border-[#e7b96a] bg-[#fff8e8] p-3 text-sm font-bold text-[#6b4a14]" data-testid="phieu-doan-ai-dien">
          ✦ AI đã điền từ danh sách đoàn vừa soát{dienSan.ten.length ? `, kèm ${dienSan.ten.length} họ tên` : ""}. Ghi trưởng đoàn rồi thu tiền.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className="text-xs font-black text-[#5c6f67]">
          Số người
          <input
            type="number"
            inputMode="numeric"
            min={COUNTER_GROUP_MIN}
            max={COUNTER_SALE_MAX_PARTY}
            value={soNguoi}
            onChange={(e) => doi(() => setSoNguoi(e.target.value))}
            placeholder="Ví dụ: 32"
            className={`${O_NHAP} text-lg font-black`}
          />
        </label>
        <label className="text-xs font-black text-[#5c6f67]">
          Trưởng đoàn / hướng dẫn viên
          <input
            value={truongDoan}
            onChange={(e) => doi(() => setTruongDoan(e.target.value))}
            maxLength={120}
            autoComplete="off"
            placeholder="Ví dụ: Nguyễn Văn An"
            className={O_NHAP}
          />
        </label>
        <label className="text-xs font-black text-[#5c6f67] sm:col-start-2">
          Số điện thoại trưởng đoàn
          <input
            value={sdt}
            onChange={(e) => doi(() => setSdt(e.target.value))}
            inputMode="tel"
            autoComplete="off"
            placeholder="Để liên lạc khi đoàn thất lạc người"
            className={O_NHAP}
          />
        </label>
      </div>

      <div className="rounded-xl border border-[#dfe6e2] bg-[#f7f9f7] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-black text-[#5c6f67]">
            Công ty lữ hành
            <select value={congTyId} onChange={(e) => doi(() => { setCongTyId(e.target.value); if (!e.target.value) setHoaDon(false); })} className={O_NHAP}>
              <option value="">Khách tự đi, không qua công ty</option>
              {congTy.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.discountPercent > 0 ? ` · ưu đãi ${item.discountPercent}%` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setMoThemCty((v) => !v)}
            aria-expanded={moThemCty}
            className="min-h-11 rounded-xl border border-[#183f34] bg-white px-3 text-sm font-black text-[#183f34]"
          >
            {moThemCty ? "Đóng" : "+ Công ty mới"}
          </button>
        </div>

        {cty ? (
          <p className="mt-2 text-xs leading-5 text-[#42574e]" data-testid="uu-dai-cong-ty">
            Năm nay <strong>{cty.groupsThisYear} đoàn</strong>, {cty.guestsThisYear.toLocaleString("vi-VN")} khách,{" "}
            {formatVnd(cty.revenueThisYearVnd)}.{" "}
            {cty.specialDiscountPercent !== null ? (
              <>Giám đốc đặt ưu đãi riêng <strong>{cty.specialDiscountPercent}%</strong>.</>
            ) : (
              <>
                Bậc ưu đãi <strong>{cty.tierPercent}%</strong>
                {bac?.mocKe ? `, thêm ${bac.mocKe - cty.groupsThisYear} đoàn nữa lên bậc kế` : ", bậc cao nhất"}.
              </>
            )}
            {cty.taxCode ? ` MST ${cty.taxCode}.` : ""}
          </p>
        ) : null}

        {moThemCty ? (
          <form onSubmit={themCty} className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="them-cong-ty">
            <label className="text-xs font-black text-[#5c6f67] sm:col-span-2">
              Tên công ty
              <input name="ten" required minLength={2} maxLength={200} className={O_NHAP} placeholder="Công ty TNHH Du lịch …" />
            </label>
            <label className="text-xs font-black text-[#5c6f67]">
              Mã số thuế
              <input name="mst" inputMode="numeric" className={O_NHAP} placeholder="10 số" />
            </label>
            <label className="text-xs font-black text-[#5c6f67]">
              Email nhận hoá đơn
              <input name="email" type="email" className={O_NHAP} />
            </label>
            <label className="text-xs font-black text-[#5c6f67] sm:col-span-2">
              Địa chỉ
              <input name="diaChi" maxLength={300} className={O_NHAP} />
            </label>
            <label className="text-xs font-black text-[#5c6f67]">
              Người liên hệ
              <input name="lienHe" maxLength={120} className={O_NHAP} />
            </label>
            <label className="text-xs font-black text-[#5c6f67]">
              Điện thoại công ty
              <input name="sdtCty" inputMode="tel" className={O_NHAP} />
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white sm:col-span-2">
              Lưu công ty
            </button>
          </form>
        ) : null}

        <label className={`mt-3 flex items-center gap-3 text-sm font-bold ${cty ? "text-[#20342c]" : "text-[#9aa49f]"}`}>
          <input
            type="checkbox"
            checked={hoaDon}
            disabled={!cty}
            onChange={(e) => doi(() => setHoaDon(e.target.checked))}
            className="h-5 w-5 accent-[#183f34]"
          />
          Xuất hoá đơn cho công ty
        </label>
      </div>

      <label className="block text-xs font-black text-[#5c6f67]">
        Nhãn đoàn (không bắt buộc)
        <input value={nhan} onChange={(e) => doi(() => setNhan(e.target.value))} maxLength={120} placeholder="Ví dụ: Đoàn trường THCS Hoa Lư" className={O_NHAP} />
      </label>

      <div className="rounded-xl bg-[#183f34] p-4 text-white" data-testid="gia-ve-doan">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Tổng tiền đoàn</p>
        <p className="mt-1 text-4xl font-black tabular-nums">{formatVnd(tinh.tongVnd)}</p>
        <p className="mt-1 text-xs text-white/75">
          {gia ? `${formatVnd(gia.unitPriceVnd)} × ${n || 0} người = ${formatVnd(tinh.tamTinhVnd)}` : "Chưa có giá người lớn"}
          {tinh.giamVnd > 0 ? ` · ưu đãi ${tinh.phanTram}% −${formatVnd(tinh.giamVnd)}` : ""}
        </p>
      </div>

      <div role="radiogroup" aria-label="Cách đoàn trả tiền" className="grid grid-cols-2 gap-2">
        {(["cash", "qr-transfer"] as const).map((pt) => (
          <button
            key={pt}
            type="button"
            role="radio"
            aria-checked={cachTra === pt}
            onClick={() => doi(() => setCachTra(pt))}
            className={`min-h-11 rounded-xl border text-sm font-black ${
              cachTra === pt ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
            }`}
          >
            {pt === "cash" ? "Tiền mặt" : "Khách quét QR"}
          </button>
        ))}
      </div>

      {cachTra === "cash" ? (
        <div className="space-y-3">
          <label className="block text-sm font-black text-[#20342c]">
            Tiền trưởng đoàn đưa
            <input
              inputMode="numeric"
              autoComplete="off"
              value={tien ? new Intl.NumberFormat("vi-VN").format(tien) : tienText}
              onChange={(e) => doi(() => setTienText(e.target.value))}
              className="mt-1 min-h-12 w-full rounded-xl border border-[#ccd8d1] px-4 text-xl font-black tabular-nums text-[#183f34] outline-none focus:border-[#4f806f]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {counterCashSuggestions(tinh.tongVnd).map((goiY) => (
              <button key={goiY} type="button" onClick={() => doi(() => setTienText(String(goiY)))} className="min-h-11 rounded-lg bg-[#eef3f0] px-3 text-sm font-black text-[#35594b]">
                {goiY === tinh.tongVnd ? "Đủ tiền" : formatVnd(goiY)}
              </button>
            ))}
          </div>
          <label className="flex gap-3 rounded-xl border-2 border-[#e7c78d] bg-[#fff8eb] p-4 text-sm leading-6 text-[#5d5037]">
            <input type="checkbox" checked={daDem} onChange={(e) => setDaDem(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#183f34]" />
            <span>
              <strong>
                Tôi đã đếm đủ {formatVnd(tien)}
                {thoi !== null && thoi > 0 ? `, thối lại ${formatVnd(thoi)}` : ""}, và bỏ {formatVnd(tinh.tongVnd)} vào quỹ.
              </strong>
            </span>
          </label>
          <button
            type="button"
            onClick={banTienMat}
            disabled={Boolean(thieu) || pending || !daDem || thoi === null}
            className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Đang lưu phiếu…" : "Thu tiền, cấp vé đoàn"}
          </button>
          <p className="text-sm text-[#6e7b75]">
            {thieu || (tien === 0 ? "Nhập số tiền trưởng đoàn đưa." : thoi === null ? `Còn thiếu ${formatVnd(tinh.tongVnd - tien)}.` : !daDem ? "Đếm tiền rồi đánh dấu xác nhận." : "")}
          </p>
        </div>
      ) : maCho ? (
        <div className="space-y-3">
          <DuaVeChoKhach
            url={maCho.url}
            tieuDe={`Mời trưởng đoàn quét · ${formatVnd(maCho.totalVnd)}`}
            loiDan="Trưởng đoàn quét mã này: coi như đã trả (bản trình diễn), vé đoàn hiện trên máy họ và phiếu tự hiện ở đây."
            chuChiaSe="Mở đường dẫn để trả và nhận vé đoàn Ninh Bình:"
          />
          <button
            type="button"
            onClick={() => window.open(maCho.manKhachUrl, "nbj-man-khach")}
            data-testid="mo-man-khach-doan"
            className="min-h-12 w-full rounded-xl bg-[#e7c78d] px-4 text-sm font-black text-[#183f34]"
          >
            Mở màn hình cho khách (số tiền, đồng hồ 15 phút)
          </button>
          <p role="status" className="flex items-center justify-between gap-3 rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
            <span>{conGiay > 0 ? "Đang chờ trưởng đoàn quét…" : "Mã đã hết hạn giữ chỗ."}</span>
            <span className="tabular-nums">
              {String(Math.floor(conGiay / 60)).padStart(2, "0")}:{String(conGiay % 60).padStart(2, "0")}
            </span>
          </p>
          <button type="button" onClick={() => doi(() => undefined)} className="min-h-11 w-full rounded-xl border border-[#ccd8d1] px-4 text-sm font-black text-[#42574e]">
            {conGiay > 0 ? "Huỷ mã, sửa lại" : "Tạo mã mới"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={taoMa}
            disabled={Boolean(thieu) || pending}
            className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Đang tạo mã…" : `Tạo mã cho trưởng đoàn quét · ${formatVnd(tinh.tongVnd)}`}
          </button>
          {thieu ? <p className="text-sm text-[#6e7b75]">{thieu}</p> : null}
        </div>
      )}

      {loi ? (
        <p role="alert" className="rounded-xl bg-[#fdeceb] px-4 py-3 text-sm font-bold text-[#8b3d31]">
          {loi}
        </p>
      ) : null}

      {vuaBan?.groupCode ? (
        <div id="ket-qua-phieu-doan" className="scroll-mt-20 space-y-3 rounded-xl border border-[#d8e0db] bg-[#f3f6f4] p-4" data-testid="ket-qua-ve-doan">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {qrDoan ? (
              // eslint-disable-next-line @next/next/no-img-element -- mã QR sinh tại chỗ
              <img src={qrDoan} alt={`Mã QR đoàn ${vuaBan.groupCode}`} className="h-32 w-32 shrink-0 rounded-lg bg-white p-2" />
            ) : null}
            <div className="min-w-0">
              <p className="font-mono text-lg font-black text-[#183f34]">{vuaBan.groupCode}</p>
              <p className="mt-1 text-sm text-[#3f524a]">
                {vuaBan.groupLeaderName} · {vuaBan.adults} người
                {vuaBan.travelCompany ? ` · ${vuaBan.travelCompany.name}` : ""}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#5c6f67]">
                <strong>Mã vào cổng của cả đoàn</strong>, quét một lần cho mỗi người tới đủ {vuaBan.adults} lượt. Đã thu{" "}
                {formatVnd(vuaBan.totalVnd)}.
              </p>
              {vuaBan.invoiceRequested ? (
                <a
                  href={`/erp/hoa-don/${vuaBan.saleCode}?coSo=${site.id}&ngay=${vuaBan.businessDate}`}
                  target="_blank"
                  rel="noopener"
                  data-testid="mo-de-nghi-hoa-don"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-[#183f34] bg-white px-4 text-sm font-black text-[#183f34]"
                >
                  Đề nghị xuất hoá đơn cho công ty ↗
                </a>
              ) : null}
              {tenAi.length && doan ? (
                <button
                  type="button"
                  onClick={() => void ganTenAi()}
                  disabled={dangGanTen}
                  data-testid="phieu-doan-dien-ten"
                  className="mt-3 ml-0 inline-flex min-h-11 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60 sm:ml-2"
                >
                  {dangGanTen ? "Đang gắn tên…" : `✦ Điền tên ${Math.min(tenAi.length, doan.memberCount)} người từ danh sách`}
                </button>
              ) : null}
              {loiGanTen ? <p className="mt-2 text-xs font-bold text-[#8b3d31]">{loiGanTen}</p> : null}
            </div>
          </div>
          <DuaVeChoKhach
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/doan/truong/${vuaBan.groupCode}`}
            tieuDe="Gửi vé đoàn cho trưởng đoàn"
            loiDan="Trưởng đoàn quét mã này: điện thoại hiện mã vào cổng của cả đoàn, mã riêng từng người và ai đã qua cổng."
            chuChiaSe={`Vé đoàn tại ${site.shortName}, mở để xem mã vào cổng:`}
          />
        </div>
      ) : null}
    </div>
  );
}
