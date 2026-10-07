"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { capMaGioiThieuAction, luuNguoiCheoAction, xoaNguoiCheoAction } from "@/app/erp/nguoi-cheo-actions";
import { tenThang, tien } from "@/domain/dai-ly";
import {
  chuyenTuLuotVao,
  docBenTuApi,
  ganNguoiCheo,
  gioVietNam,
  ngayCuaLuc,
  ngayCuaNguoiCheo,
  phutChu,
  soNamCheo,
  SU_KIEN_MO_HO_SO_NGUOI_CHEO,
  type ChuyenUocTinh,
  type CoSoThuyen,
  type GioiThieuNguoiCheo,
  type NgayCuaNguoiCheo,
  type NguoiCheo,
} from "@/domain/thuyen-song";

/**
 * Sổ người chèo của một bến: thuyền số mấy do ai chèo, quê ở đâu, chèo bao
 * nhiêu năm, hôm nay đã nhận mấy chuyến. Bản đồ phía trên dùng sổ này để hiện
 * người chèo khi bấm vào thuyền, và nút "Xem hồ sơ" trên thẻ thuyền mở đúng hồ
 * sơ ở đây (sự kiện {@link SU_KIEN_MO_HO_SO_NGUOI_CHEO}).
 *
 * Phần "hôm nay" tính lại ở máy khách từ cùng nguồn với bản đồ (lượt khách qua
 * cổng, lượt gọi xoay vòng trong sổ), nên khớp với thẻ thuyền trên bản đồ.
 */

type Nhap = {
  id?: string;
  soThuyen: string;
  hoTen: string;
  soDienThoai: string;
  queQuan: string;
  namVaoNghe: string;
  ngonNgu: string;
  ghiChu: string;
};
const TRONG: Nhap = { soThuyen: "", hoTen: "", soDienThoai: "", queQuan: "", namVaoNghe: "", ngonNgu: "", ghiChu: "" };

const HOI_BEN_MS = 60_000;
const MAU_ANH = ["#2f6b57", "#7a5520", "#3d5a80", "#8a3b2e", "#4d6b2f", "#5b4a7a"];

function mauCua(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MAU_ANH[h % MAU_ANH.length];
}

/** Chữ cái đầu của tên gọi (chữ cuối họ tên), như "Hải" → "H". */
function chuDau(hoTen: string): string {
  const ten = hoTen.trim().split(/\s+/).pop() ?? "";
  return ten.charAt(0).toUpperCase() || "?";
}

function namNayVietNam(): number {
  return Number(ngayCuaLuc(Date.now()).slice(0, 4));
}

