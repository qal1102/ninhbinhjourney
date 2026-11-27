"use client";

import { useMemo, useState } from "react";
import { ReportExportBar } from "@/components/erp/report-export-bar";
import {
  CHU_DE,
  NGUON,
  camXucCua,
  cauKetLuan,
  demTheoChuDe,
  diemTrungBinh,
  laKhachViet,
  tongTheoCoSo,
  trongKhoang,
  tyLeHaiLong,
  type CamXuc,
  type DanhGiaNgoai,
  type DuLieuDanhGiaNgoai,
} from "@/domain/danh-gia-ngoai";
import type { ErpReport } from "@/lib/export/report";

type CoSo = { id: string; ten: string };
type Khach = "tat-ca" | "viet" | "quoc-te";

const KHOANG = [
  { soNgay: 7, ten: "7 ngày" },
  { soNgay: 30, ten: "30 ngày" },
  { soNgay: 90, ten: "90 ngày" },
] as const;

const TEN_CAM_XUC: Record<CamXuc, string> = { "tich-cuc": "Khen", "trung-lap": "Trung lập", "tieu-cuc": "Chê" };
const SO_DONG_MOT_LAN = 30;

const NUT =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#183f34] focus-visible:ring-offset-2";

function nutChon(chon: boolean) {
  return `${NUT} ${chon ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#cbd7d1] bg-white text-[#183f34] hover:border-[#183f34]"}`;
}

function soVN(n: number | null, phanThapPhan = 0) {
  if (n == null) return "–";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: phanThapPhan, maximumFractionDigits: phanThapPhan });
}

