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

// The twelve modules that own a real workflow component. Written out rather than
// derived, so that flipping a module to `live` without wiring one is a test
// failure and not a silent claim.
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
] as const;

describe("ERP module status honesty (T3)", () => {
  it("marks live exactly the modules that dispatch to a workflow", () => {
    const live = ERP_MODULES.filter((module) => module.status === "live").map(
      (module) => module.id,
    );
    expect([...live].sort()).toEqual([...MODULES_WITH_A_REAL_WORKFLOW].sort());

    for (const moduleId of MODULES_WITH_A_REAL_WORKFLOW) {
      expect(
        workspaceSource,
        `${moduleId} claims to be live but has no branch in ModuleWorkspace`,
      ).toContain(`module.id === "${moduleId}"`);
    }
  });

  it("makes every planned module state what data it still needs", () => {
    const planned = ERP_MODULES.filter((module) => module.status === "planned");
    expect(planned.length).toBe(3);
    for (const entry of planned) {
      expect(entry.plannedNeeds?.length, entry.id).toBeGreaterThan(0);
      // No branch may exist for a planned module, or it would render something
      // while claiming to render nothing.
      expect(workspaceSource).not.toContain(`module.id === "${entry.id}"`);
    }
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
