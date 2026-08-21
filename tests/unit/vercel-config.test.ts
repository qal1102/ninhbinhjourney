import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Vercel deployment contract", () => {
  it("does not override the project experience mode during the build", () => {
    const config = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../vercel.json", import.meta.url)),
        "utf8",
      ),
    ) as { build?: { env?: Record<string, string> } };

    expect(config.build?.env?.NEXT_PUBLIC_EXPERIENCE_MODE).toBeUndefined();
  });
});
