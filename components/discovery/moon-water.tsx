"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import { vetTrangTrenNuoc } from "@/domain/vet-trang";

/**
 * Mặt nước dưới vòng trăng — vệt trăng gợn theo đúng pha trăng đêm đó.
 *
 * ## Nó nói điều gì thật
 *
 * Chọn đêm mở mùa thì vệt hẹp và mờ; chọn đêm rằm thì vệt rộng ra và sáng
 * lên. Không phải hiệu ứng trang trí đổi cho vui: bề rộng, độ đậm và số gợn
 * đều lấy từ `domain/vet-trang.ts`, mà tệp ấy lại lấy đúng `doSang` của phép
 * tính pha trăng. Mặt trăng và mặt nước vì thế **không bao giờ nói hai chuyện
 * khác nhau**.
 *
 * ## Ba điều giữ cho nó không thành gánh nặng
 *
 * 1. **Ngừng vẽ khi trôi khỏi khung nhìn.** Một vòng lặp vẽ chạy ngầm suốt
 *    lúc khách đã cuộn xuống tận cuối trang là cách nhanh nhất làm nóng máy
 *    và tụt pin — thứ không ai thấy trên máy người làm web.
 * 2. **Tôn trọng lựa chọn giảm chuyển động.** Khi ấy vẽ đúng một khung hình
 *    tĩnh: vẫn thấy vệt trăng, chỉ là nó không gợn.
 * 3. **Chặn độ phân giải ở 2×.** Màn 3× vẽ gấp hơn hai lần số điểm ảnh cho
 *    một hiệu ứng mà mắt không phân biệt nổi.
 *
 * Vị trí gợn sinh bằng một bộ số giả ngẫu nhiên **có hạt giống cố định**, nên
 * mặt nước giữ nguyên hình giữa các khung hình và giữa các lượt dựng lại —
 * chỉ độ sáng và một dao động ngang rất nhỏ là đổi. Ngẫu nhiên lại mỗi khung
 * hình thì ra nhiễu hạt, không ra sóng.
 */

type Gon = {
  /** Vị trí theo chiều sâu, 0 là sát chân trăng, 1 là gần người xem. */
  t: number;
  /** Lệch ngang so với tâm vệt, theo tỉ lệ nửa bề rộng. */
  lech: number;
  /** Chiều dài gợn, theo tỉ lệ bề rộng vệt. */
  dai: number;
  /** Lệch pha để các gợn không sáng tắt cùng nhịp. */
  pha: number;
};

