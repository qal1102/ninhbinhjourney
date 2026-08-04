"use client";

import { useEffect, useRef } from "react";

/**
 * Doi lau nga theo gio o chan trang -- WebGL1 thuan, khong thu vien.
 *
 * Y tuong lay tu day trang Chartogne-Taillet (Immersive Garden), nhung
 * doi cay nho thanh CO LAU: trong chinh anh Thung Nham va Van Long cua
 * du an da co san bo lau trang, nen hinh nay thuoc ve Ninh Binh chu
 * khong phai muon cho co.
 *
 * Ky thuat: toan bo ~420 ngon lau duoc "nuong" san vao MOT vertex
 * buffer (khong can extension instancing cua WebGL1). Moi ngon la mot
 * dai tam giac 5 dot. Vertex shader lo phan uon:
 *   - gio nen: sin(thoi gian + pha rieng tung ngon)
 *   - con chuot: day them mot luc theo khoang cach ngang
 * Do uon nhan t^2 nen goc lau luon "cam" xuong dat, chi ngon moi lac --
 * dung vat ly, khong bi truot ca cay nhu anh dan.
 *
 * prefers-reduced-motion: ve dung mot khung tinh roi dung han.
 * IntersectionObserver: ra khoi man hinh thi ngung rAF cho do ton pin.
 */

const BLADES = 900;
const SEGMENTS = 5;
const FLOATS_PER_VERT = 7;

const VERT = `
attribute float aBase;
attribute float aT;
attribute float aSide;
attribute float aHeight;
attribute float aPhase;
attribute float aTint;
attribute float aLean;

uniform float uTime;
uniform float uAspect;
uniform vec2 uPointer;     // x: -1..1, y: 0 duoi -> 1 tren
uniform float uPointerOn;

varying float vT;
varying float vTint;

void main() {
  float t = aT;

  // Gio nen: hai tan so chong nhau cho khoi deu tam tap nhu may danh nhip.
  float wind =
      sin(uTime * 1.15 + aPhase + aBase * 2.4) * 0.055
    + sin(uTime * 0.47 + aPhase * 1.7) * 0.03;

  // Con chuot day lau ra hai ben, gan thi manh, xa thi tat dan. Bien do
  // giu nho: de 0.22 thi lau re han ra thanh mot khoang tro, nhin gia --
  // da chup anh that va ha xuong cho no chi nghieng theo tay.
  float dx = aBase - uPointer.x;
  float push = exp(-dx * dx * 34.0) * uPointerOn * 0.11;
  push *= sign(dx == 0.0 ? 1.0 : dx);

  float bend = (aLean + wind + push) * t * t;

  // Ngon cang len cao cang thon lai. KHONG chia cho uAspect: x da o he
  // toa do clip -1..1 theo chieu ngang roi, chia them lam moi ngon chi
  // con ~1px, nhin nhu vet xuoc thay vi bo lau (da chup anh that va sua).
  // Lau gan (aTint cao) day hon lau xa mot chut cho ra chieu sau.
  float halfWidth = (0.0032 + aTint * 0.0034) * (1.0 - t * 0.88);

  float x = aBase + bend + aSide * halfWidth;
  float y = -1.0 + t * aHeight;

  vT = t;
  vTint = aTint;
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying float vT;
varying float vTint;

void main() {
  // Goc lau chim trong bong toi, len cao thi bac dan sang mau bong lau
  // trang nga -- dung mau bong lau that o Thung Nham/Van Long.
  vec3 root = vec3(0.035, 0.086, 0.068);
  vec3 mid  = vec3(0.145, 0.290, 0.207);
  vec3 tip  = vec3(0.925, 0.878, 0.718);

  vec3 color = mix(root, mid, smoothstep(0.0, 0.5, vT));
  color = mix(color, tip, smoothstep(0.45, 1.0, vT) * (0.45 + vTint * 0.55));

  // Lau xa (vTint thap) chim vao suong, lau gan ro net -- tao chieu sau
  // thay vi mot bang phang deu tam tap.
  color = mix(vec3(0.043, 0.098, 0.078), color, 0.45 + vTint * 0.55);

  float alpha = (0.55 + vTint * 0.45) * (1.0 - smoothstep(0.9, 1.0, vT) * 0.5);
  gl_FragColor = vec4(color, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Random co hat co dinh -- moi lan tai trang doi lau van y nguyen, khong
// "nhay" sang bo cuc khac gay cam giac loi.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildGeometry() {
  const rand = seeded(20250804);
  const data = new Float32Array(BLADES * SEGMENTS * 6 * FLOATS_PER_VERT);
  let o = 0;

  for (let b = 0; b < BLADES; b++) {
    // Ve tu xa toi gan: lop dau la lau xa (thap, toi, mo), lop cuoi la
    // lau gan (cao, sang, ro). Vi ve theo thu tu nay nen lau gan tu de
    // len lau xa, ra chieu sau that chu khong phai mot bang phang.
    const depth = b / BLADES;
    const base = (rand() * 2 - 1) * 1.06;
    const height = (0.34 + depth * 0.5) + rand() * 0.55;
    const phase = rand() * Math.PI * 2;
    const tint = depth * 0.72 + rand() * 0.28;
    const lean = (rand() * 2 - 1) * 0.12;

    for (let s = 0; s < SEGMENTS; s++) {
      const t0 = s / SEGMENTS;
      const t1 = (s + 1) / SEGMENTS;
      const quad: Array<[number, number]> = [
        [t0, -1], [t0, 1], [t1, -1],
        [t1, -1], [t0, 1], [t1, 1],
      ];
      for (const [t, side] of quad) {
        data[o++] = base;
        data[o++] = t;
        data[o++] = side;
        data[o++] = height;
        data[o++] = phase;
        data[o++] = tint;
        data[o++] = lean;
      }
    }
  }
  return data;
}

export function ReedField({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const glCtx =
      canvas.getContext("webgl", { alpha: true, antialias: true }) ||
      canvas.getContext("experimental-webgl");
    if (!glCtx || !(glCtx instanceof WebGLRenderingContext)) return;
    const gl: WebGLRenderingContext = glCtx;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, buildGeometry(), gl.STATIC_DRAW);

    const stride = FLOATS_PER_VERT * 4;
    const names = ["aBase", "aT", "aSide", "aHeight", "aPhase", "aTint", "aLean"];
    names.forEach((name, i) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
    });

    const uTime = gl.getUniformLocation(program, "uTime");
    const uAspect = gl.getUniformLocation(program, "uAspect");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const uPointerOn = gl.getUniformLocation(program, "uPointerOn");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vertexCount = BLADES * SEGMENTS * 6;
    let aspect = 1;

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      aspect = rect.width / Math.max(rect.height, 1);
      gl.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Chuot chi tinh theo truc ngang -- lau moc duoi day, keo doc khong
    // co y nghia vat ly.
    let pointerX = 0;
    let pointerOn = 0;
    function onMove(event: PointerEvent) {
      const rect = wrap!.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerOn = 1;
    }
    function onLeave() {
      pointerOn = 0;
    }
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    function draw(time: number) {
      gl.useProgram(program!);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uAspect, aspect);
      gl.uniform2f(uPointer, pointerX, 0);
      gl.uniform1f(uPointerOn, pointerOn);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      draw(0);
      return () => {
        ro.disconnect();
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
      };
    }

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(wrap);

    const start = performance.now();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      draw((performance.now() - start) / 1000);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`pointer-events-auto relative h-[220px] w-full sm:h-[300px] ${className}`.trim()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
