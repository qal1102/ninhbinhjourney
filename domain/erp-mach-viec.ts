import type { ErpModuleId, ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Mạch việc — vẽ ra cái vòng quy trình vốn đã có sẵn trong dữ liệu.
 *
 * ## Vấn đề thật
 *
 * Chủ dự án tự dùng ERP và nói đúng một câu: *nhiều tính năng nhưng vào rồi
 * không hiểu phải làm gì.* Mỗi màn hình đều đúng việc của nó, nhưng không màn
 * nào nói cho người đứng đó biết **mình đang ở khúc nào của một quy trình**,
 * dữ liệu trước mặt từ đâu chảy tới, và làm xong thì ai cầm tiếp.
 *
 * ## Vì sao KHÔNG viết hướng dẫn bằng tay cho từng màn
 *
 * Trong dự án này đã có sẵn một bằng chứng: nút `?` (`ModuleContextHelp`) tồn
 * tại trên mọi màn từ lâu, nhưng 14/15 màn chỉ hiện đúng một dòng mô tả chung
 * cộng một đoạn trách nhiệm dùng chung cho mọi màn — chỉ màn Đối tác được viết
 * riêng. Viết tay 15 màn × 5 vai là 75 đoạn văn; tới ngày đổi quy trình sẽ
 * không ai nhớ sửa đủ 75 chỗ, và phần quên sửa trở thành **tài liệu nói dối** —
 * tệ hơn hẳn không có tài liệu, vì người đọc tin nó.
 *
 * ## Cách làm ở đây: khai xương sống, còn vị trí thì đọc từ dữ liệu
 *
 * Tệp này khai **bằng tay đúng một lần** những gì chỉ con người biết: một luồng
 * gồm mấy bước, ai làm bước nào, ở màn nào, dữ liệu vào từ đâu, đẩy ra cái gì.
 *
 * Nhưng **"hồ sơ đang nằm ở bước nào" thì không khai** — nó suy ra từ chính
 * trạng thái của hồ sơ, tức là từ cùng một nguồn mà màn hình đang đọc. Nhờ vậy
 * mạch dẫn không thể lệch khỏi sự thật: muốn đổi quy trình thì phải đổi máy
 * trạng thái, mà đổi máy trạng thái là bài kiểm đỏ ngay.
 *
 * Hai luồng ở đây là **hai luồng tiền** — nơi sai một nhịp là mất tiền thật,
 * và cũng là nơi tài khoản giám đốc phải quyết nhiều nhất.
 */

/** Nơi làm một bước: một module trong cơ sở, hay một trang dùng chung. */
export type MachViecNoiLam =
  | { kieu: "module"; moduleId: ErpModuleId }
  | { kieu: "trang"; href: string };

export type MachViecBuoc = {
  id: string;
  /** Số người đọc thấy. Nhánh rẽ mang `null` vì nó không nằm trên đường thẳng. */
  thuTu: number | null;
  ten: string;
  /** Ai làm bước này. */
  vai: readonly ErpRole[];
  noiLam: MachViecNoiLam;
  /** Dữ liệu bước này nhận từ đâu — câu trả lời cho "số này ở đâu ra?". */
  nguonVao: string;
  /** Làm xong bước này thì cái gì ra đời. */
  ketQua: string;
  /**
   * Hồ sơ mang một trong các trạng thái này thì **đang chờ** bước này.
   *
   * Cố ý là "đang chờ" chứ không phải "đã làm xong": người mở màn hình cần
   * biết hồ sơ đang nằm trên bàn ai, không cần biết nó từng qua tay ai.
   */
  dangCho: readonly string[];
  /** Nhánh rẽ (trả lại, ngoại lệ) — có thật nhưng không phải đường chính. */
  nhanh?: true;
};

export type MachViec = {
  id: MachViecId;
  ten: string;
  /** Một câu nói trọn luồng này để làm gì. */
  motCau: string;
  buoc: readonly MachViecBuoc[];
};

export type MachViecId = "dong-ca" | "cong-no-doi-tac";

/**
 * Luồng 1 — đóng ca bán vé.
 *
 * Trạng thái lấy đúng từ `ShiftCloseStatus` (`domain/erp-shift-close.ts`).
 * `posted` tới từ bút toán bên kế toán chứ không từ chính hồ sơ ca, nên bước
 * cuối nói rõ điều đó thay vì để người đọc tưởng ca tự ghi sổ được.
 */
const DONG_CA: MachViec = {
  id: "dong-ca",
  ten: "Đóng ca bán vé",
  motCau:
    "Tiền thu trong một ca đi từ tay nhân viên tới sổ kế toán, qua đúng bốn người, và mỗi lượt chuyển tay đều để lại vết.",
  buoc: [
    {
      id: "dong-ca-1-nop",
      thuTu: 1,
      ten: "Nhân viên nộp sổ ca",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "ve-dat-cho" },
      nguonVao:
        "Vé đã bán trong ca — cả máy quét ở cổng lẫn quầy — cộng số tiền mặt đếm thật lúc giao ca.",
      ketQua:
        "Một hồ sơ ca mang bốn con số: tổng thu, hoàn, tiền mặt, thẻ. Chênh lệch do hệ thống tự tính, không ai gõ tay.",
      dangCho: ["manager-returned"],
    },
    {
      id: "dong-ca-2-quan-ly",
      thuTu: 2,
      ten: "Quản lý cơ sở duyệt",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "ve-dat-cho" },
      nguonVao: "Hồ sơ ca nhân viên vừa nộp, kèm chênh lệch đã tính sẵn.",
      ketQua:
        "Duyệt thì hồ sơ sang kế toán. Trả lại thì phải ghi lý do, và hồ sơ quay về đúng người nộp.",
      dangCho: ["submitted"],
    },
    {
      id: "dong-ca-3-ke-toan",
      thuTu: 3,
      ten: "Kế toán đối soát và lập bút toán",
      vai: ["accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao:
        "Hồ sơ ca quản lý đã duyệt, đặt cạnh vé bán ra và tiền nộp thực tế.",
      ketQua:
        "Một bút toán nháp chờ kế toán trưởng. Kế toán lập nhưng không tự duyệt được bút toán của mình.",
      dangCho: ["manager-approved", "director-approved", "director-rejected"],
    },
    {
      id: "dong-ca-4-ke-toan-truong",
      thuTu: 4,
      ten: "Kế toán trưởng duyệt và ghi sổ",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán kế toán vừa lập, kèm hồ sơ ca gốc để soi lại.",
      ketQua: "Ghi sổ xong thì ca khép lại. Trả lại thì bút toán quay về kế toán.",
      dangCho: ["accounting-review"],
    },
    {
      id: "dong-ca-5-xong",
      thuTu: 5,
      ten: "Đã ghi sổ",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán đã được kế toán trưởng duyệt.",
      ketQua: "Ca khép. Từ đây chỉ còn đường đảo bút toán, và đảo cũng để lại vết.",
      dangCho: ["posted"],
    },
    {
      id: "dong-ca-nhanh-giam-doc",
      thuTu: null,
      ten: "Giám đốc quyết ngoại lệ",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp" },
      nguonVao:
        "Chỉ những ca kế toán chuyển lên vì lệch quá 1.000 đ, kèm giải trình bắt buộc.",
      ketQua:
        "Quyết xong thì hồ sơ quay lại bàn kế toán để đi tiếp, dù chấp nhận hay bác.",
      dangCho: ["exception-pending-director"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 2 — công nợ đối tác.
 *
 * Trạng thái lấy đúng từ `SupplierApStatus` (`domain/erp-supplier-ap.ts`);
 * hai bước cuối theo đúng migration `202608020030`.
 */
const CONG_NO_DOI_TAC: MachViec = {
  id: "cong-no-doi-tac",
  ten: "Công nợ đối tác",
  motCau:
    "Một hoá đơn nhà cung cấp chỉ được trả tiền sau khi khớp đủ ba chiều: đặt hàng, nghiệm thu, hoá đơn.",
  buoc: [
    {
      id: "ap-1-ho-so-nguon",
      thuTu: 1,
      ten: "Bổ sung hồ sơ nguồn",
      vai: ["manager", "accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao:
        "Đơn đặt hàng, biên bản nghiệm thu và hoá đơn nhà cung cấp — ba thứ do ba lúc khác nhau sinh ra.",
      ketQua:
        "Hệ thống tự đối ba chiều. Còn lệch thì nêu đích danh lệch chỗ nào, không nói chung chung là 'sai'.",
      dangCho: ["match-exception", "accounting-returned"],
    },
    {
      id: "ap-2-ke-toan",
      thuTu: 2,
      ten: "Kế toán kiểm và lập bút toán",
      vai: ["accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Hồ sơ đã khớp ba chiều, kèm mã số thuế và ngày hoá đơn đã kiểm.",
      ketQua: "Bút toán chi phí, thuế đầu vào và phải trả, chờ người khác duyệt.",
      dangCho: ["ready-for-accounting"],
    },
    {
      id: "ap-3-ke-toan-truong",
      thuTu: 3,
      ten: "Kế toán trưởng duyệt và ghi sổ",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán kế toán vừa lập, kèm ba chứng từ gốc.",
      ketQua: "Ghi sổ thì khoản nợ được công nhận. Trả lại thì hồ sơ về bàn kế toán.",
      dangCho: ["accounting-review"],
    },
    {
      id: "ap-4-ghi-nhan",
      thuTu: 4,
      ten: "Đã ghi nhận công nợ",
      vai: ["accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Khoản nợ đã vào sổ, chờ tới hạn hoặc chờ có tiền.",
      ketQua: "Kế toán lập đề nghị chi khi tới lúc trả.",
      dangCho: ["posted"],
    },
    {
      id: "ap-5-duyet-chi",
      thuTu: 5,
      ten: "Kế toán trưởng duyệt chi",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Đề nghị chi, kèm khoản nợ đã ghi sổ và hình thức trả.",
      ketQua: "Duyệt thì ghi nhận đã trả. Trả lại thì khoản nợ về trạng thái chờ chi.",
      dangCho: ["payment-requested"],
    },
    {
      id: "ap-6-xong",
      thuTu: 6,
      ten: "Đã thanh toán",
      vai: [],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Lượt duyệt chi của kế toán trưởng.",
      ketQua: "Hết nợ với đối tác này ở hoá đơn này.",
      dangCho: ["paid"],
    },
    {
      id: "ap-nhanh-giam-doc",
      thuTu: null,
      ten: "Giám đốc quyết ngoại lệ",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp" },
      nguonVao: "Hồ sơ lệch mà kế toán không tự quyết được, kèm giải trình.",
      ketQua: "Quyết xong thì hồ sơ quay về đường chính để đi tiếp.",
      dangCho: ["director-exception"],
      nhanh: true,
    },
  ],
};

export const MACH_VIEC: readonly MachViec[] = [DONG_CA, CONG_NO_DOI_TAC];

export function machViecTheoId(id: string): MachViec | null {
  return MACH_VIEC.find((mach) => mach.id === id) ?? null;
}

/** Những luồng có ít nhất một bước làm tại module này. */
export function machViecCuaModule(moduleId: string): MachViec[] {
  return MACH_VIEC.filter((mach) =>
    mach.buoc.some((b) => b.noiLam.kieu === "module" && b.noiLam.moduleId === moduleId),
  );
}

/** Những luồng có ít nhất một bước làm tại trang dùng chung này. */
export function machViecCuaTrang(href: string): MachViec[] {
  return MACH_VIEC.filter((mach) =>
    mach.buoc.some((b) => b.noiLam.kieu === "trang" && b.noiLam.href === href),
  );
}

/** Các bước trên đường chính, đã xếp theo thứ tự. */
export function buocChinh(mach: MachViec): MachViecBuoc[] {
  return mach.buoc
    .filter((b) => b.thuTu !== null)
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0));
}

export function buocNhanh(mach: MachViec): MachViecBuoc[] {
  return mach.buoc.filter((b) => b.thuTu === null);
}

/** Hồ sơ mang trạng thái này thì đang chờ bước nào. */
export function buocDangCho(mach: MachViec, status: string): MachViecBuoc | null {
  return mach.buoc.find((b) => b.dangCho.includes(status)) ?? null;
}

/**
 * Bước kế tiếp trên đường chính.
 *
 * Từ một nhánh rẽ thì không đoán bừa: nhánh trả về `null` và câu chữ ngoài
 * màn hình nói rõ "quay lại đường chính", vì đường về của mỗi nhánh mỗi khác.
 */
export function buocKeTiep(mach: MachViec, buoc: MachViecBuoc): MachViecBuoc | null {
  if (buoc.thuTu === null) return null;
  return buocChinh(mach).find((b) => (b.thuTu ?? 0) > (buoc.thuTu ?? 0)) ?? null;
}

/** Đường dẫn tới nơi làm một bước, trong ngữ cảnh một cơ sở. */
export function hrefCuaBuoc(buoc: MachViecBuoc, siteId: ErpSiteId): string {
  return buoc.noiLam.kieu === "trang"
    ? buoc.noiLam.href
    : `/erp/${siteId}/${buoc.noiLam.moduleId}`;
}

/**
 * Đếm hồ sơ đang nằm ở từng bước.
 *
 * Nhận thẳng danh sách trạng thái chứ không nhận hồ sơ, để tầng thuần này
 * không cần biết hồ sơ đóng ca và hoá đơn đối tác có hình dạng khác nhau.
 */
export function demTheoBuoc(
  mach: MachViec,
  trangThai: readonly string[],
): Map<string, number> {
  const dem = new Map<string, number>();
  for (const buoc of mach.buoc) dem.set(buoc.id, 0);
  for (const tt of trangThai) {
    const buoc = buocDangCho(mach, tt);
    if (buoc) dem.set(buoc.id, (dem.get(buoc.id) ?? 0) + 1);
  }
  return dem;
}

/** "Kế toán trưởng" / "Quản lý cơ sở hoặc Kế toán" / "Không ai — đã xong". */
export function dangChoAi(
  buoc: MachViecBuoc,
  nhanVai: (role: ErpRole) => string,
): string {
  if (buoc.vai.length === 0) return "Không ai — bước này đã khép";
  return buoc.vai.map(nhanVai).join(" hoặc ");
}

/** Vai này có phải người phải ra tay ở bước ấy không. */
export function denLuotVai(buoc: MachViecBuoc, role: ErpRole): boolean {
  return buoc.vai.includes(role);
}
