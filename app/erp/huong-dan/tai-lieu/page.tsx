import Link from "next/link";
import { redirect } from "next/navigation";
import danhSachAnh from "@/content/huong-dan-anh.json";
import {
  BAN_DO_CHUC_NANG,
  CHUC_NANG_WEB,
  TEN_NHOM_WEB,
  duongDanChucNang,
  type ChucNang,
  type ChucNangWeb,
  type NhomWeb,
} from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS } from "@/domain/erp";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export const metadata = { title: "Tài liệu hướng dẫn", robots: { index: false, follow: false } };

/**
 * Tài liệu hướng dẫn toàn bộ module (12/10/2026, việc 9 của chủ dự án: "tài
 * liệu hướng dẫn toàn bộ module, có ảnh từng bước, xuất PDF").
 *
 * Dựng thẳng từ bản đồ chức năng (`domain/ban-do-chuc-nang.ts`), cùng nguồn
 * với màn Dạo một vòng: thêm chức năng vào bản đồ là tài liệu có thêm mục.
 * Ảnh do `scripts/chup-tai-lieu-huong-dan.mjs` chụp (mở đúng màn, chỗ cần bấm
 * được khoanh bằng `?chi=`), ghi danh sách vào `content/huong-dan-anh.json`;
 * cùng script in trang này thành PDF khổ A4.
 *
 * Trang đứng riêng, không có khung ERP, để bản in chỉ có tài liệu.
 */

type Anh = { id: string; tep: string; rong: number; cao: number };
const ANH = new Map<string, Anh>((danhSachAnh.anh as Anh[]).map((a) => [a.id, a]));

