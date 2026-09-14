"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  cancelStaffRequestAction,
  completeStaffRequestAction,
  createStaffRequestAction,
  decideStaffRequestAction,
} from "@/app/erp/staff-request-actions";
import type { ErpSiteId } from "@/domain/erp";
import {
  STAFF_REQUEST_DIRECTOR_THRESHOLD_VND,
  STAFF_REQUEST_STATUS_LABELS,
  STAFF_REQUEST_TYPES,
  STAFF_REQUEST_TYPE_HINTS,
  STAFF_REQUEST_TYPE_LABELS,
  formatStaffRequestVnd,
  staffRequestActionsFor,
  staffRequestSummary,
  staffRequestViewerCanSubmit,
  staffRequestWaitsOn,
  validateStaffRequestDraft,
  type StaffRequest,
  type StaffRequestStatus,
  type StaffRequestType,
  type StaffRequestViewer,
} from "@/domain/erp-staff-requests";

type Site = { id: ErpSiteId; shortName: string };
type Loc = "cho-toi" | "cua-toi" | "tat-ca";

type Props = {
  viewer: StaffRequestViewer & { name: string };
  sites: Site[];
  requests: StaffRequest[];
  today: string;
  storage: "supabase" | "memory";
  unavailableMessage: string | null;
};

const STATUS_TONE: Readonly<Record<StaffRequestStatus, string>> = Object.freeze({
  submitted: "bg-[#fff4dc] text-[#7a5a1c]",
  "pending-director": "bg-[#fde8e2] text-[#8d4234]",
  approved: "bg-[#e3f1ea] text-[#24533f]",
  rejected: "bg-[#f1ecec] text-[#6b4a44]",
  cancelled: "bg-[#eef1ef] text-[#5f6b65]",
  completed: "bg-[#dcebe4] text-[#1f4a39]",
});

