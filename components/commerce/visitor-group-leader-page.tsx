"use client";

import { useEffect, useState } from "react";
import { DESTINATIONS } from "@/content/destinations";
import {
  GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES,
  deriveGroupAttendance,
  pickCurrentAttendanceSiteId,
  type GroupAttendanceResult,
} from "@/domain/erp-group-attendance";
import {
  VISITOR_GROUP_CODE_PATTERN,
  type VisitorGroupStatus,
} from "@/domain/visitor-group";

type GroupApiResponse =
  | { accepted: true; group: VisitorGroupStatus }
  | { accepted: false; error?: { code?: string; message?: string } };

function siteName(siteId: string) {
  return DESTINATIONS.find((item) => item.id === siteId)?.name.vi ?? "một điểm tham quan";
}

function formatVisitDate(value: string) {
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return value;
  return new Date(millis).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Chưa ghi tên thì gọi theo số thứ tự — đừng bịa một cái tên không ai đặt. */
function memberLabel(member: { memberIndex: number; displayName: string }) {
  const name = member.displayName.trim();
  return name.length > 0 ? name : `Người thứ ${member.memberIndex}`;
}

/**
 * Nhịp làm mới: nửa phút một lượt.
 *
 * Đủ nhanh để trưởng đoàn đứng ở cổng thấy danh sách vơi đi gần như ngay khi
 * từng người quét xong, mà vẫn thưa hơn hẳn nhịp bấm nút tải lại của một
 * người đang sốt ruột. Trang chỉ đọc, mỗi lượt là một câu truy vấn nhẹ.
 */
const LEADER_REFRESH_INTERVAL_MS = 30_000;

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "network-error" }
  | { kind: "ready"; group: VisitorGroupStatus };

/**
 * TC-19 + TC-20 — màn hình của trưởng đoàn.
 *
 * Trang này CHỈ ĐỌC. Nó không ghi thêm một dòng dữ liệu nào — con số "còn
 * bao nhiêu người chưa qua cổng" tính lại tại chỗ từ nhật ký quét
 * (`erp_gate_scan_events`) mà `erp_visitor_group_status` đã trả sẵn, qua
 * `domain/erp-group-attendance.ts`.
 */
export function VisitorGroupLeaderExperience({ groupCode }: { groupCode: string }) {
  const trimmed = groupCode.trim();
  // Mã sai định dạng thì không có gì để gọi mạng cả — biết ngay từ lúc dựng
  // state đầu tiên, không cần một lượt effect rồi setState đồng bộ cho nó.
  const validFormat = VISITOR_GROUP_CODE_PATTERN.test(trimmed);
  const [state, setState] = useState<LoadState>(validFormat ? { kind: "loading" } : { kind: "not-found" });
  // Mốc "bây giờ" phải chạy, không được đứng yên.
  //
  // Cả màn hình này sinh ra vì một cái ngưỡng mười lăm phút. Chốt giờ đúng
  // một lần lúc dựng trang thì trưởng đoàn mở lúc phút thứ hai sẽ không bao
  // giờ thấy lời nhắc, dù có đứng đó nửa tiếng — trừ khi họ tự nghĩ ra việc
  // tải lại trang, mà chẳng ai nghĩ ra cả.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!validFormat) return;
    let alive = true;
    async function load(firstRun: boolean) {
      try {
        const response = await fetch(
          `/api/customer-visitor-groups?group_code=${encodeURIComponent(trimmed)}`,
          { credentials: "same-origin" },
        );
        const payload = (await response.json().catch(() => null)) as GroupApiResponse | null;
        if (!alive) return;
        if (!response.ok || !payload?.accepted) {
          // Lượt làm mới hỏng thì GIỮ NGUYÊN danh sách đang hiện. Thay một
          // màn hình đang đúng bằng chữ "kết nối trục trặc" chỉ vì một lượt
          // gọi lỡ nhịp là lấy mất thứ trưởng đoàn đang cần nhìn ngay lúc ấy.
          if (firstRun) {
            setState({ kind: response.status === 404 ? "not-found" : "network-error" });
          }
          return;
        }
        setState({ kind: "ready", group: payload.group });
      } catch {
        if (alive && firstRun) setState({ kind: "network-error" });
      }
    }
    void load(true);
    const timer = window.setInterval(() => {
      setNow(new Date());
      void load(false);
    }, LEADER_REFRESH_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [trimmed, validFormat]);

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
          Ninh Bình Journey · Trưởng đoàn
        </p>

        {state.kind === "loading" ? (
          <p className="mt-6 text-base leading-6 text-[#4a534d]">Đang lấy thông tin đoàn, mời bạn chờ em một chút…</p>
        ) : null}

        {state.kind === "not-found" ? (
          <div className="mt-6 rounded-2xl border border-[#e0b9a8] bg-[#fdf0ea] p-5" role="alert">
            <p className="font-bold text-[#8a3b22]">Em không tìm thấy đoàn nào mang mã này</p>
            <p className="mt-2 text-sm leading-6 text-[#6c4b1f]">
              Mời bạn kiểm tra lại đường dẫn hoặc mã đoàn, hay hỏi lại người đã gửi mã cho mình ạ.
            </p>
          </div>
        ) : null}

        {state.kind === "network-error" ? (
          <div className="mt-6 rounded-2xl border border-[#e0b9a8] bg-[#fdf0ea] p-5" role="alert">
            <p className="font-bold text-[#8a3b22]">Kết nối đang trục trặc</p>
            <p className="mt-2 text-sm leading-6 text-[#6c4b1f]">
              Em chưa lấy được thông tin đoàn lúc này. Mời bạn thử tải lại trang sau ít phút ạ.
            </p>
          </div>
        ) : null}

        {state.kind === "ready" ? <LeaderGroupView group={state.group} now={now} /> : null}
      </div>
    </main>
  );
}

