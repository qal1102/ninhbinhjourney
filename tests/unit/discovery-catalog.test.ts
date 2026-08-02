import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESTINATIONS,
  NINH_BINH_TOURISM_CORE,
  REGION_KEY,
} from "@/content/destinations";

const requiredSlugs = [
  "trang-an",
  "tam-coc-bich-dong",
  "hoa-lu-ancient-capital",
  "bai-dinh",
  "hang-mua",
  "thung-nham",
  "van-long",
  "hoa-lu-old-town",
] as const;

const geoJsonPath = fileURLToPath(
  new URL("../../public/data/ninh-binh-tourism-core.geojson", import.meta.url),
);
const metadataPath = fileURLToPath(
  new URL(
    "../../public/data/ninh-binh-tourism-core.metadata.json",
    import.meta.url,
  ),
);

describe("Ninh Bình discovery catalog and local map", () => {
  it("NBJ-M01 keeps the required destination set stable and unique", () => {
    // W3 added Tam Chúc: the ERP runs it, and the public web denied it
    // existed. It is the ninth.
    expect(DESTINATIONS).toHaveLength(9);
    expect(new Set(DESTINATIONS.map((item) => item.id)).size).toBe(9);
    expect(new Set(DESTINATIONS.map((item) => item.slug)).size).toBe(9);
    expect(DESTINATIONS.map((item) => item.slug)).toEqual(
      expect.arrayContaining([...requiredSlugs]),
    );
  });

  it("NBJ-M02 scopes every POI to the configured tourism core", () => {
    const { south, west, north, east } = NINH_BINH_TOURISM_CORE.bounds;
    for (const destination of DESTINATIONS) {
      // A destination the operator runs but which genuinely sits outside the
      // mapped core (Tam Chúc is in Hà Nam) declares that instead of being
      // quietly dragged inside the bounds. The rule still binds everything
      // else -- widening the box to swallow it would have made "Ninh Bình
      // tourism core" mean nothing.
      if (destination.outsideTourismCore) continue;
      const [latitude, longitude] = destination.coordinates;
      expect(destination.regionKey).toBe(REGION_KEY);
      expect(destination.regionKey).toBe("region-ninh-binh-demo");
      expect(destination.regionId).toBe(NINH_BINH_TOURISM_CORE.id);
      expect(latitude).toBeGreaterThanOrEqual(south);
      expect(latitude).toBeLessThanOrEqual(north);
      expect(longitude).toBeGreaterThanOrEqual(west);
      expect(longitude).toBeLessThanOrEqual(east);
    }
  });

  it("NBJ-M03 provides detail, mobility, demo-window, media and source metadata", () => {
    for (const destination of DESTINATIONS) {
      expect(destination.description.vi.length).toBeGreaterThan(40);
      expect(destination.story.vi.length).toBeGreaterThan(80);
      expect(destination.mobilityNote.vi.length).toBeGreaterThan(20);
      expect(destination.demoOpeningWindow).toMatch(/\d{2}:\d{2}/);
      expect(destination.image).toMatch(/^\/images\//);
      expect(destination.imageAlt.vi.length).toBeGreaterThan(20);
      expect(destination.source.url).toMatch(/^https:\/\//);
      expect(destination.source.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(destination.relatedSlugs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("NBJ-M04 versions a local GeoJSON product scope, never a national boundary", () => {
    const geoJson = JSON.parse(readFileSync(geoJsonPath, "utf8")) as {
      type: string;
      features: Array<{
        properties: Record<string, unknown>;
        geometry: { type: string };
      }>;
    };
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      scopeType: string;
      officialAdministrativeBoundary: boolean;
      excludedLayers: string[];
      coordinateSystem: string;
    };

    expect(geoJson.type).toBe("FeatureCollection");
    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].geometry.type).toBe("Polygon");
    expect(geoJson.features[0].properties.scopeType).toBe("tourism-core");
    expect(
      geoJson.features[0].properties.officialAdministrativeBoundary,
    ).toBe(false);
    expect(metadata.scopeType).toBe("tourism-core");
    expect(metadata.officialAdministrativeBoundary).toBe(false);
    expect(metadata.coordinateSystem).toBe("WGS 84 (EPSG:4326)");
    expect(metadata.excludedLayers).toContain("Vietnam national boundary");
    expect(
      JSON.stringify(geoJson).toLowerCase(),
    ).not.toContain("national-boundary-layer");
  });
});
