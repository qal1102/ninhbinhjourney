"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { ErpSite } from "@/domain/erp";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { canSubmitFieldOperation } from "@/domain/erp-role-policy";

type Props = { site: ErpSite; user: CurrentErpUser };
type Report = {
  id: string;
  area: string;
  category: string;
  task: string;
  employee: string;
  time: string;
  progress: number;
  status: string;
  note: string;
  image: string;
  financeCode: string;
};

function initialReports(site: ErpSite): Report[] {
  return [
    { id: "IMG-0842", area: "Cổng bán vé A", category: "Đầu ca", task: "Mở quầy và kiểm tra thiết bị", employee: "Đỗ Thị Lan", time: "07:32", progress: 100, status: "Đã xác nhận", note: "Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.", image: site.image, financeCode: "OPS-GATE-A" },
    { id: "IMG-0918", area: "Bến trung tâm", category: "Tiến độ", task: "Bổ sung biển phân luồng", employee: "Nguyễn Văn Hải", time: "09:18", progress: 75, status: "Đang xử lý", note: "Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.", image: site.image, financeCode: "OPS-FLOW-02" },
    { id: "IMG-0951", area: "Quầy hỗ trợ khách", category: "Kết quả", task: "Xử lý hàng chờ đoàn trường học", employee: "Trần Minh Anh", time: "09:51", progress: 100, status: "Hoàn thành", note: "Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.", image: site.image, financeCode: "CS-GROUP" },
  ];
}

