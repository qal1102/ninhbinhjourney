import Link from "next/link";
import { redirect } from "next/navigation";
import { endRoleSwitchAction } from "@/app/erp/actions";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import {
  CONG_NGHE_DANG_DUNG,
  CONG_NGHE_DE_XUAT,
  lichCacNamToi,
  NHAN_UU_TIEN,
  type SuKienNam,
  type UuTien,
} from "@/domain/ke-hoach-tuong-lai";
import { NHAN_CHAC_CHAN } from "@/domain/lich-mua-vu";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

/**
 * Future planning (chủ dự án đặt tên 04/10/2026): lịch sự kiện ba năm tới và
 * công nghệ của ERP, thứ đang chạy lẫn thứ nên áp dụng. Chỉ giám đốc.
 */

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function ngay(iso: string) {
  const [, thang, ngay] = iso.split("-");
  return `${ngay}/${thang}`;
}

const NHAN_LOAI = { le: "Lễ hội", mua: "Mùa", "chien-dich": "Chiến dịch" } as const;
const MAU_UU_TIEN: Record<UuTien, string> = {
  "lam-ngay": "bg-[#e3f1e8] text-[#1f5a3f]",
  "nen-lam": "bg-[#fff1d6] text-[#7a5520]",
  "khi-co-ngan-sach": "bg-[#eef0f5] text-[#4a5568]",
};

