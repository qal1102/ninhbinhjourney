/**
 * Lõi WebGL dùng chung cho các lớp sương (`components/shared/suong-ven.tsx`,
 * `nui-suong.tsx`). Chỉ chạy ở trình duyệt.
 *
 * Gom ở đây những thứ mọi lớp sương đều cần và dễ làm sai: biên dịch shader,
 * vẽ một tam giác phủ khung, vẽ ở độ phân giải thấp (sương vốn mờ), tối đa 30
 * khung/giây, dừng khi ra khỏi màn hình hay tab ẩn, dọn sạch khi gỡ.
 */

export const VERTEX_SUONG = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Nhiễu giá trị và fbm năm lớp, dán vào đầu mọi fragment shader sương. */
export const NHIEU_GLSL = `
precision mediump float;
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

export type KhungVe = {
  gl: WebGLRenderingContext;
  u: (ten: string) => WebGLUniformLocation | null;
  /** Mili giây kể từ lúc bắt đầu chạy. */
  giay: number;
  /** Vị trí khung so với màn hình, để tính tiến độ cuộn. */
  rect: DOMRect;
  /** Con trỏ chuẩn hoá 0..1 (gốc dưới trái) và độ "có mặt" 0..1. */
  conTro: { x: number; y: number; on: number };
};

/**
 * Chạy một lớp sương trên `canvas`, đọc con trỏ trên `scene`. Trả về hàm dọn.
 * Trả `null` khi máy không có WebGL hay shader không dịch được: lúc ấy không
 * vẽ gì, trang vẫn nguyên.
 */
export function chayManSuong(
  canvas: HTMLCanvasElement,
  scene: HTMLElement,
  fragment: string,
  ve: (khung: KhungVe) => void,
  { tiLeHep = 0.33, tiLeRong = 0.5 }: { tiLeHep?: number; tiLeRong?: number } = {},
): (() => void) | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const vs = bienDich(gl, gl.VERTEX_SHADER, VERTEX_SUONG);
  const fs = bienDich(gl, gl.FRAGMENT_SHADER, NHIEU_GLSL + fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const viTri = new Map<string, WebGLUniformLocation | null>();
  const u = (ten: string) => {
    if (!viTri.has(ten)) viTri.set(ten, gl.getUniformLocation(program, ten));
    return viTri.get(ten) ?? null;
  };

  const hep = window.matchMedia("(max-width: 767px)");
  const doKichThuoc = () => {
    const tiLe = hep.matches ? tiLeHep : tiLeRong;
    const w = Math.max(64, Math.min(960, Math.round(canvas.clientWidth * tiLe)));
    const h = Math.max(48, Math.round((w * canvas.clientHeight) / Math.max(canvas.clientWidth, 1)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  doKichThuoc();
  const resize = new ResizeObserver(doKichThuoc);
  resize.observe(canvas);

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
  let frame = 0;
  let lanVe = 0;
  let daHien = false;
  const goc = performance.now();

  const veKhung = (bayGio: number) => {
    frame = 0;
    if (!dangThay || document.hidden) return;
    frame = requestAnimationFrame(veKhung);
    if (bayGio - lanVe < 33) return;
    lanVe = bayGio;
    const coMat = bayGio - conTro.lanCuoi < 1400 ? 1 : 0;
    conTro.on += (coMat - conTro.on) * 0.06;
    conTro.x += (conTro.tx - conTro.x) * 0.08;
    conTro.y += (conTro.ty - conTro.y) * 0.08;
    gl.uniform2f(u("u_res"), canvas.width, canvas.height);
    gl.uniform1f(u("u_time"), (bayGio - goc) / 1000);
    gl.uniform2f(u("u_pointer"), conTro.x, conTro.y);
    gl.uniform1f(u("u_pointerOn"), conTro.on);
    ve({ gl, u, giay: bayGio - goc, rect: scene.getBoundingClientRect(), conTro });
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!daHien) {
      daHien = true;
      canvas.dataset.hien = "1";
    }
  };
  const batDau = () => {
    if (!frame && dangThay && !document.hidden) frame = requestAnimationFrame(veKhung);
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
    scene.removeEventListener("pointermove", khiDi);
    document.removeEventListener("visibilitychange", khiAn);
    canvas.dataset.hien = "0";
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
}

/** Êm vào, êm ra: màn sương bắt đầu kéo chậm, nhanh dần, rồi lắng. */
export function emVaoRa(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
