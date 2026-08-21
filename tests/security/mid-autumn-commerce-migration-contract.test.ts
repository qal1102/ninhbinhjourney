import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getPackageBySlug } from "@/content/packages";

describe("Mid-Autumn commerce demo contract", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase", "migrations", "202608210048_mid_autumn_commerce_demo.sql"),
    "utf8",
  );

  it("keeps the public catalog and production seed on the same product and price", () => {
    const item = getPackageBySlug("ban-trang-tam-coc-2026");
    expect(item).toMatchObject({
      id: "40000000-0000-4000-8000-000000000005",
      demoPriceVnd: 1_240_000,
      fixedPartySize: 2,
      bookingStartDate: "2026-09-18",
      bookingEndDate: "2026-09-27",
    });
    expect(sql).toContain("'40000000-0000-4000-8000-000000000005'");
    expect(sql).toContain("1240000");
    expect(sql).toContain("'19:00'");
    expect(sql).toContain("150");
  });

  it("uses the existing CUS-06 capacity template instead of inventing a second booking store", () => {
    expect(sql).toContain("public.customer_product_capacity_templates");
    expect(sql).toContain("public.products");
    expect(sql).toContain("public.product_sites");
    expect(sql).not.toMatch(/create table/i);
  });
});