function khoaMoi() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function gioVietNam(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c] outline-none focus:border-[#4f806f]";
const labelClass = "text-xs font-black text-[#5c6f67]";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TypeFields({
  type,
  fields,
  set,
}: {
  type: StaffRequestType;
  fields: Record<string, string>;
  set: (key: string, value: string) => void;
}) {
  const text = (key: string, label: string, placeholder = "") => (
    <Field id={`dx-${key}`} label={label}>
      <input
        id={`dx-${key}`}
        value={fields[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );
  const area = (key: string, label: string, placeholder = "") => (
    <Field id={`dx-${key}`} label={label}>
      <textarea
        id={`dx-${key}`}
        value={fields[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${inputClass} py-2`}
      />
    </Field>
  );
  const date = (key: string, label: string) => (
    <Field id={`dx-${key}`} label={label}>
      <input
        id={`dx-${key}`}
        type="date"
        value={fields[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        className={inputClass}
      />
    </Field>
  );
  const money = (key: string, label: string) => {
    const so = Number((fields[key] ?? "").replace(/[^0-9]/g, ""));
    return (
      <Field id={`dx-${key}`} label={label}>
        <input
          id={`dx-${key}`}
          inputMode="numeric"
          autoComplete="off"
          value={so ? new Intl.NumberFormat("vi-VN").format(so) : ""}
          onChange={(event) => set(key, event.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Ví dụ: 2.000.000"
          className={`${inputClass} text-base font-black tabular-nums`}
        />
        {so > STAFF_REQUEST_DIRECTOR_THRESHOLD_VND ? (
          <span className="mt-1 block text-xs font-bold text-[#8d4234]">
            Vượt {formatStaffRequestVnd(STAFF_REQUEST_DIRECTOR_THRESHOLD_VND)}: quản lý duyệt xong còn cần giám đốc duyệt.
          </span>
        ) : null}
      </Field>
    );
  };

  switch (type) {
    case "nghi-phep":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {date("from_date", "Nghỉ từ ngày")}
            {date("to_date", "Tới hết ngày")}
          </div>
          {area("reason", "Lý do", "Ví dụ: việc gia đình ở quê")}
        </>
      );
    case "doi-ca":
      return (
        <>
          {date("shift_date", "Ngày cần đổi")}
          <div className="grid gap-3 sm:grid-cols-2">
            {text("current_shift", "Ca đang trực", "Ví dụ: ca sáng 06:00–14:00")}
            {text("desired_shift", "Muốn đổi sang", "Ví dụ: ca chiều")}
          </div>
          {text("cover_name", "Người trực thay (nếu đã nhờ được)")}
          {area("reason", "Lý do", "Ví dụ: đi khám bệnh buổi sáng")}
        </>
      );
    case "tam-ung":
      return (
        <>
          {money("amount_vnd", "Số tiền cần ứng")}
          {area("purpose", "Ứng để làm gì", "Ví dụ: mua vật tư sơ cứu cho bến thuyền")}
        </>
      );
    case "de-xuat-mua":
      return (
        <>
          {area("items", "Cần mua gì, bao nhiêu", "Ví dụ: hai bộ đàm cầm tay, một bộ sạc")}
          {money("amount_vnd", "Số tiền ước tính")}
          {text("supplier", "Định mua ở đâu (nếu biết)")}
          {area("reason", "Vì sao cần mua", "Ví dụ: bộ đàm cũ hỏng, cổng B không liên lạc được")}
        </>
      );
    case "sua-chua":
      return (
        <>
          {text("location", "Hỏng ở đâu", "Ví dụ: bến thuyền số 2")}
          {area("problem", "Hỏng thế nào", "Ví dụ: tay vịn cầu tàu lung lay")}
          <fieldset>
            <legend className={labelClass}>Mức gấp</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["thuong", "gap"] as const).map((muc) => (
                <label
                  key={muc}
                  className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-black ${
                    fields.urgency === muc ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
                  }`}
                >
                  <input
                    type="radio"
                    name="dx-urgency"
                    checked={fields.urgency === muc}
                    onChange={() => set("urgency", muc)}
                    className="sr-only"
                  />
                  {muc === "gap" ? "Gấp, nguy hiểm cho khách" : "Thường"}
                </label>
              ))}
            </div>
          </fieldset>
          {money("amount_vnd", "Chi phí ước tính (nếu biết)")}
        </>
      );
    case "huy-phieu-quay":
      return (
        <>
          {text("sale_code", "Mã phiếu thu", "PT-XXXXXXXXXXXX")}
          {area("reason", "Vì sao huỷ, đã hoàn tiền cho khách chưa", "Ví dụ: bán nhầm một vé thành hai vé, đã hoàn 250.000 đ")}
        </>
      );
  }
}

