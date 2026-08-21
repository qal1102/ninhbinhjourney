# BỘ PROMPT THEO PHASE — DÁN THẲNG SANG MODEL THỰC THI

## ⏭️ VIỆC TIẾP THEO: **P0** — redeploy để mật khẩu giám đốc mới có hiệu lực

**Dùng:** `gpt-5.6-luna` / medium hoặc `claude-haiku-4-5` — việc cơ học, không có gì phải cân nhắc.
**Sau P0 thì tới:** P1 (vá 2 lỗi phễu) → P4 nhóm A (kiểm bảo mật lớp khách) → P4 nhóm B → P2 → P3 → P5.

> Cập nhật dòng này mỗi khi xong một phase. Ai mở file cũng phải biết ngay phải làm gì mà không cần đọc hết.
> Bản theo dõi cho người ở `docs/THEO_DOI_DU_AN.md`.

---

> **Cách dùng:** mở phase cần làm, xem dòng *Model*, đổi model trong phiên rồi dán nguyên khối `PROMPT` vào.
> Mỗi prompt tự đứng được — model nhận việc **không cần quét lại dự án**, mọi dữ kiện cần thiết đã nằm trong prompt.
> Làm xong một phase mới sang phase kế. Không nhảy cóc, không gộp.
>
> Soạn ngày 21/08/2026 sau phiên review. Sự thật nền ở mục 1 đã được kiểm bằng lệnh thật, **không kiểm lại**.

---

## 0. Bảng model

**Codex** — thang effort: `low · medium · high · xhigh · max · ultra`

| Tên trong repo | Slug thật | Dùng cho |
|---|---|---|
| Sol | `gpt-5.6-sol` | Việc sai là mất/lộ dữ liệu |
| Terra | `gpt-5.6-terra` | Việc thấy sai ngay, sửa rẻ |
| Luna | `gpt-5.6-luna` | Việc cơ học, contract đã khóa |

**Claude** — thang effort: `low · medium · high · xhigh · max`

| Model | ID | Context | $/1M vào | $/1M ra |
|---|---|---|---|---|
| Opus 5 | `claude-opus-5` | 1M | $5 | $25 |
| Sonnet 5 | `claude-sonnet-5` | 1M | $3 (**$2 tới 31/08/2026**) | $15 (**$10**) |
| Haiku 4.5 | `claude-haiku-4-5` | **200K** | $1 | $5 |

### Chọn theo rủi ro

| Loại việc | Sai thì mất gì | Codex | Claude |
|---|---|---|---|
| Migration, RLS, quyền, khóa mã hóa | Mất/lộ dữ liệu, không rollback được | `gpt-5.6-sol` / high | `claude-opus-5` / xhigh |
| Đồng thời, giao dịch, tiền, vé | Bán vượt, mất vé, sai tiền | `gpt-5.6-sol` / high | `claude-opus-5` / xhigh |
| Cổng phát hành, secret, activation | Bật nhầm thứ chưa duyệt | `gpt-5.6-sol` / high | `claude-opus-5` / xhigh |
| Kiểm chứng / audit đối kháng | Bỏ sót lỗi thật | `gpt-5.6-sol` / xhigh | `claude-opus-5` / xhigh |
| UI, màn hình đọc, instrumentation | Thấy ngay, sửa rẻ | `gpt-5.6-terra` / high | `claude-sonnet-5` / high |
| Viết docs theo spec đã khóa | Spec đã chốt | `gpt-5.6-terra` / medium | `claude-sonnet-5` / medium |
| Đổi tên, fixture, test lặp, copy | Contract đã khóa | `gpt-5.6-luna` / medium | `claude-haiku-4-5` |

**Không bao giờ giao tầng thấp:** migration, RLS, hợp nhất định danh, consent, đồng thời, đối soát offline, cổng phát hành.

**Mẹo tiền:** Sonnet 5 giảm giá tới 31/08/2026 — việc tầng giữa trong tháng này rẻ hơn Opus ~60%.

---

## 1. Sự thật nền — mọi prompt bên dưới đều dựa vào đây

Đo ngày 21/08/2026 bằng lệnh thật:

