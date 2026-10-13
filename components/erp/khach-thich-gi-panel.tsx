import Link from "next/link";
import {
  goiYTuSo,
  heSoCuoiTuan,
  SO_TOI_THIEU,
  soHienThi,
  TEN_DAT_TRUOC,
  TEN_LOAI_NHOM,
  tenThu,
  type KhachThichGi,
} from "@/domain/khach-thich-gi";

function ngayNgan(iso: string) {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

function tien(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return `${value.toLocaleString("vi-VN")} đ`;
}

function Thanh({ nhan, phanTram, phu }: { nhan: string; phanTram: number; phu: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold text-[#203a30]">{nhan}</span>
        <span className="shrink-0 tabular-nums text-[#4f5f57]">{phu}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e8eee9]" aria-hidden="true">
        <div className="h-full rounded-full bg-[#3f7a64]" style={{ width: `${Math.max(2, Math.min(100, phanTram))}%` }} />
      </div>
    </li>
  );
}

const GIO_HIEN = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/**
 * Khách thích gì (13/10/2026, migration 126): số gộp cho giám đốc và bộ phận
 * khách hàng, kèm việc nên làm rút từ số. Không có tên hay số điện thoại nào.
 */
export function KhachThichGiPanel({ so }: { so: KhachThichGi | null }) {
  if (!so) {
    return (
      <section data-testid="khach-thich-gi" className="mb-6 rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-[#203a30]">Khách thích gì</h2>
        <p className="mt-2 text-sm text-[#4f5f57]">Chưa đọc được số từ kho. Thử tải lại trang sau ít phút.</p>
      </section>
    );
  }
  const goiY = goiYTuSo(so);
  const tongDat = so.datTruoc.reduce((c, m) => c + m.so, 0);
  const tongQuet = so.gio.reduce((c, g) => c + g.tong, 0);
  const thuMax = Math.max(1, ...Object.values(so.thu));
  const cuoiTuan = heSoCuoiTuan(so.thu);
  const tongKhach = so.nguoiLon + so.treEm;

  return (
    <section
      data-testid="khach-thich-gi"
      aria-labelledby="khach-thich-gi-tieu-de"
      data-chi="khach-thich-gi"
      data-chi-loi="Số gộp về khách: đi cùng ai, mua gì, giờ nào đông, đặt trước bao lâu; trên cùng là việc nên làm."
      className="mb-6 rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5b7c6e]">
        {ngayNgan(so.tu)} – {ngayNgan(so.den)} · {so.soNgay} ngày
      </p>
      <h2 id="khach-thich-gi-tieu-de" className="mt-1 text-2xl font-black text-[#203a30]">Khách thích gì</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f5f57]">
        Gộp từ {soHienThi(so.luotMua)} lượt mua ở quầy và trên web ({soHienThi(tongKhach)} khách) và {soHienThi(tongQuet)} lượt qua cổng.
        Chỉ có số gộp, không nhận ra được khách nào; nhóm dưới {SO_TOI_THIEU} lượt không ghi số.
      </p>

      {goiY.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-[#173f34] p-4 text-white sm:p-5" data-testid="khach-thich-gi-goi-y">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#b9d5ca]">Việc nên làm</h3>
          <ol className="mt-3 grid gap-3 lg:grid-cols-2">
            {goiY.map((g, i) => (
              <li key={g.tieuDe} className="rounded-xl bg-white/[0.07] p-4">
                <p className="font-black">
                  <span className="mr-2 text-[#e7c78d]">{i + 1}.</span>
                  {g.tieuDe}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#d4e4de]">{g.viec}</p>
                {g.lienKet ? (
                  <Link href={g.lienKet.href} className="mt-2 inline-flex min-h-10 items-center text-sm font-black text-[#e7c78d] underline-offset-2 hover:underline">
                    {g.lienKet.nhan} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[#e3e8e4] p-4">
          <h3 className="font-black text-[#203a30]">Đi cùng ai</h3>
          <p className="text-xs text-[#5f6f67]">Mỗi lượt mua ở quầy hay đơn web là một nhóm.</p>
          <ul className="mt-3 space-y-3" data-testid="khach-thich-gi-nhom">
            {so.nhom.map((n) => (
              <Thanh key={n.loai} nhan={TEN_LOAI_NHOM[n.loai]} phanTram={n.phanTram} phu={n.luot < SO_TOI_THIEU ? "dưới 5" : `${n.phanTram}% · ${n.luot.toLocaleString("vi-VN")} lượt`} />
            ))}
          </ul>
          {tongKhach >= SO_TOI_THIEU ? (
            <p className="mt-3 text-sm text-[#4f5f57]">
              Trẻ em chiếm {Math.round((so.treEm / Math.max(1, tongKhach)) * 100)}% số khách.
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-[#e3e8e4] p-4">
          <h3 className="font-black text-[#203a30]">Đặt trên web trước bao lâu</h3>
          <p className="text-xs text-[#5f6f67]">Từ lúc đặt tới ngày đi, {soHienThi(tongDat)} đơn web.</p>
          <ul className="mt-3 space-y-3">
            {so.datTruoc.map((m) => (
              <Thanh key={m.muc} nhan={TEN_DAT_TRUOC[m.muc]} phanTram={m.phanTram} phu={m.so < SO_TOI_THIEU ? "dưới 5" : `${m.phanTram}% · ${m.so.toLocaleString("vi-VN")} đơn`} />
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[#e3e8e4] p-4 lg:col-span-2">
          <h3 className="font-black text-[#203a30]">Giờ nào đông, theo lượt qua cổng</h3>
          <p className="text-xs text-[#5f6f67]">Cột cao là giờ đông; chữ dưới mỗi cơ sở là giờ đông nhất và vắng nhất trong 7–16 giờ.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="khach-thich-gi-gio">
            {so.gio.map((g) => {
              const max = Math.max(1, ...GIO_HIEN.map((h) => g.theoGio[h] ?? 0));
              return (
                <div key={g.siteId} className="min-w-0">
                  <p className="text-sm font-black text-[#203a30]">{g.ten}</p>
                  <div className="mt-2 flex h-20 items-end gap-[3px]" aria-hidden="true">
                    {GIO_HIEN.map((h) => {
                      const v = g.theoGio[h] ?? 0;
                      const dinh = h === g.gioDong;
                      const vang = h === g.gioVang;
                      return (
                        <div
                          key={h}
                          title={`${h} giờ: ${v.toLocaleString("vi-VN")} lượt`}
                          className={`flex-1 rounded-t ${dinh ? "bg-[#c2672f]" : vang ? "bg-[#7fb39d]" : "bg-[#c9d8d0]"}`}
                          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-[#7a8a82]" aria-hidden="true">
                    <span>7h</span>
                    <span>12h</span>
                    <span>17h</span>
                  </div>
                  <p className="mt-1 text-xs text-[#4f5f57]">
                    {g.gioDong !== null ? <>Đông nhất <strong>{g.gioDong} giờ</strong></> : null}
                    {g.gioVang !== null ? <> · vắng nhất <strong>{g.gioVang} giờ</strong></> : null}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-xl border border-[#e3e8e4] p-4">
          <h3 className="font-black text-[#203a30]">Thứ nào đông</h3>
          <p className="text-xs text-[#5f6f67]">
            Lượt qua cổng theo thứ trong tuần{cuoiTuan ? `; cuối tuần gấp ${cuoiTuan.toLocaleString("vi-VN")} lần ngày thường` : ""}.
          </p>
          <ul className="mt-3 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Thanh key={d} nhan={tenThu(d)} phanTram={((so.thu[d] ?? 0) / thuMax) * 100} phu={soHienThi(so.thu[d] ?? 0)} />
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[#e3e8e4] p-4">
          <h3 className="font-black text-[#203a30]">Mua gì trên web</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5f6f67]">
                  <th className="py-1 pr-2 font-bold">Gói / vé</th>
                  <th className="py-1 pr-2 text-right font-bold">Đơn</th>
                  <th className="py-1 pr-2 text-right font-bold">Có trẻ</th>
                  <th className="py-1 text-right font-bold">Tiền</th>
                </tr>
              </thead>
              <tbody>
                {so.goi.map((g) => (
                  <tr key={g.slug} className="border-t border-[#eef1ee]">
                    <td className="py-2 pr-2 font-bold text-[#203a30]">{g.ten}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{soHienThi(g.don)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{g.khach >= SO_TOI_THIEU ? `${Math.round((g.treEm / Math.max(1, g.khach)) * 100)}%` : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{g.don < SO_TOI_THIEU ? "—" : tien(g.tien)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#f3f6f4] p-2">
              <dt className="text-[11px] text-[#5f6f67]">Đặt từ 2 lần</dt>
              <dd className="font-black tabular-nums text-[#203a30]">
                {so.hoSoWeb >= SO_TOI_THIEU ? `${Math.round((so.hoSoTuHaiDon / so.hoSoWeb) * 100)}%` : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-[#f3f6f4] p-2">
              <dt className="text-[11px] text-[#5f6f67]">Qua đại lý</dt>
              <dd className="font-black tabular-nums text-[#203a30]">{so.kenh.daiLy === 0 ? "0" : soHienThi(so.kenh.daiLy)}</dd>
            </div>
            <div className="rounded-lg bg-[#f3f6f4] p-2">
              <dt className="text-[11px] text-[#5f6f67]">Dùng mã mời</dt>
              <dd className="font-black tabular-nums text-[#203a30]">{so.kenh.maMoi === 0 ? "0" : soHienThi(so.kenh.maMoi)}</dd>
            </div>
          </dl>
        </article>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#6b7a72]">
        Chưa có: khách đi tiếp điểm nào sau khi rời một điểm. Vé quầy không gắn với người mua, nên chỉ đo được khi khách gắn số tích lượt;
        càng nhiều khách gắn số, mục này càng có số.
      </p>
    </section>
  );
}