function RequestCard({
  request,
  viewer,
  siteName,
  onDone,
}: {
  request: StaffRequest;
  viewer: StaffRequestViewer & { name: string };
  siteName: string;
  onDone: (message: { tone: "ok" | "error"; text: string }) => void;
}) {
  const actions = staffRequestActionsFor(viewer, request);
  const [mode, setMode] = useState<"approve" | "reject" | "complete" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function xacNhan() {
    if (!mode || pending) return;
    startTransition(async () => {
      const ketQua =
        mode === "cancel"
          ? await cancelStaffRequestAction({ code: request.code })
          : mode === "complete"
            ? await completeStaffRequestAction({ code: request.code, note })
            : await decideStaffRequestAction({ code: request.code, decision: mode, note });
      onDone({ tone: ketQua.ok ? "ok" : "error", text: ketQua.message });
      if (ketQua.ok) {
        setMode(null);
        setNote("");
        router.refresh();
      }
    });
  }

  const nutXacNhan =
    mode === "approve"
      ? request.status === "submitted" && request.needsDirector && viewer.role !== "director"
        ? "Đồng ý, chuyển giám đốc"
        : "Xác nhận duyệt"
      : mode === "reject"
        ? "Xác nhận từ chối"
        : mode === "complete"
          ? actions.completeLabel
          : "Xác nhận rút đề xuất";

  return (
    <li className="rounded-2xl border border-[#dde5e0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-[#42574e]">{request.code}</span>
        <span className="rounded-full bg-[#183f34] px-2 py-0.5 text-[11px] font-black text-white">
          {STAFF_REQUEST_TYPE_LABELS[request.type]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${STATUS_TONE[request.status]}`}>
          {STAFF_REQUEST_STATUS_LABELS[request.status]}
        </span>
        {request.amountVnd ? (
          <strong className="ml-auto text-base font-black tabular-nums text-[#20342c]">
            {formatStaffRequestVnd(request.amountVnd)}
          </strong>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#20342c]">{staffRequestSummary(request)}</p>
      <p className="mt-1 text-xs text-[#6e7b75]">
        {request.requestedByName} · {siteName} · gửi {gioVietNam(request.createdAt)}
      </p>
      {request.lastNote && request.status !== "submitted" ? (
        <p className="mt-2 rounded-lg bg-[#f5f7f6] px-3 py-2 text-xs leading-5 text-[#42574e]">
          <strong>{request.lastActorName}:</strong> {request.lastNote}
        </p>
      ) : null}
      {actions.waitingFor && request.requestedById === viewer.id ? (
        <p className="mt-2 text-xs font-bold text-[#7a5a1c]">{actions.waitingFor}</p>
      ) : null}

      {actions.canDecide || actions.canComplete || actions.canCancel ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.canDecide ? (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === "approve" ? null : "approve")}
                className="min-h-10 rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
              >
                Duyệt
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === "reject" ? null : "reject")}
                className="min-h-10 rounded-lg border border-[#e3b8b0] bg-white px-4 text-sm font-black text-[#8b3d31]"
              >
                Từ chối
              </button>
            </>
          ) : null}
          {actions.canComplete ? (
            <button
              type="button"
              onClick={() => setMode(mode === "complete" ? null : "complete")}
              className="min-h-10 rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
            >
              {actions.completeLabel}
            </button>
          ) : null}
          {actions.canCancel ? (
            <button
              type="button"
              onClick={() => setMode(mode === "cancel" ? null : "cancel")}
              className="min-h-10 rounded-lg border border-[#ccd8d1] bg-white px-4 text-sm font-black text-[#42574e]"
            >
              Rút đề xuất
            </button>
          ) : null}
        </div>
      ) : null}

      {mode ? (
        <div className="mt-3 rounded-xl bg-[#f7f9f7] p-3">
          {mode !== "cancel" ? (
            <>
              <label htmlFor={`note-${request.code}`} className={labelClass}>
                {mode === "reject"
                  ? "Lý do từ chối (người gửi sẽ đọc)"
                  : mode === "complete"
                    ? request.type === "sua-chua"
                      ? "Đã sửa thế nào"
                      : "Đã chi thế nào, số phiếu chi"
                    : "Ghi chú (không bắt buộc)"}
              </label>
              <textarea
                id={`note-${request.code}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={500}
                className={`${inputClass} py-2`}
              />
            </>
          ) : (
            <p className="text-sm text-[#42574e]">Rút rồi thì quản lý không xét đề xuất này nữa.</p>
          )}
          {mode === "approve" && request.type === "huy-phieu-quay" ? (
            <p className="mt-2 text-xs font-bold text-[#8b3d31]">
              Duyệt là huỷ ngay phiếu {String(request.details.sale_code ?? "")}. Nhớ hoàn tiền cho khách.
            </p>
          ) : null}
          <button
            type="button"
            onClick={xacNhan}
            disabled={pending || ((mode === "reject" || mode === "complete") && note.trim().length < 5)}
            className={`mt-2 min-h-10 rounded-lg px-4 text-sm font-black text-white disabled:opacity-50 ${
              mode === "reject" ? "bg-[#8b3d31]" : "bg-[#183f34]"
            }`}
          >
            {pending ? "Đang lưu…" : nutXacNhan}
          </button>
        </div>
      ) : null}

      {request.events.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-bold text-[#42574e]">Diễn biến ({request.events.length} bước)</summary>
          <ol className="mt-2 space-y-1 border-l-2 border-[#dde5e0] pl-3">
            {request.events.map((event, index) => (
              <li key={`${event.occurredAt}-${index}`} className="text-[#42574e]">
                <span className="tabular-nums text-[#6e7b75]">{gioVietNam(event.occurredAt)}</span> ·{" "}
                <strong>{event.actorName}</strong> · {STAFF_REQUEST_STATUS_LABELS[event.toStatus]}
                {event.note ? <span className="block text-[#6e7b75]">{event.note}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}

export function StaffRequestCenter({ viewer, sites, requests, today, storage, unavailableMessage }: Props) {
  const router = useRouter();
  const sitesCoTheGui = sites.filter((site) => staffRequestViewerCanSubmit(viewer, site.id));
  const [type, setType] = useState<StaffRequestType>("nghi-phep");
  const [siteId, setSiteId] = useState<ErpSiteId | "">(sitesCoTheGui[0]?.id ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [khoa, setKhoa] = useState(khoaMoi);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [listMessage, setListMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const choToi = useMemo(() => requests.filter((request) => staffRequestWaitsOn(viewer, request)), [requests, viewer]);
  const cuaToi = useMemo(() => requests.filter((request) => request.requestedById === viewer.id), [requests, viewer]);
  const [loc, setLoc] = useState<Loc>(choToi.length > 0 ? "cho-toi" : cuaToi.length > 0 ? "cua-toi" : "tat-ca");
  const danhSach = loc === "cho-toi" ? choToi : loc === "cua-toi" ? cuaToi : requests;
  const tenCoSo = new Map(sites.map((site) => [site.id, site.shortName]));

  function doiLoai(next: StaffRequestType) {
    setType(next);
    setFields(next === "sua-chua" ? { urgency: "thuong" } : {});
    setMessage(null);
  }

  function gui() {
    if (pending) return;
    if (!siteId) {
      setMessage({ tone: "error", text: "Chọn cơ sở gửi đề xuất." });
      return;
    }
    const kiem = validateStaffRequestDraft({ type, fields, today });
    if (!kiem.ok) {
      setMessage({ tone: "error", text: kiem.reason });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const ketQua = await createStaffRequestAction({ siteId, type, fields, requestKey: khoa });
      setMessage({ tone: ketQua.ok ? "ok" : "error", text: ketQua.message });
      if (ketQua.ok) {
        setFields(type === "sua-chua" ? { urgency: "thuong" } : {});
        setKhoa(khoaMoi());
        setLoc("cua-toi");
        router.refresh();
      }
    });
  }

  const tabs: Array<{ id: Loc; label: string; count: number }> = [
    { id: "cho-toi", label: "Chờ tôi xử lý", count: choToi.length },
    { id: "cua-toi", label: "Tôi đã gửi", count: cuaToi.length },
    { id: "tat-ca", label: "Tất cả tôi thấy", count: requests.length },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">Đề xuất &amp; phê duyệt</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Đề xuất của đội ngũ</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Xin nghỉ, đổi ca, tạm ứng, đề xuất mua, báo sửa chữa, xin huỷ phiếu quầy bán nhầm: gửi ở đây, quản lý cơ sở
          duyệt. Khoản tiền trên {formatStaffRequestVnd(STAFF_REQUEST_DIRECTOR_THRESHOLD_VND)} cần thêm giám đốc duyệt;
          tạm ứng và mua hàng do kế toán chi. Không ai tự duyệt đề xuất của mình, và mọi bước đều ghi vào Nhật ký.
        </p>
      </header>

      {storage === "memory" ? (
        <p role="note" className="rounded-xl bg-[#fff8eb] px-4 py-3 text-sm font-bold text-[#6b5326]">
          Bản chạy thử: đề xuất chỉ lưu tạm trên máy chủ này, khởi động lại là mất. Bản thật lưu vào kho dữ liệu.
        </p>
      ) : null}
      {unavailableMessage ? (
        <p role="alert" className="rounded-xl bg-[#fdeceb] px-4 py-3 text-sm font-bold text-[#8b3d31]">
          {unavailableMessage}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section aria-labelledby="dx-gui" className="h-fit rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h2 id="dx-gui" className="text-xl font-black text-[#20342c]">
            Gửi đề xuất mới
          </h2>
          {sitesCoTheGui.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-[#5f7068]">
              {viewer.role === "director"
                ? "Giám đốc là người duyệt cuối, nên không gửi đề xuất ở đây. Các đề xuất chờ giám đốc hiện ở cột bên cạnh."
                : "Tài khoản này chưa được phân công ở cơ sở nào, nên chưa gửi được đề xuất."}
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                gui();
              }}
              className="mt-4 space-y-4"
            >
              <fieldset>
                <legend className={labelClass}>Loại đề xuất</legend>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {STAFF_REQUEST_TYPES.map((loai) => (
                    <label
                      key={loai}
                      className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-black ${
                        type === loai ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#ccd8d1] bg-white text-[#42574e]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="dx-type"
                        value={loai}
                        checked={type === loai}
                        onChange={() => doiLoai(loai)}
                        className="sr-only"
                      />
                      {STAFF_REQUEST_TYPE_LABELS[loai]}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#6e7b75]">{STAFF_REQUEST_TYPE_HINTS[type]}</p>
              </fieldset>

              {sitesCoTheGui.length > 1 ? (
                <Field id="dx-site" label="Cơ sở">
                  <select
                    id="dx-site"
                    value={siteId}
                    onChange={(event) => setSiteId(event.target.value as ErpSiteId)}
                    className={inputClass}
                  >
                    {sitesCoTheGui.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.shortName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-xs text-[#6e7b75]">Gửi tới quản lý cơ sở {sitesCoTheGui[0]?.shortName}.</p>
              )}

              <TypeFields type={type} fields={fields} set={(key, value) => setFields((cu) => ({ ...cu, [key]: value }))} />

              <button
                type="submit"
                disabled={pending}
                className="min-h-12 w-full rounded-xl bg-[#183f34] px-5 text-base font-black text-white disabled:opacity-50"
              >
                {pending ? "Đang gửi…" : "Gửi đề xuất"}
              </button>
            </form>
          )}
          {message ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${
                message.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="dx-danh-sach" className="space-y-3">
          <h2 id="dx-danh-sach" className="sr-only">
            Danh sách đề xuất
          </h2>
          <div role="tablist" aria-label="Lọc đề xuất" className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={loc === tab.id}
                onClick={() => setLoc(tab.id)}
                className={`min-h-10 rounded-full px-4 text-sm font-black ${
                  loc === tab.id ? "bg-[#183f34] text-white" : "border border-[#ccd8d1] bg-white text-[#42574e]"
                }`}
              >
                {tab.label} <span className="tabular-nums opacity-80">{tab.count}</span>
              </button>
            ))}
          </div>
          {listMessage ? (
            <p
              role={listMessage.tone === "error" ? "alert" : "status"}
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                listMessage.tone === "error" ? "bg-[#fdeceb] text-[#8b3d31]" : "bg-[#e3f1ea] text-[#24533f]"
              }`}
            >
              {listMessage.text}
            </p>
          ) : null}
          {danhSach.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#ccd9d3] bg-white p-5 text-sm text-[#5f7068]">
              {loc === "cho-toi"
                ? "Chưa có đề xuất nào chờ bạn xử lý."
                : loc === "cua-toi"
                  ? "Bạn chưa gửi đề xuất nào."
                  : "Chưa có đề xuất nào trong phạm vi bạn xem được."}
            </p>
          ) : (
            <ul className="space-y-3">
              {danhSach.map((request) => (
                <RequestCard
                  key={request.code}
                  request={request}
                  viewer={viewer}
                  siteName={tenCoSo.get(request.siteId) ?? request.siteId}
                  onDone={setListMessage}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
