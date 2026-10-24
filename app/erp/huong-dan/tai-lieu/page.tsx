import Link from "next/link";
import { redirect } from "next/navigation";
import danhSachAnh from "@/content/huong-dan-anh.json";
import {
  BIA,
  BUOC_VAO,
  CACH_DOC,
  DE_LAM_GI,
  HANH_TRINH_KHACH,
  LOI_DAU,
  MO_NHOM_ERP,
  MO_NHOM_WEB,
  MOT_NGAY,
  NGUON,
  type AnhVanHoa,
  type ChangTrongNgay,
} from "@/content/tai-lieu-huong-dan";
import {
  BAN_DO_CHUC_NANG,
  CHUC_NANG_WEB,
  TEN_NHOM_WEB,
  duongDanChucNang,
  type ChucNang,
  type ChucNangWeb,
  type NhomWeb,
} from "@/domain/ban-do-chuc-nang";
import { ERP_ROLE_LABELS, type ErpRole } from "@/domain/erp";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export const metadata = { title: "Sổ tay vận hành", robots: { index: false, follow: false } };

/**
 * Sổ tay hướng dẫn toàn bộ chức năng (12/10/2026 việc 9; viết lại 14/10/2026
 * theo lời chủ dự án: kiểu dạy học, có mục đích từng chức năng, có văn hoá,
 * cách dùng từ A tới Z, ảnh ở mỗi chức năng).
 *
 * Các bước bấm lấy từ bản đồ chức năng (`domain/ban-do-chuc-nang.ts`), cùng
 * nguồn với màn Dạo một vòng; lời dẫn, mục đích và một ngày vận hành ở
 * `content/tai-lieu-huong-dan.ts`. Ảnh do `scripts/chup-tai-lieu-huong-dan.mjs`
 * chụp (chỗ cần bấm khoanh bằng `?chi=`) rồi in trang này thành PDF A4.
 *
 * Trang đứng riêng, không có khung ERP, để bản in chỉ có sổ tay.
 */

type Anh = { id: string; tep: string; rong: number; cao: number };
const ANH = new Map<string, Anh>((danhSachAnh.anh as Anh[]).map((a) => [a.id, a]));

const XANH = "#183f34";

function ngayVN(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

/** Ảnh màn hình của một chức năng. Script in PDF thay nội dung `figure.anh` bằng ảnh vừa chụp. */
function HinhChucNang({ id, ten, dien }: { id: string; ten: string; dien: "erp" | "web" }) {
  const anh = ANH.get(id);
  return (
    <figure className={`anh ${dien === "web" ? "anh-web" : "anh-erp"}`}>
      {anh ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh của sổ tay, in ra PDF cần đúng tệp gốc */}
          <img src={anh.tep} alt={`Màn hình: ${ten}`} width={anh.rong} height={anh.cao} className="w-full rounded-lg border border-[#d8e0db]" loading="eager" />
          <figcaption className="mt-1 text-[0.7rem] text-[#6e7b75]">
            {dien === "erp" ? "Khung viền cam là chỗ bắt đầu bấm." : "Trang của khách trên điện thoại."}
          </figcaption>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-[#c9d2cd] px-3 py-6 text-center text-xs text-[#6e7b75]">
          Chưa có ảnh cho mục này. Chạy lại script chụp ảnh sổ tay.
        </p>
      )}
    </figure>
  );
}

function AnhMoChuong({ anh }: { anh: AnhVanHoa }) {
  return (
    <figure className="anh-chuong mt-4 overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh đã nén sẵn cho bản in */}
      <img src={anh.tep} alt={anh.chu} className="h-48 w-full object-cover sm:h-64" loading="eager" />
      <figcaption className="bg-[#f4f1ea] px-3 py-1.5 text-[0.7rem] italic text-[#6b6255]">{anh.chu}</figcaption>
    </figure>
  );
}

function DeLamGi({ id }: { id: string }) {
  const loi = DE_LAM_GI[id];
  if (!loi) return null;
  return (
    <div className="mt-3 border-l-[3px] border-[#c2924f] bg-[#faf6ee] py-2 pl-3 pr-2">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#9a6328]">Để làm gì</p>
      <p className="mt-0.5 font-serif text-[0.98rem] leading-7 text-[#2f2a22]">{loi}</p>
    </div>
  );
}