| Điều | Tài liệu cũ nói | **Thực tế** |
|---|---|---|
| Migration 039→048 | chưa apply | **đã apply hết lên Supabase production** |
| `experienceMode` | `client-demo` | **`production`** |
| Cờ thu dữ liệu khách | toàn bộ tắt | **đang bật** |
| Cửa same-origin của `/api/customer-events` | chỉ nhận first-party | **giả header `Origin` là lọt** |
| Verdict cổng A6 | BLOCKED | đã kích hoạt thật trưa 21/08 |
| Bộ test cục bộ | — | typecheck + lint sạch, **96 file / 607 test pass + 1 skip** |
| Repo `qal1102/ninhbinhjourney` | — | **public** (chủ dự án đã biết và chấp nhận) |

**Đã xử lý:** 6 mật khẩu ERP bị lộ đã xoay, deployment `1lmt6eez3` đã Ready nên mật khẩu cũ đã chết. `ERP_DEMO_DIRECTOR_PASSWORD` đã đặt `Ninhbinh@2026` nhưng **chưa redeploy nên chưa hiệu lực** → xem P0.

---

## P0 — Chặn ngay

**Model:** `gpt-5.6-luna` / medium — hoặc `claude-haiku-4-5`
**Vì sao con rẻ nhất:** không có quyết định nào phải cân nhắc. Ba lệnh đã viết sẵn, kết quả đúng/sai thấy ngay ở màn đăng nhập. Giao model mạnh là phí tiền.

```
Việc: kích hoạt mật khẩu giám đốc mới trên production.

Bối cảnh: biến ERP_DEMO_DIRECTOR_PASSWORD trên Vercel production đã được đặt
thành Ninhbinh@2026, nhưng Vercel gắn biến môi trường lúc tạo deployment nên
giá trị mới chưa có hiệu lực.

Làm đúng ba bước, không làm gì thêm:
1. cd "D:/Ninh Binh/codex-cus00-app-sync" && npx vercel redeploy <url production moi nhat>
   (lấy url bằng: npx vercel ls --prod)
2. Đợi trạng thái Ready.
3. Xác minh: mở https://ninhbinhjourney.vercel.app/erp/login, đăng nhập
   giamdoc / Ninhbinh@2026, xác nhận vào được /erp, rồi ĐĂNG XUẤT NGAY.
   Không bấm vào bất kỳ nút ghi dữ liệu nào.

Xong thì ghi một dòng vào docs/NHAT_KY.md mục ngày hôm nay. Không sửa gì khác.
```

---

## P1 — Vá hai lỗi ERP đã xác nhận

**Model:** `gpt-5.6-sol` / high — hoặc `claude-opus-5` / xhigh
**Vì sao con mạnh:** phải giữ cho tầng đọc khớp đúng luật đã khóa trong migration đã chạy production, mà **không được sửa migration**. Sai một chút là hai màn hình lại lệch nhau tiếp — đúng lỗi đang phải vá. Model yếu dễ chọn đường tắt là sửa luôn migration, hoặc sửa một chỗ quên chỗ kia.

```
Việc: vá hai lỗi đã được xác nhận trong bảng điều hành phễu ERP.
Repo: D:/Ninh Binh/codex-cus00-app-sync

LỖI 1 — bảng phễu và bộ đặt chỗ bất đồng về cùng một chỗ ngồi.
Migration 202608200043 đặt hết hạn hold theo kiểu LƯỜI: status chỉ đổi sang
'expired' khi chính hold đó bị chạm lại (dòng 323-329), không có cron quét.
Vì vậy RPC tính sức chứa dùng CẢ HAI điều kiện (dòng 468):
    or (hold.status = 'active' and hold.expires_at > now())
Nhưng lib/customer-data/funnel-repository.ts dòng 119 chỉ xét status:
    hold.status === "active" || hold.status === "converted"
Hậu quả: hold đã hết hạn nhưng chưa ai chạm lại thì bộ đặt chỗ coi là trống,
còn màn hình ERP báo "đang giữ chỗ". Hai nguồn sự thật về cùng một khung giờ.

LỖI 2 — tỉ lệ chuyển đổi trên phễu là số vô nghĩa.
Trong cùng hàm đó: customer_payment_attempts (dòng 62) CÓ lọc thời gian
.gte(start).lt(end), nhưng customer_booking_holds (dòng 61) và
customer_orders (dòng 63) KHÔNG lọc — lấy 5000 dòng mới nhất mọi thời.
Tử số theo kỳ, mẫu số toàn thời gian.

Yêu cầu:
- Sửa dòng 119 để hold chỉ được tính là đang giữ chỗ khi status='active' VÀ
  expires_at > now(), khớp đúng luật ở migration dòng 468. Trạng thái
  'converted' giữ nguyên cách tính hiện tại.
- Thêm bộ lọc thời gian cho holds và orders cho khớp cửa sổ báo cáo.
- Rà nốt các truy vấn còn lại trong hàm: cái nào thiếu lọc thời gian mà đáng
  ra phải có thì sửa; cái nào là bảng danh mục (campaigns, sources) thì giữ.
- MAX_ROWS = 5000 đang cắt âm thầm. Nếu chạm trần thì màn hình phải nói rõ
  "số liệu bị cắt", không được hiển thị như thể đủ.

Ràng buộc:
- KHÔNG sửa migration đã apply production. Chỉ sửa tầng đọc.
- Thêm bài test chứng minh: một hold status='active' nhưng expires_at trong
  quá khứ KHÔNG được đếm là đang giữ chỗ.
- Chạy đủ: npm run typecheck && npm run lint && npm run test:run
- Cập nhật docs/NHAT_KY.md một dòng.
```

