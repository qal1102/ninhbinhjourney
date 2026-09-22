"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { loiTinhTrang, tinhTrangMua } from "@/domain/mua-trang";

/**
 * Bốn cổng vào bốn thế giới — có gợi ý để khách biết bấm được.
 *
 * ## Vấn đề nó chữa
 *
 * Chủ dự án nói thẳng: *"bốn cái ở trên ấy, tôi muốn ví dụ khách chưa biết
 * phải click vào thì nhẹ nhàng gợi ý hoặc hiện ra kiểu để click vào, kiểu
 * hold ở đâu khéo léo lồng ghép để quảng cáo."*
 *
 * Bản cũ là bốn dòng chữ nằm ngang trên đầu trang. Chữ nằm trên ảnh, không
 * viền, không nền — đọc ra là **nhãn**, không đọc ra là **cửa**. Và không có
 * gì nói cho khách biết sau mỗi cửa có gì đáng để bấm.
 *
 * ## Cách làm
 *
 * Mỗi cổng mang theo **một con số thật của chính nó**: chín điểm đến, năm hồ
 * sơ thương hiệu, năm hành trình dựng sẵn, và với Trung thu là **số đêm còn
 * lại tới rằm — đếm lại mỗi lần mở trang**. Đây là chỗ quảng cáo được lồng
 * vào: không một câu chào mời nào, chỉ một con số, mà con số thì tự nó gọi
 * người ta bấm. Và vì mọi con số đều lấy từ chính kho dữ liệu đang chạy, nó
 * không bao giờ nói sai.
 *
 * - **Máy bàn:** rê chuột hoặc dí bàn phím vào một cổng thì mở ra một tấm
 *   xem trước — ảnh, một câu, con số. Tấm ấy nằm ngay dưới hàng cổng nên mắt
 *   không phải đi tìm.
 * - **Điện thoại:** không có chuột để rê, nên con số **hiện sẵn** ngay dưới
 *   tên cổng. Một hàng chữ có kèm con số trông ra ngay là bấm được.
 *
 * Hai hàng cổng (một cho máy bàn, một cho điện thoại) đều giữ nguyên thuộc
 * tính `data-experience-portal` và đường dẫn cũ — bài kiểm đếm đúng hai bản
 * mỗi cổng, và đổi số lượng ấy là đổi luôn giao kèo điều hướng của trang.
 */

export type CongId = "travel" | "collaboration" | "seasonal" | "booking";

export type Cong = {
  id: CongId;
  nhan: string;
  nhanNgan: string;
  duongDan: string;
};

export type SoLieuCong = {
  soDiemDen: number;
  soHoSo: number;
  soGoi: number;
};

/** Ba đêm của mùa trăng, đúng bộ mà trang Trung thu đang in ra. */
const DEM_MUA = ["2026-09-18", "2026-09-25", "2026-09-27"] as const;
const DEM_RAM = "2026-09-25";

const ANH: Record<CongId, string> = {
  travel: "/images/destinations/trang-an.jpg",
  collaboration: "/images/destinations/tam-coc.jpg",
  seasonal: "/images/destinations/bai-dinh.jpg",
  booking: "/images/destinations/tam-chuc.jpg",
};

function moTa(id: CongId, lang: "vi" | "en"): string {
  const vi: Record<CongId, string> = {
    travel: "Chín nơi đáng đi, mỗi nơi một nhịp riêng. Xem trên bản đồ rồi chọn.",
    collaboration: "Hồ sơ dạng tạp chí về khả năng sáng tạo ở Ninh Bình.",
    seasonal: "Một chương riêng cho mùa trăng: ba đêm, một dòng Ngô Đồng.",
    booking: "Hành trình đã có tuyến đi, khung giờ và mức giá rõ ràng.",
  };
  const en: Record<CongId, string> = {
    travel: "Nine places worth the trip, each with its own rhythm. See them on the map.",
    collaboration: "A magazine-form dossier on creative possibilities in Ninh Binh.",
    seasonal: "A chapter of its own for the moon season: three nights, one river.",
    booking: "Journeys with a route, a time and a clear price.",
  };
  return lang === "vi" ? vi[id] : en[id];
}