function caiLuc(iso: string, bayGio: number) {
  const phut = Math.round((bayGio - Date.parse(iso)) / 60000);
  if (phut < 60) return `${Math.max(phut, 1)} phút trước`;
  const gio = Math.round(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  const ngay = Math.round(gio / 24);
  return ngay < 31 ? `${ngay} ngày trước` : new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function gioVN(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export function KhachNoiGiWorkspace({ duLieu, coSo, bayGio }: { duLieu: DuLieuDanhGiaNgoai; coSo: CoSo[]; bayGio: string }) {
  const moc = useMemo(() => new Date(bayGio), [bayGio]);
  const [coSoChon, setCoSoChon] = useState<string>("tat-ca");
  const [soNgay, setSoNgay] = useState<number>(30);
  const [khach, setKhach] = useState<Khach>("tat-ca");
  const [chiChe, setChiChe] = useState(false);
  const [tim, setTim] = useState("");
  const [soDong, setSoDong] = useState(SO_DONG_MOT_LAN);

  const tenCoSo = useMemo(() => new Map(coSo.map((c) => [c.id, c.ten])), [coSo]);

  const trongPhamVi = useMemo(() => {
    return trongKhoang(duLieu.banGhi, soNgay, moc).filter(
      (bg) =>
        (coSoChon === "tat-ca" || bg.coSo === coSoChon) &&
        (khach === "tat-ca" || (khach === "viet" ? laKhachViet(bg) : !laKhachViet(bg))),
    );
  }, [duLieu.banGhi, soNgay, moc, coSoChon, khach]);

  const danhSach = useMemo(() => {
    const q = tim.trim().toLowerCase();
    return trongPhamVi.filter(
      (bg) =>
        (!chiChe || camXucCua(bg) === "tieu-cuc") &&
        (!q || bg.noiDung.toLowerCase().includes(q) || (bg.banDich ?? "").toLowerCase().includes(q)),
    );
  }, [trongPhamVi, chiChe, tim]);

  const chuDe = useMemo(() => demTheoChuDe(trongPhamVi), [trongPhamVi]);
  const lonNhat = Math.max(1, ...chuDe.map((c) => Math.max(c.khen, c.che)));
  const theoCoSo = useMemo(
    () => tongTheoCoSo(trongKhoang(duLieu.banGhi, soNgay, moc).filter((bg) => khach === "tat-ca" || (khach === "viet" ? laKhachViet(bg) : !laKhachViet(bg))), coSo.map((c) => c.id)),
    [duLieu.banGhi, soNgay, moc, khach, coSo],
  );
  const ketLuan = cauKetLuan(trongPhamVi);
  const lanGanNhat = duLieu.lanChay[0];

  const baoCao: ErpReport = {
    screen: "Khách nói gì trên mạng",
    site: coSoChon === "tat-ca" ? "Toàn vùng" : (tenCoSo.get(coSoChon) ?? coSoChon),
    period: `${soNgay} ngày tới ${moc.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    source: "Google Maps và Tripadvisor, chia chủ đề bằng AI",
    fileSlug: "khach-noi-gi",
    sheets: [
      {
        name: "Đánh giá",
        tables: [
          {
            title: "Đánh giá trên mạng",
            columns: [
              { header: "Ngày", kind: "datetime" },
              { header: "Cơ sở", kind: "text" },
              { header: "Nguồn", kind: "text" },
              { header: "Khách", kind: "text" },
              { header: "Sao", kind: "integer" },
              { header: "Cảm xúc", kind: "text" },
              { header: "Chủ đề", kind: "text" },
              { header: "Nội dung", kind: "text" },
              { header: "Bản dịch", kind: "text" },
            ],
            rows: danhSach.map((bg) => {
              const cx = camXucCua(bg);
              return [
                bg.ngay,
                tenCoSo.get(bg.coSo) ?? bg.coSo,
                NGUON[bg.nguon],
                laKhachViet(bg) ? "Việt" : "Quốc tế",
                bg.sao,
                cx ? TEN_CAM_XUC[cx] : "",
                (bg.chuDe ?? []).map((c) => `${c.tot ? "Khen" : "Chê"}: ${CHU_DE[c.k]}`).join("; "),
                bg.noiDung,
                bg.banDich ?? "",
              ];
            }),
            emptyText: "Không có đánh giá nào khớp bộ lọc.",
          },
        ],
      },
    ],
  };

  const soLieu: { so: string; nhan: string }[] = [
    { so: soVN(trongPhamVi.length), nhan: `đánh giá trong ${soNgay} ngày` },
    { so: diemTrungBinh(trongPhamVi) == null ? "–" : `${soVN(diemTrungBinh(trongPhamVi), 1)} / 5`, nhan: "điểm trung bình" },
    { so: tyLeHaiLong(trongPhamVi.filter(laKhachViet)) == null ? "–" : `${tyLeHaiLong(trongPhamVi.filter(laKhachViet))}%`, nhan: "khách Việt hài lòng" },
    { so: tyLeHaiLong(trongPhamVi.filter((bg) => !laKhachViet(bg))) == null ? "–" : `${tyLeHaiLong(trongPhamVi.filter((bg) => !laKhachViet(bg)))}%`, nhan: "khách quốc tế hài lòng" },
  ];

  return (
    <div data-chi="khach-noi-gi" data-chi-loi="Đánh giá mới trên Google Maps và Tripadvisor, cập nhật hai lần mỗi ngày.">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dbe2de] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cơ sở">
          {[{ id: "tat-ca", ten: "Cả bốn cơ sở" }, ...coSo].map((c) => (
            <button key={c.id} type="button" aria-pressed={coSoChon === c.id} className={nutChon(coSoChon === c.id)} onClick={() => { setCoSoChon(c.id); setSoDong(SO_DONG_MOT_LAN); }}>
              {c.ten}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Khoảng thời gian">
            {KHOANG.map((k) => (
              <button key={k.soNgay} type="button" aria-pressed={soNgay === k.soNgay} className={nutChon(soNgay === k.soNgay)} onClick={() => setSoNgay(k.soNgay)}>
                {k.ten}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Khách">
            {([["tat-ca", "Mọi khách"], ["viet", "Khách Việt"], ["quoc-te", "Khách quốc tế"]] as const).map(([ma, ten]) => (
              <button key={ma} type="button" aria-pressed={khach === ma} className={nutChon(khach === ma)} onClick={() => setKhach(ma)}>
                {ten}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-[#68776f]">
          {duLieu.capNhat ? `Cập nhật lúc ${gioVN(duLieu.capNhat)}. Lấy tiếp lúc 7 giờ và 19 giờ.` : "Chưa có lượt lấy nào."}
          {lanGanNhat && lanGanNhat.loi.length > 0 ? ` Lượt gần nhất có ${lanGanNhat.loi.length} nguồn không lấy được.` : ""}
        </p>
      </div>

      {ketLuan ? (
        <p className="mt-5 rounded-2xl bg-[#183f34] px-5 py-4 text-lg font-bold leading-8 text-white sm:text-xl">{ketLuan}</p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-x-6 border-b border-[#dbe2de] pb-5 lg:grid-cols-4">
        {soLieu.map((o) => (
          <div key={o.nhan} className="py-2">
            <dt className="text-sm text-[#68776f]">{o.nhan}</dt>
            <dd className="font-display whitespace-nowrap text-4xl leading-tight text-[#183f34] tabular-nums">{o.so}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h2 className="text-xl font-black text-[#1f2f2a]">Khen và chê theo chủ đề</h2>
          {chuDe.length === 0 ? (
            <p className="mt-3 text-[#68776f]">Chưa có đánh giá nào được chia chủ đề trong khoảng này.</p>
          ) : (
            <div className="mt-3">
              <div className="mb-2 flex justify-between text-xs font-bold text-[#68776f]">
                <span>Chê</span>
                <span>Khen</span>
              </div>
              <ul className="space-y-3">
                {chuDe.map((c) => (
                  <li key={c.ma}>
                    <p className="text-sm font-bold text-[#1f2f2a]">{c.ten}</p>
                    <div className="mt-1 grid grid-cols-2 items-center">
                      <div className="flex h-3.5 items-center justify-end border-r-2 border-[#1f2f2a]">
                        <span className="pr-2 text-xs tabular-nums text-[#68776f]">{c.che || ""}</span>
                        <span className="h-full rounded-l-full bg-[#c2492d] motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${(c.che / lonNhat) * 80}%` }} />
                      </div>
                      <div className="flex h-3.5 items-center">
                        <span className="h-full rounded-r-full bg-[#2f7d62] motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${(c.khen / lonNhat) * 80}%` }} />
                        <span className="pl-2 text-xs tabular-nums text-[#68776f]">{c.khen || ""}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2 className="mt-8 text-xl font-black text-[#1f2f2a]">Theo cơ sở</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#dbe2de] text-left text-xs text-[#68776f]">
                  <th scope="col" className="py-2 pr-2 font-bold">Cơ sở</th>
                  <th scope="col" className="py-2 pr-2 text-right font-bold">Lời</th>
                  <th scope="col" className="py-2 pr-2 text-right font-bold">Điểm</th>
                  <th scope="col" className="py-2 pr-2 text-right font-bold">Hài lòng</th>
                  <th scope="col" className="py-2 font-bold">Bị chê nhất</th>
                </tr>
              </thead>
              <tbody>
                {theoCoSo.map((o) => (
                  <tr key={o.coSo} className="border-b border-[#eef2ef]">
                    <td className="py-2 pr-2 font-bold text-[#1f2f2a]">{tenCoSo.get(o.coSo) ?? o.coSo}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{soVN(o.soLoi)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{soVN(o.diem, 1)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{o.haiLong == null ? "–" : `${o.haiLong}%`}</td>
                    <td className="py-2 text-[#43554e]">{o.biCheNhieuNhat ? `${o.biCheNhieuNhat.ten} (${o.biCheNhieuNhat.che})` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-[#1f2f2a]">Từng đánh giá</h2>
            <ReportExportBar report={baoCao} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={chiChe} className={nutChon(chiChe)} onClick={() => setChiChe((v) => !v)}>
              Chỉ lời chê
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Tìm trong đánh giá</span>
              <input
                id="khach-noi-gi-tim"
                type="search"
                value={tim}
                onChange={(e) => setTim(e.target.value)}
                placeholder="Tìm chữ, ví dụ: tip, vệ sinh"
                className="min-h-11 w-full min-w-[12rem] rounded-full border border-[#cbd7d1] bg-white px-4 text-base text-[#1f2f2a] outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
              />
            </label>
          </div>

          {danhSach.length === 0 ? (
            <p className="mt-4 text-[#68776f]">Không có đánh giá nào khớp bộ lọc.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {danhSach.slice(0, soDong).map((bg) => (
                <TheDanhGia key={bg.id} bg={bg} tenCoSo={tenCoSo.get(bg.coSo) ?? bg.coSo} bayGio={moc.getTime()} />
              ))}
            </ul>
          )}
          {danhSach.length > soDong ? (
            <button type="button" className={`${nutChon(false)} mt-4`} onClick={() => setSoDong((n) => n + SO_DONG_MOT_LAN)}>
              Xem thêm {Math.min(SO_DONG_MOT_LAN, danhSach.length - soDong)} đánh giá
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TheDanhGia({ bg, tenCoSo, bayGio }: { bg: DanhGiaNgoai; tenCoSo: string; bayGio: number }) {
  const cx = camXucCua(bg);
  return (
    <li className="rounded-2xl border border-[#dbe2de] bg-white p-4 motion-safe:animate-[luxury-copy-enter_420ms_ease-out_both]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-bold text-[#1f2f2a]">{tenCoSo}</span>
        <span className="rounded-full bg-[#eef3f0] px-2 py-0.5 text-xs font-bold text-[#43554e]">{NGUON[bg.nguon]}</span>
        {bg.sao != null ? (
          <span className="text-[#b8860b]" aria-label={`${bg.sao} sao`}>
            <span aria-hidden>{"★".repeat(bg.sao)}{"☆".repeat(5 - bg.sao)}</span>
          </span>
        ) : null}
        {cx ? <span className={`text-xs font-bold ${cx === "tieu-cuc" ? "text-[#c2492d]" : cx === "tich-cuc" ? "text-[#2f7d62]" : "text-[#68776f]"}`}>{TEN_CAM_XUC[cx]}</span> : null}
        <span className="ml-auto whitespace-nowrap text-[#68776f]">{caiLuc(bg.ngay, bayGio)}</span>
      </div>
      {bg.noiDung ? <p className="mt-2 leading-7 text-[#1f2f2a]">{bg.noiDung}</p> : <p className="mt-2 text-[#68776f]">Chỉ chấm sao, không viết gì.</p>}
      {bg.banDich ? <p className="mt-2 border-l-2 border-[#cbd7d1] pl-3 leading-7 text-[#43554e]">{bg.banDich}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(bg.chuDe ?? []).map((c) => (
          <span key={c.k} className={`rounded-full border px-2 py-0.5 text-xs font-bold ${c.tot ? "border-[#2f7d62] text-[#2f7d62]" : "border-[#c2492d] text-[#c2492d]"}`}>
            {c.tot ? "Khen" : "Chê"}: {CHU_DE[c.k]}
          </span>
        ))}
        {bg.lienKet?.startsWith("https://") ? (
          <a href={bg.lienKet} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-bold text-[#183f34] underline underline-offset-2">
            Xem bản gốc
          </a>
        ) : null}
      </div>
    </li>
  );
}
