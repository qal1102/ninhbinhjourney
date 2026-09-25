import { describe, expect, it } from "vitest";

import { gomTheoDip, type CustomerFunnelSourceRow } from "@/domain/customer-funnel";

function dong(sourceId: string, dipId: string, so: Partial<CustomerFunnelSourceRow> = {}): CustomerFunnelSourceRow {
  return {
    sourceId, sourceLabel: sourceId, campaignLabel: "", dipId,
    qrScans: 0, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 0, ...so,
  };
}

describe("Phễu khách theo dịp", () => {
  it("cộng mọi mã QR của cùng một dịp làm một dòng", () => {
    const kq = gomTheoDip([
      dong("a", "trung-thu", { qrScans: 10, payments: 2 }),
      dong("b", "trung-thu", { qrScans: 5, payments: 1, acceptedGateScans: 3 }),
    ]);
    expect(kq).toEqual([
      { dipId: "trung-thu", qrScans: 15, pageViews: 0, holds: 0, payments: 3, acceptedGateScans: 3 },
    ]);
  });

  it("khách không rõ nguồn không bị đoán vào dịp nào", () => {
    const kq = gomTheoDip([dong("unattributed", "", { payments: 50 }), dong("a", "phat-dan", { payments: 1 })]);
    expect(kq.map((d) => d.dipId)).toEqual(["phat-dan"]);
    expect(kq[0].payments).toBe(1);
  });

  it("dịp ra tiền lên trước, nhóm chưa gắn dịp luôn nằm cuối", () => {
    const kq = gomTheoDip([
      dong("a", "", { payments: 99 }),
      dong("b", "vu-lan", { payments: 1, qrScans: 100 }),
      dong("c", "trung-thu", { payments: 4 }),
    ]);
    expect(kq.map((d) => d.dipId)).toEqual(["trung-thu", "vu-lan", ""]);
  });
});
