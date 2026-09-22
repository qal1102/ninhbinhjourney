import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { soDoiTacFrom, type DoiTacNhanHang } from "@/domain/doi-tac-nhan-hang";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Sổ liên hệ nhãn hàng đối tác — lối vào kho.
 *
 * ## Vì sao đọc thì nuốt lỗi, ghi thì không
 *
 * **Đọc** hỏng chỉ nên làm mất một khối trên màn hình Marketing; kéo sập cả
 * màn hình vì một khối phụ là cái giá đắt hơn nhiều lần — đúng bài học ngày
 * 13/09, khi một nhịp đọc chấm công hỏng làm sập nguyên màn soát vé.
 *
 * **Ghi** hỏng thì phải nói thẳng. Người dùng vừa gõ xong mười ô thông tin mà
 * màn hình lặng lẽ về như cũ là thứ tệ nhất: họ tưởng đã lưu, và lần sau mở
 * ra mới biết là chưa.
 */

export class SoDoiTacError extends Error {
  constructor(
    message: string,
    readonly ma:
      | "CHUA_CAU_HINH"
      | "THIEU_TEN"
      | "TEN_QUA_DAI"
      | "GIAI_DOAN_SAI"
      | "KHONG_TIM_THAY"
      | "GHI_KHONG_THANH",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SoDoiTacError";
  }
}

function taoClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-so-doi-tac" } },
  });
}

function loiTuKho(error: unknown): SoDoiTacError {
  const loi =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (loi.includes("DOI_TAC_TEN_QUA_DAI")) {
    return new SoDoiTacError("Tên nhãn hàng dài quá, xin rút gọn lại.", "TEN_QUA_DAI");
  }
  if (loi.includes("DOI_TAC_GIAI_DOAN_INVALID")) {
    return new SoDoiTacError("Giai đoạn không hợp lệ.", "GIAI_DOAN_SAI");
  }
  if (loi.includes("DOI_TAC_NOT_FOUND")) {
    return new SoDoiTacError("Dòng này không còn trong sổ nữa.", "KHONG_TIM_THAY");
  }
  if (loi.includes("DOI_TAC_INPUT_INVALID")) {
    return new SoDoiTacError("Xin điền tên nhãn hàng trước đã.", "THIEU_TEN");
  }
  return new SoDoiTacError("Chưa lưu được vào sổ. Xin thử lại.", "GHI_KHONG_THANH", {
    cause: error,
  });
}

/** Sổ có dùng được ở môi trường này không. */
export function soDoiTacSanSang() {
  return taoClient() !== null;
}

export async function docSoDoiTac(): Promise<DoiTacNhanHang[] | null> {
  const client = taoClient();
  if (!client) return null;
  const { data, error } = await client.rpc("erp_doc_so_doi_tac", {
    p_tenant_id: TENANT_ID,
  });
  if (error) {
    console.error("Đọc sổ đối tác không thành", error);
    return null;
  }
  return soDoiTacFrom(data);
}

export type GhiDoiTacInput = {
  id?: string | null;
  ten: string;
  nganhHang?: string;
  nguoiBenHo?: string;
  cachLienHe?: string;
  nguoiPhuTrach?: string;
  giaiDoan?: string;
  dipNhamToi?: string;
  ghiChu?: string;
  /**
   * Có tính lần này là một lần trao đổi thật không.
   *
   * Tách riêng khỏi phần sửa nội dung: sửa một lỗi chính tả trong tên không
   * được làm mối ấy trông như vừa được chăm sóc hôm nay.
   */
  ghiTraoDoi?: boolean;
};

export async function ghiDoiTac(input: GhiDoiTacInput): Promise<DoiTacNhanHang[]> {
  const client = taoClient();
  if (!client) {
    throw new SoDoiTacError(
      "Sổ đối tác chưa đọc được ở môi trường này.",
      "CHUA_CAU_HINH",
    );
  }
  if (!input.ten.trim()) {
    throw new SoDoiTacError("Xin điền tên nhãn hàng trước đã.", "THIEU_TEN");
  }
  const { data, error } = await client.rpc("erp_ghi_doi_tac", {
    p_tenant_id: TENANT_ID,
    p_id: input.id?.trim() ? input.id.trim() : null,
    p_ten: input.ten,
    p_nganh_hang: input.nganhHang ?? "",
    p_nguoi_ben_ho: input.nguoiBenHo ?? "",
    p_cach_lien_he: input.cachLienHe ?? "",
    p_nguoi_phu_trach: input.nguoiPhuTrach ?? "",
    p_giai_doan: input.giaiDoan ?? "nham-truoc",
    p_dip_nham_toi: input.dipNhamToi ?? "",
    p_ghi_chu: input.ghiChu ?? "",
    p_ghi_trao_doi: input.ghiTraoDoi ?? false,
  });
  if (error) throw loiTuKho(error);
  return soDoiTacFrom(data);
}

export async function goDoiTac(id: string): Promise<DoiTacNhanHang[]> {
  const client = taoClient();
  if (!client) {
    throw new SoDoiTacError(
      "Sổ đối tác chưa đọc được ở môi trường này.",
      "CHUA_CAU_HINH",
    );
  }
  const { data, error } = await client.rpc("erp_go_doi_tac", {
    p_tenant_id: TENANT_ID,
    p_id: id,
  });
  if (error) throw loiTuKho(error);
  return soDoiTacFrom(data);
}
