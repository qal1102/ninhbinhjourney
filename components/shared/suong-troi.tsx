"use client";

import { useEffect, useRef } from "react";
import type { DayBand } from "@/components/shared/ninh-binh-hour";
import { useReducedMotion } from "@/components/shared/use-reduced-motion";

/**
 * Sương trôi qua chân núi đá vôi ở ảnh đầu trang (A15-CON-LAI, "shader hero").
 *
 * Vì sao là sương mà không phải thứ khác: sương sớm luồn giữa các khối đá vôi
 * là hình ảnh riêng của Tràng An, và nó không đòi vẽ một đường nét nào lên ảnh
 * chụp thật. Hai lần trước đã hỏng đúng ở chỗ ấy: mặt nước gợn (04/08, gỡ vì
 * "nhìn ngáo" và lặp đúng ảnh màn mở đầu) và ba nét "sông uốn lượn" (22/09, gỡ
 * vì không bám vật thật nào trong ảnh). Sương thì không có hình để sai: nó là
 * một lớp mờ dày ở dải chân núi, mỏng dần lên trời.
 *
 * Ba thứ làm nó sống thay vì là một lớp phủ tĩnh:
 * - trôi chậm sang phải, theo nhiễu fbm cuộn hai lớp;
 * - rê chuột vào thì sương dạt nhẹ quanh con trỏ;
 * - cuộn xuống thì sương dày lên, như đi vào mây, nối sang cảnh Ngọa Long.
 * Màu sương theo giờ thật ở Ninh Bình (`band`): hồng nhạt lúc rạng sáng,
 * trắng giữa trưa, hổ phách chiều tà, xanh ánh trăng ban đêm.
 *
 * Là gia vị, không phải món chính (`KY_NANG_GIAO_DIEN.md` mục 7): WebGL1 thuần,
 * không thư viện; vẽ ở độ phân giải thấp (sương vốn mờ, phóng lên không mất gì);
 * tối đa 30 khung/giây; dừng khi ra khỏi màn hình hoặc tab ẩn; không chạy khi
 * khách chọn giảm chuyển động; máy không có WebGL thì không có gì, ảnh vẫn nguyên.
 */

