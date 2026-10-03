"use client";

import { useEffect, useRef } from "react";
import { useNinhBinhHour } from "@/components/shared/ninh-binh-hour";
import { MAU_THEO_GIO } from "@/components/shared/suong-troi";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";
import { chayManSuong, emVaoRa } from "@/lib/suong-gl";

/**
 * Sương vén: mở trang là một màn sương dày phủ kín ảnh đầu trang, rồi sương
 * kéo dần xuống và tan, nơi ấy hiện ra như thuyền vừa ra khỏi mây. Tan xong
 * còn lại vài dải mỏng trôi quanh đỉnh núi, rê chuột thì rẽ ra.
 *
 * Cùng một ý với sương trên trang chủ (`suong-troi.tsx`), để cả trang chỉ có
 * một ngôn ngữ chuyển động: trang chủ cuộn xuống thì sương dày lên, bấm vào
 * một nơi thì sương ở nơi ấy vén ra.
 *
 * Đặt ngay sau lớp ảnh trong một khung `relative`, trước lớp chữ: sương nằm
 * dưới chữ nên chữ trắng không bao giờ bị phủ mờ. Chữ hiện dần bằng CSS
 * (`.suong-hien`), canh đúng nhịp sương tan.
 *
 * Giảm chuyển động: không vẽ gì. Không có WebGL: không vẽ gì, ảnh vẫn nguyên.
 */

export type TongSuong = "gio" | "trang" | "giay";

const MAU_CO_DINH: Record<Exclude<TongSuong, "gio">, readonly [number, number, number]> = {
  // Ánh trăng: trắng ngả lam, như sương đêm rằm trên sông Ngô Đồng.
  trang: [0.8, 0.87, 1],
  // Màu giấy dó của nền trang sáng.
  giay: [0.97, 0.95, 0.9],
};

/** Màu màn che CSS dựng sẵn (trước khung WebGL đầu), dạng "r g b". */
const MAU_MAN_CSS: Record<TongSuong, string> = {
  gio: "236 231 220",
  trang: "184 198 222",
  giay: "244 240 231",
};

const GIU_MS = 280;
const VEN_MS = 2600;

const FRAGMENT = `
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_pointerOn;
uniform float u_veil;
uniform float u_strength;
uniform float u_progress;
uniform vec3 u_tint;
varying vec2 v_uv;

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  vec2 pp = vec2(u_pointer.x * aspect, u_pointer.y);
  float r = distance(p, pp);
  float day = u_pointerOn * (1.0 - smoothstep(0.0, 0.3, r));
  p += normalize(p - pp + 0.0001) * 0.07 * day;
  // Trong lúc vén, cả khối sương trượt xuống theo.
  p.y -= u_veil * 0.4;

  float t = u_time * 0.03;
  vec2 s = vec2(p.x * 0.55, p.y * 2.6);
  vec2 q = vec2(fbm(s * 1.3 + vec2(t, 0.0)), fbm(s * 1.3 + vec2(3.1, 7.7) - vec2(t * 0.5, 0.0)));
  float cao = fbm(s * 1.15 + vec2(11.3, 2.1) + 1.2 * q.yx + vec2(t * 0.8, 0.0));
  float giua = fbm(s * 1.7 + 1.4 * q + vec2(t * 1.6, 0.0));
  // Sương lúc yên: quấn quanh đỉnh núi (nửa trên), mỏng dần xuống chỗ chữ.
  float daiCao = smoothstep(0.5, 0.64, v_uv.y) * (1.0 - smoothstep(0.86, 1.0, v_uv.y));
  float daiGiua = smoothstep(0.32, 0.46, v_uv.y) * (1.0 - smoothstep(0.56, 0.7, v_uv.y));
  float d = smoothstep(0.3, 0.78, cao) * daiCao + smoothstep(0.34, 0.8, giua) * daiGiua * 0.55;
  d *= 1.0 - day * 0.65;
  d = mix(d, max(d, smoothstep(0.36, 0.82, giua) * smoothstep(0.3, 0.7, v_uv.y)), u_progress);

  // Màn sương phủ kín, mép trên kéo dần xuống, mép gợn theo nhiễu.
  float n = fbm(vec2(p.x * 1.6, p.y * 1.3) + vec2(t * 3.0, 0.0));
  float k = 1.0 - v_uv.y;
  float mep = (1.0 - u_veil) * 1.75 - 0.15;
  float che = smoothstep(mep - 0.3, mep + 0.04, k + 0.5 * (n - 0.5));
  float man = che * clamp(0.84 + 0.3 * (n - 0.5), 0.0, 1.0);

  float a = clamp(max(d * (u_strength + u_progress * 0.3), man * 0.97), 0.0, 0.97);
  gl_FragColor = vec4(u_tint * a, a);
}
`;

export function SuongVen({
  tong = "gio",
  doDay = 0.5,
  className = "",
}: {
  tong?: TongSuong;
  /** Độ dày của sương lúc yên, sau khi đã vén. */
  doDay?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const gio = useNinhBinhHour();
  // Màu theo giờ đổi giữa chừng (null → giờ thật) không được làm màn sương vén lại từ đầu.
  const mau = tong === "gio" ? MAU_THEO_GIO[gio?.band ?? "morning"] : MAU_CO_DINH[tong];
  const mauRef = useRef(mau);
  useEffect(() => {
    mauRef.current = mau;
  }, [mau]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = canvas?.parentElement;
    if (!canvas || !scene || reduced) return;
    let batDauVen = -1;
    const don = chayManSuong(canvas, scene, FRAGMENT, ({ gl, u, giay, rect }) => {
      if (batDauVen < 0) batDauVen = giay + GIU_MS;
      const ven = 1 - emVaoRa((giay - batDauVen) / VEN_MS);
      const tienDo = Math.max(0, Math.min(1, -rect.top / Math.max(rect.height, 1)));
      const [r, g, b] = mauRef.current;
      gl.uniform1f(u("u_veil"), ven);
      gl.uniform1f(u("u_strength"), doDay);
      gl.uniform1f(u("u_progress"), tienDo);
      gl.uniform3f(u("u_tint"), r, g, b);
      if (ven <= 0 && scene.dataset.suongVen !== "xong") scene.dataset.suongVen = "xong";
    });
    if (!don) {
      scene.dataset.suongVen = "xong";
      return;
    }
    return don;
  }, [reduced, doDay]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-suong-ven
      data-hien="0"
      style={{ ["--suong-mau" as string]: MAU_MAN_CSS[tong] }}
      className={`suong-ven pointer-events-none ${className}`}
    />
  );
}
