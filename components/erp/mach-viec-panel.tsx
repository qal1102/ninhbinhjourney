"use client";

import Link from "next/link";
import { useState } from "react";

import { ERP_ROLE_LABELS, type ErpRole, type ErpSiteId } from "@/domain/erp";
import {
  buocChinh,
  buocKeTiep,
  buocNhanh,
  dangChoAi,
  demTheoBuoc,
  denLuotVai,
  hrefCuaBuoc,
  type MachViec,
  type MachViecBuoc,
} from "@/domain/erp-mach-viec";

/**
 * Dải mạch việc — trả lời ba câu mà mọi màn hình ERP trước nay im lặng:
 * *tôi đang ở khúc nào, số trước mặt ở đâu ra, làm xong thì ai cầm tiếp.*
 *
 * ## Vì sao gập lại sẵn
 *
 * Người đã quen việc mở màn này ra là để làm, không phải để đọc. Dải chỉ
 * chiếm một khối ngắn: tên luồng, câu "có việc chờ bạn hay không", và hàng
 * số đếm từng bước. Ai cần hiểu thì bấm một cái để mở cả mạch.
 *
 * ## Vì sao không có đèn rọi trỏ vào nút
 *
 * Kiểu hướng dẫn nổi lên trên, trỏ vào toạ độ một nút cụ thể, vỡ ngay lần
 * đầu ai đó đổi bố cục — riêng trong ngày 21/09 đã có hai màn bị xếp lại.
 * Lời dẫn ở đây nằm **trong trang**, đọc từ cùng nguồn dữ liệu mà màn hình
 * đang đọc, nên không có gì để lệch.
 */

function nhanVai(role: ErpRole) {
  return ERP_ROLE_LABELS[role];
}

function ChipBuoc({
  buoc,
  so,
  denLuot,
}: {
  buoc: MachViecBuoc;
  so: number;
  denLuot: boolean;
}) {
  // Bước không giữ hồ sơ nào thì KHÔNG in số 0: sáu con số 0 xếp hàng chỉ là
  // tiếng ồn, và "1 0" đọc thoáng qua rất dễ thành "mười". Chỉ bước đang giữ
  // hồ sơ mới đeo thêm một viên số.
  const nhan = buoc.thuTu === null ? "Rẽ" : String(buoc.thuTu);
  return (
    <span
      data-testid="mach-viec-chip"
      data-so={so}
      className={[
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border py-1 pl-2.5 text-sm",
        so > 0 ? "pr-1.5" : "pr-2.5",
        denLuot && so > 0
          ? "border-[#b98a3a] bg-[#fdf6e8] font-black text-[#7a5a1f]"
          : so > 0
            ? "border-[#c9dceb] bg-[#f4f9fc] font-bold text-[#2f4a5a]"
            : "border-[#e2e8e5] bg-white text-[#78857f]",
      ].join(" ")}
      title={`${buoc.ten} · ${dangChoAi(buoc, nhanVai)}`}
    >
      <span className="font-black">{nhan}</span>
      {so > 0 ? (
        <span
          className={[
            "inline-flex min-w-5 justify-center rounded-md px-1 text-sm font-black tabular-nums",
            denLuot ? "bg-[#b98a3a] text-white" : "bg-[#2f6f8f] text-white",
          ].join(" ")}
        >
          {so}
        </span>
      ) : null}
    </span>
  );
}