export const MAU_THEO_GIO: Record<DayBand, readonly [number, number, number]> = {
  dawn: [1, 0.9, 0.86],
  morning: [0.96, 0.98, 1],
  midday: [1, 1, 0.98],
  afternoon: [1, 0.95, 0.87],
  dusk: [1, 0.86, 0.76],
  night: [0.74, 0.84, 0.96],
};

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_pointerOn;
uniform float u_progress;
uniform float u_strength;
uniform vec3 u_tint;
varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  vec2 pp = vec2(u_pointer.x * aspect, u_pointer.y);

  // Sương dạt quanh con trỏ: lệch điểm lấy mẫu ra xa con trỏ, tắt dần theo khoảng cách.
  float r = distance(p, pp);
  float day = u_pointerOn * (1.0 - smoothstep(0.0, 0.3, r));
  p += normalize(p - pp + 0.0001) * 0.07 * day;

  // Sương nằm thành dải ngang: kéo giãn nhiễu theo chiều ngang, nén theo chiều dọc.
  vec2 s = vec2(p.x * 0.55, p.y * 2.6);
  float t = u_time * 0.03;
  vec2 q = vec2(fbm(s * 1.3 + vec2(t, 0.0)), fbm(s * 1.3 + vec2(3.1, 7.7) - vec2(t * 0.5, 0.0)));
  // Dải gần, sát mặt nước: trôi nhanh hơn. Dải xa, quanh chân núi: trôi chậm, mỏng hơn.
  float gan = fbm(s * 1.8 + 1.4 * q + vec2(t * 1.8, 0.0));
  float xa = fbm(s * 1.15 + vec2(11.3, 2.1) + 1.2 * q.yx + vec2(t * 0.8, 0.0));
  float daiGan = smoothstep(0.0, 0.16, v_uv.y) * (1.0 - smoothstep(0.3, 0.52, v_uv.y));
  float daiXa = smoothstep(0.3, 0.46, v_uv.y) * (1.0 - smoothstep(0.62, 0.84, v_uv.y));
  float d = smoothstep(0.26, 0.76, gan) * daiGan + smoothstep(0.3, 0.8, xa) * daiXa * 0.8;
  // Cuộn xuống thì sương phủ dần cả khung, như đi vào mây.
  d = mix(d, max(d, smoothstep(0.32, 0.8, gan) * smoothstep(0.0, 0.25, v_uv.y)), u_progress);
  d *= 1.0 - day * 0.6;

  float a = clamp(d * (u_strength + u_progress * 0.4), 0.0, 0.85);
  gl_FragColor = vec4(u_tint * a, a);
}
`;

function bienDich(gl: WebGLRenderingContext, loai: number, nguon: string) {
  const shader = gl.createShader(loai);
  if (!shader) return null;
  gl.shaderSource(shader, nguon);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function SuongTroi({ band, className = "" }: { band: DayBand | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const bandName = band ?? "morning";

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = canvas?.parentElement;
    if (!canvas || !scene || reduced) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return;

    const vs = bienDich(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = bienDich(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, "u_res"),
      time: gl.getUniformLocation(program, "u_time"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      pointerOn: gl.getUniformLocation(program, "u_pointerOn"),
      progress: gl.getUniformLocation(program, "u_progress"),
      strength: gl.getUniformLocation(program, "u_strength"),
      tint: gl.getUniformLocation(program, "u_tint"),
    };

    const hep = window.matchMedia("(max-width: 767px)");
    const doDay = () => (bandName === "night" ? 0.66 : 0.56) * (hep.matches ? 0.85 : 1);

    const doKichThuoc = () => {
      const tiLe = hep.matches ? 0.33 : 0.5;
      const w = Math.max(64, Math.min(960, Math.round(canvas.clientWidth * tiLe)));
      const h = Math.max(64, Math.round((w * canvas.clientHeight) / Math.max(canvas.clientWidth, 1)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    doKichThuoc();
    const resize = new ResizeObserver(doKichThuoc);
    resize.observe(canvas);

    // Con trỏ: vị trí làm mượt, và độ "có mặt" tắt dần sau khi chuột thôi di.
    const conTro = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: 0, lanCuoi: 0 };
    const khiDi = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = scene.getBoundingClientRect();
      conTro.tx = (e.clientX - rect.left) / Math.max(rect.width, 1);
      conTro.ty = 1 - (e.clientY - rect.top) / Math.max(rect.height, 1);
      conTro.lanCuoi = performance.now();
    };
    scene.addEventListener("pointermove", khiDi, { passive: true });

    let dangThay = true;
    const io = new IntersectionObserver(([muc]) => {
      dangThay = Boolean(muc?.isIntersecting);
      if (dangThay) batDau();
    });
    io.observe(canvas);
    const khiAn = () => {
      if (!document.hidden) batDau();
    };
    document.addEventListener("visibilitychange", khiAn);

    let frame = 0;
    let lanVe = 0;
    let daHien = false;
    const goc = performance.now();
    const ve = (bayGio: number) => {
      frame = 0;
      if (!dangThay || document.hidden) return;
      frame = requestAnimationFrame(ve);
      if (bayGio - lanVe < 33) return;
      lanVe = bayGio;

      const rect = scene.getBoundingClientRect();
      const tienDo = Math.max(0, Math.min(1, -rect.top / Math.max(rect.height, 1)));
      const coMat = bayGio - conTro.lanCuoi < 1400 ? 1 : 0;
      conTro.on += (coMat - conTro.on) * 0.06;
      conTro.x += (conTro.tx - conTro.x) * 0.08;
      conTro.y += (conTro.ty - conTro.y) * 0.08;

      const [r, g, b] = MAU_THEO_GIO[bandName];
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, (bayGio - goc) / 1000);
      gl.uniform2f(u.pointer, conTro.x, conTro.y);
      gl.uniform1f(u.pointerOn, conTro.on);
      gl.uniform1f(u.progress, tienDo);
      gl.uniform1f(u.strength, doDay());
      gl.uniform3f(u.tint, r, g, b);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!daHien) {
        daHien = true;
        canvas.dataset.hien = "1";
      }
    };
    function batDau() {
      if (!frame && dangThay && !document.hidden) frame = requestAnimationFrame(ve);
    }
    batDau();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      resize.disconnect();
      scene.removeEventListener("pointermove", khiDi);
      document.removeEventListener("visibilitychange", khiAn);
      canvas.dataset.hien = "0";
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [reduced, bandName]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-suong-troi
      data-hien="0"
      className={`suong-troi pointer-events-none ${className}`}
    />
  );
}
