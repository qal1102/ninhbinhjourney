/**
 * TC-11 — dự báo giờ chạm trần.
 *
 * Hàm thuần, không gọi mạng. Toàn bộ phần đúng/sai của tính năng này nằm ở
 * đây, nên nó được viết để kiểm được bằng số liệu bịa sẵn, không cần cơ sở dữ
 * liệu.
 *
 * ## Luật số một: không đủ dữ liệu thì nói thẳng
 *
 * Kế hoạch TC-11 ghi rõ *"dự báo sai làm quản lý điều khách sai; sai lặng lẽ
 * còn tệ hơn không có"*. Vì thế mọi lối ra ở đây đều có tên: đoán được, chưa
 * đủ dữ liệu, hoặc hôm nay không chạm trần. Không có lối nào trả về một con số
 * mà không kèm căn cứ.
 *
 * ## Vì sao đo bằng tốc độ gần đây chứ không bằng trung bình cả ngày
 *
 * Giữ chỗ không rải đều: sáng sớm lác đác, gần trưa dồn lại. Lấy trung bình cả
 * ngày thì lúc nào cũng đoán muộn hơn thực tế. Ở đây dùng **cửa sổ gần nhất**
 * (mặc định 120 phút) và đòi cửa sổ ấy có ít nhất hai mốc đo.
 */

export type ForecastSample = {
  /** Phút kể từ 00:00 giờ Việt Nam của chính ngày đang xét. */
  atMinutes: number;
  /** Tổng số chỗ đã giữ tính tới mốc ấy (cộng dồn, không giảm). */
  taken: number;
};

export type CapacityForecast =
  | {
      kind: "du-doan";
      /** Phút kể từ 00:00 giờ Việt Nam, dự kiến chạm trần. */
      hitAtMinutes: number;
      /** Chỗ giữ thêm mỗi giờ trong cửa sổ gần nhất. */
      perHour: number;
      remaining: number;
      /** So với cùng giờ hôm trước: 2 nghĩa là nhanh gấp đôi. Null khi không có hôm trước. */
      versusYesterday: number | null;
    }
  | { kind: "khong-cham-tran"; perHour: number; remaining: number }
  | { kind: "da-kin"; }
  | { kind: "chua-du-du-lieu"; vi_sao: "chua-du-moc" | "chua-du-cho-giu" | "chua-nhuc-nhich" };

export const FORECAST_WINDOW_MINUTES = 120;
export const FORECAST_MIN_SAMPLES = 2;
export const FORECAST_MIN_TAKEN = 5;
/**
 * Mốc mặc định coi như "quá tầm nhìn": 21:00 nếu trục đang là giờ trong ngày.
 * Bề mặt vận hành đo theo **giờ đặt chỗ** nên tự truyền mốc của mình
 * () — hàm này không tự cho rằng trục là giờ nào.
 */
export const FORECAST_DAY_END_MINUTES = 21 * 60;

function locTrongCuaSo(
  samples: ForecastSample[],
  asOfMinutes: number,
  windowMinutes: number = FORECAST_WINDOW_MINUTES,
): ForecastSample[] {
  return samples
    .filter((s) => s.atMinutes <= asOfMinutes && s.atMinutes >= asOfMinutes - windowMinutes)
    .sort((a, b) => a.atMinutes - b.atMinutes);
}

/** Chỗ giữ thêm mỗi giờ, đo trên hai đầu cửa sổ. Null khi cửa sổ không đủ mốc. */
export function tocDoGiuCho(
  samples: ForecastSample[],
  asOfMinutes: number,
  windowMinutes: number = FORECAST_WINDOW_MINUTES,
): number | null {
  const trong = locTrongCuaSo(samples, asOfMinutes, windowMinutes);
  if (trong.length < FORECAST_MIN_SAMPLES) return null;
  const dau = trong[0];
  const cuoi = trong[trong.length - 1];
  const phut = cuoi.atMinutes - dau.atMinutes;
  if (phut <= 0) return null;
  const them = cuoi.taken - dau.taken;
  return (them / phut) * 60;
}