---

## P2 — Vá sự thật trong tài liệu

**Model:** `gpt-5.6-terra` / high — hoặc `claude-sonnet-5` / high
**Vì sao con giữa:** chỉ sửa chữ, không chạm code, và sự thật cần chép đã liệt kê sẵn trong prompt. Nhưng vẫn cần *high* vì phải lần ra hết những câu đã sai nằm rải trong hai file lớn — việc này là đọc hiểu, không phải tìm-thay.

```
Việc: tài liệu đang mô tả sai trạng thái production. Sửa cho khớp sự thật.
Repo: D:/Ninh Binh/codex-cus00-app-sync

Đây là rủi ro lớn nhất của dự án lúc này: một phiên làm việc mới đọc
docs/HANDOFF.md sẽ tin production còn trống và hành động theo đó.

SỰ THẬT (đã đo bằng lệnh, không kiểm lại):
- Toàn bộ migration 039 đến 048 ĐÃ APPLY lên Supabase production
  (supabase migration list --linked: local khớp remote)
- /api/health trả experienceMode = "production", không phải client-demo
- Cờ CUSTOMER_DATA_INGESTION_ENABLED ĐANG BẬT (POST /api/customer-events
  trả 403 chứ không phải 503; cờ được kiểm TRƯỚC origin tại route.ts:26)
- Production đã được kích hoạt thật trưa 21/08 qua các commit 5273196,
  c64f81d, 394eb2f, b66a69c, af68954, 2b2bd98, 90e9c13, c01c671

Yêu cầu:
- Sửa mọi câu trong docs/HANDOFF.md và docs/plans/GOI_A_KE_HOACH.md (đặc biệt
  mục 20) đang nói "chưa apply", "flag tắt", "staged", "BLOCKED" cho khớp.
- Ghi vào docs/NHAT_KY.md: production kích hoạt lúc nào, commit nào.
- Sửa cách gọi "migration 039-045": có HAI migration mang số 0039
  (202608070039_erp_rls_identity_reads và 202608180039_customer_data_backbone).
  Gọi tắt bằng 3 chữ số là mơ hồ — dùng tên đầy đủ.

Ràng buộc: CHỈ sửa tài liệu, không chạm code. Không viết lại lịch sử, chỉ sửa
những câu đã sai so với sự thật trên.
```

---

## P3 — Dọn cấu trúc tài liệu

**Model:** `gpt-5.6-terra` / medium — hoặc `claude-sonnet-5` / medium
**Vì sao con giữa, effort thấp:** cấu trúc đích đã chốt sẵn trong prompt, việc còn lại chủ yếu là **cắt và dán đúng chỗ**, không phải nghĩ ra gì mới. Chỉ cần đủ cẩn thận để không đánh rơi dòng lịch sử nào. Đây là phase tốn nhiều chữ nhất nên chạy con rẻ tiết kiệm thấy rõ.

