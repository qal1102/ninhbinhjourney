"use client";

import { useEffect, useRef } from "react";

// Trong vùng có nhãn mà con trỏ đang ở trên chữ đọc được hay một nút con thì
// viên tròn lặn đi: nó chỉ được đi trên phần ảnh, không bao giờ đè lên chữ.
const VUNG_CHU = "p, h1, h2, h3, h4, h5, h6, li, a, button, input, textarea, select, label";

function nhanTai(diem: Element | null): string {
  const vung = diem?.closest("[data-con-tro]");
  if (!vung || !diem) return "";
  const chu = diem.closest(VUNG_CHU);
  if (chu && chu !== vung && vung.contains(chu)) return "";
  return vung.getAttribute("data-con-tro") ?? "";
}

/**
 * Con trỏ theo ngữ cảnh (A15-CON-LAI, "trạng thái con trỏ").
 *
 * Rê chuột vào một vùng có `data-con-tro="<nhãn>"` thì một viên tròn kem mang
 * nhãn ấy ("Kéo", "Xem", "Mở") trôi theo con trỏ, nói trước điều sẽ xảy ra
 * nếu bấm hay kéo. Ra khỏi vùng là viên tròn thu lại và biến mất.
 *
 * Trên chữ, tiêu đề hay nút con bên trong vùng thì viên tròn lặn đi.
 *
 * Giữ đúng lời dặn ở `KY_NANG_GIAO_DIEN.md` mục 7 ("con trỏ tuỳ biến khắp nơi"
 * là thứ không làm): chỉ những vùng được gắn nhãn mới có, không bao giờ ở vùng
 * chữ đọc được, và **con trỏ gốc vẫn còn nguyên**, viên tròn chỉ đi kèm. Chỉ
 * chạy với chuột thật (`hover: hover` và `pointer: fine`); màn cảm ứng không
 * có gì. Khách chọn giảm chuyển động thì viên tròn đứng đúng chỗ con trỏ, không
 * trôi đuổi theo.
 */
export function ConTroNhan() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vien = ref.current;
    const chu = vien?.firstElementChild as HTMLElement | null;
    const chuot = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!vien || !chu || !chuot.matches) return;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)");

    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let frame = 0;
    let nhan = "";

    const dat = () => {
      vien.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const troi = () => {
      frame = 0;
      const k = giamChuyenDong.matches ? 1 : 0.2;
      x += (tx - x) * k;
      y += (ty - y) * k;
      dat();
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.4) frame = requestAnimationFrame(troi);
    };
    const doiNhan = (moi: string) => {
      if (moi === nhan) return;
      if (moi && !nhan) {
        // Hiện ra đúng chỗ con trỏ, không bay từ chỗ lần trước tới.
        x = tx;
        y = ty;
        dat();
      }
      nhan = moi;
      if (moi) chu.textContent = moi;
      vien.dataset.hien = moi ? "1" : "0";
    };
    const khiDi = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      doiNhan(nhanTai(e.target instanceof Element ? e.target : null));
      if (!frame) frame = requestAnimationFrame(troi);
    };
    const khiNhan = () => {
      vien.dataset.nhan = "1";
    };
    const khiTha = () => {
      vien.dataset.nhan = "0";
    };
    const khiRoi = () => doiNhan("");

    document.addEventListener("pointermove", khiDi, { passive: true });
    document.addEventListener("pointerdown", khiNhan, { passive: true });
    document.addEventListener("pointerup", khiTha, { passive: true });
    document.documentElement.addEventListener("pointerleave", khiRoi);
    window.addEventListener("blur", khiRoi);
    // Cuộn bằng bánh xe thì con trỏ đứng yên mà vùng dưới nó đổi; đọc lại.
    const khiCuon = () => {
      doiNhan(nhanTai(document.elementFromPoint(tx, ty)));
    };
    window.addEventListener("scroll", khiCuon, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", khiDi);
      document.removeEventListener("pointerdown", khiNhan);
      document.removeEventListener("pointerup", khiTha);
      document.documentElement.removeEventListener("pointerleave", khiRoi);
      window.removeEventListener("blur", khiRoi);
      window.removeEventListener("scroll", khiCuon);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="con-tro-nhan" data-hien="0" data-nhan="0">
      <span />
    </div>
  );
}
