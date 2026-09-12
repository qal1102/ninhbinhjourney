/**
 * Màn chờ riêng của hệ thống điều hành.
 *
 * Trước đây ERP không có màn chờ nào của mình, nên mọi màn hình trong `/erp`
 * mượn màn chờ của web khách: nền kem, một vòng xoay, và câu song ngữ "Đang
 * chuẩn bị trải nghiệm / Loading…". Lượt kiểm tay ngày 12/09/2026 mở màn hình
 * Khách hàng và chỉ thấy đúng dòng ấy — không có gì cho biết máy đang làm việc
 * hay đã treo, nên người dùng tự nhiên sẽ bấm tải lại, và tải lại thì chờ lâu
 * thêm.
 *
 * Khung xương này có hình dáng của một màn hình ERP thật (thanh đầu trang,
 * tiêu đề, bốn ô số, hai khối danh sách), để lúc nội dung thật hiện ra thì
 * trang không nhảy bố cục.
 *
 * Giữ nguyên `<main aria-busy="true">`: nhiều bài kiểm chờ đúng dấu này biến
 * mất rồi mới đọc nội dung, vì trong lúc dựng trang có hai thẻ `<main>` cùng
 * tồn tại.
 */
export default function ErpLoading() {
  return (
    <main
      className="min-h-screen bg-[#f2f4f1] text-[#17231f]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="border-b border-[#dce2dd] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-6">
          <div className="h-9 w-9 rounded-full bg-[#dfe6e1]" />
          <div className="h-3 w-40 rounded-full bg-[#dfe6e1]" />
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6 sm:py-8">
        <p className="text-sm font-bold text-[#52665d]">
          Đang tải số liệu, bạn chờ một chút nhé…
        </p>

        <div className="mt-5 space-y-3 motion-safe:animate-pulse">
          <div className="h-3 w-28 rounded-full bg-[#dfe6e1]" />
          <div className="h-9 w-full max-w-md rounded-xl bg-[#dfe6e1]" />
          <div className="h-3 w-full max-w-2xl rounded-full bg-[#e6ebe7]" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 motion-safe:animate-pulse lg:grid-cols-4">
          {[0, 1, 2, 3].map((o) => (
            <div
              key={o}
              className="rounded-2xl border border-[#d8e0db] bg-white p-4"
            >
              <div className="h-3 w-20 rounded-full bg-[#e6ebe7]" />
              <div className="mt-3 h-7 w-14 rounded-lg bg-[#dfe6e1]" />
              <div className="mt-3 h-2.5 w-24 rounded-full bg-[#eef1ef]" />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 motion-safe:animate-pulse xl:grid-cols-2">
          {[0, 1].map((khoi) => (
            <div
              key={khoi}
              className="rounded-2xl border border-[#d8e0db] bg-white p-5 sm:p-6"
            >
              <div className="h-3 w-32 rounded-full bg-[#e6ebe7]" />
              <div className="mt-3 h-5 w-48 rounded-lg bg-[#dfe6e1]" />
              <div className="mt-5 space-y-3">
                {[0, 1, 2].map((dong) => (
                  <div key={dong} className="h-12 rounded-xl bg-[#f3f6f4]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