function ngayVN(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function HinhChucNang({ id, ten, dien }: { id: string; ten: string; dien: "erp" | "web" }) {
  const anh = ANH.get(id);
  if (!anh) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-[#c9d2cd] px-3 py-6 text-center text-xs text-[#6e7b75]">
        Chưa có ảnh cho mục này. Chạy lại script chụp ảnh tài liệu.
      </p>
    );
  }
  return (
    <figure className={`anh mt-3 ${dien === "web" ? "max-w-[15rem]" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh của tài liệu, in ra PDF cần đúng tệp gốc */}
      <img src={anh.tep} alt={`Màn hình: ${ten}`} width={anh.rong} height={anh.cao} className="w-full rounded-lg border border-[#d8e0db]" loading="eager" />
      <figcaption className="mt-1 text-[0.7rem] text-[#6e7b75]">Chỗ có viền cam là nơi bắt đầu thao tác.</figcaption>
    </figure>
  );
}

function MucErp({ cn, so }: { cn: ChucNang; so: string }) {
  const duong = duongDanChucNang(cn);
  return (
    <article
      id={`muc-${cn.id}`}
      className="muc border-t border-[#e3e9e5] py-5"
      data-chup={cn.id}
      data-kieu="erp"
      data-duong-dan={`${duong}?chi=${cn.diem}`}
    >
      <h3 className="text-base font-black text-[#20342c]">
        <span className="mr-2 tabular-nums text-[#7a8a82]">{so}</span>
        {cn.ten}
      </h3>
      <p className="mt-1 text-xs text-[#5c6f67]">
        Ai làm: <strong>{ERP_ROLE_LABELS[cn.vai]}</strong>
        {cn.giamDocLamDuoc ? " · giám đốc làm thử được ngay" : ""} · Mở: <code>{duong}</code>
      </p>
      <p className="mt-2 text-sm leading-6 text-[#2c3c35]">{cn.moTa}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#2c3c35]">
        {cn.cacViec.map((viec) => (
          <li key={viec}>{viec}</li>
        ))}
      </ol>
      <HinhChucNang id={cn.id} ten={cn.ten} dien="erp" />
    </article>
  );
}

function MucWeb({ cn, so }: { cn: ChucNangWeb; so: string }) {
  return (
    <article
      id={`muc-${cn.id}`}
      className="muc border-t border-[#e3e9e5] py-5"
      data-chup={cn.id}
      data-kieu="web"
      data-duong-dan={cn.duongDan}
    >
      <h3 className="text-base font-black text-[#20342c]">
        <span className="mr-2 tabular-nums text-[#7a8a82]">{so}</span>
        {cn.ten}
      </h3>
      <p className="mt-1 text-xs text-[#5c6f67]">
        Trang của khách · Mở: <code>{cn.duongDan}</code>
        {cn.chiMayTinh ? " · chỉ thấy trên máy có chuột" : ""}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#2c3c35]">{cn.moTa}</p>
      {cn.cacViec.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#2c3c35]">
          {cn.cacViec.map((viec) => (
            <li key={viec}>{viec}</li>
          ))}
        </ol>
      ) : null}
      <HinhChucNang id={cn.id} ten={cn.ten} dien="web" />
    </article>
  );
}

export default async function TaiLieuHuongDanPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const nhomWeb = (Object.keys(TEN_NHOM_WEB) as NhomWeb[])
    .map((nhom) => ({ nhom, ten: TEN_NHOM_WEB[nhom], ds: CHUC_NANG_WEB.filter((cn) => cn.nhom === nhom) }))
    .filter((n) => n.ds.length > 0);
  const soErp = BAN_DO_CHUC_NANG.reduce((n, g) => n + g.chucNang.length, 0);
  const chupLuc = ngayVN(danhSachAnh.chupLuc);

  return (
    <main className="tai-lieu mx-auto max-w-4xl bg-white px-5 py-8 text-[#17231f] sm:px-10" lang="vi">
      <style>{`
        @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
        @media print {
          /* Nền dải màu của site bị in thành ảnh to trên từng trang (PDF hàng trăm MB): in nền trắng phẳng. */
          html, body { background: #fff !important; background-image: none !important; }
          body > *:not(:has(.tai-lieu)) { display: none !important; }
          *:has(.tai-lieu) { background: #fff !important; background-image: none !important; }
          *:has(.tai-lieu)::before, *:has(.tai-lieu)::after { display: none !important; }
          .tai-lieu, .tai-lieu * { box-shadow: none !important; backdrop-filter: none !important; filter: none !important; }
          .tai-lieu { max-width: none; padding: 0; }
          .khong-in { display: none !important; }
          .muc { break-inside: avoid-page; }
          .phan { break-before: page; }
          .anh img { max-height: 82mm; width: auto; max-width: 100%; border-radius: 0; }
          a { color: inherit; text-decoration: none; }
        }
      `}</style>

      <div className="khong-in mb-6 flex flex-wrap items-center gap-3">
        <Link href="/erp/huong-dan" className="text-sm font-bold text-[#183f34] underline underline-offset-2">
          ← Về Dạo một vòng
        </Link>
        {danhSachAnh.pdf ? (
          <a href={danhSachAnh.pdf} download className="rounded-xl bg-[#183f34] px-4 py-2 text-sm font-black text-white" data-testid="tai-pdf-huong-dan">
            Tải bản PDF
          </a>
        ) : null}
      </div>

      <section className="bia">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">Ninh Bình Journey</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-[#183f34]">Tài liệu hướng dẫn sử dụng</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#3d4a43]">
          Hệ thống điều hành (ERP) cho bốn cơ sở và trang của khách. Mỗi mục: việc ấy để làm gì, ai làm, mở ở đâu, các bước
          bấm, và ảnh màn hình có khoanh chỗ bắt đầu.
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-[#3d4a43] sm:grid-cols-3">
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Hệ thống điều hành</dt>
            <dd className="text-xl font-black">{soErp} chức năng</dd>
          </div>
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Trang của khách</dt>
            <dd className="text-xl font-black">{CHUC_NANG_WEB.length} chức năng</dd>
          </div>
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Ảnh chụp</dt>
            <dd className="text-xl font-black">{chupLuc ? `ngày ${chupLuc}` : "chưa chụp"}</dd>
          </div>
        </dl>
        <div className="mt-5 space-y-2 text-sm leading-6 text-[#2c3c35]">
          <p>
            <strong>Vào hệ thống:</strong> mở <code>/erp</code>, đăng nhập bằng tài khoản được cấp. Giám đốc chuyển sang vai
            khác bằng nút &quot;Xem theo vai&quot; để thử việc của nhân viên, quản lý, kế toán.
          </p>
          <p>
            <strong>Cài lên điện thoại:</strong> mở ERP bằng Chrome (Android) hay Safari (iPhone), chọn &quot;Thêm vào màn hình
            chính&quot;; bật thông báo để nhận báo khẩn cấp cả khi app đang đóng.
          </p>
          <p>
            <strong>Màn Dạo một vòng</strong> (<code>/erp/huong-dan</code>) đi cùng tài liệu này: bấm một việc là mở đúng màn, chỗ
            cần bấm được khoanh sáng.
          </p>
        </div>
      </section>

      <nav aria-labelledby="muc-luc" className="mt-8">
        <h2 id="muc-luc" className="text-lg font-black text-[#20342c]">Mục lục</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {BAN_DO_CHUC_NANG.map((nhom, i) => (
            <li key={nhom.id}>
              <a href={`#nhom-${nhom.id}`} className="text-[#183f34] underline-offset-2 hover:underline">
                A.{i + 1} {nhom.ten}
              </a>{" "}
              <span className="text-[#6e7b75]">· {nhom.chucNang.length} mục</span>
            </li>
          ))}
          {nhomWeb.map((nhom, i) => (
            <li key={nhom.nhom}>
              <a href={`#web-${nhom.nhom}`} className="text-[#183f34] underline-offset-2 hover:underline">
                B.{i + 1} {nhom.ten}
              </a>{" "}
              <span className="text-[#6e7b75]">· {nhom.ds.length} mục</span>
            </li>
          ))}
        </ol>
      </nav>

      <section className="phan mt-10">
        <h2 className="text-2xl font-black text-[#183f34]">A. Hệ thống điều hành</h2>
        {BAN_DO_CHUC_NANG.map((nhom, i) => (
          <section key={nhom.id} id={`nhom-${nhom.id}`} className="mt-6">
            <h2 className="text-lg font-black text-[#20342c]">
              A.{i + 1} {nhom.ten}
            </h2>
            {nhom.chucNang.map((cn, j) => (
              <MucErp key={cn.id} cn={cn} so={`A.${i + 1}.${j + 1}`} />
            ))}
          </section>
        ))}
      </section>

      <section className="phan mt-10">
        <h2 className="text-2xl font-black text-[#183f34]">B. Trang của khách</h2>
        {nhomWeb.map((nhom, i) => (
          <section key={nhom.nhom} id={`web-${nhom.nhom}`} className="mt-6">
            <h2 className="text-lg font-black text-[#20342c]">
              B.{i + 1} {nhom.ten}
            </h2>
            {nhom.ds.map((cn, j) => (
              <MucWeb key={cn.id} cn={cn} so={`B.${i + 1}.${j + 1}`} />
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}
