"use client";

import { useActionState } from "react";
import { duyetAnhAction, type SuKienActionState } from "@/app/erp/su-kien-actions";
import { DIA_DIEM_THI_ANH, GIAI_THI_ANH, tenGiai } from "@/domain/thi-anh";
import type { AnhErp } from "@/lib/customer-data/thi-anh-repository";

const BAN_DAU: SuKienActionState = { status: "idle", message: "" };

function TheAnh({ a }: { a: AnhErp }) {
  const [s, hanhDong, dang] = useActionState(duyetAnhAction, BAN_DAU);
  return (
    <li className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm" data-trang-thai={a.trangThai}>
      {a.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- đường dẫn ký tạm của kho ảnh riêng tư
        <img src={a.url} alt={a.chuThich || `Ảnh của ${a.ten}`} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full bg-[#e6ece8]" />
      )}
      <div className="p-4">
        <p className="font-black text-[#203a30]">{a.ten} <span className="font-normal text-[#68776f]">· {a.so}</span></p>
        <p className="text-xs text-[#68776f]">{DIA_DIEM_THI_ANH.find((d) => d.ma === a.dauMa)?.vi ?? a.dauMa}{a.chuThich ? ` · ${a.chuThich}` : ""}</p>
        <p className="mt-1 text-xs font-bold">
          {a.trangThai === "cho-duyet" ? <span className="text-[#9a5b12]">Chờ duyệt</span> : a.trangThai === "tu-choi" ? <span className="text-[#8a3a12]">Không dùng</span> : <span className="text-[#245e48]">Đã duyệt{a.giai ? ` · ${tenGiai(a.giai)} · mã ${a.maNhan}` : ""}</span>}
        </p>
        <form action={hanhDong} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={a.id} />
          <select name="giai" defaultValue={a.giai ?? ""} aria-label="Giải" className="min-h-10 rounded-lg border border-[#ced8d1] bg-white px-2 text-sm">
            <option value="">Không giải</option>
            {GIAI_THI_ANH.map((g) => <option key={g.giai} value={g.giai}>{g.ten.vi}</option>)}
          </select>
          <button type="submit" name="trang_thai" value="da-duyet" disabled={dang} className="min-h-10 rounded-lg bg-[#183f34] px-3 text-sm font-black text-white disabled:opacity-60">Duyệt</button>
          <button type="submit" name="trang_thai" value="tu-choi" disabled={dang} className="min-h-10 rounded-lg border border-[#c9a79d] px-3 text-sm font-black text-[#8a3a12] disabled:opacity-60">Không dùng</button>
        </form>
        {s.status !== "idle" ? <p role="status" className={`mt-2 text-xs font-bold ${s.status === "success" ? "text-[#245e48]" : "text-[#8a3a12]"}`}>{s.message}</p> : null}
      </div>
    </li>
  );
}

export function ThiAnhWorkspace({ anh }: { anh: AnhErp[] }) {
  if (anh.length === 0) return <p className="rounded-2xl bg-white p-5 text-sm text-[#68776f]">Tháng này chưa có ảnh nào gửi tới.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="ds-anh-erp" data-chi="ds-anh" data-chi-loi="Mỗi ảnh có nút Duyệt, Không dùng và ô chọn giải.">
      {anh.map((a) => <TheAnh key={a.id} a={a} />)}
    </ul>
  );
}
