---
name: erp-vietnam
description: Business/compliance guardrails for building or changing the internal ERP's Vietnamese-enterprise accounting, invoicing, payroll and approval logic (domain/erp*.ts, docs/reference/ERP_ACCOUNTING_REQUIREMENTS_VI.md). Use when touching accounting cases, journal entries, maker-checker approvals, supplier AP, e-invoice status, payroll/timekeeping, or period-close in this repo's ERP.
---

# ERP Vietnam — Business & Compliance Guardrails

No off-the-shelf Claude skill for Vietnamese-enterprise ERP exists publicly (checked GitHub 05/08/2026 — generic business/finance skill packs are US-centric: IRS deductions, sales-tax-nexus, no VAS/TT99/NĐ123 content). This skill is authored in-repo instead, and its authority is `docs/reference/ERP_ACCOUNTING_REQUIREMENTS_VI.md` — **read that file in full before implementing any accounting/finance ERP feature.** This SKILL.md is a quick-reference index over it, not a replacement.

## Legal basis (verified in-repo as of 28/07/2026 — reconfirm currency before relying on a threshold or effective date)

- **Thông tư 99/2025/TT-BTC** — doanty kế toán, hiệu lực 01/01/2026, thay Thông tư 200.
- **Luật Kế toán 88/2015/QH13** + **Luật 56/2024/QH15** sửa đổi — chứng từ bắt buộc nội dung, dữ liệu điện tử toàn vẹn/tra cứu được, sửa đổi phải để lại dấu vết.
- **Nghị định 174/2016/NĐ-CP** — lưu trữ hồ sơ kế toán theo thời hạn luật định; client-side state is never "lưu trữ".
- **Nghị định 123/2020/NĐ-CP**, **NĐ 70/2025/NĐ-CP**, **TT 32/2025/TT-BTC** — hóa đơn điện tử: trạng thái, truyền lỗi, điều chỉnh/thay thế.
- **Nghị định 320/2025/NĐ-CP** (thuế TNDN) — chi phí được trừ cần đủ hóa đơn/chứng từ + thanh toán không dùng tiền mặt khi áp dụng.
- **Bộ luật Lao động 45/2019/QH14** + **Luật BHXH 41/2024/QH15** — bảng lương phải nối hợp đồng, ca công, làm thêm, phụ cấp, khấu trừ, BHXH.

Do not hardcode a rate, threshold, or "hiệu lực từ" date as a permanent constant — these are policy-versioned per the source doc's own instruction (§2, "Ngưỡng và hiệu lực phải được cấu hình theo phiên bản chính sách, không đóng cứng vĩnh viễn trong mã nguồn").

## The standard flow (never collapse it)

`Nhân viên phát sinh → Quản lý xác nhận → Kế toán kiểm tra/lập → Người kiểm tra duyệt → Thanh toán/ghi sổ → Đối soát → Khóa kỳ`

Director only sees escalated exceptions (vượt ngưỡng, chênh lệch không xử lý được, thiếu tiền, rủi ro thuế), never routine casework.

## Role boundaries (maker–checker — do not merge these in code or UI)

| Role | Does | Must not do |
|---|---|---|
| Nhân viên hiện trường/quầy vé | Check-in, bán vé, ghi thu, chấm công, nộp chứng từ nguồn | Sửa số đã được quản lý xác nhận; lập/duyệt bút toán |
| Quản lý cơ sở | Xác nhận chốt ca, nghiệm thu, duyệt bảng công, trả hồ sơ thiếu | Tự ghi sổ; duyệt khoản chính mình lập |
| Kế toán tổng hợp | Nhận hồ sơ 4 cơ sở, đối soát, gắn tài khoản/chiều quản trị, lập bút toán | Điều phối camera/sức chứa/nhân sự; tự duyệt bút toán mình lập |
| Kế toán trưởng/checker | Kiểm tra độc lập bút toán, chính sách thuế, kỳ hạch toán | Thay chứng từ nguồn mà không trả việc + ghi lý do |
| Giám đốc | Duyệt ngoại lệ đã chuyển cấp | Xử lý chứng từ thường; xem "việc đến hạn" của nhân viên |
| Kiểm soát/kiểm toán | Đọc lịch sử, truy vết báo cáo→bút toán→chứng từ | Xóa/sửa giao dịch nguồn |