/**
 * Con số của từng cổng. Trả `null` khi cổng ấy không có con số nào đáng nói —
 * thà để trống còn hơn bịa một chỉ số cho đủ bộ.
 */
function conSo(
  id: CongId,
  lang: "vi" | "en",
  so: SoLieuCong,
  bayGio: string,
  ngan = false,
): string | null {
  switch (id) {
    case "travel":
      if (ngan) return lang === "vi" ? `${so.soDiemDen} nơi` : `${so.soDiemDen} places`;
      return lang === "vi" ? `${so.soDiemDen} điểm đến` : `${so.soDiemDen} places`;
    case "collaboration":
      return lang === "vi" ? `${so.soHoSo} hồ sơ` : `${so.soHoSo} dossiers`;
    case "booking":
      if (ngan) return lang === "vi" ? `${so.soGoi} tuyến` : `${so.soGoi} routes`;
      return lang === "vi" ? `${so.soGoi} hành trình` : `${so.soGoi} journeys`;
    case "seasonal": {
      const tt = tinhTrangMua(new Date(bayGio), DEM_MUA, DEM_RAM);
      if (!ngan) {
        // Câu đầy đủ dài quá cho một con chữ nhỏ; lấy phần sau dấu chấm giữa.
        const cau = loiTinhTrang(tt, lang);
        return cau.includes(" · ") ? cau.split(" · ")[1] : cau;
      }
      // Bản ngắn cho hàng cổng ở điện thoại. Bản đầy đủ ("còn 3 đêm nữa tới
      // rằm") kéo hàng cổng rộng ra tới mức cổng thứ tư bị đẩy hẳn ra ngoài
      // màn hình — tức là lại làm đúng cái việc mình đang đi chữa.
      if (tt.giaiDoan === "dung-ram") return lang === "vi" ? "rằm đêm nay" : "full moon tonight";
      if (tt.giaiDoan === "het-mua") return lang === "vi" ? "mùa đã khép" : "season closed";
      const n = Math.abs(tt.conMayDem);
      return lang === "vi" ? `còn ${n} đêm` : `${n} nights left`;
    }
  }
}

export function PortalRailDesktop({
  cong,
  nhanVung,
  lang,
  soLieu,
  bayGio,
}: {
  cong: readonly Cong[];
  nhanVung: string;
  lang: "vi" | "en";
  soLieu: SoLieuCong;
  bayGio: string;
}) {
  const [dangNgam, setDangNgam] = useState<CongId | null>(null);

  return (
    <div
      className="relative hidden lg:block"
      onMouseLeave={() => setDangNgam(null)}
    >
      <nav
        aria-label={nhanVung}
        className="flex items-center gap-5 text-sm text-[#FBFAF6]/82"
      >
        {cong.map((c, i) => (
          // Mỗi cổng là một mốc neo riêng, để tấm xem trước mở ra NGAY DƯỚI
          // cổng đang rê chuột. Neo chung vào cả hàng thì rê vào cổng cuối mà
          // tấm lại hiện ở đầu hàng — mắt phải đi tìm, mà đi tìm là hỏng.
          // Hai cổng đầu mở sang phải, hai cổng cuối mở sang trái, nên tấm
          // không bao giờ tràn khỏi mép màn hình.
          <span key={c.id} className="relative">
            <Link
              data-experience-portal={c.id}
              href={c.duongDan}
              transitionTypes={c.id === "travel" ? undefined : ["portal-enter"]}
              onMouseEnter={() => setDangNgam(c.id)}
              onFocus={() => setDangNgam(c.id)}
              onBlur={() => setDangNgam(null)}
              className={`inline-block border-b pb-1 transition motion-reduce:transition-none ${
                dangNgam === c.id
                  ? "border-[#E7B96A] text-[#E7B96A]"
                  : "border-transparent hover:border-[#E7B96A] hover:text-[#E7B96A]"
              }`}
            >
              {c.nhan}
            </Link>
            {dangNgam === c.id ? (
              <TamXemTruoc
                cong={c}
                lang={lang}
                soLieu={soLieu}
                bayGio={bayGio}
                veTrai={i >= cong.length - 2}
              />
            ) : null}
          </span>
        ))}
      </nav>

    </div>
  );
}

