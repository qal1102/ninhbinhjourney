import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202609070065_customer_sealed_identity_documents.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

// Bẫy đã trả giá ở lượt trước: đầu tệp (và nhiều chỗ khác) là chú thích văn
// xuôi giải thích quyết định thiết kế — chính văn xuôi đó có thể vô tình lặp
// lại đúng những từ khoá mà bài kiểm dùng để khẳng định "không có X" (ví dụ
// chú thích nhắc tới "grant select" khi so sánh với migration khác). Nếu so
// khớp phủ định trên toàn bộ `compact` thì một câu chú thích vô hại cũng có
// thể làm bài kiểm đỏ giả, và ngược lại một mutation xoá dòng luật thật vẫn
// có thể xanh giả nếu chú thích còn giữ đúng chuỗi đó. Vì vậy MỌI khẳng định
// phủ định (not.toContain/not.toMatch) và MỌI phép đếm số lần xuất hiện dưới
// đây đều chạy trên `compactCode` — bản đã cắt hết các dòng chú thích `--`.
const sqlNoComments = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const compactCode = sqlNoComments.replace(/\s+/g, " ").trim();

// Tương tự, thân hàm xoá phải được cắt riêng SAU "as $$" rồi mới so khớp —
// nếu so trên toàn văn bản thì một chú thích nhắc lại "security definer"
// hay "get diagnostics" ở đầu tệp cũng đủ làm bài kiểm xanh giả dù thân hàm
// thật đã bị mutate mất dòng đó.
const purgeFunctionMatch = sqlNoComments.match(
  /create or replace function public\.customer_purge_expired_identity_documents\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
);
const purgeFunctionBody = purgeFunctionMatch?.[1]?.replace(/\s+/g, " ").trim();

