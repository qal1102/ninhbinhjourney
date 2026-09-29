/**
 * Việc nào trên màn Hướng dẫn đã được mở, để đánh dấu cho người xem.
 *
 * Chỉ là tiện ích riêng từng trình duyệt: mất thì chỉ mất dấu ✓, hướng dẫn
 * vẫn chạy. Không ghi vào kho, vì hướng dẫn không có trạng thái nghiệp vụ.
 */

const KHOA = "nbj-huong-dan-da-mo";
const SU_KIEN = "nbj-huong-dan-da-mo";
const RONG = "[]";

function docChuoi(): string {
  try {
    return window.localStorage.getItem(KHOA) ?? RONG;
  } catch {
    return RONG;
  }
}

function phan(chuoi: string): string[] {
  try {
    const cu = JSON.parse(chuoi) as unknown;
    return Array.isArray(cu) ? cu.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ghiChuoi(ds: string[]) {
  try {
    if (ds.length) window.localStorage.setItem(KHOA, JSON.stringify(ds));
    else window.localStorage.removeItem(KHOA);
  } catch {
    // Trình duyệt chặn bộ nhớ: bỏ qua.
  }
  window.dispatchEvent(new Event(SU_KIEN));
}

export function ghiDaMo(id: string) {
  const ds = phan(docChuoi());
  if (!ds.includes(id)) ghiChuoi([...ds, id]);
}

export function xoaDaMo() {
  ghiChuoi([]);
}

/** Dùng với `useSyncExternalStore`: trả chuỗi thô để so sánh ổn định. */
export function anhChupDaMo(): string {
  return docChuoi();
}

export function anhChupDaMoMayChu(): string {
  return RONG;
}

export function theoDoiDaMo(bao: () => void) {
  window.addEventListener(SU_KIEN, bao);
  window.addEventListener("storage", bao);
  return () => {
    window.removeEventListener(SU_KIEN, bao);
    window.removeEventListener("storage", bao);
  };
}

export function daMoTu(chuoi: string): ReadonlySet<string> {
  return new Set(phan(chuoi));
}
