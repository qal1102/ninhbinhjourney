"use client";

import { useState } from "react";

type MemberApiResponse =
  | { accepted: true; member: { memberCode: string; displayName: string; activated: boolean } }
  | { accepted: false; error?: { message?: string } };

/**
 * TC-06 — khách đoàn: nơi mã QR trên tấm thẻ của mỗi người trỏ tới.
 *
 * Đây là việc tự nguyện, không phải cửa vào cổng. Trang phải nói rõ điều đó
 * ngay từ đầu, không phải một dòng chú thích nhỏ ở cuối.
 */
export function VisitorGroupMemberExperience({ memberCode }: { memberCode: string }) {
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(nameToSend: string) {
    if (pending) return;
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/customer-group-members", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_code: memberCode, display_name: nameToSend.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as MemberApiResponse | null;
      if (!response.ok || !payload?.accepted) {
        setStatus({
          tone: "error",
          text: (payload && !payload.accepted && payload.error?.message) || "Chưa lưu được, mời bạn thử lại.",
        });
        return;
      }
      setDisplayName(payload.member.displayName);
      setStatus({
        tone: "success",
        text: payload.member.displayName
          ? `Dạ, đã ghi tên "${payload.member.displayName}" vào chuyến đi này.`
          : "Đã xoá tên khỏi mã này. Bạn vẫn vào cổng bình thường ạ.",
      });
    } catch {
      setStatus({ tone: "error", text: "Chưa lưu được, mời bạn thử lại." });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">Ninh Bình Journey · Khách đoàn</p>
        <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34]">Ghi tên bạn vào chuyến đi này</h1>

        <div className="mt-5 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
          <p className="font-bold">Không ghi tên, bạn vẫn vào cổng bình thường</p>
          <p className="mt-2 text-sm leading-6">
            Đây là chỗ để bạn ghi tên nếu muốn, không phải điều kiện để qua cổng. Bỏ trống, bạn vẫn vào các điểm tham quan như mọi khách khác trong đoàn.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(displayName);
          }}
          className="mt-7 space-y-4"
        >
          <label className="block text-sm font-bold text-[#27362f]">
            Tên của bạn (không bắt buộc)
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ví dụ: Nguyễn Thị B"
              className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
            />
          </label>

          {status ? (
            <p
              role={status.tone === "error" ? "alert" : "status"}
              className={`text-sm leading-6 ${status.tone === "error" ? "text-[#9a3b2f]" : "text-[#1f6b45]"}`}
            >
              {status.text}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="min-h-12 flex-1 rounded-full bg-[#183f34] px-6 font-extrabold text-white transition-colors hover:bg-[#122e26] disabled:opacity-50"
            >
              {pending ? "Đang lưu…" : "Lưu tên"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDisplayName("");
                void save("");
              }}
              className="min-h-12 rounded-full border border-[#bec7bf] px-6 font-bold text-[#27362f] transition-colors hover:border-[#183f34] disabled:opacity-50"
            >
              Xoá tên đã ghi
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs leading-5 text-[#6b786f]">
          Mã của bạn · <code className="font-mono">{memberCode}</code>
        </p>
      </div>
    </main>
  );
}
