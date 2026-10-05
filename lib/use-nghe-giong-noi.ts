"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nghe một câu tiếng Việt bằng nhận dạng giọng nói có sẵn của trình duyệt
 * (Web Speech API, miễn phí). Chữ hiện dần khi đang nói; nói xong thì gọi
 * `onXong` với cả câu. Máy không hỗ trợ thì `hoTro` là false để màn hình mời
 * gõ tay.
 */

type KetQuaNghe = ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
type BoNghe = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: Event & { results: KetQuaNghe }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const LOI: Record<string, string> = {
  "not-allowed": "Micro đang bị chặn. Cho phép micro trong cài đặt trình duyệt.",
  "audio-capture": "Không tìm thấy micro trên máy.",
  network: "Mạng chập chờn, chưa nghe được. Thử lại hoặc gõ tay.",
  "no-speech": "Chưa nghe thấy gì. Đưa máy gần hơn rồi thử lại.",
};

export function useNgheGiongNoi(onXong: (cau: string) => void) {
  const boNghe = useRef<BoNghe | null>(null);
  const onXongRef = useRef(onXong);
  const [dangNghe, setDangNghe] = useState(false);
  const [tamThoi, setTamThoi] = useState("");
  const [loi, setLoi] = useState("");
  const [hoTro, setHoTro] = useState(true);

  useEffect(() => {
    onXongRef.current = onXong;
  }, [onXong]);

  useEffect(() => () => boNghe.current?.stop(), []);

  function batDau() {
    const w = window as typeof window & { SpeechRecognition?: new () => BoNghe; webkitSpeechRecognition?: new () => BoNghe };
    const Lop = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Lop) {
      setHoTro(false);
      setLoi("Trình duyệt này chưa nghe được giọng nói. Gõ vào ô bên dưới, hoặc mở bằng Chrome, Edge, Safari.");
      return;
    }
    setLoi("");
    setTamThoi("");
    const r = new Lop();
    r.lang = "vi-VN";
    // Ghi chú có thể dài và có chỗ ngập ngừng: nghe liên tục, bấm lần nữa để dừng.
    r.continuous = true;
    r.interimResults = true;
    let caCau = "";
    r.onresult = (e) => {
      let xong = "";
      let tam = "";
      for (let i = 0; i < e.results.length; i++) {
        const chu = e.results[i]?.[0]?.transcript ?? "";
        if (e.results[i]?.isFinal) xong += chu;
        else tam += chu;
      }
      caCau = xong;
      setTamThoi(`${xong}${tam}`.trim());
    };
    r.onend = () => {
      setDangNghe(false);
      const cau = caCau.trim();
      setTamThoi("");
      if (cau) onXongRef.current(cau);
    };
    r.onerror = (e) => {
      setDangNghe(false);
      setLoi(LOI[e.error] ?? "Chưa nghe được. Thử lại hoặc gõ tay.");
    };
    boNghe.current = r;
    try {
      r.start();
      setDangNghe(true);
    } catch {
      setLoi("Micro chưa sẵn sàng. Thử lại hoặc gõ tay.");
    }
  }

  function dung() {
    boNghe.current?.stop();
  }

  return { dangNghe, tamThoi, loi, hoTro, batDau, dung };
}
