"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ErpSite } from "@/domain/erp";
import {
  buildCameraEventScript,
  buildCameraScene,
  CAMERA_SCENE_BUCKET_MS,
  CAMERA_SCRIPT_MAX_EVENTS,
  cameraSceneBucket,
  type CameraFeed,
  type CameraScriptEvent,
  type CameraStatus,
} from "@/domain/erp-camera-ai";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  site: ErpSite;
  user: CurrentErpUser;
  /**
   * Thời điểm máy chủ dựng trang. Lần render đầu ở client phải dùng đúng con
   * số này, nếu không cảnh mô phỏng sẽ lệch giữa HTML máy chủ và HTML client.
   */
  sceneAt: number;
  initialCameraId?: string;
};

const statusStyle: Record<CameraStatus, { label: string; className: string }> = {
  stable: { label: "Ổn định", className: "bg-[#dcf0e7] text-[#245f47]" },
  attention: { label: "Cần chú ý", className: "bg-[#ffe6bf] text-[#7a511d]" },
  offline: { label: "Mất tín hiệu", className: "bg-[#ecefed] text-[#68756f]" },
};

function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function CameraAiWorkspace({ site, user, sceneAt, initialCameraId }: Props) {
  const [sceneTime, setSceneTime] = useState(sceneAt);
  const [filter, setFilter] = useState<"all" | CameraStatus>("all");
  const [selected, setSelected] = useState<CameraFeed | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [firedEvents, setFiredEvents] = useState<CameraScriptEvent[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  const scene = useMemo(
    () => buildCameraScene({ siteId: site.id, at: sceneTime }),
    [site.id, sceneTime],
  );
  const script = useMemo(
    () => buildCameraEventScript({ scene, role: user.role }),
    [scene, user.role],
  );

  // Cảnh giữ nguyên trong một khung 5 phút, sau đó dựng lại một lần. Đây là
  // toàn bộ nhịp thay đổi của màn hình này — không có vòng lặp nào sinh dữ
  // liệu nhanh hơn thế.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = Date.now();
      setSceneTime((previous) =>
        cameraSceneBucket(current) === cameraSceneBucket(previous) ? previous : current,
      );
    }, 20_000);
    return () => window.clearInterval(tick);
  }, []);

  // Kịch bản: tối đa CAMERA_SCRIPT_MAX_EVENTS sự kiện, chỉ cho giám đốc, hẹn
  // giờ đúng một lần khi mở màn hình. Không có lịch lặp lại, nên không thể
  // tràn dù để màn hình mở cả ngày.
  useEffect(() => {
    if (script.length === 0) return;
    const timers = script.map((event) =>
      window.setTimeout(() => {
        setFiredEvents((previous) =>
          previous.some((item) => item.id === event.id)
            ? previous
            : [event, ...previous].slice(0, CAMERA_SCRIPT_MAX_EVENTS),
        );
      }, event.revealAfterMs),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Chạy lại khi đổi cơ sở hoặc sang khung 5 phút mới, không chạy lại mỗi
    // lần render.
  }, [script]);

  useEffect(() => {
    if (!initialCameraId) return;
    const normalizedId = initialCameraId.padStart(2, "0");
    const requestedFeed = scene.feeds.find((feed) => feed.id.endsWith(`-${normalizedId}`));
    if (!requestedFeed) return;
    const timer = window.setTimeout(() => setSelected(requestedFeed), 0);
    return () => window.clearTimeout(timer);
    // Chỉ mở đúng một lần theo tham số ?camera=, không mở lại mỗi 5 phút.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraId, site.id]);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const visibleFeeds =
    filter === "all" ? scene.feeds : scene.feeds.filter((feed) => feed.status === filter);
  // Mã sự kiện có gắn số khung 5 phút, nên sự kiện của khung cũ tự rụng khi
  // sang khung mới -- không cần dọn danh sách bằng setState trong effect.
  const visibleEvents = firedEvents.filter((event) =>
    script.some((item) => item.id === event.id),
  );
  const bucketMinutes = Math.round(CAMERA_SCENE_BUCKET_MS / 60_000);

  async function enterFullscreen() {
    await viewerRef.current?.requestFullscreen?.();
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-[#e0cfa8] bg-[#fffaef] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#8a5c1a] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
            Kịch bản mô phỏng
          </span>
          <p className="text-xs font-bold text-[#7a5a1d]">
            Chưa có camera AI thật — mọi số trên màn hình này là mô hình, không phải số đo
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#7a5a1d]">
          Số người hiển thị được tính bằng{" "}
          <span className="font-bold">sức chứa thiết kế × hệ số tải mô phỏng</span>, dựng
          lại {bucketMinutes} phút một lần và giống nhau trên mọi máy đang xem cùng lúc.
          Không có số nào ở đây được ghi vào nhật ký sự cố, chấm công hay sổ sách.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Camera đang nhận",
            `${scene.onlineCount}/${scene.feeds.length}`,
            "Trạng thái kết nối",
          ],
          [
            "Cần chú ý",
            String(scene.attentionCount),
            scene.attentionCount ? "Vượt ngưỡng mô hình" : "Không có cảnh báo",
          ],
          [
            "Mật độ mô phỏng",
            scene.simulatedTotal.toLocaleString("vi-VN"),
            "Không phải số đếm thật",
          ],
          ["Độ trễ hình ảnh", "—", "Chưa nối luồng hình thật"],
        ].map(([label, value, note], index) => (
          <article
            key={label}
            className={`rounded-2xl p-4 shadow-sm sm:p-5 ${index === 1 && scene.attentionCount ? "border border-[#efd4a8] bg-[#fff9ed]" : "border border-[#d8e0db] bg-white"}`}
          >
            <p className="text-xs text-[#697770]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[#203a30] sm:text-3xl">{value}</p>
            <p className="mt-2 text-xs text-[#849089]">{note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">
              Hiện trường {site.shortName}
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">Camera theo khu vực</h2>
            <p className="mt-2 text-xs text-[#7b8881]">
              Khung hình mô phỏng ·{" "}
              {now?.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }) ?? "Đang đồng bộ"}
            </p>
          </div>
          <div className="grid grid-cols-4 rounded-xl border border-[#d8e0db] bg-[#f7f9f7] p-1">
            {(["all", "stable", "attention", "offline"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-lg px-2 text-[11px] font-black transition sm:px-3 ${filter === value ? "bg-[#183f34] text-white" : "text-[#65756e]"}`}
              >
                {value === "all" ? "Tất cả" : statusStyle[value].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {visibleFeeds.map((feed) => (
            <button
              key={feed.id}
              type="button"
              onClick={() => setSelected(feed)}
              className="group overflow-hidden rounded-2xl border border-[#dce3df] bg-[#122a23] text-left shadow-sm transition hover:border-[#769b8c]"
            >
              <div className="relative aspect-video overflow-hidden">
                {feed.status !== "offline" ? (
                  <Image
                    src={site.image}
                    alt={`Khung hình ${feed.zone}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover opacity-80 transition duration-700 group-hover:scale-[1.03]"
                    style={{ objectPosition: feed.position }}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[#25342f] text-sm font-bold text-white/45">
                    Không có tín hiệu
                  </div>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,18,14,.42),transparent_38%,rgba(5,18,14,.72))]" />
                {feed.status !== "offline" ? (
                  <div className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-[#8ff0c1]/35" />
                ) : null}
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-md bg-black/55 px-2 py-1 text-[10px] font-black text-white">
                    {feed.name}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-black ${statusStyle[feed.status].className}`}
                  >
                    {statusStyle[feed.status].label}
                  </span>
                </div>
                <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 text-white">
                  <div>
                    <p className="font-black">{feed.zone}</p>
                    <p className="mt-1 text-xs text-white/62">{feed.note}</p>
                  </div>
                  {feed.status !== "offline" ? (
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black">{feed.simulatedPeople}</p>
                      <p className="text-[10px] text-white/55">
                        người · mô phỏng {percent(feed.loadRatio)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">
              Kịch bản trình diễn
            </p>
            <h2 className="mt-2 text-xl font-black text-[#20342c]">Sự kiện quan sát</h2>
          </div>
          {user.role === "director" ? (
            <p className="text-xs font-bold text-[#7a8781]">
              {visibleEvents.length}/{CAMERA_SCRIPT_MAX_EVENTS} sự kiện · dừng sau khi đủ
            </p>
          ) : null}
        </div>

        {user.role !== "director" ? (
          <p className="mt-4 rounded-xl bg-[#f4f7f5] p-4 text-sm leading-6 text-[#5f7068]">
            Kịch bản mô phỏng chỉ chạy trên tài khoản giám đốc, để số dựng sẵn không xuất
            hiện như cảnh báo thật trong ca trực. Bất thường quan sát được bằng mắt thì báo
            qua <span className="font-bold">Báo cáo hiện trường</span> hoặc{" "}
            <span className="font-bold">Sự cố &amp; điều phối</span>.
          </p>
        ) : visibleEvents.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[#f4f7f5] p-4 text-sm leading-6 text-[#5f7068]">
            Đang chờ kịch bản. Sự kiện đầu tiên xuất hiện sau khoảng{" "}
            {Math.round((script[0]?.revealAfterMs ?? 0) / 1000)} giây kể từ khi mở màn hình.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[#e6ebe8]">
            {visibleEvents.map((event) => (
              <div key={event.id} className="grid grid-cols-[auto_1fr] gap-3 py-3 text-sm">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.tone === "alert" ? "bg-[#c17a35]" : "bg-[#398064]"}`}
                />
                <div>
                  <p className="font-black text-[#34483f]">{event.headline}</p>
                  <p className="mt-1 text-xs leading-5 text-[#7a8781]">{event.detail}</p>
                  <p className="mt-1.5 text-[11px] font-bold text-[#9aa39e]">
                    {event.cameraName} · kịch bản, không tạo hồ sơ sự cố
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120] grid place-items-end bg-[#06130f]/78 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
              <button
                type="button"
                aria-label="Đóng camera"
                onClick={() => setSelected(null)}
                className="absolute inset-0"
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-label={`Camera ${selected.zone}`}
                className="relative z-10 max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-[#eef2ef] shadow-2xl sm:max-w-5xl sm:rounded-3xl"
              >
                <div className="flex items-center justify-between gap-4 bg-[#183f34] px-5 py-4 text-white">
                  <div>
                    <p className="text-xs text-white/55">
                      {selected.name} · {site.shortName}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{selected.zone}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Đóng"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="grid gap-0 lg:grid-cols-[1.45fr_0.55fr]">
                  <div
                    ref={viewerRef}
                    className="relative aspect-video min-h-60 overflow-hidden bg-[#0c1814]"
                  >
                    {selected.status !== "offline" ? (
                      <Image
                        src={site.image}
                        alt={`Khung hình lớn ${selected.zone}`}
                        fill
                        sizes="100vw"
                        priority
                        className="object-cover opacity-85"
                        style={{ objectPosition: selected.position }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-white/45">
                        Camera đang mất tín hiệu
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35),transparent_35%,rgba(0,0,0,.45))]" />
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/55 px-3 py-2 text-xs font-black text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#65dda3]" />
                      MÔ PHỎNG · {now?.toLocaleTimeString("vi-VN") ?? "Đang đồng bộ"}
                    </div>
                    {selected.status !== "offline" ? (
                      <div className="absolute bottom-[18%] left-[23%] h-20 w-16 rounded border-2 border-[#83e7b5]">
                        <span className="absolute -top-6 left-0 bg-[#83e7b5] px-1.5 py-0.5 text-[9px] font-black text-[#11362a]">
                          KHUNG DỰNG SẴN
                        </span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={enterFullscreen}
                      className="absolute bottom-4 right-4 rounded-lg bg-black/55 px-3 py-2 text-xs font-black text-white"
                    >
                      Toàn màn hình
                    </button>
                  </div>
                  <aside className="p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#477565]">
                      Mô hình khu vực
                    </p>
                    {selected.status !== "offline" ? (
                      <dl className="mt-4 space-y-3 rounded-xl bg-white p-4 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[#7a8781]">Sức chứa thiết kế</dt>
                          <dd className="font-black text-[#20342c]">
                            {selected.designCapacity} người
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[#7a8781]">Mô phỏng đang có mặt</dt>
                          <dd className="font-black text-[#20342c]">
                            {selected.simulatedPeople} người
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[#7a8781]">Hệ số tải</dt>
                          <dd className="font-black text-[#20342c]">
                            {percent(selected.loadRatio)}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                    <div className="mt-4 rounded-xl border border-[#efd4a8] bg-[#fff9ed] p-4 text-sm leading-6 text-[#7a5a1d]">
                      <p className="font-black">Đây là mô hình, không phải số đo</p>
                      <p className="mt-1">
                        Sức chứa thiết kế là ước lượng vận hành, cần khách xác nhận trước
                        khi vận hành thật. Camera chưa nối cảm biến đếm người, nên nút tạo
                        sự cố từ camera vẫn tắt — số mô phỏng không được phép trở thành hồ
                        sơ sự cố thật.
                      </p>
                    </div>
                    <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-[#5f7068]">
                      Phát hiện bất thường qua hình ảnh trực tiếp thì vẫn báo qua{" "}
                      <span className="font-bold">Báo cáo hiện trường</span> hoặc{" "}
                      <span className="font-bold">Sự cố &amp; điều phối</span> như bình
                      thường.
                    </p>
                  </aside>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
