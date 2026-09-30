import {
  cheMaDon,
  tenThang,
  tien,
  trangThaiDon,
  type DonDaiLy,
  type DongDaiLy,
} from "@/domain/dai-ly";

/**
 * Cổng đại lý: đại lý thấy đường dẫn của mình, đơn đã ghi cho mình và hoa
 * hồng từng tháng. Dùng chung cho trang đại lý mở bằng khoá (`/dai-ly/<mã>`)
 * và cho giám đốc xem trước trong ERP. Không có tên, số điện thoại hay mã vé
 * của khách: mã đơn bị che bớt.
 */
export function DaiLyCong({
  thangNay,
  thangTruoc,
  don,
  duongGioiThieu,
  maQrSvg,
}: {
  thangNay: { thang: string; dong: DongDaiLy };
  thangTruoc: { thang: string; dong: DongDaiLy } | null;
  don: DonDaiLy[];
  duongGioiThieu: string;
  maQrSvg: string | null;
}) {
  const dl = thangNay.dong;
  return (
    <div className="mx-auto max-w-4xl" data-testid="dai-ly-cong">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">Cổng đại lý · Ninh Bình Journey</p>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">{dl.ten}</h1>
      <p className="mt-3 leading-7 text-[#4d5b55]">
        Mã <b>{dl.ma}</b> · hoa hồng <b>{String(dl.tyLe).replace(".", ",")}%</b> trên đơn khách đã qua cổng, tính theo tháng của ngày đi.
        {dl.trangThai === "tam-ngung" ? " Hợp tác đang tạm ngưng: đường dẫn chưa ghi đơn mới." : ""}
      </p>
      {dl.laMau ? (
        <p className="mt-3 inline-flex rounded-full bg-[#fdf0dc] px-3 py-1 text-xs font-bold text-[#8a5a14]">
          Đại lý mẫu: số đơn lấy từ lịch sử mẫu của hệ thống
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 rounded-3xl border border-[#d7d5cd] bg-white p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        {maQrSvg ? (
          <div
            role="img"
            aria-label="Mã QR đường dẫn giới thiệu"
            className="h-36 w-36 rounded-xl border border-[#e3e0d8] p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: maQrSvg }}
          />
        ) : null}
        <div>
          <h2 className="font-extrabold text-[#183f34]">Đường dẫn giới thiệu của bạn</h2>
          <p className="mt-2 break-all rounded-xl bg-[#f3f1ea] px-3 py-2 font-mono text-sm text-[#183f34]" data-testid="duong-gioi-thieu">
            {duongGioiThieu}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#59654b]">
            Gửi đường dẫn hay mã QR này cho khách. Khách mở rồi đặt vé trong vòng 30 ngày trên cùng máy thì đơn được ghi cho bạn.
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[thangNay, thangTruoc].map((ky, i) =>
          ky ? (
            <section key={ky.thang} className="rounded-3xl border border-[#d7d5cd] bg-white p-5" data-testid={i === 0 ? "thang-nay" : "thang-truoc"}>
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#668078]">
                {tenThang(ky.thang)} · {i === 0 ? "đang tạm tính" : ky.dong.daChi !== null ? "đã chi" : "đã khép, chờ chi"}
              </h2>
              <p className="mt-2 text-3xl font-extrabold text-[#183f34]">{tien(ky.dong.hoaHong)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-[#5c6f66]">Đơn đã trả</dt>
                  <dd className="font-bold text-[#183f34]">{ky.dong.don} đơn · {ky.dong.khach} khách</dd>
                </div>
                <div>
                  <dt className="text-[#5c6f66]">Khách đã tới</dt>
                  <dd className="font-bold text-[#183f34]">{ky.dong.donToi} đơn · {ky.dong.khachToi} khách</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#5c6f66]">Tiền đơn khách đã tới</dt>
                  <dd className="font-bold text-[#183f34]">{tien(ky.dong.doanhThuToi)}</dd>
                </div>
              </dl>
              {ky.dong.daChi !== null ? (
                <p className="mt-3 text-sm font-bold text-[#245b45]">Đã chi {tien(ky.dong.daChi)}</p>
              ) : null}
            </section>
          ) : null,
        )}
      </div>

      <section className="mt-6 rounded-3xl border border-[#d7d5cd] bg-white p-5">
        <h2 className="font-extrabold text-[#183f34]">Đơn gần đây</h2>
        {don.length === 0 ? (
          <p className="mt-2 text-sm text-[#59654b]">Chưa có đơn nào qua đường dẫn của bạn.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-[#668078]">
                <tr>
                  <th className="py-2 pr-3 font-bold">Mã đơn</th>
                  <th className="py-2 pr-3 font-bold">Ngày đi</th>
                  <th className="py-2 pr-3 font-bold">Khách</th>
                  <th className="py-2 pr-3 font-bold">Tiền đơn</th>
                  <th className="py-2 font-bold">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceae3]">
                {don.map((d) => (
                  <tr key={d.maDon}>
                    <td className="py-2 pr-3 font-mono text-[#183f34]">{cheMaDon(d.maDon)}</td>
                    <td className="py-2 pr-3">{d.ngayDi.split("-").reverse().join("/")}</td>
                    <td className="py-2 pr-3">{d.soKhach}</td>
                    <td className="py-2 pr-3">{tien(d.tien)}</td>
                    <td className={`py-2 font-bold ${d.daToi ? "text-[#245b45]" : "text-[#6b746e]"}`}>{trangThaiDon(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
