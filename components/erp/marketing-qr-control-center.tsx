"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createMarketingCampaignAction,
  createMarketingQrSourceAction,
  ganDipChienDichAction,
  updateMarketingQrDestinationAction,
  type MarketingQrActionState,
} from "@/app/erp/marketing-actions";
import type {
  MarketingCampaignRecord,
  MarketingQrConfig,
  MarketingQrSourceRecord,
} from "@/domain/marketing-qr";

/** Một dịp trong lịch mùa vụ, đủ để dựng ô chọn. */
export type LuaChonDip = { id: string; ten: string };

function ODip({ dip, macDinh, ten = "dip" }: { dip: readonly LuaChonDip[]; macDinh: string; ten?: string }) {
  return (
    <select
      name={ten}
      defaultValue={macDinh}
      className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"
    >
      <option value="">Chưa gắn dịp nào</option>
      {dip.map((d) => (
        <option key={d.id} value={d.id}>
          {d.ten}
        </option>
      ))}
    </select>
  );
}

/**
 * Một dòng chiến dịch, kèm ô đổi dịp.
 *
 * Gắn dịp là để phễu khách cộng được lượt quét, giữ chỗ, thanh toán và lượt
 * vào cổng theo từng dịp — tức là trả lời được "dịp nào ra tiền". Mỗi lần đổi
 * kho ghi lại cũ và mới, vì đổi dịp là đổi luôn con số của hai dịp.
 */
function DongChienDich({
  campaign,
  dip,
}: {
  campaign: MarketingCampaignRecord;
  dip: readonly LuaChonDip[];
}) {
  const [state, action] = useActionState(ganDipChienDichAction, INITIAL_STATE);
  const tenDip = dip.find((d) => d.id === campaign.dipId)?.ten;
  return (
    <li
      data-chien-dich={campaign.code}
      data-dip={campaign.dipId}
      className="rounded-2xl border border-[#d8e0db] bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#607b70]">{campaign.code}</span>
        <h3 className="text-base font-black text-[#203a30]">{campaign.name}</h3>
        <span className="text-xs font-bold text-[#66756e]">
          {campaign.status === "active" ? "Đang chạy" : campaign.status === "paused" ? "Tạm dừng" : "Nháp"}
          {" · "}
          {tenDip ? `dịp ${tenDip}` : "chưa gắn dịp"}
        </span>
      </div>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="campaignId" value={campaign.id} />
        <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">
          Thuộc dịp
          <ODip dip={dip} macDinh={campaign.dipId} />
        </label>
        <SubmitButton>Lưu dịp</SubmitButton>
        <ActionMessage state={state} />
      </form>
    </li>
  );
}

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
        Quét xong mở trang nào (chỉ nhận trang của mình)
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

