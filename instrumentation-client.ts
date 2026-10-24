import { config } from "zod/v4/core";

// CSP (`proxy.ts`) không cho `eval`. Zod 4 thử `Function("")` ở lần kiểm đầu
// để chọn đường JIT; bị chặn thì tự lùi về đường thường, nhưng mỗi lượt tải
// trang lại sinh một báo cáo vi phạm giả. Ở trình duyệt dùng thẳng đường thường.
config({ jitless: true });