Demo account `ketoan / Ketoan@2026` = kế toán tổng hợp. Kế toán trưởng/checker has no demo account yet — don't assume one exists in tests.

## Minimum record shape (any new accounting-case type needs all of this)

Mã duy nhất · loại nghiệp vụ · pháp nhân/cơ sở/bộ phận/dự án · ngày phát sinh/chứng từ/kỳ/hạn/trạng thái · người tạo/xác nhận/lập/kiểm tra/duyệt ngoại lệ · giá trị trước thuế/thuế/tổng/tiền tệ/phương thức · chứng từ nguồn + thiếu gì · định khoản Nợ/Có cân bằng · timeline bất biến (ai, khi nào, từ trạng thái nào sang trạng thái nào, lý do, bằng chứng) · liên kết ngược tới nguồn phát sinh (ca vé, QR, báo cáo hiện trường, bảng công, hợp đồng, nghiệm thu, tài sản, dự án).

## Where this lives in code

- `domain/erp-accounting.ts` — journal entries, draft→pending-checker→posted, debit/credit balance validation ("Bút toán chưa cân: Nợ ... Có ...").
- `domain/erp-supplier-ap.ts` — supplier AP, `vatVnd` field (net + VAT = total).
- `domain/erp-role-policy.ts`, `domain/erp-account-roles.ts` — role/permission wiring; extend here, not ad hoc in components.
- `domain/erp.ts` — module registry (`ERP_MODULES`), `status: "live" | "planned"` — never let a `planned` module render invented data (see the T3 comment in that file: a client asking "who is Nguyễn Văn Hải?" about a fabricated row destroys trust in every real module).

## What's honestly NOT implemented yet — never claim otherwise

- Accounting-action state is client-side only, not persisted.
- No kế toán trưởng account, no e-signature/approval trail.
- No real POS, bank, e-invoice, payroll-software, or general-ledger integration.
- No Supabase accounting migration run in production; no compliance document store.
- No VAT-rate table, no TT99 chart-of-accounts enforcement, no NĐ123 e-invoice integration, no payroll/BHXH calculation — `vatVnd` is a validated field, not a compliance engine.

If a task description or a stakeholder asks you to say a module is "live"/"production-ready", check `domain/erp.ts`'s `status` field and this list first — per root `AGENTS.md`, never describe demo/client state as persistent or realtime unless production integration is verified.

## Build order (from the source doc's own priority list — follow unless told otherwise)

1. Immutable schema: `source_events`, `accounting_cases`, `documents`, `journal_entries`, `journal_lines`, `approvals`, `payments`, `reconciliations`, `period_locks`, `audit_events`.
2. RLS by pháp nhân/cơ sở/vai trò; separate lập–kiểm tra–duyệt; block direct edits to confirmed source events.
3. Storage with versioning, checksum, metadata, retention policy, access log.
4. One real golden path first: chốt ca vé → quản lý xác nhận → kế toán đối soát → checker duyệt → ghi sổ.
5. Only then wire NCC/AP, payroll, assets, e-invoice, period-close.

## After any change here

Update `docs/HANDOFF.md`'s state/defect/work-queue sections per root `AGENTS.md` — this skill doesn't replace that requirement. If a legal citation in this file or in `ERP_ACCOUNTING_REQUIREMENTS_VI.md` looks stale, flag it rather than silently trusting either document — Vietnamese accounting/tax rules changed materially in 2025–2026 (TT99 replacing TT200, NĐ320 replacing prior CIT rules).