export function FieldReportWorkspace({ site, user }: Props) {
  const [reports, setReports] = useState(() => initialReports(site));
  const [selected, setSelected] = useState<Report | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [selected]);

  function readImage(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: Report = {
      id: `IMG-${String(reports.length + 852).padStart(4, "0")}`,
      area: String(data.get("area")),
      category: String(data.get("category")),
      task: String(data.get("task")),
      employee: user.name,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      progress: Number(data.get("progress")),
      status: Number(data.get("progress")) === 100 ? "Chờ quản lý xác nhận" : "Đang xử lý",
      note: String(data.get("note")),
      image: preview || site.image,
      financeCode: String(data.get("financeCode")),
    };
    setReports((current) => [next, ...current]);
    setSavedMessage(`Đã ghi nhận ${next.id} và chuyển quản lý ${site.shortName}.`);
    setPreview("");
    form.reset();
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Báo cáo hôm nay", reports.length + 21, "Theo ảnh và ca làm"], ["Đã xác nhận", 19, "Có người duyệt"], ["Đang xử lý", 4, "Theo deadline"], ["Thiếu bằng chứng", 1, "Quá hạn 26 phút"]].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm"><p className="text-xs text-[#6b7972]">{label}</p><p className="mt-2 text-2xl font-black text-[#203a30]">{value}</p><p className="mt-2 text-xs text-[#85918b]">{note}</p></article>)}
      </section>

      {canSubmitFieldOperation(user.role) ? <form onSubmit={submitReport} className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Báo cáo mới</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Ghi nhận ảnh hiện trường</h2></div><span className="text-xs font-bold text-[#8a5e30]">* Bắt buộc điền đủ</span></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-[#43564d]">Khu vực *<select required name="area" className="mt-2 min-h-11 w-full rounded-xl border border-[#ced8d1] bg-white px-3"><option>Cổng bán vé A</option><option>Bến trung tâm</option><option>Quầy hỗ trợ khách</option><option>Tuyến tham quan</option><option>Bãi xe</option></select></label>
          <label className="text-sm font-bold text-[#43564d]">Loại báo cáo *<select required name="category" className="mt-2 min-h-11 w-full rounded-xl border border-[#ced8d1] bg-white px-3"><option>Đầu ca</option><option>Tiến độ</option><option>Kết quả</option><option>Sự cố</option><option>Bàn giao cuối ca</option></select></label>
          <label className="text-sm font-bold text-[#43564d]">Công việc liên quan *<input required name="task" className="mt-2 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3" placeholder="Ví dụ: Kiểm tra máy quét cổng A" /></label>
          <label className="text-sm font-bold text-[#43564d]">Mã hạch toán / trung tâm chi phí *<input required name="financeCode" className="mt-2 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3" placeholder="OPS-GATE-A" /></label>
          <label className="text-sm font-bold text-[#43564d]">Tiến độ *<select required name="progress" className="mt-2 min-h-11 w-full rounded-xl border border-[#ced8d1] bg-white px-3"><option value="25">25%</option><option value="50">50%</option><option value="75">75%</option><option value="100">100% · Hoàn thành</option></select></label>
          <label className="text-sm font-bold text-[#43564d]">Ảnh hiện trường *<input required type="file" accept="image/*" capture="environment" onChange={(event) => readImage(event.target.files?.[0])} className="mt-2 block min-h-11 w-full rounded-xl border border-[#ced8d1] bg-white p-2 text-xs" /></label>
          <label className="md:col-span-2 text-sm font-bold text-[#43564d]">Kết quả / vướng mắc *<textarea required name="note" rows={3} className="mt-2 w-full rounded-xl border border-[#ced8d1] p-3" placeholder="Đã làm được gì, còn thiếu gì, cần ai hỗ trợ?" /></label>
        </div>
        {preview ? <div className="mt-4 aspect-[16/7] rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${preview}")` }} /> : null}
        <button type="submit" className="mt-4 min-h-11 w-full rounded-xl bg-[#183f34] px-4 text-sm font-black text-white sm:w-auto">Gửi báo cáo</button>
        {savedMessage ? <p role="status" className="mt-3 rounded-xl bg-[#e3f2eb] px-4 py-3 text-sm font-bold text-[#245e48]">{savedMessage}</p> : null}
      </form> : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Nhật ký có ảnh</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">Báo cáo gần nhất</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <button key={report.id} type="button" onClick={() => setSelected(report)} className="overflow-hidden rounded-2xl border border-[#dce3df] bg-white text-left transition hover:border-[#8ba99c]"><div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(8,24,18,.55)),url("${report.image}")` }} /><div className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[#547166]">{report.id}</span><span className="text-xs text-[#7b8881]">{report.time}</span></div><p className="mt-2 font-black text-[#2d4138]">{report.area}</p><p className="mt-1 text-xs text-[#6e7b75]">{report.task}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#397a62]" style={{ width: `${report.progress}%` }} /></div></div></button>)}</div>
      </section>

      {selected && typeof document !== "undefined" ? createPortal(<div className="fixed inset-0 z-[1200] grid place-items-end bg-[#071b15]/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"><button type="button" aria-label="Đóng báo cáo" onClick={() => setSelected(null)} className="absolute inset-0" /><section role="dialog" aria-modal="true" aria-label={`Báo cáo ${selected.id}`} className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"><div className="aspect-[16/8] bg-cover bg-center" style={{ backgroundImage: `url("${selected.image}")` }} /><div className="p-5 sm:p-7"><div className="flex justify-between gap-4"><div><p className="text-xs font-black text-[#477565]">{selected.id} · {selected.category}</p><h2 className="mt-2 text-2xl font-black text-[#20342c]">{selected.area}</h2></div><button type="button" aria-label="Đóng" onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-full border border-[#d6dfd9] text-xl">×</button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#f3f6f4] p-3"><dt className="text-xs text-[#7b8881]">Nhân viên</dt><dd className="mt-1 font-black">{selected.employee}</dd></div><div className="rounded-xl bg-[#f3f6f4] p-3"><dt className="text-xs text-[#7b8881]">Tiến độ</dt><dd className="mt-1 font-black">{selected.progress}% · {selected.status}</dd></div><div className="rounded-xl bg-[#f3f6f4] p-3"><dt className="text-xs text-[#7b8881]">Công việc</dt><dd className="mt-1 font-black">{selected.task}</dd></div><div className="rounded-xl bg-[#f3f6f4] p-3"><dt className="text-xs text-[#7b8881]">Mã hạch toán</dt><dd className="mt-1 font-black">{selected.financeCode}</dd></div></dl><p className="mt-4 rounded-xl border border-[#dce4df] p-4 text-sm leading-6 text-[#5e6f67]">{selected.note}</p></div></section></div>, document.body) : null}
    </div>
  );
}