function AnhChu({ n, lon = false }: { n: NguoiCheo; lon?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-black text-white ${lon ? "h-16 w-16 text-2xl ring-4 ring-white/25" : "h-11 w-11 text-base"}`}
      style={{ background: mauCua(n.id) }}
    >
      {chuDau(n.hoTen)}
    </span>
  );
}

function NhanMau() {
  return <span className="ml-2 rounded-full bg-[#fff1d6] px-2 py-0.5 align-middle text-[0.65rem] font-black text-[#7a5520]">mẫu</span>;
}

function TrangThai({ ngay, coDuLieu }: { ngay: NgayCuaNguoiCheo | undefined; coDuLieu: boolean }) {
  if (!coDuLieu) return null;
  if (ngay?.dangCheo) {
    return (
      <span className="rounded-full bg-[#fdebd8] px-2.5 py-1 text-[0.7rem] font-black text-[#9a4a12]">
        Trên sông · về {gioVietNam(ngay.dangCheo.veBenLuc)}
      </span>
    );
  }
  if (ngay) {
    return <span className="rounded-full bg-[#e3efe8] px-2.5 py-1 text-[0.7rem] font-black text-[#235443]">Ở bến · {ngay.soChuyen} chuyến</span>;
  }
  return <span className="rounded-full bg-[#eef1ef] px-2.5 py-1 text-[0.7rem] font-bold text-[#66756e]">Chưa nhận lượt</span>;
}

function dongPhu(n: NguoiCheo, namNay: number): string {
  const nam = soNamCheo(n.namVaoNghe, namNay);
  const phan = [n.queQuan, nam === null ? null : nam === 0 ? "mới vào nghề" : `${nam} năm chèo`].filter(Boolean);
  if (n.gioiThieu && n.gioiThieu.khach > 0) phan.push(`giới thiệu ${n.gioiThieu.khach} khách`);
  return phan.length ? phan.join(" · ") : n.soDienThoai ?? "Chưa ghi quê, năm vào nghề";
}

export function SoNguoiCheo({ coSo, tenBen, ds, coKho }: { coSo: CoSoThuyen; tenBen: string; ds: NguoiCheo[]; coKho: boolean }) {
  const router = useRouter();
  const [nhap, setNhap] = useState<Nhap | null>(null);
  const [loi, setLoi] = useState("");
  const [dang, batDau] = useTransition();
  const [moId, setMoId] = useState<string | null>(null);
  const [ben, setBen] = useState<{ chuyen: ChuyenUocTinh[]; bayGio: number; lech: number } | null>(null);
  const [bayGio, setBayGio] = useState(0);
  const hop = useRef<HTMLDialogElement>(null);
  const khungNhap = useRef<HTMLFormElement>(null);
  const soMau = ds.filter((n) => n.laMau).length;
  const o = "min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c] outline-none focus:border-[#4f806f]";

  // Cùng nguồn với bản đồ: lượt qua cổng trong ngày, hỏi lại mỗi phút.
  useEffect(() => {
    if (!coKho) return;
    let huy = false;
    const hoi = async () => {
      try {
        const res = await fetch(`/api/erp/thuyen?coSo=${coSo}&phan=ben`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean } & Record<string, unknown>;
        if (huy || !data.ok) return;
        const doc = docBenTuApi(data);
        if (!doc) return;
        const lech = typeof data.bayGio === "string" ? Date.parse(data.bayGio) - Date.now() : 0;
        const chuyen = doc.doi
          ? chuyenTuLuotVao(coSo, doc.luotVao, doc.doi.choMoiThuyen, doc.doi.phutMotVong)
          : chuyenTuLuotVao(coSo, doc.luotVao, 4);
        setBen({ chuyen, bayGio: Date.now() + lech, lech });
        setBayGio(Date.now() + lech);
      } catch {
        // Mạng chập chờn: giữ số lần trước, lần hỏi sau sẽ lấy lại.
      }
    };
    void hoi();
    const id = window.setInterval(hoi, HOI_BEN_MS);
    return () => {
      huy = true;
      window.clearInterval(id);
    };
  }, [coSo, coKho]);

  const theoNguoi = useMemo(() => {
    if (!ben) return new Map<string, NgayCuaNguoiCheo>();
    return ngayCuaNguoiCheo(ben.chuyen, ganNguoiCheo(ben.chuyen, ds), bayGio || ben.bayGio);
  }, [ben, ds, bayGio]);

  // Thẻ thuyền trên bản đồ có nút "Xem hồ sơ": mở đúng người ở đây.
  useEffect(() => {
    const nghe = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id && ds.some((n) => n.id === id)) moHoSo(id);
    };
    window.addEventListener(SU_KIEN_MO_HO_SO_NGUOI_CHEO, nghe);
    return () => window.removeEventListener(SU_KIEN_MO_HO_SO_NGUOI_CHEO, nghe);
  });

  function moHoSo(id: string) {
    if (ben) setBayGio(Date.now() + ben.lech);
    setMoId(id);
    const d = hop.current;
    if (d && !d.open) d.showModal();
  }
  function dongHoSo() {
    hop.current?.close();
  }

  function batDauSua(n: NguoiCheo | null) {
    setLoi("");
    setNhap(
      n
        ? {
            id: n.id,
            soThuyen: n.soThuyen,
            hoTen: n.hoTen,
            soDienThoai: n.soDienThoai ?? "",
            queQuan: n.queQuan ?? "",
            namVaoNghe: n.namVaoNghe ? String(n.namVaoNghe) : "",
            ngonNgu: n.ngonNgu ?? "",
            ghiChu: n.ghiChu ?? "",
          }
        : { ...TRONG },
    );
    dongHoSo();
    requestAnimationFrame(() => khungNhap.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  const luu = () =>
    batDau(async () => {
      if (!nhap) return;
      setLoi("");
      const kq = await luuNguoiCheoAction({ ...nhap, coSo });
      if (!kq.ok) return setLoi(kq.loi);
      setNhap(null);
      router.refresh();
    });
  const xoa = (n: NguoiCheo) =>
    batDau(async () => {
      if (!window.confirm(`Xoá ${n.hoTen} (thuyền ${n.soThuyen}) khỏi sổ?`)) return;
      setLoi("");
      const kq = await xoaNguoiCheoAction(coSo, n.id);
      if (!kq.ok) return setLoi(kq.loi);
      dongHoSo();
      router.refresh();
    });

  const capMa = (n: NguoiCheo, tyLe: number) =>
    batDau(async () => {
      setLoi("");
      const kq = await capMaGioiThieuAction(coSo, n.id, tyLe);
      if (!kq.ok) return setLoi(kq.loi);
      router.refresh();
    });

  const namNay = namNayVietNam();
  const coMa = ds.filter((n) => n.gioiThieu);
  const khachGioiThieu = coMa.reduce((tong, n) => tong + (n.gioiThieu?.khach ?? 0), 0);
  const hoaHongTam = coMa.reduce((tong, n) => tong + (n.gioiThieu?.hoaHong ?? 0), 0);
  const dangTrenSong = ds.filter((n) => theoNguoi.get(n.id)?.dangCheo).length;
  const daNhan = ds.filter((n) => theoNguoi.has(n.id)).length;
  const dangMo = ds.find((n) => n.id === moId) ?? null;

  return (
    <section
      className="mb-8 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-6"
      data-testid="so-nguoi-cheo"
      data-chi="so-nguoi-cheo"
      data-chi-loi="Sổ ghi thuyền số mấy do ai chèo. Bấm một người để mở hồ sơ: quê, số năm chèo, hôm nay đã nhận mấy chuyến. Bấm thuyền trên bản đồ rồi chọn “Xem hồ sơ” cũng tới đây."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#20342c]">Sổ người chèo · {tenBen}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f7068]">
            Bấm một người để xem hồ sơ và các chuyến hôm nay. Thuyền nhận người theo lượt gọi xoay vòng trong sổ.
            {soMau > 0 ? ` ${soMau} người gắn nhãn "mẫu"; sửa một người là thành người thật trong sổ.` : ""}
          </p>
        </div>
        {coKho ? (
          <button type="button" onClick={() => batDauSua(null)} className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white">
            Thêm người chèo
          </button>
        ) : null}
      </div>

      {ben && ds.length ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl" data-testid="so-nguoi-cheo-hom-nay">
          <div className="rounded-xl bg-[#fdf3ea] px-3 py-2">
            <dt className="text-[0.7rem] font-bold text-[#8a5a2c]">Đang trên sông</dt>
            <dd className="text-xl font-black tabular-nums text-[#9a4a12]">{dangTrenSong}</dd>
          </div>
          <div className="rounded-xl bg-[#eef5f1] px-3 py-2">
            <dt className="text-[0.7rem] font-bold text-[#3f6656]">Ở bến</dt>
            <dd className="text-xl font-black tabular-nums text-[#183f34]">{ds.length - dangTrenSong}</dd>
          </div>
          <div className="rounded-xl bg-[#f3f5f4] px-3 py-2">
            <dt className="text-[0.7rem] font-bold text-[#5c6b64]">Đã nhận lượt hôm nay</dt>
            <dd className="text-xl font-black tabular-nums text-[#20342c]">
              {daNhan}/{ds.length}
            </dd>
          </div>
        </dl>
      ) : null}

      {coMa.length > 0 ? (
        <p
          className="mt-3 text-sm leading-6 text-[#42554c]"
          data-testid="so-nguoi-cheo-gioi-thieu"
          data-chi="gioi-thieu-nguoi-cheo"
          data-chi-loi="Dòng này cộng cả sổ: bao nhiêu người có mã giới thiệu, đưa về bao nhiêu khách, hoa hồng tạm tính. Bấm một người chèo để xem mã QR và số của riêng người ấy."
        >
          {tenThang(coMa[0].gioiThieu!.thang).replace(/^t/, "T")}: {coMa.length} người có mã giới thiệu, đưa về {khachGioiThieu} khách · hoa hồng tạm tính{" "}
          <strong>{tien(hoaHongTam)}</strong>.{" "}
          <Link href="/erp/dai-ly" className="font-bold text-[#183f34] underline underline-offset-2">
            Chi hoa hồng
          </Link>
        </p>
      ) : null}

      {!coKho ? <p className="mt-4 text-sm text-[#59654b]">Bản chạy này chưa nối kho dữ liệu nên chưa có sổ.</p> : null}

      {nhap ? (
        <form
          ref={khungNhap}
          className="mt-4 grid gap-3 rounded-2xl bg-[#f4f7f5] p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            luu();
          }}
          data-testid="form-nguoi-cheo"
        >
          <p className="text-sm font-black text-[#20342c] sm:col-span-2 lg:col-span-4">{nhap.id ? "Sửa hồ sơ người chèo" : "Thêm người chèo"}</p>
          <label className="block text-xs font-bold text-[#53675e]">
            Số thuyền
            <input value={nhap.soThuyen} onChange={(e) => setNhap({ ...nhap, soThuyen: e.target.value })} className={`${o} mt-1`} required maxLength={20} />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Họ tên
            <input value={nhap.hoTen} onChange={(e) => setNhap({ ...nhap, hoTen: e.target.value })} className={`${o} mt-1`} required maxLength={120} />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Số điện thoại
            <input
              value={nhap.soDienThoai}
              onChange={(e) => setNhap({ ...nhap, soDienThoai: e.target.value })}
              className={`${o} mt-1`}
              inputMode="tel"
              maxLength={20}
              placeholder="Tuỳ chọn"
            />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Quê (xã, thôn)
            <input value={nhap.queQuan} onChange={(e) => setNhap({ ...nhap, queQuan: e.target.value })} className={`${o} mt-1`} maxLength={80} placeholder="Trường Yên" />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Năm vào nghề
            <input
              value={nhap.namVaoNghe}
              onChange={(e) => setNhap({ ...nhap, namVaoNghe: e.target.value })}
              className={`${o} mt-1`}
              inputMode="numeric"
              maxLength={4}
              placeholder="2010"
            />
          </label>
          <label className="block text-xs font-bold text-[#53675e] lg:col-span-1">
            Tiếng chào khách
            <input value={nhap.ngonNgu} onChange={(e) => setNhap({ ...nhap, ngonNgu: e.target.value })} className={`${o} mt-1`} maxLength={120} placeholder="Tiếng Việt, chào hỏi tiếng Anh" />
          </label>
          <label className="block text-xs font-bold text-[#53675e] sm:col-span-2">
            Ghi chú
            <input value={nhap.ghiChu} onChange={(e) => setNhap({ ...nhap, ghiChu: e.target.value })} className={`${o} mt-1`} maxLength={300} placeholder="Chứng chỉ cứu đuối, biết sơ cứu…" />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={dang} className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">
              {dang ? "Đang lưu…" : "Lưu"}
            </button>
            <button type="button" onClick={() => setNhap(null)} className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#53675e]">
              Thôi
            </button>
          </div>
        </form>
      ) : null}
      {loi ? (
        <p role="alert" className="mt-3 rounded-xl bg-[#fdecea] px-3 py-2 text-sm font-bold text-[#9b2c1f]">
          {loi}
        </p>
      ) : null}

      {coKho && ds.length === 0 ? <p className="mt-4 text-sm text-[#5f7068]">Sổ còn trống.</p> : null}
      {ds.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ds.map((n) => (
            <li key={n.id} data-nguoi-cheo={n.soThuyen}>
              <button
                type="button"
                onClick={() => moHoSo(n.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-[#e0e7e3] px-3 py-2.5 text-left transition-colors hover:border-[#9db8ab] hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-[#4f806f]"
                aria-label={`Hồ sơ ${n.hoTen}, thuyền ${n.soThuyen}`}
              >
                <AnhChu n={n} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-[#20342c]">
                    <span className="mr-1.5 tabular-nums text-[#5f7d70]">{n.soThuyen}</span>
                    {n.hoTen}
                    {n.laMau ? <NhanMau /> : null}
                  </span>
                  <span className="block truncate text-xs text-[#6e7b75]">{dongPhu(n, namNay)}</span>
                  {/* Màn hẹp: nhãn xuống dưới để tên không bị cắt. */}
                  <span className="mt-1.5 block lg:hidden">
                    <TrangThai ngay={theoNguoi.get(n.id)} coDuLieu={ben !== null} />
                  </span>
                </span>
                <span className="hidden shrink-0 lg:block">
                  <TrangThai ngay={theoNguoi.get(n.id)} coDuLieu={ben !== null} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={hop}
        onClose={() => setMoId(null)}
        onClick={(e) => {
          // Bấm ra nền mờ ngoài thẻ thì đóng.
          if (e.target === e.currentTarget) dongHoSo();
        }}
        aria-labelledby="ho-so-nguoi-cheo-ten"
        className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white p-0 text-[#20342c] shadow-2xl backdrop:bg-[#0d1f19]/55"
        data-testid="ho-so-nguoi-cheo"
      >
        {dangMo ? <HoSo n={dangMo} tenBen={tenBen} ngay={theoNguoi.get(dangMo.id)} coDuLieu={ben !== null} namNay={namNay} bayGio={bayGio} coKho={coKho} dang={dang} onDong={dongHoSo} onSua={() => batDauSua(dangMo)} onXoa={() => xoa(dangMo)} onCapMa={(tyLe) => capMa(dangMo, tyLe)} loi={loi} /> : null}
      </dialog>
    </section>
  );
}

function HoSo({
  n,
  tenBen,
  ngay,
  coDuLieu,
  namNay,
  bayGio,
  coKho,
  dang,
  onDong,
  onSua,
  onXoa,
  onCapMa,
  loi,
}: {
  n: NguoiCheo;
  tenBen: string;
  ngay: NgayCuaNguoiCheo | undefined;
  coDuLieu: boolean;
  namNay: number;
  bayGio: number;
  coKho: boolean;
  dang: boolean;
  onDong: () => void;
  onSua: () => void;
  onXoa: () => void;
  onCapMa: (tyLe: number) => void;
  loi: string;
}) {
  const nam = soNamCheo(n.namVaoNghe, namNay);
  const gioTrenSong = ngay ? Math.round(ngay.phutTrenSong) : 0;
  const dong = (nhan: string, giaTri: React.ReactNode) => (
    <div className="rounded-xl bg-[#f4f7f5] px-3 py-2.5">
      <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#66786f]">{nhan}</dt>
      <dd className="mt-0.5 text-sm font-bold text-[#20342c]">{giaTri}</dd>
    </div>
  );

  return (
    <div>
      <div className="relative bg-[#183f34] px-5 pb-5 pt-6 text-white">
        <button
          type="button"
          onClick={onDong}
          aria-label="Đóng hồ sơ"
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
        <div className="flex items-center gap-4 pr-10">
          <AnhChu n={n} lon />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b9d3c7]">Thuyền {n.soThuyen}</p>
            <h3 id="ho-so-nguoi-cheo-ten" className="font-display mt-0.5 text-2xl leading-tight sm:text-3xl">
              {n.hoTen}
              {n.laMau ? <NhanMau /> : null}
            </h3>
            <p className="mt-1 text-sm text-[#d6e6de]">
              {[n.queQuan, nam === null ? null : nam === 0 ? "mới vào nghề" : `${nam} năm chèo`].filter(Boolean).join(" · ") || "Chưa ghi quê, năm vào nghề"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <section aria-label="Hôm nay">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#5f7d70]">Hôm nay</h4>
            <TrangThai ngay={ngay} coDuLieu={coDuLieu} />
          </div>
          {!coDuLieu ? (
            <p className="mt-2 text-sm text-[#5f7068]">Đang lấy lượt khách qua cổng…</p>
          ) : !ngay ? (
            <p className="mt-2 text-sm leading-6 text-[#5f7068]">Chưa tới lượt nhận khách. Người chèo đứng trong hàng chờ ở bến, thuyền rời bến tiếp theo sẽ gọi theo thứ tự.</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-[#e0e7e3] px-2 py-2">
                  <dt className="text-[0.7rem] font-bold text-[#66786f]">Chuyến</dt>
                  <dd className="text-2xl font-black tabular-nums text-[#183f34]">{ngay.soChuyen}</dd>
                </div>
                <div className="rounded-xl border border-[#e0e7e3] px-2 py-2">
                  <dt className="text-[0.7rem] font-bold text-[#66786f]">Khách đã chở</dt>
                  <dd className="text-2xl font-black tabular-nums text-[#183f34]">{ngay.soKhach}</dd>
                </div>
                <div className="rounded-xl border border-[#e0e7e3] px-2 py-2">
                  <dt className="text-[0.7rem] font-bold text-[#66786f]">Trên sông</dt>
                  <dd className="text-lg font-black leading-8 text-[#183f34]">{phutChu(gioTrenSong)}</dd>
                </div>
              </dl>
              <ol className="mt-3 space-y-1.5" data-testid="chuyen-cua-nguoi-cheo">
                {ngay.chuyen.map((c) => {
                  const dangDi = bayGio < c.veBenLuc;
                  return (
                    <li
                      key={c.roiBenLuc}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${dangDi ? "bg-[#fdf3ea] font-bold text-[#9a4a12]" : "bg-[#f7f9f8] text-[#42554c]"}`}
                    >
                      <span className="tabular-nums">
                        {gioVietNam(c.roiBenLuc)} → {dangDi ? `khoảng ${gioVietNam(c.veBenLuc)}` : gioVietNam(c.veBenLuc)}
                      </span>
                      <span>
                        {c.soKhach} khách{dangDi ? " · đang đi" : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[0.7rem] leading-4 text-[#7d8c84]">Ước từ lượt khách qua cổng, ghép người theo lượt gọi xoay vòng trong sổ.</p>
            </>
          )}
        </section>

        <GioiThieu g={n.gioiThieu ?? null} coKho={coKho} dang={dang} onCapMa={onCapMa} loi={loi} />

        <dl className="grid gap-2 sm:grid-cols-2">
          {dong("Tiếng chào khách", n.ngonNgu ?? "Chưa ghi")}
          {dong("Vào nghề", n.namVaoNghe ? `Năm ${n.namVaoNghe}` : "Chưa ghi")}
          {dong(
            "Điện thoại",
            n.soDienThoai ? (
              <a href={`tel:${n.soDienThoai.replace(/[^0-9+]/g, "")}`} className="text-[#183f34] underline underline-offset-2">
                {n.soDienThoai}
              </a>
            ) : (
              "Chưa ghi số"
            ),
          )}
          {dong("Bến", tenBen)}
        </dl>

        {n.ghiChu ? (
          <p className="rounded-xl border-l-4 border-[#c9a45c] bg-[#fbf7ee] px-4 py-3 text-sm leading-6 text-[#4b4330]">{n.ghiChu}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-[#e6ece9] pt-4">
          {n.soDienThoai ? (
            <a
              href={`tel:${n.soDienThoai.replace(/[^0-9+]/g, "")}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
            >
              Gọi
            </a>
          ) : null}
          {coKho ? (
            <>
              <button type="button" onClick={onSua} className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#183f34]">
                Sửa hồ sơ
              </button>
              <button type="button" disabled={dang} onClick={onXoa} className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#9b2c1f] underline underline-offset-2">
                Xoá khỏi sổ
              </button>
            </>
          ) : null}
          <button type="button" onClick={onDong} className="ml-auto min-h-11 rounded-xl px-4 text-sm font-bold text-[#53675e]">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

const NHAN_CHI: Record<NonNullable<GioiThieuNguoiCheo["trangThaiChi"]>, string> = {
  "cho-duyet": "Đã ghi chi, chờ kế toán trưởng duyệt",
  "da-ghi-so": "Đã chi, kế toán đã ghi sổ",
  "bi-tra-lai": "Lần chi bị kế toán trả lại, ghi chi lại ở màn Đại lý & hoa hồng",
};

/**
 * Người chèo giới thiệu khách (migration 116). Mã nằm trong sổ đại lý: khách
 * quét QR rồi đặt thì đơn ghi cho người chèo; hoa hồng chỉ tính đơn đã trả mà
 * khách đã qua cổng, theo tháng ngày đi, chi ở màn Đại lý & hoa hồng.
 */
function GioiThieu({
  g,
  coKho,
  dang,
  onCapMa,
  loi,
}: {
  g: GioiThieuNguoiCheo | null;
  coKho: boolean;
  dang: boolean;
  onCapMa: (tyLe: number) => void;
  loi: string;
}) {
  const [tyLe, setTyLe] = useState("5");
  const [qr, setQr] = useState("");
  const duongDan = g ? `${typeof window === "undefined" ? "" : window.location.origin}/dl/${g.ma}` : "";
  useEffect(() => {
    if (!duongDan) return;
    let huy = false;
    void QRCode.toDataURL(duongDan, { width: 320, margin: 1, color: { dark: "#183f34", light: "#ffffff" } })
      .then((url) => {
        if (!huy) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, [duongDan]);

  if (!g) {
    if (!coKho) return null;
    return (
      <section aria-label="Giới thiệu khách" className="rounded-2xl border border-dashed border-[#c9d6cf] p-4" data-testid="gioi-thieu-chua-co-ma">
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#5f7d70]">Giới thiệu khách & hoa hồng</h4>
        <p className="mt-2 text-sm leading-6 text-[#4f6158]">
          Chưa có mã giới thiệu. Cấp mã thì người chèo có một mã QR đưa khách quét; khách đặt gói qua mã ấy và tới cổng thì người chèo được hoa hồng.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-[#53675e]">
            Hoa hồng (%)
            <input
              value={tyLe}
              onChange={(e) => setTyLe(e.target.value)}
              inputMode="decimal"
              className="mt-1 block min-h-11 w-24 rounded-xl border border-[#ccd8d1] px-3 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={dang}
            onClick={() => onCapMa(Number(tyLe.replace(",", ".")))}
            className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {dang ? "Đang cấp…" : "Cấp mã giới thiệu"}
          </button>
        </div>
        {loi ? <p role="alert" className="mt-2 text-sm font-bold text-[#9b2c1f]">{loi}</p> : null}
      </section>
    );
  }

  const o = "rounded-xl border border-[#e0e7e3] px-2 py-2 text-center";
  return (
    <section aria-label="Giới thiệu khách" data-testid="gioi-thieu-nguoi-cheo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#5f7d70]">Giới thiệu khách · {tenThang(g.thang)}</h4>
        <span className="rounded-full bg-[#eef5f1] px-2.5 py-1 text-[0.7rem] font-black text-[#235443]">
          Mã {g.ma} · {String(g.tyLe).replace(".", ",")}%
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={o}>
          <dt className="text-[0.7rem] font-bold text-[#66786f]">Đơn đặt qua mã</dt>
          <dd className="text-2xl font-black tabular-nums text-[#183f34]">{g.don}</dd>
        </div>
        <div className={o}>
          <dt className="text-[0.7rem] font-bold text-[#66786f]">Khách đã tới</dt>
          <dd className="text-2xl font-black tabular-nums text-[#183f34]">
            {g.khachToi}
            <span className="text-sm font-bold text-[#7d8c84]">/{g.khach}</span>
          </dd>
        </div>
        <div className={o}>
          <dt className="text-[0.7rem] font-bold text-[#66786f]">Doanh thu đã tới</dt>
          <dd className="text-base font-black leading-8 tabular-nums text-[#183f34]">{tien(g.doanhThuToi)}</dd>
        </div>
        <div className={`${o} bg-[#fbf7ee]`}>
          <dt className="text-[0.7rem] font-bold text-[#7a5520]">Hoa hồng</dt>
          <dd className="text-base font-black leading-8 tabular-nums text-[#7a5520]">{tien(g.hoaHong)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-[#66786f]">
        {g.trangThaiChi ? NHAN_CHI[g.trangThaiChi] : "Tạm tính: chỉ đơn đã trả mà khách đã qua cổng; chi sau khi khép tháng."}{" "}
        <Link href="/erp/dai-ly" className="font-bold text-[#183f34] underline underline-offset-2">
          Màn Đại lý & hoa hồng
        </Link>
      </p>
      {g.dangHopTac ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f4f7f5] p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh QR dựng tại chỗ dạng data URL
            <img src={qr} alt={`Mã QR giới thiệu ${g.ma}`} width={112} height={112} className="h-28 w-28 shrink-0 rounded-lg bg-white" />
          ) : null}
          <p className="min-w-0 text-sm leading-6 text-[#42554c]">
            Khách quét mã này rồi đặt gói thì đơn ghi cho người chèo.
            <span className="mt-1 block break-all font-mono text-xs text-[#183f34]">{duongDan}</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#7a5520]">Mã đang tạm ngừng ở màn Đại lý & hoa hồng, khách quét sẽ không được ghi.</p>
      )}
    </section>
  );
}
