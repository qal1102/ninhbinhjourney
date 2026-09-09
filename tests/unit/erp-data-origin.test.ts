import { readFileSync } from "node:fs";
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

describe("dấu bộ kiểm trong ghi chú — cặn sinh sau mốc thời gian", () => {
  const randomId = "9cc34b9a-1111-4111-8111-111111111111";
  const seedId = "88000000-0000-4000-8000-000000000001";
  // Sau mốc 06/08, nên nếu không nhận ra dấu thì hàng này bị đếm là tiền thật.
  const afterCutoff = "2026-09-08T03:00:00.000Z";
  const marker = "QA-T10B-RT-1757280000000";

  it("ghi chú mở đầu bằng dấu bộ kiểm là cặn chạy thử", () => {
    // Đây chính là hàng mà mỗi lượt smoke T10b để lại: mã ngẫu nhiên, giờ tạo
    // hôm nay, không có gì ngoài dấu này phân biệt được với một ca thật.
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [
        `${marker} — bàn giao ca test round-trip T10b, tự dọn bằng hoàn tác.`,
      ]),
    ).toBe("test-residue");
  });

  it("chỉ cần một ô ghi chú mang dấu là đủ", () => {
    // Bút toán nộp quỹ chỉ dính dấu ở ô kế toán trưởng, ô người lập do hệ
    // thống tự sinh nên trống trơn.
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [
        "Bút toán nộp quỹ lập tự động từ lượt đối khớp sao kê.",
        `${marker} — đã đối chiếu sao kê, duyệt ghi sổ nộp quỹ.`,
      ]),
    ).toBe("test-residue");
  });

  it("khoảng trắng thừa ở đầu ghi chú không làm sổng dấu", () => {
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [
        `   ${marker} — bàn giao ca.`,
      ]),
    ).toBe("test-residue");
  });

  // ⚠ Bài kiểm quan trọng nhất của cả khối này. Dấu nằm trong ô chữ tự do mà
  // nhân viên gõ được, nên nhận dấu quá rộng là xoá một ca THẬT khỏi con số
  // của giám đốc — đúng thứ mà nguyên tắc "thà đếm dư còn hơn giấu mất một
  // việc thật" cấm. Neo đầu chuỗi là hàng rào duy nhất giữ chỗ này.
  it("ghi chú thật có nhắc tới dấu ở giữa câu thì VẪN là nghiệp vụ thật", () => {
    const ghiChuThat = [
      `Ca sáng bàn giao đủ, đã đối chiếu với biên bản ${marker} hôm trước.`,
      `Tham chiếu: ${marker}`,
      "Xin xem lại hồ sơ QA-T10B-RT trước khi duyệt.",
      `Chênh 18 triệu, nguyên nhân giống lượt ${marker}, đã báo ngân hàng.`,
    ];
    for (const note of ghiChuThat) {
      expect(
        erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [note]),
      ).toBe("real");
    }
  });

  it("sai khuôn thì không nhận là dấu", () => {
    const saiKhuon = [
      "QA-T10B-RT-175728 — thiếu chữ số.",
      "QA-T10B-RT-17572800000001 — thừa chữ số.",
      "QA-T10B-RT- — chỉ có tiền tố.",
      "QA-T10B-RT-1757280000000", // đúng khuôn nhưng để đối chứng bên dưới
      "qa-t10b-rt-1757280000000 — viết thường.",
      "QA-T10C-RT-1757280000000 — sai tên bộ kiểm.",
    ];
    // Phần tử thứ tư là bản đúng khuôn, cố ý để cạnh nhau cho thấy hàng rào
    // nằm đúng chỗ mình nghĩ chứ không phải nó chặn tất.
    const ketQua = saiKhuon.map((note) =>
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [note]),
    );
    expect(ketQua).toEqual([
      "real",
      "real",
      "real",
      "test-residue",
      "real",
      "real",
    ]);
  });

  it("hồ sơ gieo mẫu vẫn là hồ sơ mẫu, dấu bộ kiểm không đè lên", () => {
    // Thứ tự xét phải giữ: tiền tố mã là bằng chứng chắc hơn ô chữ tự do.
    expect(
      erpFinanceDataOrigin({ id: seedId, created_at: afterCutoff }, [
        `${marker} — ai đó gõ nhầm vào hồ sơ mẫu.`,
      ]),
    ).toBe("demo-seed");
  });

  it("cột data_origin nếu có thì vẫn thắng dấu trong ghi chú", () => {
    expect(
      erpFinanceDataOrigin(
        { data_origin: "real", id: randomId, created_at: afterCutoff },
        [`${marker} — bàn giao ca.`],
      ),
    ).toBe("real");
  });

  it("không truyền ghi chú thì hành xử y hệt như trước", () => {
    // Bảng nào không có ô ghi chú vẫn phải chạy đúng, không được đổi kết quả.
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }),
    ).toBe("real");
    expect(erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [])).toBe(
      "real",
    );
  });

  it("ô ghi chú rỗng hoặc không phải chuỗi thì bỏ qua, không nổ", () => {
    expect(
      erpFinanceDataOrigin({ id: randomId, created_at: afterCutoff }, [
        null,
        undefined,
        42,
        "",
        { note: marker },
      ]),
    ).toBe("real");
  });
});

describe("dấu bộ kiểm phải khớp với chính bộ kiểm", () => {
  // Đổi `MARKER` bên spec mà quên `ERP_TEST_MARKER_PATTERN` là lỗ hổng mở lại
  // trong im lặng: smoke vẫn xanh, ô tiền giám đốc lại đếm ca test là tiền
  // thật. Bài kiểm này đọc thẳng tệp spec để khoá hai đầu vào nhau.
  const spec = readFileSync(
    "tests/e2e/prod-smoke-t10b-cash-reconciliation-roundtrip.spec.ts",
    "utf8",
  );

  it("spec vẫn sinh dấu đúng khuôn mà hàm đang dò", () => {
    expect(spec).toContain("const MARKER = `QA-T10B-RT-${Date.now()}`;");
  });

  it("dấu spec sinh ra thật sự được xếp là cặn chạy thử", () => {
    const marker = `QA-T10B-RT-${Date.now()}`;
    expect(String(Date.now()).length).toBe(13);
    expect(
      erpFinanceDataOrigin(
        { id: "9cc34b9a-1111-4111-8111-111111111111" },
        [`${marker} — bàn giao ca test round-trip T10b.`],
      ),
    ).toBe("test-residue");
  });

  it("mọi ô spec điền đều đặt dấu ở ngay đầu chuỗi", () => {
    // Neo đầu chuỗi chỉ cứu được nếu spec giữ đúng lối `${MARKER} — …`. Chỗ
    // nào spec nhét dấu vào giữa câu là chỗ ấy sổng khỏi hàng rào.
    const oDienDau = spec.match(/\$\{MARKER\}/g) ?? [];
    expect(oDienDau.length).toBeGreaterThan(0);
    const nhetGiuaCau = spec.match(/\.fill\(`[^`]+\$\{MARKER\}/g) ?? [];
    expect(nhetGiuaCau).toEqual([]);
  });
});
