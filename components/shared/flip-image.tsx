"use client";

export type FlipStart = {
  /** Vi tri tam anh nguon TAI THOI DIEM bam, theo toa do khung nhin. */
  rect: { top: number; left: number; width: number; height: number };
  src: string;
  borderRadius: string;
  objectPosition: string;
};

/**
 * Tim tam anh dang hien de lam diem xuat phat cho hieu ung "no ra".
 *
 * Cung mot diem den co the co nhieu tam tren trang cung luc (hang zigzag,
 * o anh nho trong danh muc tren dien thoai, tam anh bam con tro tren may
 * de ban). Chon tam nao DANG NHIN THAY va gan tam man hinh nhat -- do la
 * tam khach vua bam vao.
 *
 * Bo qua the co be rong 0: cac o `lg:hidden` tren may de ban co
 * `display: none` nen tra ve rect rong, khong duoc phep tinh la ung vien.
 */
export function findFlipStart(id: string): FlipStart | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-flip-src="${CSS.escape(id)}"]`),
  );

  let best: HTMLElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of candidates) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const distance = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }

  if (!best) return null;

  const image = best.querySelector("img");
  if (!image) return null;

  const rect = best.getBoundingClientRect();
  const style = window.getComputedStyle(best);
  return {
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    src: image.currentSrc || image.src,
    borderRadius: style.borderRadius,
    objectPosition: window.getComputedStyle(image).objectPosition,
  };
}
