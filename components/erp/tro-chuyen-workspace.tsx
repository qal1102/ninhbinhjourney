"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  coTep,
  danhMucGan,
  duongDanThe,
  laAnh,
  tenPhong,
  type MucGan,
  type Phong,
  type TepDinhKem,
  type TheGan,
  type TinNhan,
} from "@/domain/tro-chuyen";
import { useKenh, type CauHinhRealtime, type SuKienKenh } from "@/lib/tro-chuyen/use-kenh";

export type NguoiChon = { id: string; ten: string; chucDanh: string };
export type VanBanChon = { id: string; ten: string };

type Props = {
  toi: { id: string; ten: string };
  danhBa: NguoiChon[];
  giaoDuoc: string[];
  coSoMau: string;
  vanBan: VanBanChon[];
  realtime: CauHinhRealtime;
  hopThu: string;
  phongDau: string | null;
  luuTru: "supabase" | "memory";
};

const TEN_THE: Record<TheGan["kieu"], string> = { "chuc-nang": "Chức năng", "trang-khach": "Trang của khách", "van-ban": "Văn bản" };

function gio(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
}
function ngay(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit" });
}
function luc(iso: string) {
  const d = new Date(iso);
  const homNay = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) === homNay ? gio(iso) : d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
}
function chuCai(ten: string) {
  const tu = ten.trim().split(/\s+/);
  return (tu.at(-1)?.[0] ?? "?").toUpperCase();
}
function hanMacDinhLocal() {
  const d = new Date();
  if (d.getHours() >= 17) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setHours(17, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function thuNhoAnh(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.type === "image/gif") return f;
  const anh = await createImageBitmap(f).catch(() => null);
  if (!anh) return f;
  const ti = Math.min(1, 1600 / Math.max(anh.width, anh.height));
  if (ti === 1 && f.size < 1_200_000) return f;
  const c = document.createElement("canvas");
  c.width = Math.round(anh.width * ti);
  c.height = Math.round(anh.height * ti);
  c.getContext("2d")?.drawImage(anh, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
}

export function TroChuyenWorkspace(props: Props) {
  const { toi, realtime, hopThu } = props;
  const router = useRouter();
  const [phong, setPhong] = useState<Phong[]>([]);
  const [daTaiDs, setDaTaiDs] = useState(false);
  const [dangMo, setDangMo] = useState<string | null>(props.phongDau);
  // Tin giữ theo từng phòng: đổi phòng không phải xoá state trong effect, quay lại là thấy ngay.
  const [tinTheoPhong, setTinTheoPhong] = useState<Record<string, TinNhan[]>>({});
  const [hetCuTheoPhong, setHetCuTheoPhong] = useState<Record<string, boolean>>({});
  const [loi, setLoi] = useState("");
  const [dangGo, setDangGo] = useState<Record<string, { phong: string; ten: string; den: number }>>({});
  const [moMoi, setMoMoi] = useState(false);

  const phongMo = phong.find((p) => p.id === dangMo) ?? null;
  const tin = useMemo(() => (dangMo ? (tinTheoPhong[dangMo] ?? []) : []), [dangMo, tinTheoPhong]);
  const kenh = useMemo(() => [hopThu, ...(phongMo ? [`nbj-tc-${phongMo.kenh}`] : [])], [hopThu, phongMo]);

  const taiDs = useCallback(async () => {
    const res = await fetch("/api/erp/tro-chuyen", { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { phong?: Phong[]; message?: string } | null;
    if (res?.ok && d?.phong) {
      setPhong(d.phong);
      setDaTaiDs(true);
    } else if (d?.message) setLoi(d.message);
  }, []);

  const taiTin = useCallback(async (id: string, truoc?: string) => {
    const res = await fetch(`/api/erp/tro-chuyen/${id}${truoc ? `?truoc=${encodeURIComponent(truoc)}` : ""}`, { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { tin?: TinNhan[]; phong?: Phong; message?: string } | null;
    if (!res?.ok || !d?.tin) {
      if (d?.message) setLoi(d.message);
      return;
    }
    const moi = d.tin;
    if (truoc && moi.length < 40) setHetCuTheoPhong((h) => ({ ...h, [id]: true }));
    setTinTheoPhong((tp) => {
      const theoId = new Map((tp[id] ?? []).map((t) => [t.id, t]));
      for (const t of moi) theoId.set(t.id, t);
      return { ...tp, [id]: [...theoId.values()].sort((a, b) => a.taoLuc.localeCompare(b.taoLuc)) };
    });
    const p = d.phong;
    if (p) setPhong((ds) => ds.map((x) => (x.id === p.id ? { ...p, chuaDoc: 0 } : x)));
  }, []);

  const { trangThai, gui } = useKenh(realtime, kenh, (e: SuKienKenh) => {
    if (e.suKien === "go") {
      if (e.noiDung.ai !== toi.id) {
        setDangGo((g) => ({ ...g, [e.noiDung.ai]: { phong: e.noiDung.phong ?? "", ten: e.noiDung.ten ?? "", den: Date.now() + 4000 } }));
      }
      return;
    }
    if (e.suKien === "doc") {
      if (e.noiDung.phong === dangMo) void taiDs();
      return;
    }
    if (dangMo && e.noiDung.phong === dangMo) void taiTin(dangMo);
    void taiDs();
  });

  useEffect(() => {
    const dau = window.setTimeout(taiDs, 0);
    return () => window.clearTimeout(dau);
  }, [taiDs]);

  useEffect(() => {
    const dau = dangMo ? window.setTimeout(() => void taiTin(dangMo), 0) : undefined;
    const url = new URL(window.location.href);
    if (dangMo) url.searchParams.set("phong", dangMo);
    else url.searchParams.delete("phong");
    window.history.replaceState(null, "", url.toString());
    return () => window.clearTimeout(dau);
  }, [dangMo, taiTin]);

  // Nhịp hỏi lại: Realtime sống thì thưa (phòng hờ), không sống thì dày.
  useEffect(() => {
    const song = trangThai === "song";
    const nhip = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (dangMo) void taiTin(dangMo);
      void taiDs();
    }, song ? 30_000 : 3_000);
    return () => window.clearInterval(nhip);
  }, [trangThai, dangMo, taiTin, taiDs]);

  // Xoá "đang gõ" quá hạn.
  useEffect(() => {
    const id = window.setInterval(() => setDangGo((g) => Object.fromEntries(Object.entries(g).filter(([, v]) => v.den > Date.now()))), 1500);
    return () => window.clearInterval(id);
  }, []);

  const chuaDocTong = phong.reduce((t, p) => t + p.chuaDoc, 0);
  // Nút Trò chuyện trên thanh đầu trang cập nhật số ngay khi đọc, không chờ lượt hỏi lại.
  useEffect(() => {
    if (daTaiDs) window.dispatchEvent(new CustomEvent("nbj:tc-chua-doc", { detail: chuaDocTong }));
  }, [chuaDocTong, daTaiDs]);

  async function moVoi(nguoiId: string) {
    setLoi("");
    const res = await fetch("/api/erp/tro-chuyen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kieu: "rieng", voi: nguoiId }) });
    const d = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !d?.id) return setLoi(d?.message ?? "Chưa mở được.");
    setMoMoi(false);
    await taiDs();
    setDangMo(d.id);
  }

  async function taoNhom(ten: string, ds: string[]) {
    setLoi("");
    const res = await fetch("/api/erp/tro-chuyen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kieu: "nhom", ten, thanhVien: ds }) });
    const d = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !d?.id) return setLoi(d?.message ?? "Chưa lập được nhóm.");
    setMoMoi(false);
    await taiDs();
    setDangMo(d.id);
  }

  const nguoiDangGo = Object.values(dangGo).filter((v) => v.phong === dangMo);

  return (
    <div className="space-y-4" data-testid="tro-chuyen">
      <div className={`${dangMo ? "hidden lg:flex" : "flex"} flex-wrap items-end justify-between gap-3`}>
        <div>
          <h1 className="text-2xl font-black text-[#20342c] sm:text-3xl">Trò chuyện</h1>
          <p className="mt-1 text-sm text-[#5f7068]">
            Nhắn trong nội bộ, gửi ảnh và tệp, gắn đúng màn cần làm, giao luôn thành việc.
            <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold" data-testid="tc-trang-thai" data-trang-thai={trangThai}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${trangThai === "song" ? "bg-[#2f9e6b]" : trangThai === "dang-noi" ? "bg-[#e7b96a]" : "bg-[#9aa6a0]"}`} />
              {trangThai === "song" ? "Tin tới tức thì" : trangThai === "dang-noi" ? "Đang nối…" : "Tự làm mới mỗi 3 giây"}
            </span>
          </p>
        </div>
        {props.luuTru === "memory" ? <p className="rounded-xl bg-[#eef2ef] px-3 py-2 text-xs text-[#5f7068]">Bản chạy thử ở máy: tin nằm trong bộ nhớ, khởi động lại là mất.</p> : null}
      </div>
      {loi ? (
        <p className="rounded-xl bg-[#fff4f0] px-3 py-2 text-sm font-bold text-[#8a2f17]" role="alert">
          {loi}
        </p>
      ) : null}

      <div className="grid gap-4 lg:h-[calc(100svh-16.5rem)] lg:min-h-[30rem] lg:grid-cols-[20rem_1fr]">
        <aside className={`${dangMo ? "hidden lg:flex" : "flex"} min-h-0 flex-col rounded-3xl border border-[#d8e0db] bg-white shadow-sm`} data-chi="tro-chuyen">
          <div className="flex items-center justify-between gap-2 border-b border-[#e7ece9] p-4">
            <p className="text-sm font-black text-[#20342c]">
              Cuộc trò chuyện {chuaDocTong ? <span className="ml-1 rounded-full bg-[#c4482a] px-2 py-0.5 text-xs text-white">{chuaDocTong}</span> : null}
            </p>
            <button type="button" onClick={() => setMoMoi(true)} className="min-h-10 rounded-xl bg-[#173f34] px-3.5 text-sm font-black text-white" data-testid="tc-moi">
              + Tin mới
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="tc-ds-phong">
            {phong.map((p) => {
              const ten = tenPhong(p, toi.id);
              const tc = p.tinCuoi;
              const xem = tc ? (tc.noiDung || (tc.soGan ? "Đã gắn một phần dự án" : tc.soTep ? `${tc.soTep} tệp` : "")) : "Chưa có tin";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setDangMo(p.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${p.id === dangMo ? "bg-[#eef7f1]" : "hover:bg-[#f5f7f5]"}`}
                    aria-current={p.id === dangMo ? "true" : undefined}
                  >
                    <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black ${p.loai === "nhom" ? "bg-[#e7b96a] text-[#3d2a0c]" : "bg-[#173f34] text-white"}`}>
                      {p.loai === "nhom" ? "#" : chuCai(ten)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${p.chuaDoc ? "font-black text-[#17231f]" : "font-bold text-[#34453e]"}`}>{ten}</span>
                        {tc ? <span className="shrink-0 text-[11px] text-[#8a968f]">{luc(tc.luc)}</span> : null}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${p.chuaDoc ? "font-bold text-[#34453e]" : "text-[#7a8680]"}`}>
                          {tc && tc.nguoiGui === toi.id && tc.loai !== "he-thong" ? "Bạn: " : ""}
                          {xem}
                        </span>
                        {p.chuaDoc ? <span className="shrink-0 rounded-full bg-[#c4482a] px-1.5 text-[11px] font-black text-white">{p.chuaDoc}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {daTaiDs && phong.length === 0 ? <li className="p-4 text-sm text-[#6e7b75]">Chưa có cuộc trò chuyện nào. Bấm &quot;+ Tin mới&quot; để nhắn một đồng nghiệp.</li> : null}
          </ul>
        </aside>

        <section
          className={`${dangMo ? "flex h-[calc(100svh-6.75rem)]" : "hidden lg:flex"} min-h-[24rem] flex-col overflow-hidden rounded-3xl border border-[#d8e0db] bg-white shadow-sm lg:h-auto lg:min-h-0`}
        >
          {phongMo ? (
            <KhungPhong
              key={phongMo.id}
              toi={toi}
              danhBa={props.danhBa}
              giaoDuoc={props.giaoDuoc}
              coSoMau={props.coSoMau}
              vanBan={props.vanBan}
              phong={phongMo}
              tin={tin}
              hetCu={Boolean(hetCuTheoPhong[phongMo.id])}
              dangGo={nguoiDangGo.map((v) => v.ten)}
              onDong={() => setDangMo(null)}
              onTaiCu={() => tin[0] && void taiTin(phongMo.id, tin[0].taoLuc)}
              onDaGui={() => {
                void taiTin(phongMo.id);
                void taiDs();
                router.refresh();
              }}
              onGo={() => gui(`nbj-tc-${phongMo.kenh}`, "go", { phong: phongMo.id, ai: toi.id, ten: toi.ten })}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-black text-[#20342c]">Chọn một cuộc trò chuyện</p>
                <p className="mt-1 text-sm text-[#6e7b75]">Hoặc bấm &quot;+ Tin mới&quot; để nhắn một đồng nghiệp, lập nhóm.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {moMoi ? <HopTinMoi danhBa={props.danhBa} toi={toi.id} onDong={() => setMoMoi(false)} onMo={(id) => void moVoi(id)} onNhom={(t, ds) => void taoNhom(t, ds)} /> : null}
    </div>
  );
}

type PhanChung = Pick<Props, "toi" | "danhBa" | "giaoDuoc" | "coSoMau" | "vanBan">;

function KhungPhong(
  props: PhanChung & {
    phong: Phong;
    tin: TinNhan[];
    hetCu: boolean;
    dangGo: string[];
    onDong: () => void;
    onTaiCu: () => void;
    onDaGui: () => void;
    onGo: () => void;
  },
) {
  const { phong, tin, toi } = props;
  const cuoiRef = useRef<HTMLDivElement>(null);
  const ten = tenPhong(phong, toi.id);
  const nguoiKhac = phong.thanhVien.filter((v) => v.id !== toi.id);
  const docDenKhac = nguoiKhac.map((v) => v.docDen).sort()[0] ?? "";
  const tinCuoiCuaToi = [...tin].reverse().find((t) => t.nguoiGui === toi.id && t.loai === "chu");
  // Dòng tách ngày: tính trước, không đổi biến trong lúc dựng danh sách.
  const dong = tin.map((t, i) => ({ t, ngay: ngay(t.taoLuc), tachNgay: i === 0 || ngay(tin[i - 1].taoLuc) !== ngay(t.taoLuc) }));

  const tinCuoiId = tin.at(-1)?.id;
  useEffect(() => {
    cuoiRef.current?.scrollIntoView({ block: "end" });
  }, [tinCuoiId]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-[#e7ece9] px-3 py-3 sm:px-4">
        <button type="button" onClick={props.onDong} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d8e0db] text-lg lg:hidden" aria-label="Về danh sách trò chuyện">
          ←
        </button>
        <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${phong.loai === "nhom" ? "bg-[#e7b96a] text-[#3d2a0c]" : "bg-[#173f34] text-white"}`}>
          {phong.loai === "nhom" ? "#" : chuCai(ten)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[#20342c]">{ten}</p>
          <p className="truncate text-xs text-[#6e7b75]">
            {phong.loai === "nhom" ? `${phong.thanhVien.length} người: ${phong.thanhVien.map((v) => v.ten).join(", ")}` : (props.danhBa.find((n) => n.id === nguoiKhac[0]?.id)?.chucDanh ?? "")}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f6f8f6] px-3 py-4 sm:px-5" data-testid="tc-tin">
        {!props.hetCu && tin.length >= 40 ? (
          <div className="text-center">
            <button type="button" onClick={props.onTaiCu} className="min-h-9 rounded-full border border-[#d8e0db] bg-white px-4 text-xs font-bold text-[#5f7068]">
              Xem tin cũ hơn
            </button>
          </div>
        ) : null}
        {tin.length === 0 ? <p className="py-10 text-center text-sm text-[#7a8680]">Chưa có tin nào. Gửi lời chào đầu tiên nhé.</p> : null}
        {dong.map(({ t, ngay: n, tachNgay }) => {
          return (
            <div key={t.id}>
              {tachNgay ? <p className="my-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#8a968f]">{n}</p> : null}
              <BongTin
                t={t}
                cuaToi={t.nguoiGui === toi.id}
                laNhom={phong.loai === "nhom"}
                toi={toi.id}
                phongId={phong.id}
                danhBa={props.danhBa}
                onDoi={props.onDaGui}
              />
              {phong.loai === "rieng" && tinCuoiCuaToi?.id === t.id && docDenKhac >= t.taoLuc ? (
                <p className="mt-0.5 pr-1 text-right text-[11px] font-bold text-[#2f7a5b]" data-testid="tc-da-xem">
                  Đã xem
                </p>
              ) : null}
            </div>
          );
        })}
        {props.dangGo.length ? (
          <p className="text-xs italic text-[#6e7b75]" aria-live="polite">
            {props.dangGo.join(", ")} đang gõ…
          </p>
        ) : null}
        <div ref={cuoiRef} />
      </div>

      <KhungSoan
        toi={toi}
        giaoDuoc={props.giaoDuoc}
        coSoMau={props.coSoMau}
        vanBan={props.vanBan}
        phong={phong}
        onDaGui={props.onDaGui}
        onGo={props.onGo}
      />
    </>
  );
}

function BongTin({ t, cuaToi, laNhom, toi, phongId, danhBa, onDoi }: { t: TinNhan; cuaToi: boolean; laNhom: boolean; toi: string; phongId: string; danhBa: NguoiChon[]; onDoi: () => void }) {
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");
  if (t.loai === "he-thong") {
    return <p className="mx-auto w-fit max-w-[90%] rounded-full bg-[#e7ece9] px-3 py-1 text-center text-xs text-[#4f5f58]">{t.noiDung}</p>;
  }
  const anh = t.tep.filter((f) => laAnh(f.kieu));
  const tepKhac = t.tep.filter((f) => !laAnh(f.kieu));
  const urlTep = (f: TepDinhKem) => f.url ?? `/api/erp/tro-chuyen/tep?path=${encodeURIComponent(f.path)}`;
  const tenNhan = t.viec?.nguoiNhan ? (danhBa.find((n) => n.id === t.viec!.nguoiNhan)?.ten ?? "người nhận") : "";

  async function doiViec(trangThai: "xong" | "huy") {
    if (!t.viec) return;
    setDang(true);
    setLoi("");
    const res = await fetch(`/api/erp/tro-chuyen/${phongId}/viec`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ viecId: t.viec.id, trangThai, noiDung: (t.gan[0]?.ten ?? t.noiDung).slice(0, 120) }),
    });
    const d = (await res.json().catch(() => null)) as { message?: string } | null;
    setDang(false);
    if (!res.ok) setLoi(d?.message ?? "Chưa đổi được.");
    else onDoi();
  }

  return (
    <div className={`flex ${cuaToi ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] sm:max-w-[75%] ${cuaToi ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {laNhom && !cuaToi ? <span className="px-1 text-[11px] font-bold text-[#6e7b75]">{t.tenNguoiGui}</span> : null}
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${cuaToi ? "rounded-br-md bg-[#173f34] text-white" : "rounded-bl-md bg-white text-[#20342c]"}`}>
          {t.noiDung ? <p className="whitespace-pre-wrap break-words">{t.noiDung}</p> : null}
          {anh.length ? (
            <div className={`mt-2 grid gap-1.5 ${anh.length > 1 ? "grid-cols-2" : ""}`}>
              {anh.map((f) => (
                <a key={f.path} href={urlTep(f)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh người dùng gửi, qua đường dẫn ký ngắn hạn */}
                  <img src={urlTep(f)} alt={f.ten} className="max-h-60 w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : null}
          {tepKhac.map((f) => (
            <a
              key={f.path}
              href={urlTep(f)}
              target="_blank"
              rel="noreferrer"
              className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${cuaToi ? "bg-white/12 text-white" : "bg-[#f3f6f4] text-[#20342c]"}`}
            >
              <span aria-hidden="true" className="rounded bg-[#e7b96a] px-1.5 py-0.5 text-[10px] font-black uppercase text-[#3d2a0c]">
                {f.ten.split(".").pop()?.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate">{f.ten}</span>
              <span className="shrink-0 opacity-70">{coTep(f.co)}</span>
            </a>
          ))}
          {t.gan.map((g) => (
            <Link
              key={`${g.kieu}-${g.id}`}
              href={duongDanThe(g)}
              target={g.kieu === "trang-khach" ? "_blank" : undefined}
              className={`mt-2 block rounded-xl border px-3 py-2 ${cuaToi ? "border-white/25 bg-white/10 hover:bg-white/15" : "border-[#d8e0db] bg-[#fbfcfb] hover:border-[#8fa99f]"}`}
              data-testid="tc-the-gan"
            >
              <span className={`block text-[10px] font-black uppercase tracking-wide ${cuaToi ? "text-[#e7b96a]" : "text-[#2f7a5b]"}`}>{TEN_THE[g.kieu]}</span>
              <span className="block text-sm font-bold">{g.ten}</span>
              <span className={`block text-xs ${cuaToi ? "text-white/70" : "text-[#6e7b75]"}`}>{g.kieu === "chuc-nang" ? "Mở đúng chỗ, có khoanh viền →" : "Mở →"}</span>
            </Link>
          ))}
          {t.viec ? (
            <div className={`mt-2 rounded-xl px-3 py-2 ${cuaToi ? "bg-[#e7b96a] text-[#3d2a0c]" : "bg-[#fff8eb] text-[#5c4a26]"}`} data-testid="tc-viec">
              <p className="text-[10px] font-black uppercase tracking-wide">Việc giao cho {t.viec.nguoiNhan === toi ? "bạn" : tenNhan}</p>
              <p className="text-xs font-bold">
                {t.viec.trangThai === "xong" ? "✓ Đã làm xong" : t.viec.trangThai === "huy" ? "Đã huỷ" : `Đang chờ${t.viec.han ? ` · hạn ${gio(t.viec.han)} ${new Date(t.viec.han).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" })}` : ""}`}
              </p>
              {t.viec.trangThai === "mo" ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {t.viec.nguoiNhan === toi ? (
                    <button type="button" disabled={dang} onClick={() => void doiViec("xong")} className="min-h-8 rounded-lg bg-[#173f34] px-3 text-xs font-black text-white disabled:opacity-60">
                      Đã làm xong
                    </button>
                  ) : null}
                  {t.viec.nguoiTao === toi ? (
                    <button type="button" disabled={dang} onClick={() => void doiViec("huy")} className="min-h-8 rounded-lg border border-current px-3 text-xs font-black disabled:opacity-60">
                      Huỷ việc
                    </button>
                  ) : null}
                </div>
              ) : null}
              {loi ? <p className="mt-1 text-xs font-bold text-[#8a2f17]">{loi}</p> : null}
            </div>
          ) : null}
        </div>
        <span className="px-1 text-[10px] text-[#8a968f]">
          {gio(t.taoLuc)}
          {t.laMau ? " · tin mẫu" : ""}
        </span>
      </div>
    </div>
  );
}

function KhungSoan(props: Pick<Props, "toi" | "giaoDuoc" | "coSoMau" | "vanBan"> & { phong: Phong; onDaGui: () => void; onGo: () => void }) {
  const { phong, toi } = props;
  const [chu, setChu] = useState("");
  const [tep, setTep] = useState<(TepDinhKem & { xem?: string })[]>([]);
  const [gan, setGan] = useState<TheGan[]>([]);
  const [dangTai, setDangTai] = useState(0);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const [moMenu, setMoMenu] = useState(false);
  const [moGan, setMoGan] = useState(false);
  const [giao, setGiao] = useState(false);
  const nguoiGiaoDuoc = phong.thanhVien.filter((v) => v.id !== toi.id && props.giaoDuoc.includes(v.id));
  const [nguoiNhan, setNguoiNhan] = useState(nguoiGiaoDuoc[0]?.id ?? "");
  const [han, setHan] = useState(hanMacDinhLocal);
  const [khan, setKhan] = useState(false);
  const oAnh = useRef<HTMLInputElement>(null);
  const oTep = useRef<HTMLInputElement>(null);
  const lanGo = useRef(0);
  const oChu = useRef<HTMLTextAreaElement>(null);

  function chonMenu(id: "anh" | "tep" | "gan" | "giao") {
    if (id === "anh") return oAnh.current?.click();
    if (id === "tep") return oTep.current?.click();
    setMoMenu(false);
    if (id === "gan") setMoGan(true);
    else setGiao((g) => !g);
  }

  async function taiLen(files: FileList | null) {
    setMoMenu(false);
    const ds = Array.from(files ?? []).slice(0, 6 - tep.length);
    for (const f0 of ds) {
      setDangTai((n) => n + 1);
      try {
        const f = await thuNhoAnh(f0);
        const body = new FormData();
        body.append("tep", f);
        const res = await fetch(`/api/erp/tro-chuyen/${phong.id}/tep`, { method: "POST", body });
        const d = (await res.json().catch(() => null)) as (TepDinhKem & { message?: string }) | null;
        if (!res.ok || !d?.path) throw new Error(d?.message ?? "Chưa tải được tệp.");
        setTep((cu) => [...cu, { path: d.path, ten: d.ten, co: d.co, kieu: d.kieu, xem: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }]);
      } catch (error) {
        setLoi(error instanceof Error ? error.message : "Chưa tải được tệp.");
      } finally {
        setDangTai((n) => n - 1);
      }
    }
    if (oAnh.current) oAnh.current.value = "";
    if (oTep.current) oTep.current.value = "";
  }

  async function gui() {
    if (dangGui || dangTai) return;
    if (!chu.trim() && !tep.length && !gan.length) return;
    setDangGui(true);
    setLoi("");
    const res = await fetch(`/api/erp/tro-chuyen/${phong.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        noiDung: chu,
        tep: tep.map((f) => ({ path: f.path, ten: f.ten, co: f.co, kieu: f.kieu })),
        gan,
        viec: giao && nguoiNhan ? { nguoiNhan, han: han ? new Date(han).toISOString() : null, khan } : null,
      }),
    });
    const d = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    setDangGui(false);
    if (!res.ok || !d?.id) return setLoi(d?.message ?? "Chưa gửi được.");
    setChu("");
    setTep([]);
    setGan([]);
    setGiao(false);
    setKhan(false);
    props.onDaGui();
    oChu.current?.focus();
  }

  return (
    <div className="border-t border-[#e7ece9] p-3 sm:p-4">
      {tep.length || gan.length || dangTai ? (
        <div className="mb-2 flex flex-wrap gap-1.5" data-testid="tc-dinh-kem">
          {tep.map((f) => (
            <span key={f.path} className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-[#d8e0db] bg-[#f7f9f7] py-1 pl-1 pr-2 text-xs font-bold text-[#34453e]">
              {f.xem ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước tạo tại máy
                <img src={f.xem} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <span className="rounded bg-[#e7b96a] px-1.5 py-0.5 text-[10px] font-black uppercase text-[#3d2a0c]">{f.ten.split(".").pop()?.slice(0, 4)}</span>
              )}
              <span className="max-w-[10rem] truncate">{f.ten}</span>
              <button type="button" onClick={() => setTep((cu) => cu.filter((x) => x.path !== f.path))} aria-label={`Bỏ ${f.ten}`} className="text-[#8a968f] hover:text-[#8a2f17]">
                ×
              </button>
            </span>
          ))}
          {gan.map((g) => (
            <span key={`${g.kieu}-${g.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-[#b9d6c5] bg-[#eef7f1] px-2 py-1 text-xs font-bold text-[#1f5a3f]">
              <span className="text-[10px] font-black uppercase">{TEN_THE[g.kieu]}</span>
              <span className="max-w-[12rem] truncate">{g.ten}</span>
              <button type="button" onClick={() => setGan((cu) => cu.filter((x) => !(x.kieu === g.kieu && x.id === g.id)))} aria-label={`Bỏ ${g.ten}`} className="text-[#6e8f7d] hover:text-[#8a2f17]">
                ×
              </button>
            </span>
          ))}
          {dangTai ? <span className="rounded-xl bg-[#fff8eb] px-2 py-1 text-xs font-bold text-[#7a5520]">Đang tải {dangTai} tệp…</span> : null}
        </div>
      ) : null}

      {giao ? (
        <div className="mb-2 grid gap-2 rounded-2xl border border-[#e0b979] bg-[#fff8eb] p-3 sm:grid-cols-[1fr_1fr_auto]" data-testid="tc-giao-viec">
          <label className="text-xs font-bold text-[#7a5520]">
            Giao cho
            <select value={nguoiNhan} onChange={(e) => setNguoiNhan(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-[#e0c99a] bg-white px-2 text-sm text-[#20342c]">
              {nguoiGiaoDuoc.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.ten}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[#7a5520]">
            Hạn
            <input type="datetime-local" value={han} onChange={(e) => setHan(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-[#e0c99a] bg-white px-2 text-sm text-[#20342c]" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-[#7a5520]">
            <input type="checkbox" checked={khan} onChange={(e) => setKhan(e.target.checked)} className="h-4 w-4" /> Gấp
          </label>
          <p className="text-[11px] text-[#7a5520] sm:col-span-3">Gửi xong, việc nằm trong Việc &amp; ghi chú của người nhận, kèm phần đã gắn. Người nhận bấm &quot;Đã làm xong&quot; ngay trong tin.</p>
        </div>
      ) : null}

      <div className="relative flex items-end gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoMenu((m) => !m)}
            aria-expanded={moMenu}
            aria-label="Đính kèm, gắn phần dự án, giao việc"
            className={`grid h-11 w-11 place-items-center rounded-full text-2xl font-light transition ${moMenu ? "rotate-45 bg-[#173f34] text-white" : "bg-[#eef2ef] text-[#173f34]"}`}
            data-testid="tc-cong"
          >
            +
          </button>
          {moMenu ? (
            <div className="absolute bottom-14 left-0 z-20 w-64 rounded-2xl border border-[#d8e0db] bg-white p-1.5 shadow-xl" role="menu">
              {[
                { nhan: "Ảnh", phu: "Chụp hay chọn ảnh, tự thu nhỏ", id: "anh" as const },
                { nhan: "Tệp", phu: "PDF, Word, Excel, PowerPoint, CSV", id: "tep" as const },
                { nhan: "Gắn phần dự án", phu: "Một màn, chức năng, trang khách hay văn bản", id: "gan" as const },
                ...(nguoiGiaoDuoc.length ? [{ nhan: giao ? "Thôi giao việc" : "Giao thành việc", phu: "Người nhận phải làm, có hạn", id: "giao" as const }] : []),
              ].map((m) => (
                <button key={m.id} type="button" role="menuitem" onClick={() => chonMenu(m.id)} className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-[#f3f6f4]" data-testid={`tc-menu-${m.id}`}>
                  <span className="block text-sm font-black text-[#20342c]">{m.nhan}</span>
                  <span className="block text-xs text-[#6e7b75]">{m.phu}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input ref={oAnh} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void taiLen(e.target.files)} data-testid="tc-o-anh" />
          <input
            ref={oTep}
            type="file"
            accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => void taiLen(e.target.files)}
            data-testid="tc-o-tep"
          />
        </div>
        <label className="sr-only" htmlFor="tc-chu">
          Tin nhắn
        </label>
        <textarea
          id="tc-chu"
          ref={oChu}
          value={chu}
          rows={1}
          onChange={(e) => {
            setChu(e.target.value.slice(0, 4000));
            if (Date.now() - lanGo.current > 2500) {
              lanGo.current = Date.now();
              props.onGo();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              void gui();
            }
          }}
          placeholder={`Nhắn ${tenPhong(phong, toi.id)}…`}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-[#d8e0db] bg-[#fbfcfb] px-4 py-2.5 text-sm text-[#20342c] outline-none focus:border-[#2f7a5b]"
          data-testid="tc-o-chu"
        />
        <button
          type="button"
          onClick={() => void gui()}
          disabled={dangGui || dangTai > 0 || (!chu.trim() && !tep.length && !gan.length)}
          className="min-h-11 rounded-2xl bg-[#173f34] px-4 text-sm font-black text-white disabled:opacity-40"
          data-testid="tc-gui"
        >
          {dangGui ? "…" : giao ? "Gửi & giao" : "Gửi"}
        </button>
      </div>
      {loi ? <p className="mt-2 text-xs font-bold text-[#8a2f17]">{loi}</p> : null}
      {moGan ? (
        <HopGan
          coSoMau={props.coSoMau}
          vanBan={props.vanBan}
          daChon={gan}
          onDong={() => setMoGan(false)}
          onChon={(g) => setGan((cu) => (cu.some((x) => x.kieu === g.kieu && x.id === g.id) || cu.length >= 4 ? cu : [...cu, g]))}
        />
      ) : null}
    </div>
  );
}

function useHopThoai(onDong: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const dong = () => onDong();
    d?.addEventListener("close", dong);
    return () => d?.removeEventListener("close", dong);
  }, [onDong]);
  return ref;
}

function HopGan({ coSoMau, vanBan, daChon, onDong, onChon }: { coSoMau: string; vanBan: VanBanChon[]; daChon: TheGan[]; onDong: () => void; onChon: (g: TheGan) => void }) {
  const ref = useHopThoai(onDong);
  const [tim, setTim] = useState("");
  const tatCa = useMemo(() => danhMucGan(coSoMau), [coSoMau]);
  const chuan = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const loc = (m: { ten: string; nhom?: string }) => !tim.trim() || chuan(`${m.ten} ${m.nhom ?? ""}`).includes(chuan(tim));
  const nhom = new Map<string, MucGan[]>();
  for (const m of tatCa.filter(loc)) nhom.set(m.nhom, [...(nhom.get(m.nhom) ?? []), m]);
  const vb = vanBan.filter((v) => loc({ ten: v.ten }));
  const daCo = (kieu: string, id: string) => daChon.some((g) => g.kieu === kieu && g.id === id);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="z-[2000] m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-[#d8e0db] bg-white p-0 shadow-2xl backdrop:bg-[#0d1f19]/50"
      data-testid="tc-hop-gan"
    >
      <div className="flex max-h-[80svh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[#e7ece9] p-4">
          <div>
            <p className="text-base font-black text-[#20342c]">Gắn một phần dự án</p>
            <p className="text-xs text-[#6e7b75]">Người nhận bấm vào là tới đúng màn. Gắn tối đa 4 phần.</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d8e0db]" aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="p-4 pb-2">
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm: hoá đơn, sức chứa, hợp đồng…" className="min-h-11 w-full rounded-xl border border-[#d8e0db] px-3 text-sm" autoFocus data-testid="tc-tim-gan" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {vb.length ? (
            <section className="mb-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-[#8a968f]">Văn bản trong hệ thống</p>
              {vb.slice(0, 12).map((v) => (
                <MucChon key={v.id} ten={v.ten} da={daCo("van-ban", v.id)} onChon={() => onChon({ kieu: "van-ban", id: v.id, ten: v.ten, duongDan: "/erp/van-ban" })} />
              ))}
            </section>
          ) : null}
          {[...nhom.entries()].map(([tenNhom, ds]) => (
            <section key={tenNhom} className="mb-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-[#8a968f]">{tenNhom}</p>
              {ds.map((m) => (
                <MucChon key={`${m.kieu}-${m.id}`} ten={m.ten} da={daCo(m.kieu, m.id)} onChon={() => onChon({ kieu: m.kieu, id: m.id, ten: m.ten, duongDan: m.duongDan })} />
              ))}
            </section>
          ))}
          {!vb.length && nhom.size === 0 ? <p className="py-6 text-center text-sm text-[#6e7b75]">Không thấy phần nào khớp.</p> : null}
        </div>
        <div className="border-t border-[#e7ece9] p-3 text-right">
          <button type="button" onClick={() => ref.current?.close()} className="min-h-10 rounded-xl bg-[#173f34] px-5 text-sm font-black text-white">
            Xong{daChon.length ? ` · đã gắn ${daChon.length}` : ""}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function MucChon({ ten, da, onChon }: { ten: string; da: boolean; onChon: () => void }) {
  return (
    <button
      type="button"
      onClick={onChon}
      disabled={da}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${da ? "bg-[#eef7f1] font-bold text-[#1f5a3f]" : "text-[#20342c] hover:bg-[#f3f6f4]"}`}
    >
      <span>{ten}</span>
      <span aria-hidden="true" className="shrink-0 text-xs font-black">
        {da ? "✓" : "+"}
      </span>
    </button>
  );
}

function HopTinMoi({ danhBa, toi, onDong, onMo, onNhom }: { danhBa: NguoiChon[]; toi: string; onDong: () => void; onMo: (id: string) => void; onNhom: (ten: string, ds: string[]) => void }) {
  const ref = useHopThoai(onDong);
  const [che, setChe] = useState<"rieng" | "nhom">("rieng");
  const [tim, setTim] = useState("");
  const [chon, setChon] = useState<string[]>([]);
  const [tenNhom, setTenNhom] = useState("");
  const chuan = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const ds = danhBa.filter((n) => n.id !== toi && (!tim.trim() || chuan(`${n.ten} ${n.chucDanh}`).includes(chuan(tim))));
  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="z-[2000] m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-[#d8e0db] bg-white p-0 shadow-2xl backdrop:bg-[#0d1f19]/50"
      data-testid="tc-hop-moi"
    >
      <div className="flex max-h-[80svh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[#e7ece9] p-4">
          <p className="text-base font-black text-[#20342c]">Tin mới</p>
          <button type="button" onClick={() => ref.current?.close()} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d8e0db]" aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="space-y-2 p-4 pb-2">
          <div className="flex gap-1.5">
            {(["rieng", "nhom"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setChe(k)} aria-pressed={che === k} className={`min-h-9 rounded-full px-4 text-sm font-bold ${che === k ? "bg-[#173f34] text-white" : "bg-[#eef2ef] text-[#43554e]"}`}>
                {k === "rieng" ? "Nhắn một người" : "Lập nhóm"}
              </button>
            ))}
          </div>
          {che === "nhom" ? <input value={tenNhom} onChange={(e) => setTenNhom(e.target.value.slice(0, 80))} placeholder="Tên nhóm, ví dụ Điều hành Tràng An" className="min-h-11 w-full rounded-xl border border-[#d8e0db] px-3 text-sm" /> : null}
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm theo tên, chức danh" className="min-h-11 w-full rounded-xl border border-[#d8e0db] px-3 text-sm" autoFocus />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {ds.map((n) => {
            const da = chon.includes(n.id);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => (che === "rieng" ? onMo(n.id) : setChon((c) => (da ? c.filter((x) => x !== n.id) : [...c, n.id])))}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${da ? "bg-[#eef7f1]" : "hover:bg-[#f5f7f5]"}`}
                  data-testid={`tc-nguoi-${n.id}`}
                >
                  <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173f34] text-xs font-black text-white">
                    {chuCai(n.ten)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#20342c]">{n.ten}</span>
                    <span className="block truncate text-xs text-[#6e7b75]">{n.chucDanh}</span>
                  </span>
                  {che === "nhom" ? <span className="text-sm font-black text-[#2f7a5b]">{da ? "✓" : ""}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {che === "nhom" ? (
          <div className="border-t border-[#e7ece9] p-3 text-right">
            <button
              type="button"
              disabled={!tenNhom.trim() || chon.length === 0}
              onClick={() => onNhom(tenNhom, chon)}
              className="min-h-10 rounded-xl bg-[#173f34] px-5 text-sm font-black text-white disabled:opacity-40"
            >
              Lập nhóm · {chon.length + 1} người
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