/** Bộ số giả ngẫu nhiên có hạt giống — cùng hạt thì cùng mặt nước. */
function tungSo(hat: number) {
  let x = hat >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

function dungGon(so: number): Gon[] {
  const ngau = tungSo(0x5eed);
  return Array.from({ length: so }, () => {
    const t = ngau();
    return {
      t,
      // Gợn càng xa tâm càng thưa: lấy luỹ thừa để chúng dồn về giữa vệt.
      lech: (ngau() * 2 - 1) ** 3,
      dai: 0.05 + ngau() ** 2 * 0.22,
      pha: ngau() * Math.PI * 2,
    };
  });
}

export function MoonWater({
  doSang,
  className = "",
}: {
  /** Phần đĩa trăng đang sáng, 0 tới 1. */
  doSang: number;
  className?: string;
}) {
  const khung = useRef<HTMLCanvasElement | null>(null);
  const doSangRef = useRef(doSang);
  const veRef = useRef<((luc: number) => void) | null>(null);
  const itChuyenDong = useReducedMotion();

  useEffect(() => {
    doSangRef.current = doSang;
    // Ở chế độ giảm chuyển động không có vòng lặp vẽ nào chạy, nên phải tự
    // vẽ lại đúng một khung khi khách đổi đêm.
    //
    // Đây là một LỖI THẬT do bài kiểm bắt được: cả bộ Playwright chạy với
    // `reducedMotion: "reduce"`, và ở đó mặt nước đứng im ở pha của lần dựng
    // đầu — tức mặt trăng nói một đằng, mặt nước nói một nẻo, đúng cái mà
    // thành phần này sinh ra để tránh.
    if (itChuyenDong) veRef.current?.(0);
  }, [doSang, itChuyenDong]);

  useEffect(() => {
    const canvas = khung.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rong = 0;
    let cao = 0;
    let gon: Gon[] = [];
    let soGonHienTai = -1;
    let dangHien = true;
    let ma = 0;

    const doLaiKhung = () => {
      const ti = Math.min(2, window.devicePixelRatio || 1);
      rong = canvas.clientWidth;
      cao = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(rong * ti));
      canvas.height = Math.max(1, Math.round(cao * ti));
      ctx.setTransform(ti, 0, 0, ti, 0, 0);
    };

    const ve = (luc: number) => {
      if (rong === 0 || cao === 0) return;
      const vet = vetTrangTrenNuoc(doSangRef.current, rong);
      if (vet.soGon !== soGonHienTai) {
        gon = dungGon(vet.soGon);
        soGonHienTai = vet.soGon;
      }
      const tam = rong / 2;
      ctx.clearRect(0, 0, rong, cao);

      // Quầng sáng loang dưới chân trăng, làm nền cho các gợn.
      // Bán kính phải NHỎ hơn nửa bề ngang khung, nếu không quầng còn sáng
      // tới tận hai mép và cả dải nước hiện ra thành một băng ngang có cạnh
      // trên rõ mồn một — đúng lỗi mép hộp vừa sửa ở đầu trang.
      const banKinhLoang = Math.min(Math.max(vet.beRong, 1) * 0.9, rong * 0.38);
      const loang = ctx.createRadialGradient(tam, 0, 0, tam, 0, banKinhLoang);
      loang.addColorStop(0, `rgba(246,230,189,${(vet.doDam * 0.16).toFixed(3)})`);
      loang.addColorStop(1, "rgba(246,230,189,0)");
      ctx.fillStyle = loang;
      ctx.fillRect(0, 0, rong, cao);

      // Làm nhoè nhẹ toàn bộ gợn. Nét sắc cạnh đọc ra là gạch kẻ; nước thì
      // không có cạnh nào sắc cả. Trình duyệt nào không hiểu `filter` thì
      // vẫn vẽ được, chỉ là sắc hơn một chút.
      ctx.filter = "blur(0.7px)";

      for (const g of gon) {
        const y = g.t * cao;
        // Vệt loe dần về phía người xem — đúng cách một vệt sáng trên nước
        // nhìn từ bờ.
        const nuaRong = (vet.beRong / 2) * (0.35 + 1.25 * g.t);
        const x = tam + g.lech * nuaRong;
        const dai = g.dai * nuaRong * 2;
        const nhap = itChuyenDong ? 0.82 : 0.42 + 0.58 * Math.sin(luc / 1100 + g.pha + g.t * 5);
        // Mờ dần về phía dưới, và mờ dần về hai mép vệt.
        const xa = 1 - g.t * 0.62;
        const meP = 1 - Math.min(1, Math.abs(g.lech)) ** 2 * 0.75;
        const dam = vet.doDam * 0.62 * nhap * xa * meP;
        if (dam <= 0.004) continue;
        ctx.fillStyle = `rgba(250,238,208,${dam.toFixed(3)})`;
        const dayGon = 0.8 + g.t * 1.1;
        ctx.beginPath();
        ctx.roundRect(x - dai / 2, y, dai, dayGon, dayGon / 2);
        ctx.fill();
      }
      ctx.filter = "none";
    };

    doLaiKhung();
    veRef.current = ve;

    const theoDoiKhung = new ResizeObserver(() => {
      doLaiKhung();
      if (itChuyenDong) ve(0);
    });
    theoDoiKhung.observe(canvas);

    const theoDoiHien = new IntersectionObserver(
      ([muc]) => {
        dangHien = muc.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    theoDoiHien.observe(canvas);

    if (itChuyenDong) {
      ve(0);
      return () => {
        veRef.current = null;
        theoDoiKhung.disconnect();
        theoDoiHien.disconnect();
      };
    }

    const vong = (luc: number) => {
      if (dangHien) ve(luc);
      ma = window.requestAnimationFrame(vong);
    };
    ma = window.requestAnimationFrame(vong);

    return () => {
      veRef.current = null;
      window.cancelAnimationFrame(ma);
      theoDoiKhung.disconnect();
      theoDoiHien.disconnect();
    };
  }, [itChuyenDong]);

  return (
    <canvas
      ref={khung}
      data-moon-water
      aria-hidden="true"
      className={`pointer-events-none block w-full [mask-image:linear-gradient(180deg,#000_0%,#000_46%,transparent_100%)] ${className}`}
    />
  );
}
