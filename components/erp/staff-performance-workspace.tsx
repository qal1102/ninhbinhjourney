"use client";

import { useState } from "react";
import type { ErpSite } from "@/domain/erp";

type Props = { site: ErpSite };

const staff = [
  { name: "Đỗ Thị Lan", role: "Nhân viên cổng vé", shift: "07:30–12:15", tasks: "7/8", progress: 88, deadline: "11:30", current: "Đối soát đoàn TA-018", completed: "Mở quầy; kiểm máy quét; xử lý 462 lượt QR; nộp 4 ảnh", tickets: "462 vé · 79,4 triệu", evidence: "4 ảnh · 1 biên bản", difference: "0 đ", status: "Đúng tiến độ" },
  { name: "Nguyễn Văn Hải", role: "Điều phối bến", shift: "07:00–13:00", tasks: "5/7", progress: 71, deadline: "10:45", current: "Lắp biển phân luồng số 4", completed: "Kiểm tra 3 tuyến; bàn giao 12 thuyền; nộp 3 ảnh", tickets: "Không bán vé", evidence: "3 ảnh · GPS đủ", difference: "Không áp dụng", status: "Nguy cơ trễ" },
  { name: "Trần Minh Anh", role: "Kinh doanh đoàn", shift: "08:00–17:00", tasks: "6/6", progress: 100, deadline: "10:30", current: "Chờ phản hồi khách FB-281", completed: "Gửi 3 báo giá; xác nhận đoàn 42 khách; cập nhật 2 hợp đồng", tickets: "118 vé · 16,2 triệu", evidence: "3 báo giá · 2 email", difference: "12 triệu chờ đối soát", status: "Hoàn thành" },
] as const;

const summaries = {
  day: ["84/89", "92%", "96%", "2"],
  week: ["428/446", "94%", "95%", "7"],
  month: ["1.842/1.906", "96%", "93%", "18"],
  year: ["12.486/12.972", "97%", "92%", "64"],
} as const;

export function StaffPerformanceWorkspace({ site }: Props) {
  const [period, setPeriod] = useState<keyof typeof summaries>("day");
  const values = summaries[period];
  return <section className="space-y-5">
    <div className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Nhân sự & công việc</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Ca làm tại {site.shortName}</h2></div><div className="grid grid-cols-4 rounded-xl bg-[#f0f4f1] p-1">{(["day", "week", "month", "year"] as const).map((item) => <button type="button" key={item} onClick={() => setPeriod(item)} className={`min-h-9 rounded-lg px-2 text-xs font-black ${period === item ? "bg-[#183f34] text-white" : "text-[#65756e]"}`}>{item === "day" ? "Ngày" : item === "week" ? "Tuần" : item === "month" ? "Tháng" : "Năm"}</button>)}</div></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Có mặt / kế hoạch", values[0], "Theo chấm công GPS"], ["Đúng giờ", values[1], "Bình quân 3 năm: 91%"], ["Việc đúng deadline", values[2], "Theo nhật ký công việc"], ["Việc có nguy cơ trễ", values[3], "Quản lý đã nhận cảnh báo"]].map(([label, value, note]) => <article key={label} className="rounded-xl bg-[#f3f6f4] p-4"><p className="text-xs text-[#718078]">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-2 text-xs text-[#7b8881]">{note}</p></article>)}</div></div>

    <div className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Theo từng người</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Tiến độ, kết quả và bằng chứng</h2><div className="mt-5 space-y-3">{staff.map((employee) => <details key={employee.name} className="rounded-xl border border-[#e0e6e2] open:border-[#91aa9f]"><summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[1fr_0.55fr_0.55fr_auto] sm:items-center"><div><p className="font-black text-[#2d4138]">{employee.name}</p><p className="mt-1 text-xs text-[#7b8881]">{employee.role} · {employee.shift}</p></div><div><p className="text-xs text-[#7b8881]">Công việc</p><p className="mt-1 font-black">{employee.tasks}</p></div><div><p className="text-xs text-[#7b8881]">Tiến độ</p><p className="mt-1 font-black">{employee.progress}%</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${employee.status === "Nguy cơ trễ" ? "bg-[#ffe4de] text-[#934336]" : "bg-[#dff1e8] text-[#246249]"}`}>{employee.status}</span></summary><div className="border-t border-[#e6ebe8] bg-[#f8faf8] p-4 sm:p-5"><div className="h-1.5 overflow-hidden rounded-full bg-[#e7ece9]"><div className={`h-full rounded-full ${employee.progress < 80 ? "bg-[#c46c50]" : "bg-[#397a62]"}`} style={{ width: `${employee.progress}%` }} /></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-[#7b8881]">Đang làm · hạn {employee.deadline}</dt><dd className="mt-1 font-black">{employee.current}</dd></div><div><dt className="text-xs text-[#7b8881]">Đã hoàn thành</dt><dd className="mt-1 font-bold">{employee.completed}</dd></div><div><dt className="text-xs text-[#7b8881]">Vé & doanh thu ghi nhận</dt><dd className="mt-1 font-bold">{employee.tickets}</dd></div><div><dt className="text-xs text-[#7b8881]">Bằng chứng</dt><dd className="mt-1 font-bold">{employee.evidence}</dd></div><div><dt className="text-xs text-[#7b8881]">Chênh lệch cuối ca</dt><dd className="mt-1 font-bold">{employee.difference}</dd></div><div><dt className="text-xs text-[#7b8881]">Mã hạch toán</dt><dd className="mt-1 font-mono font-bold">OPS-{site.id.toUpperCase()}-SHIFT</dd></div></dl></div></details>)}</div></div>
  </section>;
}