```
Việc: tách docs/HANDOFF.md và dựng bộ định tuyến, để agent mới đọc 2 file là
biết đang ở đâu và làm gì tiếp.
Repo: D:/Ninh Binh/codex-cus00-app-sync

VẤN ĐỀ: docs/HANDOFF.md đang 124KB / 500 dòng, trong đó mục 2 chiếm 308 dòng
(62%) và toàn là ký sự lịch sử chứ không phải hiện trạng. Tiếng Việt có dấu
tốn token: 124KB ~ 40-50K token, cộng kế hoạch 48KB ~ 16-19K token nữa. Mỗi
phiên khởi động đốt 60-70K token chỉ để biết đang ở đâu.

CẤU TRÚC ĐÍCH:
  AGENTS.md            ~8KB   bộ định tuyến (tự nạp cho cả Codex lẫn Claude)
  docs/HANDOFF.md     <=25KB  CHỈ hiện trạng hôm nay + 12 cái bẫy
  docs/NHAT_KY.md       lớn   nhật ký theo ngày, chỉ thêm, đọc khi truy vết
  docs/LO_TRINH.md    ~15KB   phase/step + gate + model
  docs/plans/                 kế hoạch thi hành hiện hành
  docs/reference/             tra khi chạm đúng việc
  docs/archive/               lịch sử, không dùng kết luận trạng thái

LÀM:
1. Tạo docs/NHAT_KY.md. CHÉP NGUYÊN VĂN mục 2 của HANDOFF sang, sắp theo ngày,
   mới nhất trên cùng. Không tóm tắt, không viết lại.
2. Cắt docs/HANDOFF.md còn: (0) hiện trạng production hôm nay, (1) đang hỏng
   gì / đang chặn gì, (2) trỏ sang LO_TRINH.md, (3) 12 cái bẫy GIỮ NGUYÊN
   (chỉ ~5KB, là bài học vĩnh viễn).
3. Tạo docs/LO_TRINH.md: bảng phase/step. Mỗi dòng gồm mã việc, mô tả một câu,
   trạng thái (chưa/đang/xong/chặn), gate phải qua, model khuyến nghị. Lấy
   hàng việc từ HANDOFF mục 4 (các mã T*, W*, CUS-*) và bảng model ở mục 0
   của docs/PROMPT_THEO_PHASE.md.
4. Sửa AGENTS.md: thay phần "Read this first" bằng bảng định tuyến

   | Sắp làm gì | Đọc file nào | Model |
   | Bất kỳ việc gì | AGENTS.md + docs/HANDOFF.md | - |
   | Biết việc kế tiếp | thêm docs/LO_TRINH.md | - |
   | Chạm schema/RLS/quyền | thêm migration liên quan | tầng cao |
   | Chạm UI công khai | thêm docs/reference/UI_UX_RULES.md | tầng giữa |
   | Chạm vé/sức chứa | thêm SO_TAY_HE_THONG_VI.md + migration T8/T11a | tầng cao |
   | Truy vết việc cũ | docs/NHAT_KY.md | tầng thấp |

   Bỏ câu cấm tạo tài liệu trạng thái mới, thay bằng ranh giới rõ:
   HANDOFF = hôm nay, NHAT_KY = đã qua, LO_TRINH = sắp tới. Không có file
   trạng thái thứ tư.
5. Trong LO_TRINH.md ghi bảng định nghĩa Sol/Terra/Luna kèm slug thật
   (gpt-5.6-sol / terra / luna) — repo đang dùng ba tên này khắp nơi mà không
   chỗ nào định nghĩa.

Ràng buộc: CHỈ sửa tài liệu. Không mất một dòng lịch sử nào — mọi thứ cắt khỏi
HANDOFF phải xuất hiện nguyên văn trong NHAT_KY.
```

---

## P4 — Kiểm chứng 63 cáo buộc chưa xác minh

**Model:** `gpt-5.6-sol` / xhigh — hoặc `claude-opus-5` / xhigh
**Vì sao con mạnh nhất, effort cao nhất:** đây là việc **khó nhất trong cả danh sách**. Phản biện khó hơn viết code: phải đọc code người khác, dựng lại ý định của nó, rồi tự chứng minh mình sai. Model yếu có xu hướng gật đầu với cáo buộc nghe hợp lý — mà gật sai ở đây thì sinh ra một đợt sửa lỗi không tồn tại, tốn hơn nhiều lần tiền tiết kiệm được.

Phiên review 21/08 thu được 66 phát hiện nhưng **toàn bộ agent phản biện chết vì hết hạn mức chi tiêu**. Ba cái đã tự xác minh ĐÚNG (endpoint mở, mật khẩu lộ, tài liệu lệch). **63 cái còn lại là cáo buộc chưa ai kiểm.**

Nguồn đầy đủ: `~/.claude/projects/d--Ninh-Binh-ninhbinh/<session>/subagents/workflows/wf_8a018c28-332/journal.jsonl`

Xếp theo mức đáng lo — làm từ trên xuống, dừng khi thấy đủ:

