import type { ErpSite } from "@/domain/erp";
import {
  duBao7Ngay,
  tiLeKhongDen,
  tongTheoTuan,
  trungBinhTheoThu,
  xuHuong,
} from "@/domain/bao-cao-co-so";
import type { BaoCaoCoSo } from "@/lib/erp/bao-cao-repository";

/**
 * Báo cáo & dự báo một cơ sở. Mọi con số đọc từ kho (`erp_bao_cao_co_so`);
 * cách suy luận nằm trong `domain/bao-cao-co-so.ts` và được nói ra ngay trên
 * màn hình, để người xếp ca biết con số dự báo từ đâu mà có.
 */

const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function soVi(value: number) {
  return value.toLocaleString("vi-VN");
}

function tien(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ đ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đ`;
  return `${soVi(value)} đ`;
}

function ngayNgan(ngay: string) {
  return `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;
}

function Cot({ phan, nhan, phu, gia, noiBat = false }: { phan: number; nhan: string; phu?: string; gia: string; noiBat?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-[11px] font-bold tabular-nums text-[#5f6d66]">{gia}</span>
      <div className="flex h-28 w-full items-end rounded-md bg-[#f1f5f2]">
        <div
          className={`w-full rounded-md ${noiBat ? "bg-[#c07a2c]" : "bg-[#3e7a62]"}`}
          style={{ height: `${Math.max(2, Math.round(phan * 100))}%` }}
        />
      </div>
      <span className="text-[11px] text-[#6b7771]">{nhan}</span>
      {phu ? <span className="-mt-1 text-[10px] tabular-nums text-[#8a958f]">{phu}</span> : null}
    </div>
  );
}

export function BaoCaoWorkspace({ site, baoCao }: { site: ErpSite; baoCao: BaoCaoCoSo }) {
  if (baoCao.trangThai !== "co-so-lieu") {
    return (
      <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#20342c]">
          {baoCao.trangThai === "chua-noi-kho" ? "Bản chạy thử này chưa nối kho số liệu" : "Chưa đọc được số liệu"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6d66]">
          {baoCao.trangThai === "chua-noi-kho"
            ? "Báo cáo đọc vé, phiếu quầy và lượt qua cổng trong kho thật, nên ở máy chạy thử không có gì để vẽ. Thà để trống còn hơn dựng một biểu đồ cho đẹp."
            : baoCao.loiNhan}
        </p>
      </section>
    );
  }

  const { soLieu, homNay } = baoCao;
  const tuan = tongTheoTuan(soLieu.ngay);
  const theoThu = trungBinhTheoThu(soLieu.ngay);
  const heSo = xuHuong(soLieu.ngay);
  const duBao = duBao7Ngay(soLieu, homNay);
  const khongDen = tiLeKhongDen(soLieu.ngay);
  const tongKhach28 = soLieu.ngay.slice(-28).reduce((t, d) => t + d.khachVao, 0);
  const tongKhachTruoc = soLieu.ngay.slice(-56, -28).reduce((t, d) => t + d.khachVao, 0);
  const tienQuay28 = soLieu.ngay.slice(-28).reduce((t, d) => t + d.tienQuay, 0);
  const tongGio = soLieu.gio.reduce((t, g) => t + g.khach, 0);
  const gioDong = [...soLieu.gio].sort((a, b) => b.khach - a.khach).slice(0, 2).map((g) => g.gio).sort((a, b) => a - b);
  const maxTuan = Math.max(1, ...tuan.map((t) => t.khach));
  const maxThu = Math.max(1, ...theoThu);
  const maxGio = Math.max(1, ...soLieu.gio.map((g) => g.khach));
  const maxDuBao = Math.max(1, ...duBao.map((d) => d.cao));
  const canhBao = duBao.filter((d) => d.phanTramSucChua !== null && d.phanTramSucChua >= 85);
  const bienDong = tongKhachTruoc > 0 ? Math.round(((tongKhach28 - tongKhachTruoc) / tongKhachTruoc) * 100) : null;

  if (tongKhach28 === 0 && tongKhachTruoc === 0) {
    return (
      <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#20342c]">Chưa có lượt khách nào qua cổng {site.shortName} trong tám tuần qua</h2>
        <p className="mt-2 text-sm leading-6 text-[#5f6d66]">Có khách qua cổng thì báo cáo và dự báo tự hiện ở đây.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5" data-testid="bao-cao-co-so">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Khách qua cổng · 28 ngày", soVi(tongKhach28), bienDong === null ? "Chưa có kỳ trước để so" : `${bienDong > 0 ? "+" : ""}${bienDong}% so với 28 ngày trước`],
          ["Tiền bán tại quầy · 28 ngày", tien(tienQuay28), `${soVi(soLieu.ngay.slice(-28).reduce((t, d) => t + d.phieuQuay, 0))} phiếu`],
          ["Giờ đông nhất", gioDong.map((g) => `${g}h`).join(" và ") || "—", tongGio ? `${Math.round(((soLieu.gio.find((g) => g.gio === gioDong[0])?.khach ?? 0) / tongGio) * 100)}% khách vào trong giờ ${gioDong[0]}h` : ""],
          ["Khách đặt web không tới", khongDen === null ? "—" : `${khongDen.toLocaleString("vi-VN")}%`, "Tính trên các ngày đã qua"],
        ].map(([nhan, gia, ghiChu]) => (
          <article key={nhan} className="min-w-0 rounded-xl border border-[#e3e9e5] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-[#6d7c74]">{nhan}</p>
            <p className="mt-2 text-xl font-black tracking-[-0.02em] text-[#1e3229] sm:text-2xl">{gia}</p>
            <p className="mt-1 text-xs leading-5 text-[#7c8882]">{ghiChu}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6" data-testid="du-bao-7-ngay">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Dự báo bảy ngày tới</p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">
          {canhBao.length > 0
            ? `${canhBao.length} ngày giờ cao điểm có thể chạm ${canhBao[0].phanTramSucChua}% sức chứa`
            : "Chưa ngày nào giờ cao điểm vượt 85% sức chứa"}
        </h2>
        <div className="mt-5 flex gap-1.5 sm:gap-3">
          {duBao.map((d) => (
            <Cot
              key={d.ngay}
              phan={d.khach / maxDuBao}
              gia={soVi(d.khach)}
              nhan={THU_NGAN[new Date(`${d.ngay}T00:00:00Z`).getUTCDay()]}
              phu={ngayNgan(d.ngay)}
              noiBat={d.phanTramSucChua !== null && d.phanTramSucChua >= 85}
            />
          ))}
        </div>
        <ul className="mt-5 divide-y divide-[#eef1ed] text-sm">
          {duBao.map((d) => (
            <li key={d.ngay} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <span className="font-bold text-[#20342c]">{d.thu} {ngayNgan(d.ngay)}</span>
              <span className="text-[#5f6d66]">
                khoảng {soVi(d.thap)}–{soVi(d.cao)} khách · đã có vé {soVi(d.daDat)}
                {d.gioCaoDiem !== null && d.phanTramSucChua !== null
                  ? ` · ${d.gioCaoDiem}h ~${soVi(d.khachGioCaoDiem)} khách (${d.phanTramSucChua}% sức chứa giờ)`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-[#f6f9f7] p-3 text-xs leading-5 text-[#5f6d66]">
          Cách tính: trung bình cùng thứ trong bốn tuần gần nhất, nhân xu hướng bốn tuần so với bốn tuần trước đó
          (hiện {heSo >= 1 ? "+" : ""}{Math.round((heSo - 1) * 100)}%), không bao giờ thấp hơn số khách đã có vé cho ngày ấy (vé web đặt trước, và với hôm nay là cả vé quầy đã bán).
          Giờ cao điểm lấy tỉ trọng giờ đông nhất của tám tuần qua; sức chứa là ngưỡng một giờ ở điểm nghẽn
          {soLieu.sucChuaGio ? ` (${soVi(soLieu.sucChuaGio)} khách/giờ)` : ""}.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Tám tuần gần nhất</p>
          <div className="mt-4 flex gap-1.5 sm:gap-2">
            {tuan.map((t) => (
              <Cot key={t.bat} phan={t.khach / maxTuan} gia={soVi(t.khach)} nhan={ngayNgan(t.bat)} />
            ))}
          </div>
          <p className="mt-3 text-xs text-[#7c8882]">Khách qua cổng mỗi tuần, nhãn là ngày đầu tuần.</p>
        </section>

        <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Trung bình theo thứ · 4 tuần</p>
          <div className="mt-4 flex gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((thu) => (
              <Cot key={thu} phan={theoThu[thu] / maxThu} gia={soVi(theoThu[thu])} nhan={THU_NGAN[thu]} noiBat={thu === 0 || thu === 6} />
            ))}
          </div>
          <p className="mt-3 text-xs text-[#7c8882]">Dùng để xếp thêm người cho ngày đông.</p>
        </section>
      </div>

      <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Khách vào theo giờ · tám tuần</p>
        <div className="mt-4 flex gap-1 sm:gap-2">
          {soLieu.gio.map((g) => (
            <Cot key={g.gio} phan={g.khach / maxGio} gia={tongGio ? `${Math.round((g.khach / tongGio) * 100)}%` : "0"} nhan={`${g.gio}h`} noiBat={gioDong.includes(g.gio)} />
          ))}
        </div>
      </section>
    </div>
  );
}