function LeaderGroupView({ group, now }: { group: VisitorGroupStatus; now: Date }) {
  const siteId = pickCurrentAttendanceSiteId({ members: group.members, now });
  const attendance: GroupAttendanceResult | null = siteId
    ? deriveGroupAttendance({ members: group.members, siteId, now })
    : null;

  const headline =
    !attendance || attendance.status === "not-started"
      ? {
          big: group.memberCount,
          caption: "người trong đoàn — chưa ai qua cổng nào cả",
        }
      : attendance.status === "complete"
        ? {
            big: 0,
            caption: `người còn thiếu — cả đoàn đã qua cổng ${siteName(attendance.siteId)} đủ rồi ạ`,
          }
        : {
            big: attendance.pendingCount,
            caption: `người trong đoàn chưa qua cổng ${siteName(attendance.siteId)}`,
          };

  return (
    <div>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34]">
        {group.groupLabel.trim().length > 0 ? group.groupLabel : `Đoàn của ${group.leaderName}`}
      </h1>
      <dl className="mt-4 space-y-1 text-sm text-[#4a534d]">
        <div className="flex gap-2">
          <dt className="font-bold">Mã đoàn</dt>
          <dd>
            <code className="font-mono">{group.groupCode}</code>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-bold">Ngày đi</dt>
          <dd>{formatVisitDate(group.visitDate)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-bold">Sĩ số</dt>
          <dd>{group.memberCount} người</dd>
        </div>
      </dl>

      <div className="mt-7 rounded-3xl border border-[#183f34]/20 bg-white p-6 text-center">
        <p className="text-7xl font-black tabular-nums text-[#183f34]">{headline.big}</p>
        <p className="mt-2 text-base font-bold text-[#27362f]">{headline.caption}</p>
      </div>

      {attendance && attendance.alertLevel === "attention" ? (
        <div className="mt-5 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5" role="alert">
          <p className="font-bold text-[#6c4b1f]">
            Đã hơn {attendance.minutesSinceFirstScan} phút kể từ người đầu tiên qua cổng {siteName(attendance.siteId)}
            {" "}
            mà đoàn vẫn còn {attendance.pendingCount} người chưa vào ạ.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6c4b1f]">
            Mời bạn kiểm tra lại xem có ai đang tới muộn hay đã lạc nhau ở đâu không ạ.
          </p>
        </div>
      ) : null}

      {attendance && attendance.pendingCount > 0 ? (
        <div className="mt-5 rounded-2xl border border-[#dde1db] bg-white p-5">
          <p className="font-bold text-[#27362f]">Những người chưa qua cổng {siteName(attendance.siteId)}</p>
          <ul className="mt-3 space-y-1 text-sm text-[#4a534d]">
            {attendance.pendingMembers.map((member) => (
              <li key={member.memberIndex}>{memberLabel(member)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-7 rounded-2xl border border-[#bcd6c8] bg-[#f0f7f2] p-5">
        <p className="font-bold text-[#183f34]">Mã đoàn dùng chung được, không phải lỗ hổng</p>
        <p className="mt-2 text-sm leading-6 text-[#27362f]">
          Ai bận không đi được thì cứ đưa mã của mình cho người đi thay — người cầm mã được đối xử đúng như người đó,
          cổng vẫn cho vào bình thường. Cả đoàn dùng chung một hạn mức chỗ nên không ai chiếm thêm được suất nào cả,
          bạn không cần lo bị gian lận số chỗ đâu ạ.
        </p>
      </div>

      <p className="mt-8 text-xs leading-5 text-[#6b786f]">
        Ngưỡng nhắc ở trên là {GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES} phút kể từ người đầu tiên qua cổng, tính
        trên đúng nhật ký quét của đoàn — trang này không ghi thêm dữ liệu nào cả.
      </p>
    </div>
  );
}