**Nhóm A — bảo mật lớp khách (làm trước)**
1. Cổng consent đọc lời khai trong payload trình duyệt thay vì tra bảng `customer_consents`
2. Ba route khách nhận `anonymous_id` từ body khi thiếu cookie → ghi consent/giữ chỗ lên hồ sơ người khác
3. Hợp nhất định danh không xác minh liên hệ → biết email/số của ai là gắn được hồ sơ mình vào hồ sơ họ
4. Đăng nhập ERP fail-open khi registry không đọc được → tài khoản đã đình chỉ vẫn vào được
5. Bài test tên "enables RLS on every public table" thực ra chỉ soi 31 bảng hardcode trong một migration

**Nhóm B — đúng đắn nghiệp vụ**
6. Migration 047 làm hỏng chuỗi tiếng Việt trong function ERP **đã chạy production**
7. Schema chỉ cho phép **đúng một** khung giờ cho mỗi (sản phẩm, điểm) — nếu đúng thì tiền đề "đặt vé theo khung giờ" không dựng được
8. Test "không bán vượt" chỉ dò chuỗi trong file SQL, không chạm database
9. Hai RPC đặt chỗ khóa slot theo hai thứ tự khác nhau → có thể deadlock
10. `capacity_snapshot` chỉ làm mới khi có người giữ chỗ → phễu và trang cấu hình sức chứa hiện hai con số khác nhau
11. Giữ chỗ **15 phút** trong khi đề bài ghi rõ **10 phút**, không tài liệu nào ghi nhận độ lệch
12. Không có gì chặn hai khung giờ chồng lấn tại cùng một điểm

**Nhóm C — soát vé offline**
13. Thiết bị offline quá 36 giờ kẹt cứng vĩnh viễn: không sync được, không nạp được vé mới, không có nút xóa hàng đợi
14. Chống quét trùng phía máy trạm bị xóa sau mỗi lần sync → vé một lượt quét lần hai vẫn "cho vào"
15. Quá 5000 vé còn hiệu lực là không nạp được manifest — vỡ đúng tại cơ sở đông nhất
16. Migration 045 thay function T8 `erp_gate_scan_ticket` đang chạy và biến idempotency key từ tùy chọn thành **bắt buộc**

**Nhóm D — cổng phát hành**
17. `/erp/release` chỉ là màn hình hiển thị, không phải cơ chế chặn — bật cờ thẳng trên Vercel là mở tính năng, gate không biết
18. Rollback "tự từ chối khi có dữ liệu thật" không đúng với bảng lịch bán — điều kiện chặn bất khả thi theo schema
19. Không có PITR + migration 043 ghi thẳng vào `erp_tickets` đang chạy = rủi ro một chiều
20. Ba "policy version đã duyệt" chỉ là kiểm chuỗi không chứa `draft/staged` — gõ "v1" là qua cổng
21. Cờ `NEXT_PUBLIC_*` bật trên dashboard hiện ON trên gate nhưng chưa có hiệu lực tới khi redeploy

**Nhóm E — nghiệm thu và phạm vi**
22. Luồng mua vé A2 thiếu 6/8 yêu cầu: không chọn khung giờ, không hiện chỗ còn, không tách người lớn/trẻ em, không trường liên hệ, không mã QR, không chữ ký chống giả
23. Không có lớp trừu tượng `PaymentProvider`; CHECK constraint khóa cứng `status='succeeded'` nên thất bại/quá hạn **không ghi được**
24. Vé QR có chữ ký, mở lại bằng đường dẫn riêng: **không tồn tại**
25. A6 bị định nghĩa lại thành "activation gate", bỏ hẳn phần đề bài giao: đối chiếu từng dòng trong 7 dòng nghiệm thu
26. Trang `/quyen-rieng-tu` nêu đích danh Xuân Trường là pháp nhân kiểm soát dữ liệu, trong khi chính repo ghi câu hỏi đó **chưa có câu trả lời**
27. Bằng chứng "Playwright booking 2/2" và "A3 offline 1/1" là test mock toàn bộ API, không chạm route handler/repository/DB
28. Migration 044 hard-code kênh `zalo` — Zalo nằm trong danh sách "Ngoài phạm vi" của phiếu

