"use client";

import Link from "next/link";
import { useActionState } from "react";
import { rutThamAction, taoSuKienAction, type SuKienActionState } from "@/app/erp/su-kien-actions";
import type { SuKienErp } from "@/lib/customer-data/su-kien-repository";

const BAN_DAU: SuKienActionState = { status: "idle", message: "" };

function ngayGio(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ThongBao({ s }: { s: SuKienActionState }) {
  if (s.status === "idle") return null;
  return (
    <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${s.status === "success" ? "bg-[#e3f2eb] text-[#245e48]" : "bg-[#fbe6df] text-[#8a3a12]"}`}>
      {s.message}
    </p>
  );
}

function NutRut({ slug, coTheRut }: { slug: string; coTheRut: boolean }) {
  const [s, hanhDong, dang] = useActionState(rutThamAction, BAN_DAU);
  return (
    <form action={hanhDong} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={dang || !coTheRut}
        className="inline-flex min-h-11 items-center rounded-xl bg-[#b23a24] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dang ? "Đang rút…" : "Rút thăm ngay"}
      </button>
      {!coTheRut ? <span className="ml-3 text-xs text-[#68776f]">Rút được sau hạn đăng ký.</span> : null}
      <ThongBao s={s} />
    </form>
  );
}

export function SuKienWorkspace({ ds, bayGio }: { ds: SuKienErp[]; bayGio: number }) {
  const [s, hanhDong, dang] = useActionState(taoSuKienAction, BAN_DAU);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4" data-testid="ds-su-kien-erp" data-chi="ds-su-kien" data-chi-loi="Mỗi thẻ là một sự kiện: số người đăng ký, bao nhiêu đồng ý nhận tin, nút rút thăm.">
        {ds.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-[#68776f]">Chưa có sự kiện nào.</p> : null}
        {ds.map((sk) => (
          <article key={sk.slug} className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-[#203a30]">{sk.ten}</h2>
                <p className="text-sm text-[#4f5f57]">{sk.khachMoi}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${sk.trangThai === "da-rut" ? "bg-[#e3f2eb] text-[#245e48]" : "bg-[#fff1d6] text-[#7a5310]"}`}>
                {sk.trangThai === "da-rut" ? "Đã rút thăm" : Date.parse(sk.hanDangKy) > bayGio ? "Đang nhận đăng ký" : "Hết hạn, chờ rút"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-[#f3f6f4] p-2"><dt className="text-[11px] text-[#5f6f67]">Diễn ra</dt><dd className="font-bold">{ngayGio(sk.dienRaLuc)}</dd></div>
              <div className="rounded-lg bg-[#f3f6f4] p-2"><dt className="text-[11px] text-[#5f6f67]">Hạn đăng ký</dt><dd className="font-bold">{ngayGio(sk.hanDangKy)}</dd></div>
              <div className="rounded-lg bg-[#f3f6f4] p-2"><dt className="text-[11px] text-[#5f6f67]">Người đăng ký</dt><dd className="font-black tabular-nums" data-testid="so-dang-ky-erp">{sk.soNguoi.toLocaleString("vi-VN")}</dd></div>
              <div className="rounded-lg bg-[#f3f6f4] p-2"><dt className="text-[11px] text-[#5f6f67]">Đồng ý nhận tin</dt><dd className="font-black tabular-nums">{sk.dongYTiepThi.toLocaleString("vi-VN")}</dd></div>
            </dl>
            <p className="mt-2 text-sm text-[#4f5f57]">{sk.soGiai} giải: {sk.giaiThuong}</p>
            <p className={`mt-1 text-xs ${sk.soDangKyKhuyenMai ? "text-[#4f5f57]" : "font-bold text-[#9a5b12]"}`}>
              {sk.soDangKyKhuyenMai ? `Số đăng ký khuyến mại: ${sk.soDangKyKhuyenMai}` : "Chưa có số đăng ký khuyến mại với Sở Công Thương: chỉ dùng để trình diễn."}
            </p>
            <Link href={`/su-kien/${sk.slug}`} className="mt-2 inline-flex min-h-10 items-center text-sm font-black text-[#356957] underline-offset-2 hover:underline">
              Trang khách: /su-kien/{sk.slug} →
            </Link>
            {sk.trangThai === "da-rut" && sk.nguoiTrung ? (
              <div className="mt-3">
                <h3 className="text-sm font-black text-[#203a30]">Người trúng (đưa mã nhận giải cho quầy đón khách)</h3>
                <ol className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                  {sk.nguoiTrung.map((n) => (
                    <li key={n.ma} className="rounded-lg bg-[#f3f6f4] px-3 py-1.5">{n.thuTu}. {n.so} · <span className="font-mono">{n.maNhan}</span></li>
                  ))}
                </ol>
              </div>
            ) : (
              <NutRut slug={sk.slug} coTheRut={Date.parse(sk.hanDangKy) <= bayGio} />
            )}
          </article>
        ))}
      </section>

      <form action={hanhDong} className="h-fit rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm" data-testid="tao-su-kien" data-chi="tao-su-kien" data-chi-loi="Điền tên, khách mời, giờ diễn ra, hạn đăng ký, số giải rồi bấm Mở sự kiện.">
        <h2 className="text-lg font-black text-[#203a30]">Mở sự kiện mới</h2>
        <p className="mt-1 text-xs leading-5 text-[#68776f]">
          Mở xong, máy công bố ngay mã cam kết rút thăm. Có gắn lượt với vé nên là khuyến mại may rủi: đăng ký với Sở Công Thương ít nhất 3 ngày làm
          việc trước khi chạy thật, rồi ghi số văn bản vào ô cuối.
        </p>
        {[
          ["ten", "Tên sự kiện", "Đêm nhạc bên sông Ngô Đồng"],
          ["slug", "Đường dẫn (chữ thường, gạch nối)", "dem-nhac-ngo-dong"],
          ["khachMoi", "Khách mời", "Ca sĩ …, công bố sau cũng được"],
        ].map(([ten, nhan, goiY]) => (
          <label key={ten} className="mt-3 block text-sm font-bold text-[#43564d]">
            {nhan}
            <input name={ten} required placeholder={goiY} className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
          </label>
        ))}
        <label className="mt-3 block text-sm font-bold text-[#43564d]">
          Giới thiệu
          <textarea name="moTa" rows={3} className="mt-1 w-full rounded-xl border border-[#ced8d1] p-3 font-normal" />
        </label>
        <label className="mt-3 block text-sm font-bold text-[#43564d]">
          Nơi diễn ra
          <select name="coSo" className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] bg-white px-3 font-normal">
            <option value="trang-an">Tràng An</option>
            <option value="tam-coc">Tam Cốc</option>
            <option value="bai-dinh">Bái Đính</option>
            <option value="tam-chuc">Tam Chúc</option>
            <option value="">Nơi khác</option>
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#43564d]">
            Giờ diễn ra
            <input type="datetime-local" name="dienRaLuc" required className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
          </label>
          <label className="block text-sm font-bold text-[#43564d]">
            Hạn đăng ký
            <input type="datetime-local" name="hanDangKy" required className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="block text-sm font-bold text-[#43564d]">
            Số giải
            <input type="number" name="soGiai" min={1} max={200} defaultValue={10} required className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
          </label>
          <label className="block text-sm font-bold text-[#43564d]">
            Giải thưởng
            <input name="giaiThuong" required defaultValue="Chụp ảnh và giao lưu 10 phút với khách mời, ngồi hàng đầu" className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
          </label>
        </div>
        <label className="mt-3 block text-sm font-bold text-[#43564d]">
          Số văn bản đăng ký khuyến mại (nếu đã có)
          <input name="soDangKyKhuyenMai" className="mt-1 min-h-11 w-full rounded-xl border border-[#ced8d1] px-3 font-normal" />
        </label>
        <button type="submit" disabled={dang} className="mt-4 min-h-11 w-full rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">
          {dang ? "Đang mở…" : "Mở sự kiện"}
        </button>
        <ThongBao s={s} />
      </form>
    </div>
  );
}
