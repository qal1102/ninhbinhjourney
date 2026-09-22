import Link from "next/link";

import { loiDip, type DipSapToi } from "@/domain/lich-mua-vu";

/**
 * Lịch mùa vụ trên màn hình Marketing.
 *
 * ## Nó trả lời câu hỏi nào
 *
 * Màn hình Marketing trước đây chỉ làm được **một** việc: đổi đích của mã QR
 * đã in. Đó là một cái tua vít, không phải một cuốn lịch. Chủ dự án hỏi đúng
 * chỗ thiếu: *"các đại lễ Phật đản hoặc lễ lớn đều nên có ở đây hết, event
 * liên tục để bắt đầu xu thế"*.
 *
 * Khối này trả lời: **ba tháng nữa có gì, và dịp nào đã tới lúc phải bắt tay
 * vào làm.** Ngày của các dịp âm lịch được tính ra cho đúng năm đang xem
 * (`domain/am-lich.ts`), nên cuốn lịch này dùng được cho mọi năm chứ không
 * phải một bảng chép tay hết hạn sau mười hai tháng.
 *
 * ## Vì sao mỗi dịp có một cái nút
 *
 * Biết mà không làm gì thì cuốn lịch chỉ là tờ áp phích. Nút "Mở chiến dịch
 * cho dịp này" đưa thẳng xuống ô tạo chiến dịch với tên đã điền sẵn — người
 * dùng chỉ việc bấm lưu. Không có bảng mới, không có kho dữ liệu mới: chiến
 * dịch nháp vốn đã là chỗ để ghi ý tưởng.
 */

function ngayDoc(iso: string) {
  const [nam, thang, ngay] = iso.split("-");
  return `${ngay}.${thang}.${nam}`;
}

function goiYTen(d: DipSapToi) {
  return `${d.dip.ten} ${d.ngayBatDau.slice(0, 4)}`;
}

export function LichMuaVuPanel({ lich }: { lich: readonly DipSapToi[] }) {
  const canLam = lich.filter((d) => d.trangThai !== "con-xa");
  const conXa = lich.filter((d) => d.trangThai === "con-xa");

  return (
    <section
      data-testid="lich-mua-vu"
      className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-5 sm:p-7"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
        Lịch mùa vụ · mười hai tháng tới
      </p>
      <h2 className="font-display mt-2 text-3xl text-[#3d3325] sm:text-4xl">
        {canLam.length > 0
          ? `${canLam.length} dịp đã tới lúc bắt tay vào làm`
          : "Chưa dịp nào tới hạn chuẩn bị"}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6250]">
        Ngày của các dịp âm lịch được tính cho đúng năm, không chép tay. Mỗi dịp
        ghi luôn mốc phải bắt đầu chuẩn bị — biết ngày khai hội mà biết muộn thì
        cũng bằng không. Bấm vào một dịp để mở sẵn chiến dịch nháp cho nó.
      </p>

      {/*
        Hai nhóm, hai mật độ. Mười hai dịp dựng thành mười hai thẻ đầy đủ thì
        khối này cao gần 1.800px và người dùng phải cuộn qua cả năm mới thấy
        hết — đúng cái bệnh "nhiều quá, hiển thị chưa được đẹp" đã phải sửa ở
        các màn ERP khác. Dịp cần làm ngay thì dựng thẻ, dịp còn xa thì một
        dòng là đủ, nhưng **vẫn ở lại trong danh sách** vì chủ dự án muốn nhìn
        thấy cả năm.
      */}
      {canLam.length > 0 ? (
        <ol className="mt-6 space-y-3">
          {canLam.map((d) => (
            <li
              key={d.dip.id}
              data-dip={d.dip.id}
              data-trang-thai={d.trangThai}
              className="rounded-2xl border border-[#d7c69c] bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-black text-[#3d3325]">
                  {ngayDoc(d.ngayBatDau)}
                  {d.ngayKetThuc !== d.ngayBatDau ? ` – ${ngayDoc(d.ngayKetThuc)}` : ""}
                </span>
                {d.dip.lich === "am" ? (
                  <span className="rounded-full bg-[#f0e6d0] px-2 py-0.5 text-xs font-bold text-[#7a6228]">
                    {d.dip.ngay}/{d.dip.thang} âm lịch
                  </span>
                ) : null}
                <span
                  className={`text-xs font-bold ${
                    d.trangThai === "dang-dien-ra" ? "text-[#28654d]" : "text-[#9a5a1f]"
                  }`}
                >
                  {loiDip(d)}
                </span>
              </div>

              <h3 className="mt-2 text-xl font-black text-[#3d3325]">{d.dip.ten}</h3>
              {d.dip.noi ? (
                <p className="text-xs font-bold text-[#8a8171]">{d.dip.noi}</p>
              ) : null}
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6250]">
                {d.dip.yNghia}
              </p>
              {d.dip.nguon ? (
                <p className="mt-2 text-xs italic text-[#8a8171]">Nguồn: {d.dip.nguon}</p>
              ) : null}

              <Link
                href={`/erp/marketing?dip=${encodeURIComponent(d.dip.id)}#tao-chien-dich`}
                prefetch={false}
                className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#d7c69c] bg-white px-4 text-sm font-black text-[#6b5520] transition hover:border-[#b79b56] hover:bg-[#fffaf0]"
              >
                Mở chiến dịch cho dịp này
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {conXa.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#8a8171]">
            Còn xa, để biết trước
          </p>
          <ol className="mt-3 divide-y divide-[#ece3d4] border-y border-[#ece3d4]">
            {conXa.map((d) => (
              <li
                key={d.dip.id}
                data-dip={d.dip.id}
                data-trang-thai={d.trangThai}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
              >
                <span className="w-[10.5rem] shrink-0 text-sm font-black text-[#3d3325]">
                  {ngayDoc(d.ngayBatDau)}
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-[#4a4133]">
                  {d.dip.ten}
                  {d.dip.lich === "am" ? (
                    <span className="ml-2 text-xs font-medium text-[#8a8171]">
                      {d.dip.ngay}/{d.dip.thang} âm lịch
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-[#8a8171]">còn {d.conBaoNhieuNgay} ngày</span>
                <Link
                  href={`/erp/marketing?dip=${encodeURIComponent(d.dip.id)}#tao-chien-dich`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-black text-[#6b5520] underline underline-offset-4 hover:text-[#8a6b27]"
                >
                  Mở chiến dịch
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[#8a8171]">
            Mỗi dịp ở đây đều có mốc phải bắt đầu chuẩn bị riêng; tới hạn thì nó
            tự chuyển lên nhóm trên.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export { goiYTen };