/**
 * Tấm xem trước của một cổng.
 *
 * `aria-hidden` vì mọi chữ trong đó chỉ để mời mắt: đường dẫn và tên cổng đã
 * nằm sẵn trong chính liên kết ở trên, nên trình đọc màn hình không cần nghe
 * lại một lần nữa.
 */
function TamXemTruoc({
  cong,
  lang,
  soLieu,
  bayGio,
  veTrai,
}: {
  cong: Cong;
  lang: "vi" | "en";
  soLieu: SoLieuCong;
  bayGio: string;
  veTrai: boolean;
}) {
  const so = conSo(cong.id, lang, soLieu, bayGio);
  return (
    <span
      aria-hidden="true"
      data-portal-peek={cong.id}
      className={`absolute top-[calc(100%+0.85rem)] z-30 block w-[23rem] overflow-hidden rounded-2xl border border-white/12 bg-[#0d1915]/92 shadow-2xl shadow-black/45 backdrop-blur-md motion-safe:animate-[nbThiepLen_.22s_ease-out] ${
        veTrai ? "right-0" : "left-0"
      }`}
    >
      <span className="relative block h-28 w-full">
        <Image src={ANH[cong.id]} alt="" fill sizes="368px" className="object-cover" />
        <span className="absolute inset-0 block bg-[linear-gradient(180deg,rgba(13,25,21,.1),rgba(13,25,21,.92))]" />
      </span>
      <span className="block px-4 pb-4 pt-3">
        <span className="font-display block text-lg text-[#fbf7ee]">{cong.nhan}</span>
        <span className="mt-1 block text-sm leading-6 text-white/64">{moTa(cong.id, lang)}</span>
        {so ? (
          <span className="mt-3 inline-flex items-center rounded-full border border-[#E7B96A]/45 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#E7B96A]">
            {so}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function PortalRailMobile({
  cong,
  nhanVung,
  hienTai = "travel",
  lang,
  soLieu,
  bayGio,
  className = "",
}: {
  cong: readonly Cong[];
  nhanVung: string;
  hienTai?: CongId;
  lang: "vi" | "en";
  soLieu: SoLieuCong;
  bayGio: string;
  className?: string;
}) {
  return (
    <nav aria-label={nhanVung} className={className}>
      <span className="flex w-max items-stretch gap-5 border-b border-white/15 pb-2 font-display text-[0.95rem] text-[#FBFAF6]/78">
        {cong.map((c) => {
          const so = conSo(c.id, lang, soLieu, bayGio, true);
          return (
            <Link
              key={c.id}
              data-experience-portal={c.id}
              href={c.duongDan}
              transitionTypes={c.id === "travel" ? undefined : ["portal-enter"]}
              className={`inline-flex min-h-11 flex-col justify-center whitespace-nowrap border-b-2 transition motion-reduce:transition-none ${
                c.id === hienTai
                  ? "border-[#E7B96A] text-[#E7B96A]"
                  : "border-transparent hover:border-[#E7B96A]/60 hover:text-[#FBFAF6]"
              }`}
            >
              <span aria-hidden="true">{c.nhanNgan}</span>
              {/*
                Con số nằm ngay dưới tên. Không có chuột để rê thì đây là cách
                duy nhất nói cho khách biết sau cửa ấy có gì — và nó cũng làm
                cái nhãn trông ra ngay là bấm được.
              */}
              {so ? (
                <span
                  aria-hidden="true"
                  className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#E7B96A]/72"
                >
                  {so}
                </span>
              ) : null}
              <span className="sr-only">{c.nhan}</span>
            </Link>
          );
        })}
      </span>
    </nav>
  );
}
