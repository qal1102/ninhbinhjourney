"use client";

import { useSyncExternalStore } from "react";
import {
  anhChupDaMo,
  anhChupDaMoMayChu,
  daMoTu,
  theoDoiDaMo,
  xoaDaMo,
} from "@/lib/huong-dan-da-mo";

function useDaMo() {
  return daMoTu(useSyncExternalStore(theoDoiDaMo, anhChupDaMo, anhChupDaMoMayChu));
}

/** Dấu ✓ cạnh việc đã mở từ màn Hướng dẫn trên chính trình duyệt này. */
export function DauDaMo({ id }: { id: string }) {
  const daMo = useDaMo();
  if (!daMo.has(id)) return null;
  return (
    <span
      data-testid="dau-da-mo"
      className="inline-flex items-center gap-1 rounded-full bg-[#dff1e8] px-2.5 py-1 text-xs font-black text-[#246249]"
    >
      ✓ Đã mở
    </span>
  );
}

export function NutXoaDauDaMo() {
  const daMo = useDaMo();
  if (daMo.size === 0) return null;
  return (
    <button
      type="button"
      onClick={xoaDaMo}
      className="inline-flex min-h-11 items-center text-sm font-bold text-[#5f7068] underline underline-offset-4"
    >
      Xoá các dấu ✓ để trình diễn lại
    </button>
  );
}
