/**
 * Mùa trăng đang ở giai đoạn nào, tính theo hôm nay.
 *
 * ## Vì sao cần
 *
 * Vòng trăng của trang Trung thu ban đầu **luôn mở sẵn ở đêm rằm**, bất kể hôm
 * nay là ngày nào. Chủ dự án mở web ngày 22/09 — trước rằm ba đêm — và nói
 * đúng ý: *"nên để nó tự detect giờ là giai đoạn nào chứ"*. Một trang theo mùa
 * mà không biết hôm nay là ngày nào trong mùa thì nó chỉ là tấm áp phích.
 *
 * ## Quy ước
 *
 * Một "đêm" tính theo **ngày dương ở giờ Việt Nam**. Không dùng giờ máy khách:
 * trang tự tính ở máy chủ rồi truyền xuống, nên khách ở Berlin vẫn thấy đúng
 * mùa trăng của Ninh Bình, và bản HTML máy chủ dựng khớp với bản máy khách
 * dựng lại — không lệch hydrate.
 */

const MUI_GIO_VN_MS = 7 * 60 * 60 * 1000;

/** Ngày dương `YYYY-MM-DD` ở giờ Việt Nam cho một thời điểm bất kỳ. */
export function ngayVN(luc: Date): string {
  return new Date(luc.getTime() + MUI_GIO_VN_MS).toISOString().slice(0, 10);
}

/** Số đêm từ ngày này tới ngày kia. Dương là còn tới, âm là đã qua. */
export function soDem(tu: string, den: string): number {
  return Math.round(
    (Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000,
  );
}

export type GiaiDoanMua =
  | "truoc-mua"
  | "trong-mua"
  | "dung-ram"
  | "qua-ram"
  | "het-mua";

export type TinhTrangMua = {
  giaiDoan: GiaiDoanMua;
  /** Ngày dương giờ Việt Nam của "hôm nay". */
  homNay: string;
  /** Số đêm còn lại tới mốc kế tiếp của giai đoạn hiện tại. */
  conMayDem: number;
  /** Chỉ số đêm trong mùa gần hôm nay nhất. */
  demGanNhat: number;
  /**
   * Có nên mở sẵn đêm "tối nay" không.
   *
   * Chỉ mở trong khoảng mùa nới ra bảy đêm mỗi đầu. Ngoài khoảng đó thì một
   * mặt trăng "tối nay" là thông tin lạc đề: khách vào tháng Ba không cần biết
   * trăng đêm nay khuyết bao nhiêu, họ cần thấy đêm rằm của mùa.
   */
  hienToiNay: boolean;
};

const NOI_RA_DEM = 7;

/**
 * @param ngayDem Các đêm của mùa, `YYYY-MM-DD`, xếp tăng dần.
 * @param ngayRam Đêm rằm — mốc chính của mùa.
 */
export function tinhTrangMua(
  bayGio: Date,
  ngayDem: readonly string[],
  ngayRam: string,
): TinhTrangMua {
  const homNay = ngayVN(bayGio);
  const moMua = ngayDem[0];
  const khepMua = ngayDem[ngayDem.length - 1];
  const toiMoMua = soDem(homNay, moMua);
  const toiRam = soDem(homNay, ngayRam);
  const toiKhep = soDem(homNay, khepMua);

  const giaiDoan: GiaiDoanMua =
    toiMoMua > 0
      ? "truoc-mua"
      : toiRam > 0
        ? "trong-mua"
        : toiRam === 0
          ? "dung-ram"
          : toiKhep >= 0
            ? "qua-ram"
            : "het-mua";

  const conMayDem =
    giaiDoan === "truoc-mua"
      ? toiMoMua
      : giaiDoan === "trong-mua"
        ? toiRam
        : giaiDoan === "qua-ram"
          ? toiKhep
          : 0;

  let demGanNhat = 0;
  for (let i = 1; i < ngayDem.length; i += 1) {
    if (
      Math.abs(soDem(homNay, ngayDem[i])) <
      Math.abs(soDem(homNay, ngayDem[demGanNhat]))
    ) {
      demGanNhat = i;
    }
  }

  return {
    giaiDoan,
    homNay,
    conMayDem,
    demGanNhat,
    hienToiNay: toiMoMua <= NOI_RA_DEM && toiKhep >= -NOI_RA_DEM,
  };
}

/** Câu trạng thái đặt ngay trên vòng trăng. */
export function loiTinhTrang(
  tt: TinhTrangMua,
  lang: "vi" | "en",
): string {
  const n = Math.abs(tt.conMayDem);
  const dem = lang === "vi" ? (n === 1 ? "một đêm" : `${n} đêm`) : n === 1 ? "1 night" : `${n} nights`;
  switch (tt.giaiDoan) {
    case "truoc-mua":
      return lang === "vi" ? `Còn ${dem} nữa mở mùa` : `${dem} until the season opens`;
    case "trong-mua":
      return lang === "vi" ? `Đang trong mùa · còn ${dem} nữa tới rằm` : `In season · ${dem} until the full moon`;
    case "dung-ram":
      return lang === "vi" ? "Đêm nay là rằm" : "Tonight is the full moon";
    case "qua-ram":
      return lang === "vi" ? `Qua rằm · còn ${dem} nữa khép mùa` : `Past the full moon · ${dem} until the season closes`;
    case "het-mua":
      return lang === "vi" ? "Mùa trăng năm nay đã khép" : "This year's moon season has closed";
  }
}
