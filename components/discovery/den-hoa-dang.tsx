"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";

/**
 * Đèn hoa đăng trôi trên sông Ngô Đồng, dưới vòng trăng của trang Trung thu.
 *
 * Thả đèn hoa đăng là tục thật của đêm rằm ở Ninh Bình, nên đây không phải đồ
 * trang trí vô cớ: mỗi chiếc là một đốm nến trong đài sen giấy, trôi chậm theo
 * dòng, ánh nến lập loè và đổ bóng dài xuống mặt nước. Đèn ở xa nhỏ, mờ, trôi
 * chậm hơn đèn ở gần, nên mặt sông có chiều sâu mà không cần ảnh.
 *
 * Canvas 2D thuần, tối đa 30 khung/giây, dừng khi khuất màn hình hay tab ẩn,
 * vẽ ở mật độ điểm ảnh tối đa 1,5. Giảm chuyển động: không vẽ.
 */

type Den = { x: number; sau: number; pha: number; toc: number; co: number };

function taoDen(so: number, rong: number): Den[] {
  // Số giả ngẫu nhiên có hạt cố định: đèn rải tự nhiên, không xếp thành hàng,
  // và lần nào mở trang cũng một mặt sông.
  let hat = 7;
  const ngau = () => {
    hat = (hat * 16807) % 2147483647;
    return hat / 2147483647;
  };
  return Array.from({ length: so }, (_, i) => {
    const sau = ngau();
    return {
      x: ((i + ngau() * 0.8) / so) * rong,
      sau,
      pha: ngau() * 10,
      toc: 4 + (1 - sau) * 9,
      co: 0.5 + (1 - sau) * 0.6,
    };
  });
}

export function DenHoaDang() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rong = 0;
    let cao = 0;
    let dsDen: Den[] = [];
    const doKichThuoc = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      rong = canvas.clientWidth;
      cao = canvas.clientHeight;
      canvas.width = Math.round(rong * dpr);
      canvas.height = Math.round(cao * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dsDen = taoDen(rong < 480 ? 6 : 8, rong);
    };
    doKichThuoc();
    const resize = new ResizeObserver(doKichThuoc);
    resize.observe(canvas);

    const veDen = (den: Den, giay: number) => {
      // Mặt sông chiếm cả khung: xa ở trên, gần ở dưới.
      const y = cao * (0.22 + (1 - den.sau) * 0.6);
      const x = ((den.x - giay * den.toc) % (rong + 80) + rong + 80) % (rong + 80) - 40;
      const nhap = Math.sin(giay * 1.3 + den.pha) * 1.6 * den.co;
      const s = 9 * den.co;
      const lapLoe = 0.82 + 0.18 * Math.sin(giay * 9 + den.pha * 3) * Math.sin(giay * 5.3 + den.pha);
      const mo = 0.35 + (1 - den.sau) * 0.65;

      // Bóng nến dưới nước: một vệt sáng dọc mềm, gợn nhẹ theo sóng.
      ctx.save();
      ctx.translate(x + Math.sin(giay * 1.7 + den.pha) * s * 0.15, y + s * 1.6);
      ctx.scale(0.42, 2.2);
      const bong = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.4);
      bong.addColorStop(0, `rgba(255, 190, 110, ${0.3 * mo * lapLoe})`);
      bong.addColorStop(1, "rgba(255, 190, 110, 0)");
      ctx.fillStyle = bong;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Quầng sáng.
      const quang = ctx.createRadialGradient(x, y - s * 0.6 + nhap, 0, x, y - s * 0.6 + nhap, s * 4.2);
      quang.addColorStop(0, `rgba(255, 196, 120, ${0.5 * mo * lapLoe})`);
      quang.addColorStop(1, "rgba(255, 196, 120, 0)");
      ctx.fillStyle = quang;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6 + nhap, s * 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Đài sen giấy: ba cánh, đáy phẳng trên mặt nước.
      ctx.save();
      ctx.translate(x, y + nhap);
      ctx.globalAlpha = mo;
      ctx.fillStyle = "#d9783a";
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(-s * 1.15, -s * 0.9, -s * 0.45, -s * 1.1);
      ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, 0, -s * 1.35);
      ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.45, -s * 1.1);
      ctx.quadraticCurveTo(s * 1.15, -s * 0.9, s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255, 226, 160, ${0.9 * lapLoe})`;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.55, s * 0.26, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let dangThay = true;
    let frame = 0;
    let lanVe = 0;
    const goc = performance.now();
    const ve = (bayGio: number) => {
      frame = 0;
      if (!dangThay || document.hidden) return;
      frame = requestAnimationFrame(ve);
      if (bayGio - lanVe < 33) return;
      lanVe = bayGio;
      const giay = (bayGio - goc) / 1000;
      ctx.clearRect(0, 0, rong, cao);
      ctx.globalCompositeOperation = "lighter";
      // Vẽ xa trước, gần sau.
      for (const den of [...dsDen].sort((a, b) => b.sau - a.sau)) veDen(den, giay);
      ctx.globalCompositeOperation = "source-over";
      if (canvas.dataset.hien !== "1") canvas.dataset.hien = "1";
    };
    const batDau = () => {
      if (!frame && dangThay && !document.hidden) frame = requestAnimationFrame(ve);
    };
    const io = new IntersectionObserver(([muc]) => {
      dangThay = Boolean(muc?.isIntersecting);
      if (dangThay) batDau();
    });
    io.observe(canvas);
    const khiAn = () => {
      if (!document.hidden) batDau();
    };
    document.addEventListener("visibilitychange", khiAn);
    batDau();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", khiAn);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} aria-hidden="true" data-hien="0" className="den-hoa-dang pointer-events-none" />;
}
