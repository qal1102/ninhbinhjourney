import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import { bangCongCoSo, deriveShiftPresence, type OBangCong } from "@/domain/erp-shift-presence";
import type { AttendanceEvent } from "@/lib/erp/demo-session";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

/**
 * Bảng công của cơ sở cho giám đốc và quản lý: hôm nay ai đang trong ca, và
 * 7 ngày qua từng người vào, ra lúc mấy giờ. Trước đây màn Chấm công của giám
 * đốc chỉ có ô chấm công của chính mình, nên trông như trống trơn.
 */

type Props = {
  site: ErpSite;
  directory: readonly ErpStaffDirectoryEntry[];
  attendance: readonly AttendanceEvent[];
};

const THU = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function nhanNgay(khoa: string) {
  const [y, m, d] = khoa.split("-").map(Number);
  const thu = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { thu: THU[thu], ngay: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
}

function O({ o, homNay }: { o: OBangCong | null; homNay: boolean }) {
  if (!o) {
    return <span className="text-xs text-[#9aa59f]">{homNay ? "Chưa vào" : "Nghỉ"}</span>;
  }
  return (
    <span className="inline-flex flex-col items-center leading-4">
      <span className={`text-xs font-black tabular-nums ${o.muon ? "text-[#9a4a12]" : "text-[#20342c]"}`}>{o.vao}</span>
      <span className="text-[0.7rem] tabular-nums text-[#66756e]">
        {o.ra ?? (o.dangTrongCa ? <span className="font-bold text-[#246249]">đang ca</span> : "—")}
      </span>
    </span>
  );
}

export function BangCongCoSo({ site, directory: danhBa, attendance }: Props) {
  // Chỉ người làm tại cơ sở: giám đốc, kế toán có quyền cả vùng nhưng không chấm công ở đây.
  const directory = danhBa.filter((nguoi) => nguoi.role === "employee" || nguoi.role === "manager");
  const at = new Date();
  const bang = bangCongCoSo({ directory, events: attendance, siteId: site.id, at });
  // Hôm nay đứng đầu: trên điện thoại khỏi phải kéo ngang mới thấy ngày đang làm.
  const ngay = [...bang.ngay].reverse();
  const dong = bang.dong;
  const { summary } = deriveShiftPresence({ directory, events: attendance, siteId: site.id, at });
  const homNay = ngay[0];
  const muon7 = dong.reduce((t, d) => t + d.soLanMuon, 0);
  const coMoPhong = dong.some((d) => Object.values(d.theoNgay).some((o) => o?.viTriMoPhong));

  return (
    <section
      className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
      data-testid="bang-cong-co-so"
      data-chi="bang-cong-co-so"
      data-chi-loi="Bảng công 7 ngày của cơ sở: mỗi người một dòng, ô ghi giờ vào và giờ ra; giờ vào màu cam là đi muộn sau 07:30."
    >
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Bảng công · {site.shortName}</p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">Ai đi làm, vào ra lúc nào</h2>
      <p className="mt-2 text-sm text-[#65756e]">Bảy ngày gần nhất, hôm nay đứng đầu. Giờ vào màu cam là vào sau 07:30.</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Đang trong ca", summary.onShift, "bg-[#e3f1ea] text-[#246249]"],
          ["Đã tan ca", summary.finished, "bg-[#f3f6f4] text-[#20342c]"],
          ["Chưa vào ca hôm nay", summary.notStarted, "bg-[#fdf3e6] text-[#8a5e30]"],
          ["Lượt vào muộn 7 ngày", muon7, "bg-[#f3f6f4] text-[#20342c]"],
        ].map(([nhan, so, lop]) => (
          <div key={String(nhan)} className={`rounded-xl p-4 ${lop}`}>
            <dt className="text-xs font-bold opacity-80">{nhan}</dt>
            <dd className="mt-1 text-2xl font-black tabular-nums">{so}</dd>
          </div>
        ))}
      </dl>

      {dong.length === 0 ? (
        <p className="mt-5 rounded-xl border border-[#e0e6e2] bg-[#f8faf8] p-5 text-sm text-[#65756e]">
          Chưa ai được phân công vào {site.shortName}. Cấp vai trò ở màn{" "}
          <Link href="/erp/tai-khoan" className="font-bold text-[#183f34] underline underline-offset-2">
            Tài khoản &amp; phân quyền
          </Link>
          .
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-[#e0e6e2]">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="bg-[#f6f8f7] text-[0.7rem] font-black uppercase tracking-[0.08em] text-[#5f7068]">
                <th scope="col" className="sticky left-0 z-10 bg-[#f6f8f7] px-3 py-2.5">
                  Người
                </th>
                {ngay.map((n) => {
                  const { thu, ngay: chu } = nhanNgay(n);
                  return (
                    <th key={n} scope="col" className={`px-2 py-2.5 text-center ${n === homNay ? "text-[#183f34]" : ""}`}>
                      <span className="block">{n === homNay ? "Hôm nay" : thu}</span>
                      <span className="block font-bold normal-case tracking-normal text-[#7b8881]">{chu}</span>
                    </th>
                  );
                })}
                <th scope="col" className="px-3 py-2.5 text-right">
                  7 ngày
                </th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d) => (
                <tr key={d.accountId} className="border-t border-[#e6ebe8]">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 font-normal">
                    <Link href={`/erp/ho-so/${d.accountId}`} className="block text-sm font-black text-[#20342c] underline-offset-2 hover:underline">
                      {d.displayName}
                    </Link>
                    <span className="block max-w-[11rem] truncate text-xs text-[#7b8881]">{d.jobTitle}</span>
                  </th>
                  {ngay.map((n) => (
                    <td key={n} className={`px-2 py-2.5 text-center ${n === homNay ? "bg-[#f7fbf9]" : ""}`}>
                      <O o={d.theoNgay[n]} homNay={n === homNay} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right text-xs leading-5 text-[#5f7068]">
                    <span className="block font-black text-[#20342c]">
                      {d.soNgayLam}/{ngay.length} ngày
                    </span>
                    {d.gioVaoTrungBinh ? <span className="block">vào TB {d.gioVaoTrungBinh}</span> : null}
                    {d.soLanMuon ? <span className="block font-bold text-[#9a4a12]">{d.soLanMuon} lần muộn</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {coMoPhong ? (
        <p className="mt-3 text-xs leading-5 text-[#7b8881]">Lượt chấm công mẫu ghi vị trí mô phỏng; lượt người thật bấm ghi vị trí GPS của máy.</p>
      ) : null}
    </section>
  );
}
