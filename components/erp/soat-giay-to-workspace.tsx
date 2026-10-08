"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SupplierApSupplier } from "@/domain/erp-supplier-ap";
import type { ErpRole } from "@/domain/erp";
import {
  KHOA_DIEN_HOA_DON,
  TEN_LOAI,
  dienHoaDonNcc,
  doiChieuBo,
  kiemGiayTo,
  type KetQuaSoat,
  type MucSoat,
  type TrichXuat,
} from "@/domain/soat-giay-to";

type GiayTo = { id: string; ten: string; anh: string; trangThai: "dang-doc" | "xong" | "loi"; trich?: TrichXuat; loi?: string };

const MAU = [
  { tep: "hoa-don-hop-le.jpg", ten: "Hoá đơn đủ" },
  { tep: "hoa-don-co-loi.jpg", ten: "Hoá đơn có lỗi" },
  { tep: "nghiem-thu-thieu-ky.jpg", ten: "Biên bản nghiệm thu" },
] as const;

const NHAN_KET_LUAN: Record<KetQuaSoat["ketLuan"], { chu: string; lop: string }> = {
  dat: { chu: "Đạt", lop: "bg-[#e3f1e8] text-[#1d6b3e]" },
  thieu: { chu: "Thiếu hoặc sai", lop: "bg-[#fbe6e2] text-[#a3341f]" },
  "can-xem": { chu: "Cần xem lại", lop: "bg-[#fff1d6] text-[#7a5520]" },
};

const DAU_MUC: Record<MucSoat["trangThai"], { kyHieu: string; lop: string; nhan: string }> = {
  dat: { kyHieu: "✓", lop: "bg-[#e3f1e8] text-[#1d6b3e]", nhan: "Đạt" },
  thieu: { kyHieu: "!", lop: "bg-[#fbe6e2] text-[#a3341f]", nhan: "Thiếu" },
  sai: { kyHieu: "✕", lop: "bg-[#fbe6e2] text-[#a3341f]", nhan: "Sai" },
  "can-xem": { kyHieu: "?", lop: "bg-[#fff1d6] text-[#7a5520]", nhan: "Cần xem" },
};

function homNayVn() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** Thu ảnh về cạnh dài 1800px, JPEG: đủ đọc chữ, nhẹ để gửi qua mạng điện thoại. */
async function thuNho(nguon: Blob): Promise<string> {
  const bmp = await createImageBitmap(nguon);
  const tiLe = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * tiLe);
  c.height = Math.round(bmp.height * tiLe);
  const g = c.getContext("2d");
  if (!g) throw new Error("Trình duyệt không vẽ được ảnh.");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