function CacBuoc({ ds }: { ds: readonly string[] }) {
  if (!ds.length) return null;
  return (
    <>
      <p className="mt-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#5b7c6e]">Các bước</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#2c3c35]">
        {ds.map((viec) => (
          <li key={viec}>{viec}</li>
        ))}
      </ol>
    </>
  );
}

function MucErp({ cn, so }: { cn: ChucNang; so: string }) {
  const duong = duongDanChucNang(cn);
  return (
    <article id={`muc-${cn.id}`} className="muc muc-erp border-t border-[#e3e9e5] py-6" data-chup={cn.id} data-kieu="erp" data-duong-dan={`${duong}?chi=${cn.diem}`}>
      <div className="min-w-0">
        <h3 className="font-serif text-xl font-semibold leading-tight text-[#20342c]">
          <span className="mr-2 font-sans text-sm font-black tabular-nums text-[#9a6328]">{so}</span>
          {cn.ten}
        </h3>
        <DeLamGi id={cn.id} />
        <p className="mt-3 text-xs leading-5 text-[#5c6f67]">
          Ai làm: <strong>{ERP_ROLE_LABELS[cn.vai]}</strong>
          {cn.giamDocLamDuoc ? " · giám đốc làm thử được ngay" : ""} · Mở: <code>{duong}</code>
        </p>
        <p className="mt-1 text-sm leading-6 text-[#2c3c35]">{cn.moTa}</p>
        <CacBuoc ds={cn.cacViec} />
      </div>
      <HinhChucNang id={cn.id} ten={cn.ten} dien="erp" />
    </article>
  );
}

function MucWeb({ cn, so }: { cn: ChucNangWeb; so: string }) {
  return (
    <article id={`muc-${cn.id}`} className="muc muc-web border-t border-[#e3e9e5] py-6" data-chup={cn.id} data-kieu="web" data-duong-dan={cn.duongDan}>
      <div className="min-w-0">
        <h3 className="font-serif text-xl font-semibold leading-tight text-[#20342c]">
          <span className="mr-2 font-sans text-sm font-black tabular-nums text-[#9a6328]">{so}</span>
          {cn.ten}
        </h3>
        <DeLamGi id={cn.id} />
        <p className="mt-3 text-xs leading-5 text-[#5c6f67]">
          Trang của khách · Mở: <code>{cn.duongDan}</code>
          {cn.chiMayTinh ? " · chỉ thấy trên máy có chuột" : ""}
        </p>
        <p className="mt-1 text-sm leading-6 text-[#2c3c35]">{cn.moTa}</p>
        <CacBuoc ds={cn.cacViec} />
      </div>
      <HinhChucNang id={cn.id} ten={cn.ten} dien="web" />
    </article>
  );
}

