import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * BRAND-DOSSIER-03 · 15/09/2026.
 *
 * Brand names and logo-bearing visual studies are deliberately quarantined in
 * the opt-in collaboration dossier. They must never leak into the tourism
 * homepage, seasonal route, or other public source files.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const THIRD_PARTY_BRAND =
  /celine|chanel|prada|bottega|herm[eè]s|bvlgari|bulgari|cartier|\bdior\b|gucci|rolex|vacheron|louis vuitton/i;
const COLLABORATION_SOURCE = "components/discovery/collaboration-editorial.tsx";
const COLLABORATION_ASSET_ALLOWLIST = [
  "/images/campaigns/mid-autumn-2026/brand-proposals/celine-concept.webp",
  "/images/campaigns/mid-autumn-2026/brand-proposals/chanel-concept.webp",
  "/images/campaigns/mid-autumn-2026/brand-proposals/prada-concept.webp",
  "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp",
  "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/bottega-kim-son-craft.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/bvlgari-night-salon.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-heritage-watch.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-night-gala.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-atelier.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-beauty.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-evening-gala.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-sunset-music.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/rolex-river-explorer.webp",
  "/images/campaigns/mid-autumn-2026/luxury-editorial/vacheron-constantin-heritage.webp",
] as const;

function collect(directory: string, matcher: RegExp): string[] {
  const files: string[] = [];
  const visit = (directoryPath: string) => {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (matcher.test(entry.name)) files.push(entryPath);
    }
  };
  visit(path.join(REPO_ROOT, directory));
  return files;
}

describe("opt-in luxury collaboration dossier contract", () => {
  it("keeps brand names and image imports out of the homepage", () => {
    const homepage = readFileSync(path.join(REPO_ROOT, "app", "ninh-binh-landing.tsx"), "utf8");
    expect(homepage).not.toMatch(THIRD_PARTY_BRAND);
    expect(homepage).not.toContain('from "@/components/discovery/mid-autumn-campaign"');
    expect(homepage).toContain('href={experiencePortalHref(destination, lang, source)}');
  });

  it("allows brand wording in the dossier source only", () => {
    const publicSourceFiles = [
      ...collect("app", /\.(ts|tsx|css)$/),
      ...collect("components", /\.(ts|tsx)$/),
      ...collect("content", /\.(ts|tsx|json)$/),
    ];
    const offenders = publicSourceFiles
      .filter((file) => THIRD_PARTY_BRAND.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, "/"));
    expect(offenders).toEqual([COLLABORATION_SOURCE]);
  });

  it("keeps every restored luxury visual in the explicit dossier allowlist", () => {
    const editorial = readFileSync(path.join(REPO_ROOT, COLLABORATION_SOURCE), "utf8");
    for (const asset of COLLABORATION_ASSET_ALLOWLIST) {
      expect(editorial).toContain(asset);
      expect(readFileSync(path.join(REPO_ROOT, "public", asset), "utf8").length).toBeGreaterThan(0);
    }
    const publicBrandAssets = collect("public", THIRD_PARTY_BRAND)
      .map((file) => `/${path.relative(path.join(REPO_ROOT, "public"), file).replace(/\\/g, "/")}`)
      .sort();
    expect(publicBrandAssets).toEqual([...COLLABORATION_ASSET_ALLOWLIST].sort());
  });

  it("requires bilingual independent-study wording and an Hermès finale", () => {
    const editorial = readFileSync(path.join(REPO_ROOT, COLLABORATION_SOURCE), "utf8");
    expect(editorial).toContain("independent creative study / uncommissioned concept / no affiliation or endorsement");
    expect(editorial).toContain("Không có hợp tác, tài trợ, chấp thuận hay chứng thực nào được xác nhận");
    expect(editorial).toContain('data-dossier-final={finale || undefined}');
    expect(editorial).toContain('id: "hermes"');
    expect(editorial).not.toMatch(/official partner|our partner|confirmed collaborator|sponsored by/i);
  });
});
