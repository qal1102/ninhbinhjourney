"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeOnSiteNoShowAction } from "@/app/erp/on-site-due-actions";
import type { ErpSite } from "@/domain/erp";
import { noShowEligibility, validateNoShowReason, type OnSiteDueOrder } from "@/domain/erp-on-site-due";
import { formatVietnameseDate } from "@/lib/vietnamese-date";

type Workspace = { available: true; orders: OnSiteDueOrder[] } | { available: false; message: string };

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function DongDon({ order, site, today }: { order: OnSiteDueOrder; site: ErpSite; today: string }) {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const duoc = noShowEligibility(order, today);

  function xacNhan() {
    const kiem = validateNoShowReason(lyDo);
    if (!kiem.ok) {
      setMessage({ tone: "error", text: kiem.reason });
      return;
    }
    startTransition(async () => {
      const ketQua = await closeOnSiteNoShowAction({ siteId: site.id, orderCode: order.orderCode, reason: lyDo });
      setMessage({ tone: ketQua.ok ? "ok" : "error", text: ketQua.message });
      if (ketQua.ok) {
        setMo(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="rounded-xl border border-[#e6ece8] bg-[#f8faf8] p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono font-bold text-[#20342c]">{order.orderCode}</span>
        <strong className="tabular-nums text-[#20342c]">{formatVnd(order.amountVnd)}</strong>
      </div>
      <p className="mt-1 text-xs text-[#5f7068]">
        Ngày đi {formatVietnameseDate(order.visitDate)} · {order.partySize} khách
        {order.ticketCodes.length ? ` · vé ${order.ticketCodes.join(", ")}` : ""}
      </p>
      {duoc.ok ? (
        <button
          type="button"
          onClick={() => setMo(!mo)}
          className="mt-2 min-h-11 rounded-lg border border-[#e3b8b0] bg-white px-3 text-xs font-black text-[#8b3d31]"
        >
          Khách không đến
        </button>
      ) : (
        <p className="mt-2 text-xs font-bold text-[#7a5a1c]">{duoc.reason}</p>
      )}
      {mo ? (
        <div className="mt-2 rounded-lg bg-white p-3">
          <label htmlFor={`khong-den-${order.orderCode}`} className="text-xs font-black text-[#8b3d31]">
            Lý do: đã gọi khách chưa, khách nói gì
          </label>
          <textarea
            id={`khong-den-${order.orderCode}`}
            value={lyDo}
            onChange={(event) => setLyDo(event.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-[#e3b8b0] p-2 text-sm"
            placeholder="Ví dụ: gọi hai lần không nghe máy, quá ngày đi"
          />
          <button
            type="button"
            disabled={pending || lyDo.trim().length < 10}
            onClick={xacNhan}
            className="mt-2 min-h-11 rounded-lg bg-[#8b3d31] px-3 text-xs font-black text-white disabled:opacity-50"
          >
            {pending ? "Đang lưu…" : "Đóng khoản và huỷ vé chưa dùng"}
          </button>
        </div>
      ) : null}
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${
            message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </li>
  );
}

/**
 * QA-DON-DU-LIEU-10 — danh sách đơn trả tại điểm còn chờ thu của cơ sở, cho
 * quản lý cơ sở và giám đốc. Bảng đối soát chỉ báo "N đơn còn nợ"; ở đây mới
 * thấy từng đơn và đóng được khoản của khách không đến.
 */
export function OnSiteDuePanel({ site, workspace, today }: { site: ErpSite; workspace: Workspace; today: string }) {
  return (
    <section className="rounded-2xl border border-[#dde5e0] bg-white p-4 sm:p-5">
      <h3 className="text-sm font-black text-[#20342c]">Đơn trả tại điểm còn chờ thu</h3>
      {!workspace.available ? (
        <p className="mt-2 text-sm text-[#5f7068]">{workspace.message}</p>
      ) : workspace.orders.length === 0 ? (
        <p className="mt-2 text-sm text-[#5f7068]">Cơ sở này không còn đơn trả tại điểm nào chờ thu.</p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-5 text-[#5f7068]">
            Khách tới thì thu ở cổng như thường. Qua hết ngày đi mà khách không tới, bấm &ldquo;Khách không đến&rdquo;
            để đóng khoản: vé chưa dùng bị huỷ, đơn chuyển sang đã huỷ, sổ tiền giữ nguyên hàng chờ thu làm bằng chứng.
          </p>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {workspace.orders.map((order) => (
              <DongDon key={order.orderCode} order={order} site={site} today={today} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
