import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

const sources = {
  "TRANGAN-WHARF-DEMO": {
    place: "Bến thuyền Tràng An",
    lead: "Mặt nước mở ra một hành trình chậm giữa núi đá vôi, hang xuyên thủy và những lớp di sản.",
    source: "trang_an",
  },
  "BAIDINH-GATE-DEMO": {
    place: "Điểm đón Bái Đính",
    lead: "Bắt đầu từ nhịp chuông, hành lang đá và một ngày kết nối di sản Ninh Bình.",
    source: "bai_dinh",
  },
  "HOTEL-LOBBY-DEMO": {
    place: "Điểm chào đón lưu trú",
    lead: "Một lời mời riêng để khám phá Ninh Bình theo thời gian, nhịp đi và sở thích của bạn.",
    source: "hotel_lobby",
  },
  "AIRPORT-CONCEPT-DEMO": {
    place: "Airport gateway concept",
    lead: "Concept Collaboration — a proposed digital gateway into the Ninh Bình destination story.",
    source: "airport_concept",
  },
} as const;

export default async function QrSourcePage({
  params,
}: {
  params: Promise<{ sourceCode: string }>;
}) {
  const { sourceCode } = await params;
  const source = sources[sourceCode as keyof typeof sources];
  if (!source) notFound();

  const activeRun = (await cookies()).get("nbj-active-run")?.value;

  return (
    <main className="relative grid min-h-screen place-items-end overflow-hidden bg-[#183f34] px-5 py-8 text-white sm:px-10 lg:place-items-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_15%,rgba(168,206,193,.24),transparent_40%),linear-gradient(160deg,#214d3c,#111a17_78%)]" />
      <section className="relative z-10 w-full max-w-5xl rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur-md sm:p-10 lg:grid lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.23em] text-[#e7c78d]">
            QR source recognized
          </p>
          <p className="mt-4 text-sm text-white/58">{sourceCode}</p>
          <div className="mt-6 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs font-bold">
            {activeRun ? "Paired demo room" : "Discovery mode"}
          </div>
        </div>
        <div className="mt-8 lg:mt-0">
          <h1 className="font-display text-5xl leading-[0.98] sm:text-7xl">
            {source.place}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/74">
            {source.lead}
          </p>
          <Link
            href={`/plan?lang=vi&source=${encodeURIComponent(source.source)}`}
            className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#f4f0e7] px-6 font-bold text-[#183f34]"
          >
            Lập hành trình từ điểm chạm này
          </Link>
          {!activeRun ? (
            <p className="mt-4 text-sm leading-6 text-white/55">
              To create shared journey and booking state, join the short-lived QR
              issued by an authenticated presenter.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
