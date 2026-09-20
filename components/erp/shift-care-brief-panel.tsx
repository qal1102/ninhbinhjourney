"use client";

import { useState } from "react";

import {
  CARE_NEED_LABELS,
  conChoDon,
  docGioToi,
  docLenBoDam,
  SHIFT_CARE_COPY,
  tomTatCaTruc,
  type ShiftCareGroup,
} from "@/domain/shift-care-brief";

/**
 * TC-13 mục 2–3 — bản giao ca "hôm nay ai cần để ý".
 *
 * Chỗ đứng của khối này đã đo ba lần mới ra:
 *
 *   - Đặt dưới máy quét: ở khổ 390px nó rơi xuống mốc 1838px, phải cuộn gần
 *     hai màn hình mới thấy. Một bản giao ca không ai nhìn thấy thì bằng không.
 *   - Đặt trên máy quét và mở sẵn: hai đoàn thôi đã đẩy máy quét từ 402px
 *     xuống 1340px. Người đứng cổng không được trả giá đó, và ngày đông đoàn
 *     thì giá còn đắt hơn.
 *   - Đặt trên máy quét nhưng **gập lại**: một dòng, cao 44px, nói đúng con số
 *     để người trực biết hôm nay có việc hay không. Mở ra là chuyện một cú
 *     chạm, và chỉ người cần mới phải chạm.
 *
 * Ngày không có ai tự khai — phần lớn ngày sẽ như vậy — khối này chỉ là một
 * dòng chữ, không có nút, không có khung.
 *
 * Mỗi đoàn có sẵn một câu viết trọn để đọc thẳng lên bộ đàm: người trực không
 * phải tự dịch bảng sang lời nói, và cả ca nói giống nhau.
 */
export function ShiftCareBriefPanel({ groups }: { groups: readonly ShiftCareGroup[] }) {
  const [moRong, setMoRong] = useState(false);

  if (groups.length === 0) {
    return (
      <p data-testid="shift-care-brief" className="mb-4 text-sm leading-6 text-[#5f7068]">
        <span data-testid="shift-care-brief-empty">
          <span className="font-black text-[#2f6f8f]">Ca trực: </span>
          {SHIFT_CARE_COPY.trong}
        </span>
      </p>
    );
  }

  const tomTat = tomTatCaTruc([...groups]);

  return (
    <section
      data-testid="shift-care-brief"
      className="mb-6 rounded-2xl border border-[#c9dceb] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-black text-[#1f2f2a]">
          <span className="text-[#2f6f8f]">Ca trực · {SHIFT_CARE_COPY.tieuDe}: </span>
          {tomTat.soDoan} đoàn, {tomTat.soNguoi} người
          {tomTat.soDoanConDon > 0 ? ` · còn ${tomTat.soDoanConDon} đoàn chưa tới đủ` : ""}
        </p>
        <button
          type="button"
          onClick={() => setMoRong((truoc) => !truoc)}
          data-testid="shift-care-brief-toggle"
          aria-expanded={moRong}
          className="inline-flex min-h-11 items-center rounded-lg border border-[#c9dceb] bg-[#f4f9fc] px-4 text-sm font-black text-[#2f6f8f]"
        >
          {moRong ? "Thu lại" : "Mở bản đọc"}
        </button>
      </div>

      {moRong ? (
        <>
          <p className="mt-3 text-sm leading-6 text-[#5f7068]">{SHIFT_CARE_COPY.cachDung}</p>

          <ul className="mt-3 space-y-3">
            {groups.map((group) => (
              <li
                key={group.groupCode}
                data-testid="shift-care-brief-group"
                className="rounded-xl border border-[#d9e6ee] bg-[#f4f9fc] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-base font-black text-[#1f2f2a]">
                    {group.groupLabel.length > 0 ? group.groupLabel : group.groupCode}
                  </span>
                  <span
                    className={
                      conChoDon(group)
                        ? "text-sm font-black text-[#8a5a1f]"
                        : "text-sm font-black text-[#3d6b50]"
                    }
                  >
                    {conChoDon(group) ? SHIFT_CARE_COPY.conDon : SHIFT_CARE_COPY.daDon}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#4a5a52]">
                  {docGioToi(group.gioToi)} · {group.memberCount} khách ·{" "}
                  {group.nguon === "quay" ? "mua tại quầy" : "đặt trên web"} · mã {group.groupCode}
                </p>

                {/* Câu viết sẵn để đọc lên bộ đàm — không ai phải tự nghĩ lời. */}
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-[#1f2f2a] ring-1 ring-[#d9e6ee]">
                  <span className="font-black">Đọc lên bộ đàm: </span>
                  {docLenBoDam(group)}
                </p>

                <ul className="mt-2 space-y-1">
                  {group.members.map((member) => (
                    <li key={member.memberIndex} className="text-sm leading-6 text-[#42554c]">
                      Người thứ {member.memberIndex}
                      {member.displayName.length > 0 ? ` (${member.displayName})` : ""} —{" "}
                      {CARE_NEED_LABELS[member.careNeed]}
                      {member.daVao ? " · đã qua cổng" : " · chưa vào"}
                    </li>
                  ))}
                </ul>

                {group.leaderPhone.length > 0 ? (
                  <p className="mt-2 text-sm text-[#4a5a52]">
                    Trưởng đoàn {group.leaderName} ·{" "}
                    <a
                      href={`tel:${group.leaderPhone.replace(/[^0-9+]/g, "")}`}
                      className="inline-flex min-h-11 items-center font-black text-[#2f6f8f] underline"
                    >
                      {group.leaderPhone}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
