import { describe, expect, it } from "vitest";
import {
  ERP_REAL_DATA_FROM,
  erpDataOriginLabel,
  erpFinanceDataOrigin,
  isErpDataOrigin,
  isRealErpData,
  parseErpDataOrigin,
  partitionErpDataOrigin,
} from "@/domain/erp-data-origin";

describe("nguồn gốc dữ liệu ERP", () => {
  it("nhận đúng ba giá trị đã định nghĩa", () => {
    expect(isErpDataOrigin("real")).toBe(true);
    expect(isErpDataOrigin("demo-seed")).toBe(true);
    expect(isErpDataOrigin("test-residue")).toBe(true);
    expect(isErpDataOrigin("seed")).toBe(false);
    expect(isErpDataOrigin("")).toBe(false);
  });

  it("cột chưa tồn tại thì coi là dữ liệu thật", () => {
    // Migration có thể chưa áp được lúc deploy. Khi ấy `row.data_origin` là
    // undefined, và con số phải giữ nguyên như trước chứ không được tụt về 0:
    // thà đếm dư một hồ sơ mẫu còn hơn giấu mất một việc thật.
    expect(parseErpDataOrigin(undefined)).toBe("real");
    expect(parseErpDataOrigin(null)).toBe("real");
    expect(parseErpDataOrigin(42)).toBe("real");
    expect(parseErpDataOrigin("khong-biet")).toBe("real");
  });

  it("giữ nguyên nhãn đã đọc được từ kho dữ liệu", () => {
    expect(parseErpDataOrigin("demo-seed")).toBe("demo-seed");
    expect(parseErpDataOrigin("test-residue")).toBe("test-residue");
  });

  it("chỉ hàng thật mới được tính vào con số ra quyết định", () => {
    expect(isRealErpData({ dataOrigin: "real" })).toBe(true);
    expect(isRealErpData({ dataOrigin: "demo-seed" })).toBe(false);
    expect(isRealErpData({ dataOrigin: "test-residue" })).toBe(false);
  });

  it("hàng thật không đeo nhãn, hai loại còn lại gọi đúng tên", () => {
    expect(erpDataOriginLabel("real")).toBeNull();
    expect(erpDataOriginLabel("demo-seed")).toBe("hồ sơ mẫu");
    expect(erpDataOriginLabel("test-residue")).toBe("cặn chạy thử");
  });

  it("tách danh sách thành phần thật và phần mẫu, giữ nguyên thứ tự", () => {
    const rows = [
      { id: "a", dataOrigin: "demo-seed" as const },
      { id: "b", dataOrigin: "real" as const },
      { id: "c", dataOrigin: "test-residue" as const },
      { id: "d", dataOrigin: "real" as const },
    ];
    const { real, sample } = partitionErpDataOrigin(rows);
    expect(real.map((row) => row.id)).toEqual(["b", "d"]);
    expect(sample.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("trả về cả phần mẫu để màn hình còn nói ra được", () => {
    // Giấu phần mẫu đi thì giám đốc thấy 0 mà sổ lại đầy hồ sơ, và chính sự
    // vênh ấy làm người ta nghi màn hình hỏng.
    const { real, sample } = partitionErpDataOrigin([
      { dataOrigin: "demo-seed" as const },
      { dataOrigin: "demo-seed" as const },
    ]);
    expect(real).toHaveLength(0);
    expect(sample).toHaveLength(2);
  });
});

describe("erpFinanceDataOrigin — ba bảng tài chính không có cột nhãn", () => {
  const seedId = "88000000-0000-4000-8000-000000000001";
  const randomId = "9cc34b9a-1111-4111-8111-111111111111";
  const beforeCutoff = "2026-08-05T05:59:00.000Z";
  const afterCutoff = "2026-09-06T03:00:00.000Z";

  it("tin cột data_origin trước tiên, nếu bảng nào đó có", () => {
    expect(
      erpFinanceDataOrigin({
        data_origin: "test-residue",
        id: seedId,
        created_at: afterCutoff,
      }),
    ).toBe("test-residue");
  });

  it("mã mang tiền tố gieo sẵn là hồ sơ mẫu", () => {
    for (const id of [
      "61000000-0000-4000-8000-000000000001",
      "87000000-0000-4000-8000-000000000001",
      seedId,
    ]) {
      expect(erpFinanceDataOrigin({ id, created_at: afterCutoff })).toBe(
        "demo-seed",
      );
    }
  });

  it("mã ngẫu nhiên tạo trước mốc là cặn chạy thử", () => {
    // Chín trong mười một bút toán trên production rơi vào đúng nhánh này:
    // chúng do các lượt chạy thử đi qua đúng quy trình tạo ra, nên không có
    // gì trong cấu trúc phân biệt được với hàng thật ngoài thời gian.
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: beforeCutoff }),
    ).toBe("test-residue");
  });

  it("mã ngẫu nhiên tạo sau mốc là nghiệp vụ thật", () => {
    expect(erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff })).toBe(
      "real",
    );
  });

  it("ngày hỏng hoặc thiếu thì coi là thật, không giấu mất việc thật", () => {
    expect(erpFinanceDataOrigin({ id: randomId })).toBe("real");
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: "khong-phai-ngay" }),
    ).toBe("real");
    expect(erpFinanceDataOrigin({})).toBe("real");
  });

  it("mốc chia đứng đúng 06/08/2026 00:00 giờ Việt Nam", () => {
    // Lùi mốc này lên sau khi có khách thật là xoá nhãn khỏi dữ liệu của họ.
    expect(new Date(ERP_REAL_DATA_FROM).toISOString()).toBe(
      "2026-08-05T17:00:00.000Z",
    );
  });
});