function DanhSachMuc({ muc }: { muc: readonly MucSoat[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {muc.map((m, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-5">
          <span
            aria-label={DAU_MUC[m.trangThai].nhan}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-black ${DAU_MUC[m.trangThai].lop}`}
          >
            {DAU_MUC[m.trangThai].kyHieu}
          </span>
          <span className="min-w-0">
            <b className="text-[#20342c]">{m.ten}:</b> <span className="break-words text-[#4c5f56]">{m.chiTiet}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const NHAN_O: Record<string, string> = {
  supplierId: "Nhà cung cấp",
  invoiceSeries: "Ký hiệu hoá đơn",
  invoiceNumber: "Số hoá đơn",
  invoiceDate: "Ngày hoá đơn",
  netVnd: "Giá trị trước thuế",
  vatVnd: "Thuế GTGT",
  totalVnd: "Tổng thanh toán",
  description: "Nội dung",
  contractReference: "Mã hợp đồng",
  acceptanceReference: "Mã biên bản nghiệm thu",
  acceptedTotalVnd: "Giá trị đã nghiệm thu",
};

function BanDienSan({ daDoc, dsNcc }: { daDoc: readonly TrichXuat[]; dsNcc: readonly SupplierApSupplier[] }) {
  const { dien } = dienHoaDonNcc(daDoc, dsNcc);
  const dong = Object.entries(dien).map(([k, v]) => {
    const giaTri =
      k === "supplierId"
        ? (dsNcc.find((n) => n.id === v)?.name ?? String(v))
        : typeof v === "number"
          ? `${v.toLocaleString("vi-VN")} đ`
          : String(v);
    return [NHAN_O[k] ?? k, giaTri] as const;
  });
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-xl border border-[#e7b96a] bg-[#fff8e8] p-3 text-sm sm:grid-cols-[auto_1fr]" data-testid="soat-ban-dien">
      {dong.map(([nhan, giaTri]) => (
        <div key={nhan} className="contents">
          <dt className="font-bold text-[#6b4a14]">{nhan}</dt>
          <dd className="break-words text-[#20342c]">{giaTri}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SoatGiayToWorkspace({
  dsNcc,
  coAi,
  vai,
  coSoMacDinh,
}: {
  dsNcc: readonly SupplierApSupplier[];
  coAi: boolean;
  vai: ErpRole;
  coSoMacDinh: string | null;
}) {
  const router = useRouter();
  const [ds, setDs] = useState<GiayTo[]>([]);
  const [loiChung, setLoiChung] = useState("");
  const [xemDien, setXemDien] = useState(false);
  const oChup = useRef<HTMLInputElement>(null);
  const oChon = useRef<HTMLInputElement>(null);
  const homNay = homNayVn();

  async function doc(ten: string, nguon: Blob) {
    setLoiChung("");
    const id = crypto.randomUUID();
    let anh: string;
    try {
      anh = await thuNho(nguon);
    } catch {
      setLoiChung("Không mở được ảnh này. Xin chọn ảnh JPEG hoặc PNG.");
      return;
    }
    setDs((cu) => [{ id, ten, anh, trangThai: "dang-doc" }, ...cu]);
    try {
      const res = await fetch("/api/erp/soat-giay-to", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anh }),
      });
      const kq = (await res.json().catch(() => null)) as { trich?: TrichXuat; message?: string } | null;
      if (!res.ok || !kq?.trich) throw new Error(kq?.message ?? "AI chưa đọc được ảnh. Xin thử lại.");
      setDs((cu) => cu.map((g) => (g.id === id ? { ...g, trangThai: "xong", trich: kq.trich } : g)));
    } catch (error) {
      setDs((cu) => cu.map((g) => (g.id === id ? { ...g, trangThai: "loi", loi: error instanceof Error ? error.message : "Lỗi không rõ." } : g)));
    }
  }

  async function chonTep(files: FileList | null) {
    for (const f of Array.from(files ?? []).slice(0, 4)) await doc(f.name, f);
    if (oChup.current) oChup.current.value = "";
    if (oChon.current) oChon.current.value = "";
  }

  async function dungMau(tep: string, ten: string) {
    const res = await fetch(`/images/erp/giay-to-mau/${tep}`);
    await doc(`${ten} (mẫu)`, await res.blob());
  }

  const daDoc = ds.filter((g) => g.trangThai === "xong" && g.trich).map((g) => g.trich!);
  const doiChieu = doiChieuBo(daDoc);
  const coHoSoNcc = daDoc.some((t) => t.loai === "hoa-don" || t.loai === "nghiem-thu" || t.loai === "hop-dong");

  function dienVaoHoSo() {
    // Biểu mẫu gửi hoá đơn chỉ quản lý cơ sở thấy; vai khác (kể cả giám đốc)
    // xem bản điền sẵn ngay tại đây thay vì bị đưa sang trang không có biểu mẫu.
    if (vai !== "manager") {
      setXemDien(true);
      return;
    }
    const { siteId, dien } = dienHoaDonNcc(daDoc, dsNcc);
    const coSo = siteId ?? coSoMacDinh;
    if (!coSo) return;
    try {
      sessionStorage.setItem(KHOA_DIEN_HOA_DON, JSON.stringify({ siteId: coSo, dien, luc: Date.now() }));
    } catch {
      // Chặn lưu tạm thì vẫn mở màn hồ sơ; người dùng nhập tay như cũ.
    }
    router.push(`/erp/${coSo}/doi-tac-nha-cung-ung#ho-so-moi`);
  }

  return (
    <div className="space-y-6" data-testid="soat-giay-to">
      <section className="rounded-3xl bg-[#173f34] p-5 text-white shadow-sm sm:p-7" data-chi="soat-giay-to">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e7b96a]">✦ AI đọc · luật soát</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Soát giấy tờ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
          Chụp hoá đơn, biên bản nghiệm thu, hợp đồng hay danh sách đoàn. AI đọc chữ trên ảnh; hệ thống soát theo luật: thiếu mã số thuế, cộng tiền sai,
          chưa ký, thiếu dấu, ngày lập sai, rồi đối chiếu chéo cả bộ và điền sẵn vào hồ sơ hoá đơn nhà cung cấp. Ảnh không được lưu.
        </p>
        {coAi ? (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => oChup.current?.click()}
              className="inline-flex min-h-12 items-center rounded-2xl bg-[#e7b96a] px-5 text-sm font-black text-[#173f34]"
            >
              Chụp ảnh giấy tờ
            </button>
            <button
              type="button"
              onClick={() => oChon.current?.click()}
              className="inline-flex min-h-12 items-center rounded-2xl border border-white/40 px-5 text-sm font-black text-white"
            >
              Chọn ảnh có sẵn
            </button>
            <input ref={oChup} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void chonTep(e.target.files)} />
            <input ref={oChon} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void chonTep(e.target.files)} />
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm">Máy chủ chưa bật AI (thiếu AI_API_KEY), nên chưa đọc được ảnh.</p>
        )}
        {coAi ? (
          <div className="mt-4">
            <p className="text-xs font-bold text-white/60">Chưa có giấy tờ trong tay? Thử với giấy tờ mẫu:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MAU.map((m) => (
                <button
                  key={m.tep}
                  type="button"
                  data-testid={`soat-mau-${m.tep.replace(".jpg", "")}`}
                  onClick={() => void dungMau(m.tep, m.ten)}
                  className="min-h-10 rounded-full border border-white/30 bg-white/10 px-3.5 text-sm font-bold text-white hover:bg-white/20"
                >
                  {m.ten}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {loiChung ? <p className="mt-3 text-sm font-bold text-[#ffd0c4]">{loiChung}</p> : null}
      </section>

      {doiChieu.length || coHoSoNcc ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6" data-testid="soat-doi-chieu">
          <h2 className="text-lg font-black text-[#20342c]">Cả bộ hồ sơ</h2>
          {(["hoa-don", "nghiem-thu", "hop-dong"] as const)
            .filter((loai) => daDoc.filter((t) => t.loai === loai).length > 1)
            .map((loai) => (
              <p key={loai} className="mt-2 rounded-lg bg-[#fff1d6] px-3 py-2 text-xs font-bold text-[#7a5520]">
                Có {daDoc.filter((t) => t.loai === loai).length}{" "}
                {({ "hoa-don": "hoá đơn", "nghiem-thu": "biên bản nghiệm thu", "hop-dong": "hợp đồng" } as const)[loai]}{" "}
                trong bộ: đang đối chiếu và điền theo cái thêm sau cùng. Bấm{" "}
                &quot;Bỏ&quot; ở cái không thuộc việc này.
              </p>
            ))}
          {doiChieu.length ? (
            <DanhSachMuc muc={doiChieu} />
          ) : (
            <p className="mt-2 text-sm text-[#5f7068]">Thêm hoá đơn và biên bản nghiệm thu (hoặc hợp đồng) của cùng một việc để đối chiếu chéo.</p>
          )}
          {coHoSoNcc ? (
            <div className="mt-4 border-t border-[#e2e8e4] pt-4">
              <button
                type="button"
                onClick={dienVaoHoSo}
                data-testid="soat-dien-ho-so"
                className="inline-flex min-h-12 items-center rounded-2xl bg-[#183f34] px-5 text-sm font-black text-white"
              >
                {vai === "manager" ? "Điền vào hồ sơ hoá đơn nhà cung cấp →" : "Xem bản sẽ điền vào hồ sơ nhà cung cấp"}
              </button>
              {xemDien && vai !== "manager" ? <BanDienSan daDoc={daDoc} dsNcc={dsNcc} /> : null}
              <p className="mt-2 text-xs leading-5 text-[#6e7b75]">
                Mở biểu mẫu &quot;Gửi hóa đơn kèm PO và nghiệm thu&quot; với nhà cung cấp, số hoá đơn, ngày, tiền và số nghiệm thu đã điền. Mã đề nghị mua,
                trung tâm chi phí vẫn nhập tay.
                {vai !== "manager"
                  ? " Biểu mẫu gửi hoá đơn do quản lý cơ sở mở. Muốn thử trọn vẹn: bấm \"Xem theo vai trò\" trên thanh đầu trang, chọn quản lý Tràng An, quay lại màn này."
                  : ""}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {ds.map((g) => {
          const kq = g.trich ? kiemGiayTo(g.trich, homNay, dsNcc) : null;
          return (
            <article key={g.id} className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-5" data-testid="soat-the" data-ket-luan={kq?.ketLuan ?? g.trangThai}>
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh khách vừa chụp, chỉ nằm trong bộ nhớ trình duyệt */}
                <img src={g.anh} alt={`Ảnh ${g.ten}`} className="h-24 w-20 shrink-0 rounded-lg border border-[#e2e8e4] object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#6e7b75]">{g.ten}</p>
                  {g.trangThai === "dang-doc" ? (
                    <p className="mt-2 text-sm font-bold text-[#183f34]" role="status">
                      <span className="motion-safe:animate-pulse">✦</span> AI đang đọc giấy tờ…
                    </p>
                  ) : g.trangThai === "loi" ? (
                    <p className="mt-2 text-sm font-bold text-[#a3341f]">{g.loi}</p>
                  ) : g.trich && kq ? (
                    <>
                      <p className="mt-1 text-lg font-black text-[#20342c]">{TEN_LOAI[g.trich.loai]}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${NHAN_KET_LUAN[kq.ketLuan].lop}`}>
                        {NHAN_KET_LUAN[kq.ketLuan].chu}
                      </span>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setDs((cu) => cu.filter((x) => x.id !== g.id))}
                  className="h-9 shrink-0 rounded-full border border-[#d8e0db] px-3 text-xs font-bold text-[#5f7068]"
                  aria-label={`Bỏ ${g.ten}`}
                >
                  Bỏ
                </button>
              </div>
              {kq ? <DanhSachMuc muc={kq.muc} /> : null}
            </article>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-[#6e7b75]">
        Đây là bước soát sơ bộ cho người nộp và kế toán. Hệ thống chưa nối cổng hoá đơn điện tử của cơ quan thuế, nên chưa tra được hoá đơn có thật hay
        đã bị huỷ; mã số thuế chỉ được soát đúng dạng. AI có thể đọc nhầm, kết quả cần người xem lại trước khi gửi hồ sơ.
      </p>
    </div>
  );
}