describe("TC-17 migration 065 — kho giấy tờ tuỳ thân đã niêm, khoá cửa lại", () => {
  it("chạy trọn một giao dịch", () => {
    expect(compact.startsWith("-- TC-17")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(sql.split("\nbegin;\n").length).toBe(2);
  });

  it("không khẳng định một sự thật pháp lý nào — chỉ nói phải hỏi luật sư", () => {
    expect(compact.toLowerCase()).toContain("phải hỏi luật sư");
    expect(compact.toLowerCase()).not.toMatch(/theo quy định pháp luật việt nam/);
  });

  it("dựng một kho riêng, không đứng chung bảng với hành trình", () => {
    expect(compactCode).toContain(
      "create table if not exists public.customer_sealed_identity_documents (",
    );
    // Bảng này là bảng duy nhất được tạo trong migration — không kèm thêm
    // bất kỳ bảng hành trình/gợi ý/phân khúc nào khác.
    expect(compactCode.match(/create table if not exists/g)?.length).toBe(1);
  });

  it("tham chiếu tới customer_profiles bằng khoá tổ hợp (tenant_id, profile_id)", () => {
    expect(compactCode).toContain(
      "foreign key (profile_id, tenant_id) references public.customer_profiles(id, tenant_id) on delete restrict",
    );
    // Không tham chiếu tới customer_identities — quyết định đã giải thích
    // trong chú thích migration, nhưng luật thật phải nằm ở mã, không phải
    // ở lời giải thích.
    expect(compactCode).not.toContain("references public.customer_identities");
  });

  it("bắt buộc lý do thu, là một liệt kê có ràng buộc chứ không phải text tự do", () => {
    const reasons = [
      "authority_request",
      "incident_investigation",
      "partner_contract_requirement",
      "residence_notification_pending_legal_review",
      "other_approved_by_director",
    ];
    const reasonClauseMatch = sqlNoComments.match(
      /collection_reason text not null check \(\s*collection_reason in \(([\s\S]*?)\)\s*\)/,
    );
    expect(reasonClauseMatch).not.toBeNull();
    const reasonClause = reasonClauseMatch![1];
    for (const reason of reasons) {
      expect(reasonClause).toContain(`'${reason}'`);
    }
    // Đúng năm lý do, không hơn không kém — thêm một lý do phải là quyết
    // định có chủ đích, không phải lặng lẽ trôi vào.
    expect(reasonClause.match(/'[a-z_]+'/g)?.length).toBe(reasons.length);
  });

  it("mang cột bản mã và phiên bản khoá theo đúng khuôn customer_identities", () => {
    const tableMatch = sqlNoComments.match(
      /create table if not exists public\.customer_sealed_identity_documents \(([\s\S]*?)\n\);/,
    );
    expect(tableMatch).not.toBeNull();
    const tableBody = tableMatch![1].replace(/\s+/g, " ").trim();
    expect(tableBody).toContain("document_ciphertext text not null");
    expect(tableBody).toContain(
      "check ( char_length(document_ciphertext) between 24 and 8192 )",
    );
    expect(tableBody).toContain("encryption_key_version text not null");
    expect(tableBody).toContain(
      "check ( char_length(trim(encryption_key_version)) between 1 and 40 )",
    );
    // Không lưu trực tiếp bất kỳ trường danh tính trần nào — chỉ bản mã.
    expect(tableBody).not.toMatch(/\b(full_name|id_number|document_number|passport_number)\s+text\b/);
  });

  it("mỗi hàng mang sẵn hạn xoá bắt buộc, không phải một chính sách nằm ngoài dữ liệu", () => {
    expect(compactCode).toContain("expires_at timestamptz not null,");
    expect(compactCode).toContain("check (expires_at > collected_at)");
    // Không có cột nullable nào đóng vai hạn xoá "tuỳ chọn".
    expect(compactCode).not.toContain("expires_at timestamptz,");
  });

  it("bật row level security và khoá cửa hoàn toàn — không vai nào được cấp quyền trên bảng", () => {
    expect(compactCode).toContain(
      "alter table public.customer_sealed_identity_documents enable row level security;",
    );
    expect(compactCode).toContain(
      "revoke all on table public.customer_sealed_identity_documents from public, anon, authenticated, service_role;",
    );
    // Không có câu grant nào nhắm vào chính bảng này.
    expect(compactCode).not.toMatch(
      /grant [^;]*on table public\.customer_sealed_identity_documents/,
    );
  });

  it("không cấp quyền cho anon hoặc authenticated ở bất kỳ đâu trong migration", () => {
    expect(compactCode).not.toMatch(/grant [^;]*\banon\b/);
    expect(compactCode).not.toMatch(/grant [^;]*\bauthenticated\b/);
  });

  it("hàm xoá hồ sơ hết hạn tồn tại, trả về integer và chỉ service_role được gọi", () => {
    expect(compactCode).toContain(
      "create or replace function public.customer_purge_expired_identity_documents() returns integer",
    );
    expect(compactCode).toContain(
      "revoke all on function public.customer_purge_expired_identity_documents() from public, anon, authenticated, service_role;",
    );
    expect(compactCode).toContain(
      "grant execute on function public.customer_purge_expired_identity_documents() to service_role;",
    );
  });

  it("thân hàm xoá thật sự chạy security definer, search_path rỗng và xoá đúng hàng hết hạn", () => {
    expect(purgeFunctionBody).toBeDefined();
    // Các thuộc tính an toàn phải nằm TRƯỚC "as $$" theo cú pháp SQL — kiểm
    // riêng trên phần đầu định nghĩa hàm (không phải trong thân), lấy từ
    // bản đã cắt chú thích để không lẫn với văn xuôi giải thích.
    const functionHeaderMatch = sqlNoComments.match(
      /create or replace function public\.customer_purge_expired_identity_documents\(\)([\s\S]*?)as \$\$/,
    );
    expect(functionHeaderMatch).not.toBeNull();
    const functionHeader = functionHeaderMatch![1].replace(/\s+/g, " ").trim();
    expect(functionHeader).toContain("security definer");
    expect(functionHeader).toContain("set search_path = ''");

    // Thân hàm phải thật sự xoá và thật sự đếm số hàng đã xoá.
    expect(purgeFunctionBody).toContain(
      "delete from public.customer_sealed_identity_documents where expires_at <= now();",
    );
    expect(purgeFunctionBody).toContain("get diagnostics v_deleted_count = row_count;");
    expect(purgeFunctionBody).toContain("return v_deleted_count;");
  });

  it("chỉ tiến tới — không update hay xoá dữ liệu ở bảng đã có từ trước", () => {
    expect(compactCode).not.toContain("update public.");
    expect(compactCode).not.toContain("alter table public.customer_profiles");
    expect(compactCode).not.toContain("alter table public.customer_identities");
    // Câu delete duy nhất được phép là câu bên trong hàm xoá hồ sơ hết hạn,
    // nhắm đúng bảng mới, không nhắm vào bảng nào khác.
    const deleteStatements = compactCode.match(/delete from public\.\w+/g) ?? [];
    expect(deleteStatements).toEqual([
      "delete from public.customer_sealed_identity_documents",
    ]);
  });
});
