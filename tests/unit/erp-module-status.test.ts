import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERP_MODULES } from "@/domain/erp";

const workspaceSource = readFileSync(
  fileURLToPath(
    new URL("../../components/erp/module-workspace.tsx", import.meta.url),
  ),
  "utf8",
);

// Every module owns a real workflow component. Written out rather than
// derived, so that adding a module without wiring one is a test failure and
// not a silent claim. There is no "planned" state any more (26/09/2026): the
// two shells were removed and "bao-cao" was built.
const MODULES_WITH_A_REAL_WORKFLOW = [
  "ve-dat-cho",
  "check-in-khach",
  "suc-chua",
  "sop-dien-tap",
  "camera-ai",
  "bao-cao-hien-truong",
  "du-an-su-kien",
  "su-co",
  "nhan-su",
  "cham-cong",
  "doi-tac-nha-cung-ung",
  "tai-chinh-doi-soat",
  "bao-cao",
] as const;

describe("ERP module status honesty (T3)", () => {
  it("every module dispatches to a real workflow", () => {
    expect(ERP_MODULES.map((module) => module.id).sort()).toEqual([...MODULES_WITH_A_REAL_WORKFLOW].sort());
    for (const moduleId of MODULES_WITH_A_REAL_WORKFLOW) {
      expect(
        workspaceSource,
        `${moduleId} has no branch in ModuleWorkspace`,
      ).toContain(`module.id === "${moduleId}"`);
    }
  });

  it("no longer carries the empty-shell screen", () => {
    expect(workspaceSource).not.toContain("PlannedModuleNotice");
    expect(workspaceSource).not.toContain("Giai đoạn sau");
  });

  it("has no invented operational rows left in the workspace file", () => {
    // The exact fabrications that used to ship: named drivers, invented work
    // orders, an attachment count for files that never existed. If any of
    // these strings comes back, so has the credibility problem.
    for (const fabrication of [
      "Nguyễn Văn Hải",
      "Phạm Quốc Dũng",
      "Trần Minh Tuấn",
      "WO-219",
      "DRILL-08",
      "2 tệp đính kèm",
      "428",
    ]) {
      expect(workspaceSource, `still fabricating: ${fabrication}`).not.toContain(
        fabrication,
      );
    }
  });
});
