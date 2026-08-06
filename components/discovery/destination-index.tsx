"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type IndexItem = {
  id: string;
  name: string;
  image: string;
  imagePosition: string;
  category: string;
  duration: string;
};

export type IndexCopy = {
  sectionLabel: string;
  sectionTitle: string;
  sectionIntro: string;
  hint: string;
};

/** Kich thuoc tam anh bam con tro (desktop). */
const PREVIEW_W = 300;
const PREVIEW_H = 390;
/** Do "li" cua chuyen dong bam theo: cang nho anh cang tre lai mem hon. */
const FOLLOW_EASING = 0.14;

/**
 * Danh muc diem den kieu tap chi: moi dong la mot ten lon, re chuot len
 * dong nao thi mot tam anh hien ra va BAM THEO con tro voi do tre mem.
 *
 * Vi sao dung dang nay thay vi them 10 the zigzag nua:
 *  - 15 diem cung mot khuon zigzag lien tuc chiem 9.540px va doc rat deu
 *    deu; dang nay goi tron phan con lai trong ~1.400px ma KHONG cat bot
 *    diem nao.
 *  - No dao nguoc quan he: khach di TIM noi dung thay vi bi noi dung doi
 *    vao mat -- dung tinh than "curated, not listed" cua brief.
 *
 * MOBILE KHONG CO CON TRO. Duoi lg, component doi han sang dang khac:
 * moi dong co mot o anh vuong nho nam ben trai, hien san. Khong bao gio
 * de mobile thanh mot danh sach chu tro troi.
 */
export function DestinationIndex({
  items,
  copy,
  onSelect,
}: {
  items: readonly IndexItem[];
  copy: IndexCopy;
  onSelect: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  /*
   * Mac dinh la 0, KHONG phai null. Truoc do khi chua re chuot thi khong
   * co anh nao, nen nua phai cua khoi nay trong tron suot gan 2.000px --
   * nhin nhu trang lam do dang chu khong phai mot danh muc co y do. Da
   * chup duoc va sua ngay 06/08.
   * Gio luon co mot tam anh dang hien: no cung la loi moi de nguoi ta
   * hieu ra rang re chuot len ten khac thi anh se doi.
   */
  const [activeIndex, setActiveIndex] = useState(0);

  // Vi tri chuot thuc va vi tri anh dang duoc ve -- anh duoi theo sau.
  const pointer = useRef({ x: 0, y: 0 });
  const drawn = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Chi chay tren thiet bi co con tro that. `hover: hover` loai bo dien
    // thoai/tablet cam ung, noi ma "re chuot" khong ton tai.
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover) return;

    const root = rootRef.current;
    if (!root) return;

    /*
     * Cho anh "dau" o nua phai, ngang tam hang dau tien -- de luc chua ai
     * cham chuot vao thi no van nam o mot cho hop ly, chu khong dinh o goc
     * tren ben trai roi bay ra khi re chuot.
     */
    function park() {
      const rect = root!.getBoundingClientRect();
      pointer.current = { x: rect.width * 0.72, y: Math.min(rect.height * 0.28, 320) };
      drawn.current = { ...pointer.current };
    }
    park();

    function onMove(event: PointerEvent) {
      const rect = root!.getBoundingClientRect();
      pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    root.addEventListener("pointermove", onMove);
    window.addEventListener("resize", park);

    let frame = 0;
    function tick() {
      const node = previewRef.current;
      if (node) {
        // Giam chuyen dong: bam dinh vi tri chuot, khong co do tre mem.
        const ease = reduced ? 1 : FOLLOW_EASING;
        drawn.current.x += (pointer.current.x - drawn.current.x) * ease;
        drawn.current.y += (pointer.current.y - drawn.current.y) * ease;
        node.style.transform = `translate3d(${Math.round(drawn.current.x - PREVIEW_W / 2)}px, ${Math.round(
          drawn.current.y - PREVIEW_H / 2,
        )}px, 0)`;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      root.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", park);
      cancelAnimationFrame(frame);
    };
  }, []);

  const active = items[activeIndex] ?? items[0] ?? null;

  return (
    // `id` rieng, KHONG dung lai "all-destinations" cua DestinationZigzag:
    // hai the cung mot id la HTML sai, va lam moi lien ket neo tro toi
    // deu roi vao the dau tien mot cach ngau nhien.
    <section id="destination-index" className="bg-[#FBFAF6] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{copy.sectionLabel}</p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183F34] sm:text-6xl">
            {copy.sectionTitle}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#4A5751]">{copy.sectionIntro}</p>
          {/* Chi goi y thao tac tren may co con tro -- tren dien thoai cau
              nay vo nghia vi anh da hien san. */}
          <p className="mt-4 hidden text-sm text-[#6D756F] lg:block">{copy.hint}</p>
        </div>

        {/*
          KHONG xoa anh khi chuot roi khoi khoi: de nguyen tam cuoi cung
          khach vua xem. Truoc do `onPointerLeave` dat lai ve null, nen chi
          can dua chuot ra ngoai la ca nua phai trong tron tro lai.
        */}
        <div ref={rootRef} className="relative mt-12">
          {/*
            Tam anh bam con tro. `pointer-events-none` la bat buoc: neu no
            an chuot thi chinh no se chan pointermove cua cac dong ben
            duoi, va hieu ung tu dap chinh no.
          */}
          <div
            ref={previewRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 hidden lg:block"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          >
            <div
              // Chinh tam anh dang bam con tro la diem XUAT PHAT tu nhien
              // nhat cho hieu ung no ra khung chi tiet -- khach vua nhin
              // vao no thi no lon dan len.
              data-flip-src={active ? active.id : undefined}
              className="relative h-full w-full overflow-hidden rounded-[10px] shadow-2xl shadow-[#183F34]/25 transition-opacity duration-300"
              style={{ opacity: active ? 1 : 0 }}
            >
              {active ? (
                <Image
                  src={active.image}
                  alt=""
                  fill
                  sizes="300px"
                  className="object-cover"
                  style={{ objectPosition: active.imagePosition }}
                />
              ) : null}
            </div>
          </div>

          <ul className="relative z-10">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  onPointerEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  className="group flex w-full items-center gap-4 border-t border-[#183F34]/12 py-5 text-left transition-colors last:border-b hover:bg-[#183F34]/[0.03] sm:gap-6 sm:py-6 lg:py-7"
                >
                  {/* Anh nho -- CHI tren mobile/tablet, thay cho anh bam
                      con tro von khong ton tai o do. */}
                  <span
                    data-flip-src={item.id}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-[#E8E4DA] sm:h-20 sm:w-20 lg:hidden"
                  >
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      style={{ objectPosition: item.imagePosition }}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="font-display block text-2xl leading-tight text-[#183F34] transition-colors group-hover:text-[#3F7568] sm:text-4xl lg:text-5xl">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-[#6D756F] sm:text-sm">
                      {item.category} · {item.duration}
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xl text-[#183F34]/30 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[#3F7568]"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
