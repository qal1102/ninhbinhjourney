"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ErpModuleId, ErpSite } from "@/domain/erp";
import type {
  WorkdayAuditEvent,
  WorkdayEvidence,
  WorkdayLocationEvent,
  WorkdayRecord,
  WorkdayStatus,
} from "@/domain/erp-workday";
import {
  listWorkdayTaskTemplates,
  type WorkdayTaskTemplate,
} from "@/domain/erp-workday-catalog";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import {
  assignWorkdayAction,
  checkInWorkdayAction,
  recordActiveWorkdayLocationAction,
  reviewWorkdayAction,
  submitWorkdayAction,
  updateWorkdayProgressAction,
} from "@/app/erp/workday-actions";

export type WorkdayEmployeeOption = {
  id: string;
  name: string;
  jobTitle: string;
  siteIds: readonly string[];
  moduleIdsBySite: Partial<Record<string, readonly ErpModuleId[]>>;
  station: string;
  shiftLabel: string;
};

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  initialRecords: readonly WorkdayRecord[];
  employees?: readonly WorkdayEmployeeOption[];
};

const statusLabels: Record<WorkdayStatus, string> = {
  assigned: "Chờ vào ca",
  "checked-in": "Đã vào ca",
  "in-progress": "Đang thực hiện",
  submitted: "Chờ quản lý duyệt",
  "manager-returned": "Cần bổ sung",
  approved: "Đã hoàn thành",
};

const statusClasses: Record<WorkdayStatus, string> = {
  assigned: "bg-[#eef3f0] text-[#52675d]",
  "checked-in": "bg-[#e1edf4] text-[#315f79]",
  "in-progress": "bg-[#e1edf4] text-[#315f79]",
  submitted: "bg-[#fff0ce] text-[#77531c]",
  "manager-returned": "bg-[#ffe5df] text-[#934336]",
  approved: "bg-[#dff1e8] text-[#246249]",
};

const steps: { status: WorkdayStatus; label: string }[] = [
  { status: "assigned", label: "Nhận việc" },
  { status: "checked-in", label: "Vào ca" },
  { status: "in-progress", label: "Trong ca" },
  { status: "submitted", label: "Bàn giao" },
  { status: "approved", label: "Xác nhận" },
];

function positionNow(maximumAge = 0) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Thiết bị không hỗ trợ định vị."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge,
      timeout: 15_000,
    });
  });
}

function positionError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = Number((error as { code?: number }).code);
    if (code === 1) {
      return "Bạn cần cho phép vị trí để vào ca và xác thực ảnh hiện trường.";
    }
    if (code === 3) {
      return "Chưa lấy được GPS. Hãy ra nơi thoáng và thử lại.";
    }
  }
  return error instanceof Error ? error.message : "Không đọc được vị trí.";
}