```
Việc: phản biện danh sách cáo buộc dưới đây. Đây KHÔNG phải danh sách lỗi đã
xác nhận — chúng do agent khác nêu và CHƯA ai kiểm.
Repo: D:/Ninh Binh/codex-cus00-app-sync

Với TỪNG cáo buộc: tự mở file được dẫn, đọc đúng đoạn đó VÀ đoạn xung quanh,
rồi kết luận một trong ba:
- ĐÚNG: bằng chứng khớp, vấn đề có thật, hậu quả nêu ra không phóng đại
- SAI: đọc nhầm, hiểu sai code, vấn đề không tồn tại, HOẶC tài liệu đã tự
  thú nhận đúng điều đó rồi (tự thú nhận thì không còn là lỗi giấu)
- MỘT PHẦN: có lỗi thật nhưng phát biểu quá mạnh — phải viết lại cho đúng mức

Mặc định nghiêng về SAI nếu không tự nhìn thấy bằng chứng. Không tin lời kể lại.

Làm nhóm A trước, rồi B, C, D, E. Sau mỗi nhóm dừng lại báo kết quả trước khi
sang nhóm sau — đừng chạy hết một lượt rồi mới báo.

Đầu ra mỗi cáo buộc: mã số, kết luận, file:dòng làm bằng chứng, một câu hậu quả
thật. KHÔNG sửa code trong phase này — chỉ kiểm chứng.
```

---

## P5 — Trả nợ nghiệm thu A6

**Model:** `gpt-5.6-sol` / high — hoặc `claude-opus-5` / xhigh
**Vì sao con mạnh:** đây là bản chấm điểm sẽ đưa cho chủ đầu tư. Mỗi dòng phải chứng minh bằng code chứ không bằng lời tài liệu — mà tài liệu trong repo này đã nhiều lần nói quá so với thực tế. Cần model đủ hoài nghi để không chép lại lời tự khen.

```
Việc: viết bản đối chiếu nghiệm thu mà đề bài gốc yêu cầu nhưng chưa ai làm.
Repo: D:/Ninh Binh/codex-cus00-app-sync

Đề bài gốc docs/reference/PHIEU_GIAO_VIEC_01_GOI_A.md mục 5 có 7 dòng nghiệm
thu. Nhiệm vụ A6 theo phiếu là "đối chiếu với danh mục nghiệm thu rút gọn tại
mục 5 và ghi rõ từng dòng đạt hay chưa". Việc đó chưa được viết ra ở đâu cả —
A6 đã bị định nghĩa lại thành "activation gate", tức là đổi đề bài.

Chấm từng dòng trong 7 dòng, bằng bằng chứng code, không bằng lời tài liệu:
1. Vé web và vé quầy dùng CÙNG MỘT CHUẨN MÃ
2. Hai phiên đặt chỗ song song KHÔNG BAO GIỜ bán vượt
3. Soát vé có chế độ mất mạng, tự đồng bộ, chống quét trùng, ghi cả lượt từ chối
4. QR động đo đúng nguồn, đổi đích không in lại
5. Bảng điều hành hiện phễu từ quét mã tới soát vé, KHÔNG CÓ SỐ BỊA
6. Toàn bộ kiểm tra xanh, HANDOFF cập nhật trung thực
7. Khách không điền biểu mẫu dài: TỐI ĐA MỘT TRƯỜNG LIÊN HỆ

Mỗi dòng ghi: Đạt / Chưa / Một phần, kèm file:dòng chứng minh, và nếu Chưa thì
thiếu chính xác cái gì.

Lưu ý đã biết: dòng 5 hiện KHÔNG đạt (xem P1 — hold hết hạn bị đếm là đang giữ
chỗ, và tỉ lệ chuyển đổi so tử số theo kỳ với mẫu số toàn thời gian).

Ghi kết quả vào docs/plans/GOI_A_KE_HOACH.md thành một mục mới. Không sửa code.
```

---

## 2. Luật chung cho mọi phase

1. Không tự mở rộng phạm vi. Mâu thuẫn giữa prompt và repo thì **dừng và hỏi chủ dự án**.
2. Không sửa tài liệu và code trong cùng một commit.
3. Xong một việc: thêm một dòng vào `docs/NHAT_KY.md`, đổi trạng thái trong `docs/LO_TRINH.md`. **Không tạo file trạng thái mới.**
4. Không nói "xong" nếu chưa chạy `npm run typecheck && npm run lint && npm run test:run`.
5. Test ghi vào production phải tự dọn sạch (luật `AGENTS.md`).
6. Test production phải đặt `PLAYWRIGHT_BASE_URL` tường minh — thiếu là nó lặng lẽ dựng server cục bộ rồi báo nhầm.
7. Không apply migration hay bật cờ mới trên production nếu prompt không giao rõ.
