export default function GlobalLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#f4f0e7] p-6 text-[#183f34]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#a8cec1] border-t-[#183f34]" />
        <p className="mt-4 text-sm font-bold">
          Đang chuẩn bị trải nghiệm / Loading…
        </p>
      </div>
    </main>
  );
}
