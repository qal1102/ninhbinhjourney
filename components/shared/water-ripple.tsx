"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const VERTEX_SRC = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uAspect;
uniform vec3 uDrops[8];

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uAspect, 1.0);
  vec2 displacement = vec2(0.0);

  for (int i = 0; i < 8; i++) {
    vec3 drop = uDrops[i];
    float age = uTime - drop.z;
    if (drop.z <= 0.0 || age < 0.0 || age > 2.2) continue;
    vec2 delta = (uv - drop.xy) * aspect;
    float dist = length(delta);
    float ring = sin(dist * 60.0 - age * 10.0) * exp(-age * 2.5) * exp(-dist * 6.0);
    displacement += normalize(delta + 0.0001) * ring * 0.015;
  }

  displacement += vec2(sin(uv.y * 12.0 + uTime * 0.6), cos(uv.x * 10.0 + uTime * 0.5)) * 0.0022;

  vec3 color = texture2D(uTexture, uv + displacement).rgb;
  float highlight = clamp(length(displacement) * 9.0, 0.0, 0.35);
  color += highlight;

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function WaterRipple({
  src,
  alt,
  className = "",
  wakeSourceX,
  wakeSourceY,
}: {
  src: string;
  alt: string;
  className?: string;
  /**
   * Toa do uv (0-1, goc duoi-trai) cua vat the tren mat nuoc -- vi du con
   * thuyen -- de phat song nhe lien tuc tu do, nhu dang re nuoc di qua.
   * Hai so nguyen thuy thay vi mot object: object literal truyen thang tu
   * JSX tao tham chieu moi moi lan render, khien effect dung lai WebGL
   * khong can thiet.
   */
  wakeSourceX?: number;
  wakeSourceY?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const glContext = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!glContext || !(glContext instanceof WebGLRenderingContext)) return;
    const gl: WebGLRenderingContext = glContext;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uAspect = gl.getUniformLocation(program, "uAspect");
    const uDrops = gl.getUniformLocation(program, "uDrops");
    const uTexture = gl.getUniformLocation(program, "uTexture");

    // WebGL doc anh tu goc duoi-trai, HTML <img> doc tu goc tren-trai -- neu
    // khong lat, mat nuoc se hien nguoc dau (da bat duoc loi nay qua chup
    // anh thuc te: nui/thuyen lon nguoc trong canvas).
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 40, 35, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    let destroyed = false;
    const image = new window.Image();
    image.src = src;
    image.onload = () => {
      if (destroyed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };

    const drops = new Float32Array(24); // 8 drops * (x, y, time)
    let dropCursor = 0;
    // Duong chan troi cua anh trang-an-rain.png nam o khoang 64% chieu cao
    // tinh tu tren xuong -- trong he toa do uv (0 = day man hinh) do la
    // ~0.36. Ghim moi giot song (ca tu con tro lan mua) khong vuot qua moc
    // nay, de song khong bao gio "lan" len vach nui -- da bat qua chup anh
    // that: mua ngau nhien roi trung nui trong lai nhu bi loi.
    const WATER_Y_MAX = 0.34;

    function pushDropAtUv(x: number, y: number) {
      const base = dropCursor * 3;
      drops[base] = x;
      drops[base + 1] = Math.min(y, WATER_Y_MAX);
      drops[base + 2] = performance.now() / 1000;
      dropCursor = (dropCursor + 1) % 8;
    }

    function pushDrop(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      pushDropAtUv((clientX - rect.left) / rect.width, 1 - (clientY - rect.top) / rect.height);
    }

    let lastMoveAt = 0;
    function onPointerMove(event: PointerEvent) {
      const now = performance.now();
      if (now - lastMoveAt < 45) return;
      lastMoveAt = now;
      pushDrop(event.clientX, event.clientY);
    }
    function onPointerDown(event: PointerEvent) {
      pushDrop(event.clientX, event.clientY);
    }

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerdown", onPointerDown);

    // Song nen: neu co wakeSourceX/Y (vi tri con thuyen), phat song deu nhu
    // mai cheo re nuoc -- nhip gan hon, jitter nho quanh dung vi tri
    // thuyen. Khong co thi roi rac nhe khap mat nuoc kieu mua, thua hon.
    const hasWakeSource = wakeSourceX !== undefined && wakeSourceY !== undefined;
    let rainTimer = 0;
    function scheduleRain() {
      const delay = hasWakeSource ? 480 + Math.random() * 420 : 900 + Math.random() * 1300;
      rainTimer = window.setTimeout(() => {
        if (visible) {
          if (hasWakeSource) {
            pushDropAtUv(
              wakeSourceX! + (Math.random() - 0.5) * 0.05,
              Math.min(wakeSourceY! + (Math.random() - 0.5) * 0.03, WATER_Y_MAX),
            );
          } else {
            pushDropAtUv(0.1 + Math.random() * 0.8, Math.random() * WATER_Y_MAX);
          }
        }
        scheduleRain();
      }, delay);
    }
    scheduleRain();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(container);

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      gl.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const start = performance.now();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const time = (performance.now() - start) / 1000;
      gl.useProgram(program);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uAspect, canvas!.width / canvas!.height);
      gl.uniform3fv(uDrops, drops);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTexture, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(rainTimer);
      io.disconnect();
      ro.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerDown);
    };
  }, [src, wakeSourceX, wakeSourceY]);

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      {/* Lop nen that: hien khi giam chuyen dong hoac WebGL khong khoi tao
          duoc -- canvas phia tren trong suot cho toi khi ve duoc gi do, nen
          khong bao gio co man hinh trong/hong. */}
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
