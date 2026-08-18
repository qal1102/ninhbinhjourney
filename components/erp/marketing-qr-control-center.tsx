"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createMarketingCampaignAction,
  createMarketingQrSourceAction,
  updateMarketingQrDestinationAction,
  type MarketingQrActionState,
} from "@/app/erp/marketing-actions";
import type { MarketingQrConfig, MarketingQrSourceRecord } from "@/domain/marketing-qr";

const INITIAL_STATE: MarketingQrActionState = { status: "idle", message: "" };

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : children}
    </button>
  );
}

function ActionMessage({ state }: { state: MarketingQrActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm font-bold ${state.status === "error" ? "text-[#994737]" : "text-[#28654d]"}`}
    >
      {state.message}
    </p>
  );
}

function DestinationEditor({ source }: { source: MarketingQrSourceRecord }) {
  const [state, action] = useActionState(updateMarketingQrDestinationAction, INITIAL_STATE);
  return (
    <form action={action} className="mt-4 grid gap-3 border-t border-[#e3ebe6] pt-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <input type="hidden" name="sourceId" value={source.id} />
      <input type="hidden" name="expectedVersion" value={source.version} />
      <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
        Đích nội bộ (không nhận URL ngoài)
        <input
          name="destinationPath"
          required
          maxLength={1024}
          defaultValue={source.destinationPath}
          className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
        />
      </label>
      <SubmitButton>Đổi đích</SubmitButton>
      <div className="lg:col-span-2"><ActionMessage state={state} /></div>
    </form>
  );
}

export function MarketingQrControlCenter({ config }: { config: MarketingQrConfig }) {
  const [campaignState, campaignAction] = useActionState(createMarketingCampaignAction, INITIAL_STATE);
  const [sourceState, sourceAction] = useActionState(createMarketingQrSourceAction, INITIAL_STATE);

  return (
    <div className="space-y-6" data-testid="marketing-qr-control-center">
      <section className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">Marketing · QR động</p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">Một mã in, đổi được điểm đến</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          QR chỉ chuyển tới đường dẫn nội bộ đã kiểm tra. Lượt quét là aggregate không kèm contact; khi khách tự cho phép analytics, event `qr_opened` mới nối vào hành trình ẩn danh.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={campaignAction} className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#203a30]">Tạo campaign</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Mã campaign<input name="code" required minLength={3} maxLength={48} placeholder="TAMCOC-AUG" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
            <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Trạng thái<select name="status" defaultValue="draft" className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"><option value="draft">Nháp</option><option value="active">Đang chạy</option><option value="paused">Tạm dừng</option></select></label>
          </div>
          <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Tên nội bộ<input name="name" required minLength={2} maxLength={160} placeholder="QR bến Tam Cốc tháng 8" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
          <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton>Tạo campaign</SubmitButton><ActionMessage state={campaignState} /></div>
        </form>

        <form action={sourceAction} className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#203a30]">Tạo mã QR động</h2>
          {config.campaigns.length === 0 ? <p className="mt-4 text-sm text-[#66756e]">Tạo campaign trước khi tạo QR.</p> : <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Campaign<select name="campaignId" required className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm">{config.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.code} · {campaign.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Mã QR<input name="code" required minLength={3} maxLength={48} placeholder="TC-WHARF-01" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Mã vị trí<input name="placementId" required minLength={3} maxLength={48} placeholder="TAMCOC-WHARF" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Trạng thái<select name="status" defaultValue="active" className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"><option value="active">Đang chạy</option><option value="paused">Tạm dừng</option></select></label>
            </div>
            <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Nhãn vị trí<input name="placementLabel" required minLength={2} maxLength={160} placeholder="Bảng tại bến Tam Cốc" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
            <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Đích nội bộ<input name="destinationPath" required maxLength={1024} placeholder="/plan" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
            <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton>Tạo QR động</SubmitButton><ActionMessage state={sourceState} /></div>
          </>}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">Nguồn đã cấu hình</p><h2 className="mt-1 text-2xl font-black text-[#203a30]">{config.sources.length} mã QR</h2></div><p className="text-sm text-[#66756e]">Lượt quét lấy từ `marketing_qr_scans`.</p></div>
        {config.sources.length === 0 ? <div className="rounded-3xl border border-dashed border-[#b8c6bf] bg-white px-6 py-12 text-center text-sm text-[#66756e]">Chưa có QR nào. Màn hình không tự sinh campaign hay lượt quét minh họa.</div> : config.sources.map((source) => <article key={source.id} className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">{source.campaignCode} · {source.placementLabel}</p><h3 className="mt-2 text-xl font-black text-[#203a30]">/q/{source.code}</h3><p className="mt-1 text-sm text-[#66756e]">{source.status === "active" ? "Đang chạy" : source.status === "paused" ? "Tạm dừng" : "Đã ngừng"} · {source.scanCount.toLocaleString("vi-VN")} lượt quét{source.lastScannedAt ? ` · gần nhất ${new Date(source.lastScannedAt).toLocaleString("vi-VN")}` : ""}</p></div><span className="rounded-xl bg-[#eef5ef] px-3 py-2 text-xs font-black text-[#356957]">v{source.version}</span></div><DestinationEditor source={source} /></article>)}
      </section>
    </div>
  );
}
