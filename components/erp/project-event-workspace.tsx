import { ERP_PROJECT_EVENTS } from "@/domain/erp-operating-data";
import type { ErpSite } from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

type Props = { site: ErpSite; user: CurrentErpUser };

const workBySite = {
  "trang-an": [
    ["EV-TA-041", "Phê duyệt phương án phân luồng 35.000 khách", "Ban vận hành", "Hạn 29/07", "Khẩn"],
    ["EV-TA-038", "Chốt hợp đồng sân khấu và ánh sáng", "Phòng mua sắm", "Chậm 2 ngày", "Chậm"],
    ["EV-TA-032", "Diễn tập y tế, cứu hộ và thất lạc trẻ em", "An ninh & y tế", "02/08", "Đúng hạn"],
  ],
  "tam-chuc": [
    ["EV-TC-026", "Nghiệm thu tải trọng sân khấu mặt nước", "Kỹ thuật", "Hạn 04/08", "Khẩn"],
    ["EV-TC-021", "Khóa lịch xe điện tăng cường", "Điều phối xe", "06/08", "Đúng hạn"],
    ["EV-TC-018", "Xác nhận danh sách 140 tình nguyện viên", "Nhân sự", "08/08", "Đang làm"],
  ],
  "tam-coc": [
    ["EV-TM-019", "Bổ sung nhà cung ứng thuyền trang trí", "Mua sắm", "Hạn 06/08", "Khẩn"],
    ["EV-TM-016", "Chốt phương án thời tiết xấu", "Ban tổ chức", "09/08", "Đang làm"],
    ["EV-TM-011", "Duyệt tuyến chụp ảnh và vùng hạn chế", "Vận hành bến", "12/08", "Đúng hạn"],
  ],
  "bai-dinh": [
    ["EV-BD-014", "Duyệt thiết kế ánh sáng Bảo Tháp", "Ban nội dung", "Hạn 10/08", "Đang duyệt"],
    ["EV-BD-012", "Khảo sát nguồn điện dự phòng", "Kỹ thuật", "12/08", "Đúng hạn"],
    ["EV-BD-009", "Chốt phương án kiểm soát nến và cháy", "PCCC", "14/08", "Đúng hạn"],
  ],
} as const;

const milestones = [
  ["Pháp lý & giấy phép", "92%", "Đang duyệt hạng mục cuối"],
  ["Nhà thầu & mua sắm", "74%", "Một gói việc chậm"],
  ["Vận hành & phân luồng", "61%", "Chờ phê duyệt phương án"],
  ["An toàn & diễn tập", "48%", "Đã khóa lịch diễn tập"],
] as const;

export function ProjectEventWorkspace({ site, user }: Props) {
  const event = ERP_PROJECT_EVENTS.find((item) => item.siteId === site.id)!;
  const work = workBySite[site.id];
  const visibleWork = user.role === "employee" ? work.slice(0, 2) : work;
  const remaining = event.budgetBillion - event.committedBillion;

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#3f2e24] p-5 text-white sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e8c8a8]">{site.shortName} · {event.date}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl">{event.name}</h2>
            <p className="mt-3 text-sm text-white/65">{event.nextMilestone}</p>
          </div>
          <div className="flex gap-2">
            <a href="#viec-khan" className="rounded-xl bg-[#c85b45] px-4 py-3 text-sm font-black">{event.urgentCount} việc khẩn</a>
            <a href="#tien-do" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#3f2e24]">Xem tiến độ</a>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/12"><div className="h-full rounded-full bg-[#e4b37b]" style={{ width: `${event.progress}%` }} /></div>
        <div className="mt-2 flex justify-between text-xs text-white/55"><span>Tiến độ tổng thể {event.progress}%</span><span>Còn {event.daysLeft} ngày</span></div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Ngân sách", `${event.budgetBillion.toLocaleString("vi-VN")} tỷ`, `${event.committedBillion.toLocaleString("vi-VN")} tỷ đã cam kết`],
          ["Còn khả dụng", `${remaining.toLocaleString("vi-VN")} tỷ`, "Sau hợp đồng đã duyệt"],
          ["Khách dự kiến", event.expectedGuests.toLocaleString("vi-VN"), "Theo phương án phân luồng"],
          ["Gói việc", "41 / 56", "3 gói cần theo dõi"],
        ].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5"><p className="text-xs text-[#697770]">{label}</p><p className="mt-2 text-2xl font-black text-[#253c33]">{value}</p><p className="mt-2 text-xs leading-5 text-[#849089]">{note}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article id="viec-khan" className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e3e9e5] p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[0.17em] text-[#9a5f32]">Cần xử lý</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">{user.role === "director" ? "Việc đã chuyển cấp" : user.role === "manager" ? "Gói việc cần điều phối" : user.role === "accountant" ? "Cam kết ngân sách & hồ sơ chi phí" : "Việc của tôi"}</h2></div>
          <div className="divide-y divide-[#e7ece9]">
            {visibleWork.map(([code, title, owner, due, status], index) => <details key={code} className="group"><summary className="grid cursor-pointer list-none gap-2 p-4 sm:grid-cols-[0.45fr_1.4fr_0.7fr_auto] sm:items-center sm:px-6"><span className="text-xs font-black text-[#7a8781]">{code}</span><strong className="text-sm text-[#2c3e36]">{title}</strong><span className="text-xs text-[#6e7b75]">{user.role === "employee" ? user.name : owner}</span><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${index === 0 ? "bg-[#ffe4de] text-[#934336]" : index === 1 ? "bg-[#fff0ce] text-[#77531c]" : "bg-[#dff1e8] text-[#246249]"}`}>{due} · {status}</span></summary><div className="border-t border-[#edf0ee] bg-[#f8faf8] px-5 py-4 text-sm text-[#66756e]">{user.role === "director" ? "Quản lý dự án đã xác minh tác động và chuyển cấp để phê duyệt." : user.role === "accountant" ? "Kiểm tra hợp đồng, ngân sách đã cam kết, nghiệm thu và mã chi phí trước khi ghi nhận." : "Mở gói việc để cập nhật người phụ trách, bằng chứng và mốc hoàn thành."}</div></details>)}
          </div>
        </article>

        <aside id="tien-do" className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Theo nhóm công việc</p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">Tiến độ & điểm nghẽn</h2>
          <div className="mt-5 space-y-5">
            {milestones.map(([label, percent, note], index) => <div key={label}><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-black text-[#34483f]">{label}</p><p className="mt-1 text-xs text-[#7c8882]">{note}</p></div><strong className={index === 1 || index === 2 ? "text-[#a5533f]" : "text-[#2d735b]"}>{percent}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className={index === 1 || index === 2 ? "h-full rounded-full bg-[#c47155]" : "h-full rounded-full bg-[#397a62]"} style={{ width: percent }} /></div></div>)}
          </div>
        </aside>
      </section>
    </div>
  );
}
