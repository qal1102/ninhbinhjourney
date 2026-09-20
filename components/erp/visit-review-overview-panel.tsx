import { DESTINATIONS } from "@/content/destinations";
import { VisitReviewModerationAction } from "@/components/erp/visit-review-moderation-action";
import { canModerateReviews, MODERATION_COPY, remainingQuota } from "@/domain/visit-review-moderation";
import type { ErpRole } from "@/domain/erp";
import {
  duLoiDeKetLuan,
  noiDangTut,
  noiHayMaItNguoiBiet,
  OVERVIEW_MIN_REVIEWS,
  vietDiem,
  type SiteReviewOverview,
} from "@/domain/visit-review-overview";

/**
 * TC-12 mục 2 — "Khách đã tới nói gì" trên màn hình Khách hàng của ERP.
 *
 * Bảng này chỉ nói ba điều, theo đúng thứ tự người điều hành cần: nơi nào đang
 * tụt, nơi nào hay mà ít người biết, rồi mới tới con số từng cơ sở. Không tên
 * khách, không mã khách — người điều hành cần biết cơ sở nào tụt, không cần
 * biết ai chấm.
 */

function tenCoSo(siteId: string): string {
  return DESTINATIONS.find((item) => item.id === siteId)?.name.vi ?? "Cơ sở khác";
}

function Sao({ rating }: { rating: number }) {
  return (
    <span className="text-sm text-[#b8860b]" aria-label={`${rating} sao`}>
      <span aria-hidden>{"★".repeat(rating)}</span>
    </span>
  );
}

export function VisitReviewOverviewPanel({
  rows,
  fromLabel,
  toLabel,
  viewerRole,
  hidesUsedIn30Days = 0,
}: {
  rows: SiteReviewOverview[];
  fromLabel: string;
  toLabel: string;
  /** TC-12 mục 3 — vai người đang xem, quyết định có nút ẩn hay không. */
  viewerRole?: ErpRole;
  hidesUsedIn30Days?: number;
}) {
  const duocKiemDuyet = viewerRole ? canModerateReviews(viewerRole) : false;
  const conLai = viewerRole ? remainingQuota(viewerRole, hidesUsedIn30Days) : 0;
  const coLoi = rows.filter((row) => row.reviewCount > 0);
  const dangTut = noiDangTut(rows);
  const itNguoiBiet = noiHayMaItNguoiBiet(rows);

  return (
    <section
      data-testid="visit-review-overview"
      className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
        Khách đã tới nói gì · {fromLabel} – {toLabel}
      </p>
      <h2 className="mt-1 text-lg font-black text-[#1f2f2a]">Bảng điểm từ người đã qua cổng</h2>
      <p className="mt-1 text-xs leading-5 text-[#5f7068]">
        Mỗi lời ở đây gắn với một lượt vào cổng có thật, nên không ai chấm hộ được. Bảng chỉ kết luận
        khi một cơ sở đã có từ {OVERVIEW_MIN_REVIEWS} lời trở lên.
      </p>

      {coLoi.length === 0 ? (
        <p data-testid="visit-review-overview-empty" className="mt-4 text-sm text-[#5f7068]">
          Kỳ này chưa có khách nào kể lại. Khách chỉ chấm được sau khi đã qua cổng, nên số lời sẽ
          theo sau lượt khách thật.
        </p>
      ) : (
        <>
          {dangTut.length > 0 ? (
            <div
              data-testid="visit-review-overview-tut"
              className="mt-4 rounded-xl border border-[#e6c9c9] bg-[#fdf2f2] p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#9b4a4a]">
                Cần nhìn ngay
              </p>
              <ul className="mt-2 space-y-1">
                {dangTut.map((row) => (
                  <li key={row.siteId} className="text-sm text-[#4a2f2f]">
                    <strong className="font-black">{tenCoSo(row.siteId)}</strong> đang ở{" "}
                    {vietDiem(row.average)}/5 sau {row.reviewCount} lời.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {itNguoiBiet.length > 0 ? (
            <div
              data-testid="visit-review-overview-it-nguoi-biet"
              className="mt-3 rounded-xl border border-[#cfe0d4] bg-[#f2f8f4] p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#3d6b50]">
                Hay mà ít người biết
              </p>
              <ul className="mt-2 space-y-1">
                {itNguoiBiet.map((row) => (
                  <li key={row.siteId} className="text-sm text-[#2f4a39]">
                    <strong className="font-black">{tenCoSo(row.siteId)}</strong> được{" "}
                    {vietDiem(row.average)}/5 mà chỉ {row.entryCount.toLocaleString("vi-VN")} lượt vào
                    trong kỳ.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            Trên điện thoại, bảng bốn cột bị cắt mất cột cuối — nhìn tưởng lỗi.
            Khổ hẹp xếp chồng từng cơ sở, khổ rộng mới dựng bảng.
          */}
          <ul data-testid="visit-review-overview-list" className="mt-4 space-y-2 sm:hidden">
            {rows.map((row) => (
              <li
                key={row.siteId}
                className="flex items-baseline justify-between gap-3 border-b border-[#eef2ef] pb-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[#1f2f2a]">{tenCoSo(row.siteId)}</span>
                  <span className="mt-0.5 block text-xs text-[#5f7068]">
                    {row.reviewCount.toLocaleString("vi-VN")} lời ·{" "}
                    {row.entryCount.toLocaleString("vi-VN")} lượt vào
                  </span>
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums text-[#1f2f2a]">
                  {duLoiDeKetLuan(row) ? `${vietDiem(row.average)}/5` : "chưa đủ"}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#dbe2de] text-left text-xs uppercase tracking-[0.12em] text-[#5f7068]">
                  <th scope="col" className="py-2 pr-3 font-black">Cơ sở</th>
                  <th scope="col" className="py-2 pr-3 text-right font-black">Điểm</th>
                  <th scope="col" className="py-2 pr-3 text-right font-black">Số lời</th>
                  <th scope="col" className="py-2 text-right font-black">Lượt vào</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.siteId} className="border-b border-[#eef2ef]">
                    <td className="py-2 pr-3 font-bold text-[#1f2f2a]">{tenCoSo(row.siteId)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#1f2f2a]">
                      {duLoiDeKetLuan(row) ? `${vietDiem(row.average)}/5` : "chưa đủ"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#4a5a52]">
                      {row.reviewCount.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#4a5a52]">
                      {row.entryCount.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {coLoi.some((row) => row.recentVoices.length > 0) ? (
            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#5f7068]">
                Lời gần đây
              </p>
              {duocKiemDuyet ? (
                <p className="mt-1 text-xs text-[#6b786f]">
                  {MODERATION_COPY.conLai(conLai)} Lời đã ẩn vẫn nằm trong kho và truy lại được; không ai xoá hẳn được một lời khách.
                </p>
              ) : null}
              <ul className="mt-2 space-y-3">
                {coLoi.flatMap((row) =>
                  row.recentVoices.slice(0, 3).map((voice, index) => (
                    <li key={`${row.siteId}-${index}`} className="border-t border-[#eef2ef] pt-2">
                      <p className="text-xs font-bold text-[#5f7068]">{tenCoSo(row.siteId)}</p>
                      <Sao rating={voice.rating} />
                      <p className="mt-1 text-sm leading-6 text-[#2f3d37]">{voice.comment}</p>
                      {duocKiemDuyet ? <VisitReviewModerationAction reviewId={voice.id} /> : null}
                    </li>
                  )),
                )}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