function formatTime(value: string | null) {
  if (!value) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function freshness(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return `${seconds} giây trước`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} phút trước`;
  return formatTime(value);
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${Math.round(value / 1_024)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

const auditActionLabels: Record<WorkdayAuditEvent["action"], string> = {
  "manager.assign": "Quản lý giao việc",
  "employee.check-in": "Nhân viên vào ca",
  "employee.progress": "Nhân viên cập nhật",
  "employee.submit": "Nhân viên bàn giao",
  "manager.review": "Quản lý kiểm tra",
};

function EvidenceReview({ evidence }: { evidence: readonly WorkdayEvidence[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {evidence.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-xl border border-[#dbe3de] bg-white"
        >
          {item.previewUrl ? (
            <a
              href={item.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="block bg-[#edf2ef]"
              aria-label={`Mở ảnh ${item.fileName}`}
            >
              {/* Signed private-storage URLs are short lived and cannot use a fixed image host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`Bằng chứng ${item.fileName}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-video w-full object-cover"
              />
            </a>
          ) : (
            <div className="grid aspect-video place-items-center bg-[#edf2ef] px-4 text-center text-xs font-bold text-[#687970]">
              Chưa có bản xem trước trong phiên này
            </div>
          )}
          <div className="space-y-2 p-3 text-xs leading-5 text-[#5d6d65]">
            <p className="break-all font-black text-[#30483d]">
              {item.fileName}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt>Tệp</dt>
              <dd>
                {item.mimeType} · {formatBytes(item.sizeBytes)}
              </dd>
              <dt>GPS ghi nhận</dt>
              <dd>{formatTime(item.capturedAt)}</dd>
              <dt>Lưu hệ thống</dt>
              <dd>{formatTime(item.uploadedAt)}</dd>
              <dt>Khoảng cách</dt>
              <dd>
                {item.distanceMeters.toLocaleString("vi-VN")} m từ tâm vùng
              </dd>
              <dt>Độ chính xác</dt>
              <dd>
                {item.accuracy === null
                  ? "Không có"
                  : `${Math.round(item.accuracy)} m`}
              </dd>
            </dl>
            <p className="rounded-lg bg-[#edf6f1] p-2 text-[#315f4d]">
              GPS của thiết bị được ghi nhận trong vùng cơ sở khi ảnh được tải
              lên. Dữ liệu này không tự xác minh nội dung hoặc nơi ảnh thực sự
              được chụp.
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function WorkdayAuditTrail({
  auditTrail,
}: {
  auditTrail: readonly WorkdayAuditEvent[];
}) {
  return (
    <ol className="space-y-2">
      {auditTrail.map((event) => (
        <li
          key={event.id}
          className="grid gap-1 rounded-lg border border-[#e0e6e2] bg-white p-3 text-xs sm:grid-cols-[9rem_1fr]"
        >
          <div>
            <p className="font-black text-[#345848]">
              {auditActionLabels[event.action]}
            </p>
            <p className="mt-1 text-[#77837d]">{formatTime(event.at)}</p>
          </div>
          <div>
            <p className="font-bold text-[#43564e]">{event.actor.name}</p>
            <p className="mt-1 leading-5 text-[#69776f]">{event.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function activeStep(record: WorkdayRecord) {
  if (record.status === "manager-returned") return 3;
  const index = steps.findIndex((step) => step.status === record.status);
  return index < 0 ? 0 : index;
}

function WorkdaySteps({ record }: { record: WorkdayRecord }) {
  const current = activeStep(record);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Tiến trình công việc">
      {steps.map((step, index) => (
        <li key={step.status} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${
              index <= current ? "bg-[#2f755d]" : "bg-[#e3e9e5]"
            }`}
          />
          <p
            className={`mt-2 truncate text-[10px] font-bold sm:text-xs ${
              index <= current ? "text-[#315e4d]" : "text-[#8b9691]"
            }`}
          >
            {step.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function LocationMapDialog({
  location,
  employeeName,
  site,
  onClose,
}: {
  location: WorkdayLocationEvent;
  employeeName: string;
  site: ErpSite;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  const eastMeters =
    (location.longitude - site.coordinates.longitude) *
    111_320 *
    Math.cos((site.coordinates.latitude * Math.PI) / 180);
  const northMeters =
    (location.latitude - site.coordinates.latitude) * 110_540;
  const vectorLength = Math.hypot(eastMeters, northMeters);
  const markerRadius =
    Math.min(vectorLength / site.geofenceRadiusMeters, 1.45) * 62;
  const markerX =
    110 + (vectorLength > 0 ? (eastMeters / vectorLength) * markerRadius : 0);
  const markerY =
    110 - (vectorLength > 0 ? (northMeters / vectorLength) * markerRadius : 0);
  return (
    <div
      className="fixed inset-0 z-[1200] grid place-items-center bg-[#102b23]/70 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Vị trí của ${employeeName}`}
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e7e3] p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#4b7666]">
              Vị trí cập nhật gần nhất
            </p>
            <h3 className="mt-1 text-xl font-black text-[#21372e]">
              {employeeName} · {site.shortName}
            </h3>
            <p className="mt-1 text-sm text-[#6d7b74]">
              {freshness(location.recordedAt)} · cách tâm khu vực{" "}
              {location.distanceMeters.toLocaleString("vi-VN")} m
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef3f0] text-xl font-black text-[#29483b]"
            aria-label="Đóng sơ đồ vị trí"
          >
            ×
          </button>
        </div>
        <div className="grid gap-4 bg-[#f3f7f5] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:p-5">
          <div className="grid min-h-72 place-items-center rounded-xl border border-[#d9e2dd] bg-white p-3">
            <svg
              viewBox="0 0 220 220"
              role="img"
              aria-label={`Sơ đồ tương đối vị trí của ${employeeName} trong vùng ${site.shortName}`}
              className="h-full max-h-80 w-full"
            >
              <circle cx="110" cy="110" r="64" fill="#e5f1eb" stroke="#5b8b76" strokeWidth="2" strokeDasharray="6 5" />
              <circle cx="110" cy="110" r="5" fill="#244d3d" />
              <text x="110" y="130" textAnchor="middle" fontSize="10" fill="#536a60">
                Tâm vùng cơ sở
              </text>
              <line x1="110" y1="110" x2={markerX} y2={markerY} stroke="#b2702c" strokeWidth="2" />
              <circle
                cx={markerX}
                cy={markerY}
                r="8"
                fill={location.insideGeofence ? "#2f8a65" : "#b14839"}
                stroke="white"
                strokeWidth="3"
              />
            </svg>
          </div>
          <div className="rounded-xl border border-[#d9e2dd] bg-white p-4 text-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#5b7569]">
              Dữ liệu lưu trong ERP
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs leading-5 text-[#5e6f66]">
              <dt>Vĩ độ</dt>
              <dd className="font-bold text-[#30483d]">
                {location.latitude.toFixed(6)}
              </dd>
              <dt>Kinh độ</dt>
              <dd className="font-bold text-[#30483d]">
                {location.longitude.toFixed(6)}
              </dd>
              <dt>Thời điểm</dt>
              <dd>{formatTime(location.recordedAt)}</dd>
              <dt>Độ chính xác</dt>
              <dd>
                {location.accuracy === null
                  ? "Không có"
                  : `${Math.round(location.accuracy)} m`}
              </dd>
              <dt>Bán kính vùng</dt>
              <dd>{site.geofenceRadiusMeters.toLocaleString("vi-VN")} m</dd>
            </dl>
            <p className="mt-4 text-xs leading-5 text-[#748079]">
              Sơ đồ chỉ thể hiện hướng và khoảng cách tương đối; không gửi tọa
              độ nhân viên sang dịch vụ bản đồ bên ngoài.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm sm:p-5">
          <p
            className={
              location.insideGeofence
                ? "font-bold text-[#28674f]"
                : "font-black text-[#9a4033]"
            }
          >
            {location.insideGeofence
              ? "Đang trong vùng làm việc"
              : "Đang ngoài vùng làm việc"}
          </p>
          <p className="text-xs text-[#6f7d76]">
            Cách tâm {location.distanceMeters.toLocaleString("vi-VN")} m
          </p>
        </div>
      </section>
    </div>
  );
}

function EmployeeWorkday({
  record,
  site,
  onRecord,
}: {
  record: WorkdayRecord;
  site: ErpSite;
  onRecord: (record: WorkdayRecord) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [gpsState, setGpsState] = useState<
    "off" | "starting" | "active" | "error"
  >("off");
  const lastSentAt = useRef(0);
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const active = ["checked-in", "in-progress", "manager-returned"].includes(
    record.status,
  );

  useEffect(() => {
    if (!active || !navigator.geolocation) {
      return;
    }
    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        latestPosition.current = position;
        const now = Date.now();
        if (now - lastSentAt.current < 30_000) return;
        lastSentAt.current = now;
        setGpsState("starting");
        const recordedAt = new Date(position.timestamp).toISOString();
        void recordActiveWorkdayLocationAction({
          workdayId: record.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          recordedAt,
          idempotencyKey: `gps:${record.id}:${Math.floor(now / 30_000)}`,
        }).then((result) => {
          if (!result.success) {
            setGpsState("error");
            setError(result.message);
            return;
          }
          if (result.location && !result.location.insideGeofence) {
            setGpsState("error");
            setError(
              "Thiết bị đang ở ngoài vùng làm việc. Quản lý đã nhìn thấy lần cập nhật này.",
            );
            return;
          }
          setGpsState("active");
          setError("");
        }).catch((syncError: unknown) => {
          setGpsState("error");
          setError(
            syncError instanceof Error
              ? syncError.message
              : "Không thể đồng bộ vị trí với máy chủ.",
          );
        });
      },
      (watchError) => {
        setGpsState("error");
        setError(positionError(watchError));
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [active, record.id]);

  async function checkIn() {
    setError("");
    setMessage("");
    setGpsState("starting");
    try {
      const position = await positionNow();
      latestPosition.current = position;
      startTransition(async () => {
        try {
          const result = await checkInWorkdayAction({
            workdayId: record.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            idempotencyKey: `checkin:${record.id}:${crypto.randomUUID()}`,
          });
          if (!result.success || !result.record) {
            setGpsState("error");
            setError(result.message);
            return;
          }
          setGpsState("active");
          setMessage(result.message);
          onRecord(result.record);
        } catch (syncError) {
          setGpsState("error");
          setError(
            syncError instanceof Error
              ? syncError.message
              : "Không thể đồng bộ lượt vào ca với máy chủ.",
          );
        }
      });
    } catch (positionFailure) {
      setGpsState("error");
      setError(positionError(positionFailure));
    }
  }

  async function submitWithGps(
    form: HTMLFormElement,
    action: (formData: FormData) => Promise<
      | { success: true; message: string; record?: WorkdayRecord }
      | { success: false; message: string }
    >,
  ) {
    setError("");
    setMessage("Đang xác thực vị trí và tải ảnh…");
    const formData = new FormData(form);
    const evidence = formData.get("evidence");
    if (evidence instanceof File && evidence.size > 0) {
      try {
        const cached = latestPosition.current;
        const position =
          cached && Date.now() - cached.timestamp < 60_000
            ? cached
            : await positionNow(30_000);
        latestPosition.current = position;
        formData.set("capturedAt", new Date().toISOString());
        formData.set("latitude", String(position.coords.latitude));
        formData.set("longitude", String(position.coords.longitude));
        formData.set("accuracy", String(position.coords.accuracy));
      } catch (positionFailure) {
        setError(positionError(positionFailure));
        return;
      }
    }
    formData.set("idempotencyKey", crypto.randomUUID());
    startTransition(async () => {
      const result = await action(formData);
      if (!result.success || !result.record) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      form.reset();
      onRecord(result.record);
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
      <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
              {record.code} · {site.shortName}
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              {record.taskTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68776f]">
              {record.station} · {record.shiftLabel}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-black ${statusClasses[record.status]}`}
          >
            {statusLabels[record.status]}
          </span>
        </div>
        <div className="mt-5">
          <WorkdaySteps record={record} />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f4f7f5] p-4">
            <p className="text-xs text-[#728078]">Quản lý giao việc</p>
            <p className="mt-1 font-black text-[#30443b]">{record.manager.name}</p>
          </div>
          <div className="rounded-xl bg-[#f4f7f5] p-4">
            <p className="text-xs text-[#728078]">Hạn hoàn thành</p>
            <p className="mt-1 font-black text-[#30443b]">
              {formatTime(record.dueAt)}
            </p>
          </div>
          <div className="rounded-xl bg-[#f4f7f5] p-4">
            <p className="text-xs text-[#728078]">Tiến độ đã báo</p>
            <p className="mt-1 font-black text-[#30443b]">
              {record.progressPercent}%
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#dde5e0] p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-[#5b7569]">
            Yêu cầu hoàn thành
          </p>
          <p className="mt-2 text-sm leading-6 text-[#43564e]">
            {record.instructions}
          </p>
        </div>

        {active ? (
          <div
            className={`rounded-xl border p-4 ${
              gpsState === "error"
                ? "border-[#efc9c1] bg-[#fff3f0]"
                : "border-[#c9ded4] bg-[#eff7f3]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  gpsState === "active"
                    ? "animate-pulse bg-[#2f936d]"
                    : gpsState === "error"
                      ? "bg-[#b34b3c]"
                      : "bg-[#d49a35]"
                }`}
              />
              <p className="text-sm font-black text-[#315346]">
                {gpsState === "active"
                  ? "GPS trong ca đang bật"
                  : gpsState === "error"
                    ? "GPS đang gián đoạn"
                    : "Đang xác định vị trí"}
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#687970]">
              Vị trí được cập nhật khi ca đang mở hoặc phiếu cần bổ sung và
              web/PWA đang hoạt động. Hệ thống dừng cập nhật khi phiếu chờ duyệt
              hoặc đã được duyệt.
            </p>
          </div>
        ) : null}

        {record.status === "assigned" ? (
          <button
            type="button"
            onClick={checkIn}
            disabled={pending}
            className="w-full rounded-xl bg-[#1f604c] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? "Đang kiểm tra vị trí…" : "Cho phép GPS và vào ca"}
          </button>
        ) : null}

        {["checked-in", "in-progress"].includes(record.status) ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              className="rounded-xl border border-[#dde5e0] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitWithGps(
                  event.currentTarget,
                  updateWorkdayProgressAction,
                );
              }}
            >
              <h3 className="font-black text-[#263d33]">Cập nhật trong ca</h3>
              <input type="hidden" name="workdayId" value={record.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={record.version}
              />
              <label className="mt-4 block text-xs font-bold text-[#65756d]">
                Tiến độ
                <select
                  name="progressPercent"
                  defaultValue={Math.max(25, record.progressPercent)}
                  className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm text-[#263d33]"
                >
                  {[25, 50, 75, 90]
                    .filter((value) => value >= record.progressPercent)
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-[#65756d]">
                Việc đã làm / vướng mắc
                <textarea
                  name="note"
                  required
                  minLength={4}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] px-3 py-2.5 text-sm text-[#263d33]"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[#65756d]">
                Ảnh hiện trường (nếu cần)
                <input
                  type="file"
                  name="evidence"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="mt-1.5 block w-full text-xs text-[#596b62] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e9f1ed] file:px-3 file:py-2 file:font-bold file:text-[#285e49]"
                />
              </label>
              <button
                disabled={pending}
                className="mt-4 w-full rounded-lg bg-[#e6f0eb] px-4 py-3 text-sm font-black text-[#285e49] disabled:opacity-60"
              >
                Lưu cập nhật
              </button>
            </form>

            <form
              className="rounded-xl border border-[#cbded5] bg-[#f4faf7] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitWithGps(event.currentTarget, submitWorkdayAction);
              }}
            >
              <h3 className="font-black text-[#263d33]">Bàn giao cuối ca</h3>
              <p className="mt-1 text-xs leading-5 text-[#687970]">
                Nêu kết quả và tải ảnh hiện trường. Hệ thống sẽ ghi nhận GPS của
                thiết bị tại thời điểm tải ảnh.
              </p>
              <input type="hidden" name="workdayId" value={record.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={record.version}
              />
              <label className="mt-4 block text-xs font-bold text-[#65756d]">
                Kết quả bàn giao
                <textarea
                  name="note"
                  required
                  minLength={4}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm text-[#263d33]"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[#65756d]">
                Ảnh hoàn thành {record.evidenceRequired ? "(bắt buộc)" : ""}
                <input
                  type="file"
                  name="evidence"
                  required={record.evidenceRequired}
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="mt-1.5 block w-full text-xs text-[#596b62] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-bold file:text-[#285e49]"
                />
              </label>
              <button
                disabled={pending}
                className="mt-4 w-full rounded-lg bg-[#1f604c] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                Bàn giao và kết thúc ca
              </button>
            </form>
          </div>
        ) : null}

        {record.status === "manager-returned" ? (
          <form
            className="rounded-xl border border-[#edc7be] bg-[#fff6f3] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitWithGps(event.currentTarget, submitWorkdayAction);
            }}
          >
            <h3 className="font-black text-[#843d31]">Quản lý yêu cầu bổ sung</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f4a43]">
              {record.managerNote}
            </p>
            <input type="hidden" name="workdayId" value={record.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={record.version}
            />
            <label className="mt-4 block text-xs font-bold text-[#6f4a43]">
              Nội dung đã bổ sung
              <textarea
                name="note"
                required
                minLength={4}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[#dfbcb4] bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-bold text-[#6f4a43]">
              Ảnh bổ sung mới{" "}
              {record.evidenceRequired ? "kèm GPS (bắt buộc)" : "(nếu cần)"}
              <input
                type="file"
                name="evidence"
                required={record.evidenceRequired}
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="mt-1.5 block w-full text-xs"
              />
            </label>
            <button
              disabled={pending}
              className="mt-4 rounded-lg bg-[#8e493c] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              Gửi lại cùng phiếu này
            </button>
          </form>
        ) : null}

        {record.status === "submitted" ? (
          <div className="rounded-xl bg-[#fff7e5] p-4 text-sm leading-6 text-[#755627]">
            Đã bàn giao lúc {formatTime(record.checkOutAt)}. Quản lý sẽ kiểm tra
            ảnh, tiến độ và nhật ký trước khi xác nhận.
          </div>
        ) : null}

        {record.status === "approved" ? (
          <div className="rounded-xl bg-[#edf7f2] p-4 text-sm leading-6 text-[#2b624d]">
            <strong>Đã được {record.manager.name} xác nhận.</strong>{" "}
            {record.managerNote}
          </div>
        ) : null}

        {record.evidence.length > 0 ? (
          <details className="rounded-xl border border-[#e0e6e2] p-4">
            <summary className="cursor-pointer text-sm font-black text-[#315346]">
              {record.evidence.length} ảnh có GPS thiết bị trong vùng lúc tải
            </summary>
            <ul className="mt-3 space-y-2 text-xs text-[#66766e]">
              {record.evidence.map((item) => (
                <li key={item.id}>
                  {item.fileName} · {formatTime(item.capturedAt)} · cách tâm khu
                  vực {item.distanceMeters.toLocaleString("vi-VN")} m
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {message ? (
          <p role="status" className="rounded-lg bg-[#eaf5ef] p-3 text-sm font-bold text-[#276249]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg bg-[#fff0ed] p-3 text-sm font-bold text-[#913f32]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ManagerWorkdays({
  sites,
  records,
  employees,
  onRecord,
}: {
  sites: readonly ErpSite[];
  records: readonly WorkdayRecord[];
  employees: readonly WorkdayEmployeeOption[];
  onRecord: (record: WorkdayRecord) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mapRecordId, setMapRecordId] = useState<string | null>(null);
  const site = sites.find((item) => item.id === siteId) ?? sites[0];
  const siteRecords = records.filter((record) => record.siteId === site?.id);
  const mapRecord = records.find((record) => record.id === mapRecordId) ?? null;
  const siteEmployees = employees.filter((employee) =>
    employee.siteIds.includes(site?.id ?? ""),
  );
  const templates = useMemo(
    () =>
      site
        ? listWorkdayTaskTemplates(site.id).filter((template) =>
            siteEmployees.some((employee) =>
              employee.moduleIdsBySite[site.id]?.includes(template.moduleId),
            ),
          )
        : [],
    [site, siteEmployees],
  );
  const [employeeId, setEmployeeId] = useState("");
  const allowedTemplates = useMemo(() => {
    const employee = siteEmployees.find((item) => item.id === employeeId);
    if (!employee || !site) return templates;
    const modules = employee.moduleIdsBySite[site.id] ?? [];
    return templates.filter((template) => modules.includes(template.moduleId));
  }, [employeeId, site, siteEmployees, templates]);

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 20_000);
    return () => window.clearInterval(interval);
  }, [router]);

  function handleForm(
    form: HTMLFormElement,
    action: (data: FormData) => Promise<
      | { success: true; message: string; record?: WorkdayRecord }
      | { success: false; message: string }
    >,
  ) {
    setError("");
    setMessage("");
    const data = new FormData(form);
    data.set("idempotencyKey", crypto.randomUUID());
    startTransition(async () => {
      const result = await action(data);
      if (!result.success || !result.record) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      onRecord(result.record);
      form.reset();
    });
  }

  if (!site) return null;

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#e4e9e6] p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
              Điều phối nhân sự trong ca
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Giao việc và theo dõi hiện trường
            </h2>
          </div>
          {sites.length > 1 ? (
            <label className="text-xs font-bold text-[#64746c]">
              Cơ sở đang quản lý
              <select
                value={site.id}
                onChange={(event) => {
                  setSiteId(event.target.value);
                  setEmployeeId("");
                }}
                className="mt-1 block rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm font-black text-[#294338]"
              >
                {sites.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.shortName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <form
          className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleForm(event.currentTarget, assignWorkdayAction);
          }}
        >
          <input type="hidden" name="siteId" value={site.id} />
          <label className="text-xs font-bold text-[#65756d]">
            Nhân viên
            <select
              name="employeeId"
              required
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm text-[#263d33]"
            >
              <option value="">Chọn người nhận việc</option>
              {siteEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.jobTitle}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[#65756d] sm:col-span-1 xl:col-span-2">
            Công việc đúng với cơ sở
            <select
              name="templateId"
              required
              className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm text-[#263d33]"
            >
              <option value="">Chọn công việc</option>
              {allowedTemplates.map((template: WorkdayTaskTemplate) => (
                <option key={template.id} value={template.id}>
                  {template.title} · {template.station}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[#65756d]">
            Hạn hoàn thành
            <input
              type="time"
              name="dueTime"
              required
              defaultValue="17:00"
              className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-[#65756d]">
            Mức ưu tiên
            <select
              name="priority"
              defaultValue="normal"
              className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm"
            >
              <option value="normal">Bình thường</option>
              <option value="high">Cần ưu tiên</option>
              <option value="critical">Khẩn cấp</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[#65756d] sm:col-span-2 xl:col-span-4">
            Lưu ý riêng cho nhân viên
            <input
              name="managerNote"
              maxLength={500}
              placeholder="Ví dụ: kiểm tra thêm làn đoàn trước 10:30"
              className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] px-3 py-2.5 text-sm"
            />
          </label>
          <button
            disabled={pending}
            className="self-end rounded-lg bg-[#1f604c] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            Giao việc
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="border-b border-[#e4e9e6] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#477565]">
                {site.shortName}
              </p>
              <h2 className="mt-2 text-xl font-black text-[#20342c]">
                Nhân viên và việc đang phụ trách
              </h2>
            </div>
            <span className="rounded-full bg-[#eef3f0] px-3 py-1 text-xs font-black text-[#52675d]">
              {siteRecords.length} phiếu
            </span>
          </div>
        </div>
        <div className="divide-y divide-[#e7ece9]">
          {siteRecords.map((record) => (
            <article key={record.id} className="p-4 sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#263d33]">
                      {record.employee.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusClasses[record.status]}`}
                    >
                      {statusLabels[record.status]}
                    </span>
                    {record.latestLocation &&
                    !record.latestLocation.insideGeofence ? (
                      <span className="rounded-full bg-[#ffe5df] px-2.5 py-1 text-[11px] font-black text-[#934336]">
                        Ngoài vùng làm việc
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#43564e]">
                    {record.taskTitle}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#75817b]">
                    {record.station} · tiến độ {record.progressPercent}% · hạn{" "}
                    {formatTime(record.dueAt)}
                  </p>
                  {record.latestLocation ? (
                    <p className="mt-2 text-xs text-[#52675d]">
                      GPS {freshness(record.latestLocation.recordedAt)} · cách
                      tâm khu vực{" "}
                      {record.latestLocation.distanceMeters.toLocaleString(
                        "vi-VN",
                      )}{" "}
                      m
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[#8a9690]">
                      Chưa có vị trí — nhân viên chưa vào ca.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.latestLocation ? (
                    <button
                      type="button"
                      onClick={() => setMapRecordId(record.id)}
                      className="rounded-lg border border-[#cbd9d2] bg-white px-3 py-2 text-xs font-black text-[#2d624e]"
                    >
                      Xem vị trí
                    </button>
                  ) : null}
                </div>
              </div>

              {record.status === "submitted" ? (
                <div className="mt-4 space-y-4 rounded-xl bg-[#f6f8f7] p-4">
                  <section aria-labelledby={`result-${record.id}`}>
                    <h3
                      id={`result-${record.id}`}
                      className="text-xs font-black uppercase tracking-[0.12em] text-[#5b7569]"
                    >
                      Kết quả nhân viên bàn giao
                    </h3>
                    <p className="mt-2 rounded-lg border border-[#dce4df] bg-white p-3 text-sm leading-6 text-[#344b40]">
                      {record.resultNote || "Nhân viên chưa ghi nội dung kết quả."}
                    </p>
                  </section>

                  <section aria-labelledby={`evidence-${record.id}`}>
                    <h3
                      id={`evidence-${record.id}`}
                      className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#5b7569]"
                    >
                      Bằng chứng và dữ liệu GPS khi tải
                    </h3>
                    {record.evidence.length > 0 ? (
                      <EvidenceReview evidence={record.evidence} />
                    ) : (
                      <p className="rounded-lg border border-[#e3d8c2] bg-[#fff8e9] p-3 text-xs font-bold text-[#765b2d]">
                        Phiếu chưa có ảnh bằng chứng.
                      </p>
                    )}
                  </section>

                  <section aria-labelledby={`audit-${record.id}`}>
                    <h3
                      id={`audit-${record.id}`}
                      className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#5b7569]"
                    >
                      Nhật ký xử lý
                    </h3>
                    <WorkdayAuditTrail auditTrail={record.auditTrail} />
                  </section>

                  <form
                    className="grid gap-3 border-t border-[#dce4df] pt-4 sm:grid-cols-[1fr_auto_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const submitter = (event.nativeEvent as SubmitEvent)
                        .submitter as HTMLButtonElement | null;
                      if (submitter?.value) {
                        const decision =
                          event.currentTarget.querySelector<HTMLInputElement>(
                            'input[type="hidden"][name="decision"]',
                          );
                        if (decision) decision.value = submitter.value;
                      }
                      handleForm(event.currentTarget, reviewWorkdayAction);
                    }}
                  >
                    <input type="hidden" name="workdayId" value={record.id} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={record.version}
                    />
                    <input type="hidden" name="decision" value="" />
                    <label className="text-xs font-bold text-[#65756d]">
                      Ý kiến kiểm tra
                      <input
                        name="note"
                        required
                        minLength={2}
                        placeholder="Nêu kết quả hoặc phần cần bổ sung"
                        className="mt-1.5 w-full rounded-lg border border-[#d4ddd8] bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <button
                      name="decision"
                      value="return"
                      disabled={pending}
                      className="self-end rounded-lg bg-[#fff0ed] px-4 py-3 text-xs font-black text-[#914135]"
                    >
                      Yêu cầu bổ sung
                    </button>
                    <button
                      name="decision"
                      value="approve"
                      disabled={pending}
                      className="self-end rounded-lg bg-[#1f604c] px-4 py-3 text-xs font-black text-white"
                    >
                      Xác nhận hoàn thành
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
          {siteRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#748079]">
              Chưa có phiếu công việc cho cơ sở này hôm nay.
            </p>
          ) : null}
        </div>
      </div>

      {message ? (
        <p role="status" className="rounded-lg bg-[#eaf5ef] p-3 text-sm font-bold text-[#276249]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-[#fff0ed] p-3 text-sm font-bold text-[#913f32]">
          {error}
        </p>
      ) : null}
      {mapRecord?.latestLocation ? (
        <LocationMapDialog
          location={mapRecord.latestLocation}
          employeeName={mapRecord.employee.name}
          site={sites.find((item) => item.id === mapRecord.siteId) ?? site}
          onClose={() => setMapRecordId(null)}
        />
      ) : null}
    </section>
  );
}

export function WorkdayLifecycle({
  user,
  sites,
  initialRecords,
  employees = [],
}: Props) {
  const [optimisticRecords, setOptimisticRecords] = useState<
    Record<string, WorkdayRecord>
  >({});
  const records = useMemo(() => {
    const incomingIds = new Set(initialRecords.map((record) => record.id));
    const merged = initialRecords.map((incoming) => {
      const optimistic = optimisticRecords[incoming.id];
      if (!optimistic) return incoming;
      if (incoming.version > optimistic.version) return incoming;
      if (incoming.version < optimistic.version) return optimistic;
      const incomingLocation = incoming.latestLocation?.recordedAt ?? "";
      const optimisticLocation = optimistic.latestLocation?.recordedAt ?? "";
      return incomingLocation >= optimisticLocation ? incoming : optimistic;
    });
    return [
      ...merged,
      ...Object.values(optimisticRecords).filter(
        (record) => !incomingIds.has(record.id),
      ),
    ];
  }, [initialRecords, optimisticRecords]);
  const onRecord = (record: WorkdayRecord) =>
    setOptimisticRecords((current) => ({ ...current, [record.id]: record }));

  if (user.role === "manager") {
    return (
      <ManagerWorkdays
        sites={sites}
        records={records}
        employees={employees}
        onRecord={onRecord}
      />
    );
  }
  if (user.role !== "employee") return null;
  const record = records.find((item) => item.employee.id === user.id);
  const site = sites.find((item) => item.id === record?.siteId);
  if (!record || !site) {
    return (
      <section className="rounded-2xl border border-dashed border-[#bcc9c2] bg-white p-8 text-center">
        <h2 className="text-xl font-black text-[#284036]">
          Chưa có việc được giao hôm nay
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d7a74]">
          Khi quản lý giao việc, bạn sẽ thấy rõ nơi làm, hạn hoàn thành, yêu cầu
          chụp ảnh và nút vào ca tại đây.
        </p>
      </section>
    );
  }
  return <EmployeeWorkday record={record} site={site} onRecord={onRecord} />;
}