function DongSuKien({ s }: { s: SuKienNam }) {
  const loai = s.dip.loai ?? "le";
  return (
    <li
      data-su-kien={s.dip.id}
      data-trang-thai={s.trangThai}
      className={`grid gap-2 border-b border-[#e3e9e5] py-4 last:border-b-0 sm:grid-cols-[8.5rem_1fr_auto] sm:items-start sm:gap-4 ${
        s.trangThai === "da-qua" ? "opacity-55" : ""
      }`}
    >
      <div>
        <p className="text-base font-black tabular-nums text-[#20342c]">
          {ngay(s.batDau)}
          {s.ketThuc !== s.batDau ? ` – ${ngay(s.ketThuc)}` : ""}
        </p>
        <p className={`mt-1 text-xs font-bold ${s.chacChan === "da-cong-bo" ? "text-[#28654d]" : s.chacChan === "du-kien" ? "text-[#9a5a1f]" : "text-[#5f7068]"}`}>
          {s.chacChan === "du-kien" && s.dip.uocLuong ? "Ngày ước lượng" : NHAN_CHAC_CHAN[s.chacChan]}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-[#20342c]">{s.dip.ten}</h3>
          <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-xs font-bold text-[#35594b]">{NHAN_LOAI[loai]}</span>
          {s.dip.lich === "am" ? (
            <span className="rounded-full bg-[#f0e6d0] px-2 py-0.5 text-xs font-bold text-[#7a6228]">
              {s.dip.ngay}/{s.dip.thang} âm lịch
            </span>
          ) : null}
        </div>
        {s.dip.noi ? <p className="text-xs font-bold text-[#8a8171]">{s.dip.noi}</p> : null}
        <p className="mt-1 text-sm leading-6 text-[#5f7068]">{s.dip.yNghia}</p>
        <p className="mt-1 text-xs text-[#7c8882]">
          {s.trangThai === "da-qua"
            ? "Đã qua"
            : s.trangThai === "dang-dien-ra"
              ? "Đang diễn ra"
              : `Còn ${s.conBaoNhieuNgay} ngày · nên bắt đầu chuẩn bị từ ${ngay(s.chuanBiTu)}/${s.chuanBiTu.slice(0, 4)}`}
          {s.dip.nguon ? ` · Nguồn: ${s.dip.nguon}` : ""}
        </p>
      </div>
      {s.trangThai !== "da-qua" ? (
        <Link
          href={`/erp/marketing?dip=${encodeURIComponent(s.dip.id)}#tao-chien-dich`}
          prefetch={false}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d7c69c] bg-white px-4 text-sm font-black text-[#6b5520] transition hover:border-[#b79b56]"
        >
          Mở chiến dịch
        </Link>
      ) : null}
    </li>
  );
}

export default async function FuturePlanningPage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && !user.actingAs) redirect("/erp");

  if (user.actingAs) {
    return (
      <ErpShell user={user}>
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#e0b979] bg-[#fff8eb] p-6 text-[#5d4420] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">Future planning</p>
          <h1 className="mt-2 text-2xl font-black text-[#3f3524]">Bạn đang xem với vai {ERP_ROLE_LABELS[user.role]}</h1>
          <p className="mt-2 leading-7">Kế hoạch các năm tới chỉ dành cho giám đốc. Mời bạn quay về giám đốc.</p>
          <form action={endRoleSwitchAction} className="mt-5">
            <input type="hidden" name="next" value="/erp/future-planning" />
            <button type="submit" className="inline-flex min-h-12 items-center rounded-xl bg-[#183f34] px-5 font-black text-white">
              Quay về giám đốc
            </button>
          </form>
        </section>
      </ErpShell>
    );
  }

  const bayGio = new Date();
  const cacNam = lichCacNamToi(bayGio, 3);
  const xin = (await searchParams)?.nam;
  const namXin = Number(Array.isArray(xin) ? xin[0] : xin);
  const namChon = cacNam.find((n) => n.nam === namXin) ?? cacNam[0];

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="space-y-8" data-testid="future-planning">
        <header className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7c78d]">Future planning</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl" data-chi="future-planning" data-chi-loi="Đổi năm ở ba nút để xem lễ hội và mùa vụ các năm tới; kéo xuống xem công nghệ đang chạy và nên áp dụng.">
            Kế hoạch các năm tới
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Lịch lễ hội, mùa vụ và chiến dịch ba năm tới, tính tự động theo âm lịch và theo lần tổ chức gần nhất; ngày nào chưa
            công bố thì ghi dự kiến. Bên dưới là công nghệ ERP đang chạy và những thứ nên áp dụng tiếp.
          </p>
          <nav aria-label="Các phần" className="mt-6 flex flex-wrap gap-2">
            {[
              ["#lich-cac-nam", "Lịch các năm tới"],
              ["#cong-nghe-dang-chay", "Công nghệ đang chạy"],
              ["#nen-ap-dung", "Nên áp dụng tiếp"],
            ].map(([href, nhan]) => (
              <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-white/25 px-4 text-sm font-bold text-white hover:bg-white/10">
                {nhan}
              </a>
            ))}
          </nav>
        </header>

        <section id="lich-cac-nam" aria-labelledby="tieu-de-lich" className="scroll-mt-24 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="tieu-de-lich" className="text-2xl font-black text-[#20342c]">
                Lịch {namChon.nam} · {namChon.suKien.length} dịp
              </h2>
              <p className="mt-1 text-sm text-[#5f7068]">Bấm &ldquo;Mở chiến dịch&rdquo; ở một dịp là có sẵn chiến dịch nháp ở màn Kênh khách.</p>
            </div>
            <nav aria-label="Chọn năm" className="flex gap-2" data-testid="chon-nam">
              {cacNam.map((n) => (
                <Link
                  key={n.nam}
                  href={`/erp/future-planning?nam=${n.nam}#lich-cac-nam`}
                  aria-current={n.nam === namChon.nam ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-black ${
                    n.nam === namChon.nam ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#cbd7d1] text-[#183f34]"
                  }`}
                >
                  {n.nam}
                </Link>
              ))}
            </nav>
          </div>
          <ol className="mt-4">
            {namChon.suKien.map((s) => (
              <DongSuKien key={`${s.dip.id}-${s.nam}`} s={s} />
            ))}
          </ol>
        </section>

        <section id="cong-nghe-dang-chay" aria-labelledby="tieu-de-dang-chay" className="scroll-mt-24">
          <h2 id="tieu-de-dang-chay" className="text-2xl font-black text-[#20342c]">
            Công nghệ đang chạy trong ERP · {CONG_NGHE_DANG_DUNG.length}
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONG_NGHE_DANG_DUNG.map((c) => (
              <li key={c.id} data-cong-nghe={c.id} className="flex flex-col rounded-2xl border border-[#e0e6e2] bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#28654d]">Đang chạy</p>
                <h3 className="mt-2 text-lg font-black leading-snug text-[#20342c]">{c.ten}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5f7068]">{c.lamGi}</p>
                <p className="mt-2 text-xs text-[#7c8882]">Thấy ở: {c.oDau}</p>
                {c.duongDan ? (
                  <Link href={c.duongDan} className="mt-auto pt-3 text-sm font-black text-[#1f604c] underline underline-offset-4">
                    Mở xem →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section id="nen-ap-dung" aria-labelledby="tieu-de-de-xuat" className="scroll-mt-24">
          <h2 id="tieu-de-de-xuat" className="text-2xl font-black text-[#20342c]">
            Nên áp dụng tiếp · {CONG_NGHE_DE_XUAT.length}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f7068]">
            Xếp theo thứ tự nên làm. Mỗi mục ghi rõ ERP đang có gì và còn thiếu gì, để quyết theo ngân sách.
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {CONG_NGHE_DE_XUAT.map((c, i) => (
              <li key={c.id} data-de-xuat={c.id} className="rounded-2xl border border-[#e0e6e2] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#183f34] text-sm font-black text-[#e7c78d]">{i + 1}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${MAU_UU_TIEN[c.uuTien]}`}>{NHAN_UU_TIEN[c.uuTien]}</span>
                </div>
                <h3 className="mt-2 text-lg font-black leading-snug text-[#20342c]">{c.ten}</h3>
                <dl className="mt-2 space-y-2 text-sm leading-6">
                  <div>
                    <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#718078]">Giải quyết</dt>
                    <dd className="text-[#3d5047]">{c.giaiQuyet}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#718078]">ERP đang có</dt>
                    <dd className="text-[#3d5047]">{c.hienCo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#718078]">Cần thêm</dt>
                    <dd className="text-[#3d5047]">{c.canGi}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </ErpShell>
  );
}
