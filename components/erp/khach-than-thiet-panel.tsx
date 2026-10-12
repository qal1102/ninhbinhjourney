import { MOC_THUONG, type TongQuanThanThiet } from "@/domain/khach-than-thiet";

function ngay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(d);
}

const NHAN_TIEP_THI: Record<string, string> = {
  granted: "Nhận tin",
  denied: "Không nhận tin",
  revoked: "Đã thôi nhận",
};

/**
 * Khách thân thiết trên màn Khách hàng (migration 119): bao nhiêu khách đã để
 * lại số, bao nhiêu đến từ vé đoàn, bao nhiêu đồng ý nhận tin, quà đã cấp và
 * đã đổi. Danh sách chỉ có ba số cuối điện thoại, không có số đầy đủ.
 */
export function KhachThanThietPanel({ tongQuan }: { tongQuan: TongQuanThanThiet | null }) {
  return (
    <section className="mt-6 rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6" data-testid="khach-than-thiet" data-chi="khach-than-thiet" data-chi-loi="Số khách đã để lại số, quà đã cấp và đã đổi.">
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Khách thân thiết</p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">Khách để lại số điện thoại, đi lần nào tích lần ấy</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c6f67]">
        Khách quét mã vé của mình (người trong đoàn quét mã riêng) hoặc quầy gõ số hộ, rồi tích hai ô tách riêng: dùng số
        để giữ vé, và nhận tin ưu đãi. Mốc quà:{" "}
        {MOC_THUONG.map((m) => `${m.visits} lượt ${m.reward.toLocaleLowerCase("vi")}`).join(", ")}.
      </p>
      {!tongQuan ? (
        <p className="mt-4 rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
          Chưa đọc được phần khách thân thiết ở môi trường này (kho chưa nối hoặc migration 119 chưa áp).
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Khách đã để số", tongQuan.customers],
              ["Từ vé đoàn", tongQuan.fromGroups],
              ["Đồng ý nhận tin", tongQuan.marketingGranted],
              ["Quà đã cấp / đã đổi", `${tongQuan.vouchersIssued} / ${tongQuan.vouchersRedeemed}`],
            ].map(([nhan, so]) => (
              <div key={String(nhan)} className="rounded-xl bg-[#f3f6f4] p-3">
                <dt className="text-xs font-bold text-[#5c6f67]">{nhan}</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums text-[#20342c]">{so}</dd>
              </div>
            ))}
          </dl>
          {tongQuan.top.length === 0 ? (
            <p className="mt-4 text-sm text-[#6e7b75]">Chưa khách nào để lại số. Quầy gắn số ngay dưới phiếu vừa bán.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[#d8e0db] text-left text-xs text-[#5c6f67]">
                    <th className="py-2 pr-3 font-bold">Khách</th>
                    <th className="py-2 pr-3 text-right font-bold">Lượt đi</th>
                    <th className="py-2 pr-3 text-right font-bold">Mã đã gắn</th>
                    <th className="py-2 pr-3 text-right font-bold">Quà chưa đổi</th>
                    <th className="py-2 pr-3 font-bold">Tiếp thị</th>
                    <th className="py-2 font-bold">Gắn gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {tongQuan.top.map((k, i) => (
                    <tr key={`${k.contactHint}-${i}`} className="border-b border-[#eef1ef]">
                      <td className="py-2 pr-3 font-mono font-bold text-[#20342c]">•••{k.contactHint}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{k.visits}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{k.codes}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{k.vouchersOpen}</td>
                      <td className="py-2 pr-3">{NHAN_TIEP_THI[k.marketing] ?? k.marketing}</td>
                      <td className="py-2">{ngay(k.lastLinkedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