export function MachViecPanel({
  mach,
  siteId,
  trangThai,
  viewerRole,
  dangODay,
}: {
  mach: MachViec;
  /** Cơ sở đang mở — dùng để dựng đường dẫn tới màn của từng bước. */
  siteId: ErpSiteId;
  /** Trạng thái của những hồ sơ màn hình này đang cầm. */
  trangThai: readonly string[];
  viewerRole: ErpRole;
  /**
   * Đường dẫn của chính màn đang mở. Bước nào trỏ về đây thì nói "bạn đang
   * đứng ở đây" thay vì mời bấm một liên kết dẫn về chỗ cũ — một liên kết
   * không đi đâu cả làm người đọc tưởng mình bấm hỏng.
   */
  dangODay?: string;
}) {
  const [moRong, setMoRong] = useState(false);
  const dem = demTheoBuoc(mach, trangThai);
  const chinh = buocChinh(mach);
  const nhanh = buocNhanh(mach);

  const choMinh = mach.buoc
    .filter((buoc) => denLuotVai(buoc, viewerRole) && (dem.get(buoc.id) ?? 0) > 0)
    .map((buoc) => ({ buoc, so: dem.get(buoc.id) ?? 0 }));
  const tongChoMinh = choMinh.reduce((tong, m) => tong + m.so, 0);

  return (
    <section
      data-testid="mach-viec"
      data-mach={mach.id}
      className="mb-6 rounded-2xl border border-[#c9dceb] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-black text-[#1f2f2a]">
          <span className="text-[#2f6f8f]">Mạch việc · </span>
          {mach.ten}
          <span className="font-bold text-[#5f7068]"> · {chinh.length} bước</span>
        </p>
        <button
          type="button"
          onClick={() => setMoRong((truoc) => !truoc)}
          data-testid="mach-viec-toggle"
          aria-expanded={moRong}
          className="inline-flex min-h-11 items-center rounded-lg border border-[#c9dceb] bg-[#f4f9fc] px-4 text-sm font-black text-[#2f6f8f]"
        >
          {moRong ? "Thu lại" : "Xem cả mạch"}
        </button>
      </div>

      <p
        data-testid="mach-viec-cho-minh"
        className={
          tongChoMinh > 0
            ? "mt-2 text-sm font-black leading-6 text-[#7a5a1f]"
            : "mt-2 text-sm leading-6 text-[#5f7068]"
        }
      >
        {tongChoMinh > 0 ? (
          <>
            Đang chờ bạn:{" "}
            {choMinh
              .map(
                ({ buoc, so }) =>
                  `${so} hồ sơ ở ${buoc.thuTu === null ? "nhánh" : `bước ${buoc.thuTu}`} — ${buoc.ten}`,
              )
              .join(" · ")}
          </>
        ) : (
          <>Không có hồ sơ nào đang chờ bạn ở màn này.</>
        )}
      </p>

      {/* Hàng số đếm: bước nào đang giữ bao nhiêu hồ sơ. Cho xuống dòng được
          nên khổ hẹp không bao giờ tràn ngang. */}
      <p className="mt-2 text-sm text-[#78857f]">Hồ sơ đang nằm ở đâu:</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {chinh.map((buoc) => (
          <ChipBuoc
            key={buoc.id}
            buoc={buoc}
            so={dem.get(buoc.id) ?? 0}
            denLuot={denLuotVai(buoc, viewerRole)}
          />
        ))}
        {nhanh.map((buoc) => (
          <ChipBuoc
            key={buoc.id}
            buoc={buoc}
            so={dem.get(buoc.id) ?? 0}
            denLuot={denLuotVai(buoc, viewerRole)}
          />
        ))}
      </div>

      {moRong ? (
        <div data-testid="mach-viec-chi-tiet" className="mt-4">
          <p className="text-sm leading-6 text-[#5f7068]">{mach.motCau}</p>

          <ol className="mt-3 space-y-3">
            {chinh.map((buoc) => {
              const so = dem.get(buoc.id) ?? 0;
              const ke = buocKeTiep(mach, buoc);
              return (
                <li
                  key={buoc.id}
                  data-testid="mach-viec-buoc"
                  className={[
                    "rounded-xl border p-4",
                    denLuotVai(buoc, viewerRole)
                      ? "border-[#e0cfa8] bg-[#fdf9f1]"
                      : "border-[#d9e6ee] bg-[#f8fbfd]",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-base font-black text-[#1f2f2a]">
                      {buoc.thuTu}. {buoc.ten}
                    </span>
                    <span className="text-sm font-bold text-[#4a5a52]">
                      {so > 0 ? `${so} hồ sơ đang ở đây` : "chưa có hồ sơ nào"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#4a5a52]">
                    Ai làm: <strong className="font-black">{dangChoAi(buoc, nhanVai)}</strong>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#42554c]">
                    <span className="font-black">Dữ liệu từ đâu: </span>
                    {buoc.nguonVao}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#42554c]">
                    <span className="font-black">Làm xong thì có gì: </span>
                    {buoc.ketQua}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {hrefCuaBuoc(buoc, siteId) === dangODay ? (
                      <span
                        data-testid="mach-viec-dang-o-day"
                        className="inline-flex min-h-11 items-center font-black text-[#3d6b50]"
                      >
                        Bạn đang đứng ở đây
                      </span>
                    ) : (
                      <Link
                        href={hrefCuaBuoc(buoc, siteId)}
                        className="inline-flex min-h-11 items-center font-black text-[#2f6f8f] underline"
                      >
                        Mở màn làm bước này
                      </Link>
                    )}
                    {ke ? (
                      <span className="text-[#5f7068]">
                        Xong rồi sang bước {ke.thuTu} — {ke.ten}
                      </span>
                    ) : (
                      <span className="text-[#5f7068]">Đây là bước cuối của mạch.</span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>

          {nhanh.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-black text-[#5f7068]">Nhánh rẽ</p>
              <ul className="mt-2 space-y-2">
                {nhanh.map((buoc) => (
                  <li
                    key={buoc.id}
                    data-testid="mach-viec-nhanh"
                    className="rounded-xl border border-[#e6d7c9] bg-[#fdf8f2] p-4"
                  >
                    <p className="text-base font-black text-[#1f2f2a]">{buoc.ten}</p>
                    <p className="mt-1 text-sm text-[#4a5a52]">
                      Ai làm: <strong className="font-black">{dangChoAi(buoc, nhanVai)}</strong> ·{" "}
                      {dem.get(buoc.id) ?? 0} hồ sơ đang ở đây
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#42554c]">
                      <span className="font-black">Khi nào rẽ vào đây: </span>
                      {buoc.nguonVao}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#42554c]">
                      <span className="font-black">Rồi đi đâu tiếp: </span>
                      {buoc.ketQua}
                    </p>
                    {hrefCuaBuoc(buoc, siteId) === dangODay ? (
                      <span className="mt-2 inline-flex min-h-11 items-center text-sm font-black text-[#3d6b50]">
                        Bạn đang đứng ở đây
                      </span>
                    ) : (
                      <Link
                        href={hrefCuaBuoc(buoc, siteId)}
                        className="mt-2 inline-flex min-h-11 items-center text-sm font-black text-[#2f6f8f] underline"
                      >
                        Mở màn làm bước này
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