function DongThoiGian({ chang, so }: { chang: readonly ChangTrongNgay[]; so: Map<string, { so: string; ten: string }> }) {
  return (
    <ol className="mt-4">
      {chang.map((c) => (
        <li key={c.ten} className="chang grid grid-cols-[4.6rem_1fr] gap-3 border-t border-[#e8e2d6] py-3 sm:grid-cols-[6rem_1fr]">
          <p className="font-serif text-base font-semibold leading-6 text-[#9a6328]">{c.luc}</p>
          <div className="min-w-0">
            <p className="font-black text-[#20342c]">{c.ten}</p>
            <p className="mt-0.5 text-sm leading-6 text-[#3d4a43]">{c.loi}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {c.muc.map((id) => {
                const m = so.get(id);
                return m ? (
                  <a key={id} href={`#muc-${id}`} className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-[0.72rem] font-bold text-[#35594b]">
                    {m.so} {m.ten}
                  </a>
                ) : null;
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function SoTayVanHanhPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");

  const nhomWeb = (Object.keys(TEN_NHOM_WEB) as NhomWeb[])
    .map((nhom) => ({ nhom, ten: TEN_NHOM_WEB[nhom], ds: CHUC_NANG_WEB.filter((cn) => cn.nhom === nhom) }))
    .filter((n) => n.ds.length > 0);
  const soErp = BAN_DO_CHUC_NANG.reduce((n, g) => n + g.chucNang.length, 0);
  const chupLuc = ngayVN(danhSachAnh.chupLuc);

  const so = new Map<string, { so: string; ten: string }>();
  BAN_DO_CHUC_NANG.forEach((nhom, i) => nhom.chucNang.forEach((cn, j) => so.set(cn.id, { so: `A.${i + 1}.${j + 1}`, ten: cn.ten })));
  nhomWeb.forEach((nhom, i) => nhom.ds.forEach((cn, j) => so.set(cn.id, { so: `B.${i + 1}.${j + 1}`, ten: cn.ten })));

  const theoVai = new Map<ErpRole, ChucNang[]>();
  for (const cn of BAN_DO_CHUC_NANG.flatMap((n) => n.chucNang)) theoVai.set(cn.vai, [...(theoVai.get(cn.vai) ?? []), cn]);

  return (
    <main className="tai-lieu mx-auto max-w-4xl bg-white px-4 py-8 text-[#17231f] sm:px-10" lang="vi">
      <style>{`
        @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
        .muc-web { display: grid; gap: 1rem; }
        .anh { margin-top: 0.9rem; }
        .anh-web { max-width: 15rem; }
        @media (min-width: 640px) {
          .muc-web { grid-template-columns: minmax(0, 1fr) 13rem; align-items: start; }
          .muc-web .anh-web { margin-top: 0; }
        }
        @media print {
          /* Nền dải màu của site bị in thành ảnh to trên từng trang (PDF hàng trăm MB): in nền trắng phẳng. */
          html, body { background: #fff !important; background-image: none !important; }
          /* Chữ in nhỏ hơn màn hình một chút: mỗi trang A4 vừa hai chức năng. */
          html { font-size: 12.5px; }
          body > *:not(:has(.tai-lieu)) { display: none !important; }
          *:has(.tai-lieu) { background: #fff !important; background-image: none !important; }
          *:has(.tai-lieu)::before, *:has(.tai-lieu)::after { display: none !important; }
          .tai-lieu, .tai-lieu * { box-shadow: none !important; backdrop-filter: none !important; filter: none !important; }
          .tai-lieu { max-width: none; padding: 0; }
          .khong-in { display: none !important; }
          .muc, .chang, .o-vao { break-inside: avoid-page; }
          .chuong { break-before: page; }
          .bia { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
          .bia-anh img { height: 120mm !important; }
          .anh-chuong img { height: 62mm !important; }
          /* Hai cột: chữ bên trái, ảnh bên phải, mỗi trang vừa hai ba chức năng. */
          .muc { padding-top: 4mm; padding-bottom: 4mm; }
          .muc-erp { display: grid; grid-template-columns: minmax(0, 1fr) 84mm; gap: 5mm; align-items: start; }
          .muc-web { grid-template-columns: minmax(0, 1fr) 46mm; gap: 5mm; align-items: start; }
          .muc-erp .anh, .muc-web .anh { margin-top: 0; max-width: none; }
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

      {/* Bìa */}
      <section className="bia">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9a6328]">Ninh Bình Journey</p>
          <h1 className="mt-3 font-serif text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-6xl" style={{ color: XANH }}>
            Sổ tay vận hành
          </h1>
          <p className="mt-3 max-w-2xl font-serif text-lg italic leading-8 text-[#4a4237]">
            Hệ thống điều hành bốn cơ sở và trang của khách, kể từng việc một: để làm gì, ai làm, bấm thế nào.
          </p>
        </div>
        <figure className="bia-anh mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh bìa đã nén sẵn */}
          <img src={BIA.tep} alt={BIA.chu} className="h-64 w-full object-cover sm:h-96" loading="eager" />
          <figcaption className="bg-[#f4f1ea] px-3 py-1.5 text-[0.7rem] italic text-[#6b6255]">{BIA.chu}</figcaption>
        </figure>
        <dl className="mt-6 grid grid-cols-3 gap-2 text-sm text-[#3d4a43]">
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Hệ thống điều hành</dt>
            <dd className="text-lg font-black sm:text-xl">{soErp} chức năng</dd>
          </div>
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Trang của khách</dt>
            <dd className="text-lg font-black sm:text-xl">{CHUC_NANG_WEB.length} chức năng</dd>
          </div>
          <div className="rounded-xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#6e7b75]">Ảnh chụp</dt>
            <dd className="text-lg font-black sm:text-xl">{chupLuc ?? "chưa chụp"}</dd>
          </div>
        </dl>
      </section>

      {/* Lời đầu */}
      <section className="chuong mt-12">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">Lời đầu</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight" style={{ color: XANH }}>
          Vì sao có hệ thống này
        </h2>
        <AnhMoChuong anh={LOI_DAU.anh} />
        <div className="mt-5 space-y-4 font-serif text-[1.05rem] leading-8 text-[#2f2a22]">
          {LOI_DAU.doan.map((doan) => (
            <p key={doan.slice(0, 24)}>{doan}</p>
          ))}
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {LOI_DAU.baDieu.map((d) => (
            <li key={d.ten} className="o-vao rounded-xl border border-[#e3dccd] bg-[#faf6ee] p-4">
              <p className="font-serif text-lg font-semibold text-[#20342c]">{d.ten}</p>
              <p className="mt-1 text-sm leading-6 text-[#4a4237]">{d.loi}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 font-serif text-xl font-semibold text-[#20342c]">Cách đọc sổ tay</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#2c3c35]">
          {CACH_DOC.map((dong) => (
            <li key={dong}>{dong}</li>
          ))}
        </ul>
      </section>

      {/* Bước vào và một ngày từ A tới Z: chạy tiếp sau lời đầu, khỏi bỏ trống nửa trang */}
      <section className="mt-12">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">Bắt đầu</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight" style={{ color: XANH }}>
          Bước vào hệ thống
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {BUOC_VAO.map((b, i) => (
            <div key={b.ten} className="o-vao rounded-xl bg-[#f3f6f4] p-4">
              <dt className="font-black text-[#20342c]">
                <span className="mr-2 font-serif text-[#9a6328]">{i + 1}</span>
                {b.ten}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-[#3d4a43]">{b.loi}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-10 font-serif text-3xl font-semibold leading-tight" style={{ color: XANH }}>
          Một ngày vận hành, từ A tới Z
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#4a4237]">
          Theo chân một ngày ở bến, từ lúc trời còn sương tới khi khép sổ. Mỗi chặng ghi số mục để mở ra xem kỹ.
        </p>
        <DongThoiGian chang={MOT_NGAY} so={so} />

        <h3 className="mt-10 font-serif text-2xl font-semibold text-[#20342c]">Hành trình một vị khách</h3>
        <p className="mt-2 text-sm leading-6 text-[#4a4237]">Cùng ngày ấy, nhìn từ phía khách: những việc khách tự làm trên điện thoại là việc nhân viên được nhẹ.</p>
        <DongThoiGian chang={HANH_TRINH_KHACH} so={so} />
      </section>

      {/* Mục lục */}
      <nav aria-labelledby="muc-luc" className="chuong mt-12">
        <h2 id="muc-luc" className="font-serif text-3xl font-semibold" style={{ color: XANH }}>
          Mục lục
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">A. Hệ thống điều hành</p>
            <ol className="mt-2 space-y-1 text-sm">
              {BAN_DO_CHUC_NANG.map((nhom, i) => (
                <li key={nhom.id}>
                  <a href={`#nhom-${nhom.id}`} className="text-[#183f34] underline-offset-2 hover:underline">
                    A.{i + 1} {nhom.ten}
                  </a>{" "}
                  <span className="text-[#6e7b75]">· {nhom.chucNang.length} mục</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">B. Trang của khách</p>
            <ol className="mt-2 space-y-1 text-sm">
              {nhomWeb.map((nhom, i) => (
                <li key={nhom.nhom}>
                  <a href={`#web-${nhom.nhom}`} className="text-[#183f34] underline-offset-2 hover:underline">
                    B.{i + 1} {nhom.ten}
                  </a>{" "}
                  <span className="text-[#6e7b75]">· {nhom.ds.length} mục</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">Phụ lục</p>
            <ol className="mt-2 space-y-1 text-sm">
              <li>
                <a href="#ai-lam-gi" className="text-[#183f34]">Ai làm việc gì</a>
              </li>
              <li>
                <a href="#nguon" className="text-[#183f34]">Nguồn tư liệu văn hoá</a>
              </li>
            </ol>
          </div>
        </div>
      </nav>

      {/* A. Hệ thống điều hành */}
      {BAN_DO_CHUC_NANG.map((nhom, i) => {
        const mo = MO_NHOM_ERP[nhom.id];
        return (
          <section key={nhom.id} id={`nhom-${nhom.id}`} className="chuong mt-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">A. Hệ thống điều hành · chương {i + 1}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight" style={{ color: XANH }}>
              A.{i + 1} {nhom.ten}
            </h2>
            {mo ? (
              <>
                <AnhMoChuong anh={mo.anh} />
                <p className="mt-4 font-serif text-[1.05rem] italic leading-8 text-[#3a342b]">{mo.loi}</p>
              </>
            ) : null}
            {nhom.chucNang.map((cn, j) => (
              <MucErp key={cn.id} cn={cn} so={`A.${i + 1}.${j + 1}`} />
            ))}
          </section>
        );
      })}

      {/* B. Trang của khách */}
      {nhomWeb.map((nhom, i) => {
        const mo = MO_NHOM_WEB[nhom.nhom];
        return (
          <section key={nhom.nhom} id={`web-${nhom.nhom}`} className="chuong mt-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">B. Trang của khách · chương {i + 1}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight" style={{ color: XANH }}>
              B.{i + 1} {nhom.ten}
            </h2>
            {mo.anh ? <AnhMoChuong anh={mo.anh} /> : null}
            <p className="mt-4 font-serif text-[1.05rem] italic leading-8 text-[#3a342b]">{mo.loi}</p>
            {nhom.ds.map((cn, j) => (
              <MucWeb key={cn.id} cn={cn} so={`B.${i + 1}.${j + 1}`} />
            ))}
          </section>
        );
      })}

      {/* Phụ lục */}
      <section id="ai-lam-gi" className="chuong mt-14">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6328]">Phụ lục</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold" style={{ color: XANH }}>
          Ai làm việc gì
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#4a4237]">
          Mỗi việc thuộc về một vai. Người bán vé chẳng tự huỷ phiếu mình bán, kế toán lập thì kế toán trưởng mới ghi sổ: tách việc để giữ tiền.
          Giám đốc thử việc của vai khác bằng nút Vai trò.
        </p>
        <div className="mt-4 space-y-3">
          {[...theoVai.entries()].map(([vai, ds]) => (
            <div key={vai} className="o-vao rounded-xl bg-[#f3f6f4] p-4">
              <p className="font-black text-[#20342c]">
                {ERP_ROLE_LABELS[vai]} <span className="font-bold text-[#6e7b75]">· {ds.length} việc</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-[#3d4a43]">{ds.map((cn) => `${so.get(cn.id)?.so} ${cn.ten}`).join(" · ")}</p>
            </div>
          ))}
        </div>

        <h2 id="nguon" className="mt-10 font-serif text-2xl font-semibold" style={{ color: XANH }}>
          Nguồn tư liệu văn hoá
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#4a4237]">
          Dữ kiện về di sản, lịch sử lấy từ phần nội dung điểm đến đã kiểm nguồn của Ninh Bình Journey và các bài dưới đây. Ngày lễ hội có thể xê dịch
          theo năm; nên xem thông báo chính thức trước mỗi mùa.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[#2c3c35]">
          {NGUON.map((n) => (
            <li key={n.url}>
              {n.ten}. <span className="break-all text-[#6e7b75]">{n.url}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