export function MarketingQrControlCenter({
  config,
  goiYTenChienDich = "",
  dip = [],
  dipChon = "",
}: {
  config: MarketingQrConfig;
  /** Các dịp trong lịch mùa vụ, để gắn chiến dịch vào. */
  dip?: readonly LuaChonDip[];
  /** Dịp người dùng vừa bấm trong lịch mùa vụ, chọn sẵn trong ô dịp. */
  dipChon?: string;
  /**
   * Tên điền sẵn khi người dùng bấm một dịp trong lịch mùa vụ. Rỗng thì ô
   * tên để trống như cũ.
   */
  goiYTenChienDich?: string;
}) {
  const [campaignState, campaignAction] = useActionState(createMarketingCampaignAction, INITIAL_STATE);
  const [sourceState, sourceAction] = useActionState(createMarketingQrSourceAction, INITIAL_STATE);

  return (
    <div className="space-y-6" data-testid="marketing-qr-control-center">
      <section className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">Kênh khách · mã QR đổi được đích</p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">Một mã in, đổi được điểm đến</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Biển đã in thì mã trên biển nằm đó mãi, nhưng nơi nó dẫn khách tới thì
          đổi lúc nào cũng được, không phải in lại. Mã chỉ dẫn về các trang của
          mình. Máy đếm số lượt quét chứ không ghi ai quét; chỉ khi khách tự
          đồng ý, lượt quét đó mới nối được vào hành trình của họ.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form id="tao-chien-dich" action={campaignAction} className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#203a30]">Tạo chiến dịch</h2>
          {goiYTenChienDich ? (
            <p className="mt-2 rounded-xl bg-[#eef5ef] px-3 py-2 text-xs font-bold text-[#356957]">
              Đã điền sẵn tên theo dịp bạn vừa chọn trong lịch mùa vụ. Sửa lại được.
            </p>
          ) : null}
          {/* `key` đổi theo gợi ý: không có nó thì React giữ nguyên ô cũ và
              tên điền sẵn không vào được. */}
          <label className="mt-4 grid gap-1 text-xs font-bold text-[#5d6f66]">Tên chiến dịch<input key={goiYTenChienDich} name="name" required minLength={2} maxLength={160} defaultValue={goiYTenChienDich} placeholder="QR bến Tam Cốc tháng 8" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
          <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Thuộc dịp<ODip key={dipChon} dip={dip} macDinh={dipChon} /></label>
          <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Trạng thái<select name="status" defaultValue="draft" className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"><option value="draft">Nháp</option><option value="active">Đang chạy</option><option value="paused">Tạm dừng</option></select></label>
          <p className="mt-2 text-xs text-[#7c8b83]">Mã chiến dịch do máy đặt theo tên bạn vừa nhập. Tạo xong là có mã ngay, khỏi nghĩ.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton>Tạo chiến dịch</SubmitButton><ActionMessage state={campaignState} /></div>
        </form>

        <form action={sourceAction} className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#203a30]">Tạo mã QR động</h2>
          {config.campaigns.length === 0 ? <p className="mt-4 text-sm text-[#66756e]">Cần tạo chiến dịch trước khi tạo mã QR.</p> : <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Chiến dịch<select name="campaignId" required className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm">{config.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.code} · {campaign.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-bold text-[#5d6f66]">Trạng thái<select name="status" defaultValue="active" className="min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm"><option value="active">Đang chạy</option><option value="paused">Tạm dừng</option></select></label>
            </div>
            <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Nhãn vị trí<input name="placementLabel" required minLength={2} maxLength={160} placeholder="Bảng tại bến Tam Cốc" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
            <label className="mt-3 grid gap-1 text-xs font-bold text-[#5d6f66]">Quét xong mở trang nào<input name="destinationPath" required maxLength={1024} placeholder="/plan" className="min-h-11 rounded-lg border border-[#cbd7d1] px-3 text-sm" /></label>
            <p className="mt-2 text-xs text-[#7c8b83]">Mã QR và mã vị trí do máy đặt theo chiến dịch và nhãn vị trí. Tạo xong là in lên biển được luôn.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton>Tạo QR động</SubmitButton><ActionMessage state={sourceState} /></div>
          </>}
        </form>
      </section>

      {config.campaigns.length > 0 ? (
        <section data-testid="danh-sach-chien-dich" className="space-y-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">Chiến dịch</p>
            <h2 className="mt-1 text-2xl font-black text-[#203a30]">{config.campaigns.length} chiến dịch</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#66756e]">
              Gắn mỗi chiến dịch vào một dịp để bảng phễu bên dưới cộng được khách theo dịp: dịp nào nhiều người quét mã, dịp nào ra tiền.
            </p>
          </div>
          <ol className="grid gap-3 lg:grid-cols-2">
            {config.campaigns.map((campaign) => (
              <DongChienDich key={campaign.id} campaign={campaign} dip={dip} />
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">Mã QR đang dùng</p><h2 className="mt-1 text-2xl font-black text-[#203a30]">{config.sources.length} mã QR</h2></div><p className="text-sm text-[#66756e]">Số lượt quét đếm thẳng từ nhật ký quét, không phải số ước tính.</p></div>
        {config.sources.length === 0 ? <div className="rounded-3xl border border-dashed border-[#b8c6bf] bg-white px-6 py-12 text-center text-sm text-[#66756e]">Chưa có QR nào. Màn hình không tự sinh chiến dịch hay lượt quét minh họa.</div> : config.sources.map((source) => <article key={source.id} className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">{source.campaignCode} · {source.placementLabel}</p><h3 className="mt-2 text-xl font-black text-[#203a30]">/q/{source.code}</h3><p className="mt-1 text-sm text-[#66756e]">{source.status === "active" ? "Đang chạy" : source.status === "paused" ? "Tạm dừng" : "Đã ngừng"} · {source.scanCount.toLocaleString("vi-VN")} lượt quét{source.lastScannedAt ? ` · gần nhất ${new Date(source.lastScannedAt).toLocaleString("vi-VN")}` : ""}</p></div><span className="rounded-xl bg-[#eef5ef] px-3 py-2 text-xs font-black text-[#356957]">v{source.version}</span></div><DestinationEditor source={source} /></article>)}
      </section>
    </div>
  );
}
