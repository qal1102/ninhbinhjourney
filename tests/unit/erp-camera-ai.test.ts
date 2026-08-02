import { describe, expect, it } from "vitest";
import type { ErpRole, ErpSiteId } from "@/domain/erp";
import {
  buildCameraEventScript,
  buildCameraScene,
  CAMERA_ATTENTION_LOAD,
  CAMERA_SCENE_BUCKET_MS,
  CAMERA_SCRIPT_MAX_EVENTS,
  cameraSceneBucket,
  listCameraZoneNames,
} from "@/domain/erp-camera-ai";

const SITES: ErpSiteId[] = ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"];
const OTHER_ROLES: ErpRole[] = [
  "manager",
  "employee",
  "accountant",
  "chief-accountant",
];

// Một mốc cố định để mọi khẳng định dưới đây lặp lại được.
const AT = Date.UTC(2026, 7, 2, 3, 17, 42);

describe("cảnh camera mô phỏng", () => {
  it("giữ nguyên trong cùng một khung 5 phút", () => {
    const start = Math.floor(AT / CAMERA_SCENE_BUCKET_MS) * CAMERA_SCENE_BUCKET_MS;
    const first = buildCameraScene({ siteId: "trang-an", at: start });
    const later = buildCameraScene({
      siteId: "trang-an",
      at: start + CAMERA_SCENE_BUCKET_MS - 1,
    });
    expect(later).toEqual(first);
  });

  it("dựng lại khi sang khung mới", () => {
    const start = Math.floor(AT / CAMERA_SCENE_BUCKET_MS) * CAMERA_SCENE_BUCKET_MS;
    const next = buildCameraScene({
      siteId: "trang-an",
      at: start + CAMERA_SCENE_BUCKET_MS,
    });
    expect(next.bucket).toBe(cameraSceneBucket(start) + 1);
    expect(next.feeds.map((feed) => feed.simulatedPeople)).not.toEqual(
      buildCameraScene({ siteId: "trang-an", at: start }).feeds.map(
        (feed) => feed.simulatedPeople,
      ),
    );
  });

  it("cho mọi người xem cùng một cảnh, không phụ thuộc ai đang đăng nhập", () => {
    // Hàm không nhận vai trò: hai máy đặt cạnh nhau không thể mâu thuẫn nhau.
    const a = buildCameraScene({ siteId: "tam-chuc", at: AT });
    const b = buildCameraScene({ siteId: "tam-chuc", at: new Date(AT) });
    expect(b).toEqual(a);
  });

  it("số người luôn nằm trong sức chứa thiết kế đã khai báo", () => {
    for (const siteId of SITES) {
      for (let step = 0; step < 200; step += 1) {
        const scene = buildCameraScene({
          siteId,
          at: AT + step * CAMERA_SCENE_BUCKET_MS,
        });
        for (const feed of scene.feeds) {
          expect(feed.simulatedPeople).toBeGreaterThanOrEqual(0);
          expect(feed.simulatedPeople).toBeLessThanOrEqual(feed.designCapacity);
          expect(feed.status === "attention").toBe(
            feed.status !== "offline" && feed.loadRatio >= CAMERA_ATTENTION_LOAD,
          );
        }
      }
    }
  });

  it("luôn có đúng một camera mất tín hiệu và nó không góp số vào tổng", () => {
    for (const siteId of SITES) {
      const scene = buildCameraScene({ siteId, at: AT });
      const offline = scene.feeds.filter((feed) => feed.status === "offline");
      expect(offline).toHaveLength(1);
      expect(offline[0].simulatedPeople).toBe(0);
      expect(scene.onlineCount).toBe(scene.feeds.length - 1);
      expect(scene.simulatedTotal).toBe(
        scene.feeds
          .filter((feed) => feed.status !== "offline")
          .reduce((sum, feed) => sum + feed.simulatedPeople, 0),
      );
    }
  });

  it("dựng đúng các khu vực đã khai báo cho từng cơ sở", () => {
    for (const siteId of SITES) {
      const scene = buildCameraScene({ siteId, at: AT });
      expect(scene.feeds.map((feed) => feed.zone)).toEqual([
        ...listCameraZoneNames(siteId),
      ]);
      expect(scene.feeds.filter((feed) => feed.bottleneck)).toHaveLength(1);
    }
  });
});

describe("kịch bản sự kiện camera", () => {
  it("không phát cho bất kỳ vai trò nào ngoài giám đốc", () => {
    const scene = buildCameraScene({ siteId: "trang-an", at: AT });
    for (const role of OTHER_ROLES) {
      expect(buildCameraEventScript({ scene, role })).toEqual([]);
    }
  });

  it("không bao giờ vượt trần 2 sự kiện, ở mọi cơ sở và mọi khung giờ", () => {
    for (const siteId of SITES) {
      for (let step = 0; step < 500; step += 1) {
        const scene = buildCameraScene({
          siteId,
          at: AT + step * CAMERA_SCENE_BUCKET_MS,
        });
        const script = buildCameraEventScript({ scene, role: "director" });
        expect(script.length).toBeLessThanOrEqual(CAMERA_SCRIPT_MAX_EVENTS);
      }
    }
  });

  it("nhắm vào khu vực nghẽn và đóng lại bằng một sự kiện gỡ cảnh báo", () => {
    const scene = buildCameraScene({ siteId: "bai-dinh", at: AT });
    const script = buildCameraEventScript({ scene, role: "director" });
    const bottleneck = scene.feeds.find((feed) => feed.bottleneck);

    expect(script).toHaveLength(2);
    expect(script.map((event) => event.tone)).toEqual(["alert", "resolved"]);
    expect(script.every((event) => event.zone === bottleneck?.zone)).toBe(true);
    // Sự kiện hiện dần chứ không đổ ra cùng lúc.
    expect(script[0].revealAfterMs).toBeGreaterThan(0);
    expect(script[1].revealAfterMs).toBeGreaterThan(script[0].revealAfterMs);
  });

  it("nói thẳng trong nội dung rằng đây là kịch bản, không phải số đo", () => {
    const scene = buildCameraScene({ siteId: "tam-coc", at: AT });
    const script = buildCameraEventScript({ scene, role: "director" });
    expect(script.map((event) => event.detail).join(" ")).toMatch(
      /kịch bản|mô phỏng|mô hình/i,
    );
  });
});