export function duBaoChamTran(input: {
  capacity: number;
  samples: ForecastSample[];
  asOfMinutes: number;
  /** Tốc độ cùng giờ hôm trước, để nói "nhanh gấp đôi hôm qua". */
  perHourYesterday?: number | null;
  /**
   * Cửa sổ đo. Khách đặt trước nhiều ngày nên bề mặt vận hành truyền cửa sổ
   * dài (nửa ngày trở lên); hai giờ chỉ hợp với thứ bán ngay trong ngày.
   */
  windowMinutes?: number;
  /** Quá mốc này thì coi như không chạm trần trong tầm đang nhìn. */
  horizonMinutes?: number;
}): CapacityForecast {
  const { capacity, samples, asOfMinutes } = input;
  const cuaSo = input.windowMinutes ?? FORECAST_WINDOW_MINUTES;
  const trong = locTrongCuaSo(samples, asOfMinutes, cuaSo);
  const daGiu = trong.length > 0 ? trong[trong.length - 1].taken : 0;
  const remaining = Math.max(0, capacity - daGiu);

  if (capacity > 0 && daGiu >= capacity) return { kind: "da-kin" };
  if (trong.length < FORECAST_MIN_SAMPLES) {
    return { kind: "chua-du-du-lieu", vi_sao: "chua-du-moc" };
  }
  if (daGiu < FORECAST_MIN_TAKEN) {
    return { kind: "chua-du-du-lieu", vi_sao: "chua-du-cho-giu" };
  }

  const perHour = tocDoGiuCho(samples, asOfMinutes, cuaSo);
  if (perHour === null) return { kind: "chua-du-du-lieu", vi_sao: "chua-du-moc" };
  if (perHour <= 0) return { kind: "chua-du-du-lieu", vi_sao: "chua-nhuc-nhich" };

  const phutConLai = (remaining / perHour) * 60;
  const hitAtMinutes = Math.round(asOfMinutes + phutConLai);
  if (hitAtMinutes > (input.horizonMinutes ?? FORECAST_DAY_END_MINUTES)) {
    return { kind: "khong-cham-tran", perHour, remaining };
  }

  const homQua = input.perHourYesterday ?? null;
  const versusYesterday = homQua && homQua > 0 ? perHour / homQua : null;
  return { kind: "du-doan", hitAtMinutes, perHour, remaining, versusYesterday };
}

/**
 * Đối chiếu một dự báo đã đưa ra với chuyện đã xảy ra thật.
 *
 * Kế hoạch đòi "sai số được ghi ra chứ không giấu", nên hàm này là một phần
 * của tính năng chứ không phải đồ chơi kiểm thử: màn hình vận hành đọc chính
 * nó để nói "hôm qua đoán lệch bao nhiêu phút".
 *
 * Trả `null` khi không so được — ví dụ hôm ấy chưa bao giờ kín, hoặc lúc đó
 * hệ thống không đoán.
 */
export function doSaiSo(input: {
  forecast: CapacityForecast;
  /** Phút thực tế chạm trần; null nghĩa là cả ngày không kín. */
  thucTeHitAtMinutes: number | null;
}): { lechPhut: number; huong: "som-hon" | "muon-hon" | "dung" } | null {
  const { forecast, thucTeHitAtMinutes } = input;
  if (forecast.kind === "du-doan" && thucTeHitAtMinutes !== null) {
    const lech = forecast.hitAtMinutes - thucTeHitAtMinutes;
    return {
      lechPhut: Math.abs(lech),
      huong: lech === 0 ? "dung" : lech > 0 ? "muon-hon" : "som-hon",
    };
  }
  return null;
}

/** "13:45" từ số phút kể từ nửa đêm. */
export function docGio(minutes: number): string {
  const gio = Math.floor(minutes / 60);
  const phut = Math.round(minutes % 60);
  return `${String(gio).padStart(2, "0")}:${String(phut).padStart(2, "0")}`;
}

/**
 * Một câu tiếng Việt cho người vận hành đọc.
 *
 * Cấm của TC-11, giữ đúng: **không phần trăm tải, không tên ngưỡng, không số
 * phiên bản ngưỡng.** Người đứng ở cổng cần biết mấy giờ kín và còn bao nhiêu
 * chỗ, không cần biết cái ngưỡng ấy tên gì.
 */
export function noThanh(forecast: CapacityForecast, tenNoi: string, nhanGio?: string): string {
  switch (forecast.kind) {
    case "da-kin":
      return `${tenNoi} đã kín chỗ.`;
    case "khong-cham-tran":
      return `${tenNoi} giữ chỗ đều, nhiều khả năng chưa kín; còn ${forecast.remaining.toLocaleString("vi-VN")} chỗ.`;
    case "chua-du-du-lieu":
      return forecast.vi_sao === "chua-du-cho-giu"
        ? `${tenNoi} mới có ít lượt giữ chỗ, chưa đoán được giờ kín.`
        : forecast.vi_sao === "chua-nhuc-nhich"
          ? `${tenNoi} chưa có thêm lượt giữ chỗ nào trong khoảng vừa đo, chưa đoán được giờ kín.`
          : `${tenNoi} chưa đủ mốc đo, chưa đoán được giờ kín.`;
    case "du-doan": {
      const nhanh =
        forecast.versusYesterday && forecast.versusYesterday >= 1.5
          ? `${tenNoi} giữ chỗ nhanh gấp ${forecast.versusYesterday.toFixed(1).replace(".", ",")} hôm qua, k`
          : `${tenNoi} k`;
      return `${nhanh}hoảng ${nhanGio ?? docGio(forecast.hitAtMinutes)} là kín; còn ${forecast.remaining.toLocaleString("vi-VN")} chỗ.`;
    }
  }
}
