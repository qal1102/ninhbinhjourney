import Image from "next/image";
import Link from "next/link";

const concepts = [
  {
    title: "Tràng An destination activation",
    image: "/images/concepts/trang-an-activation-concept.png",
    alt: "Original concept image of a calm Tràng An arrival pavilion beside the river",
    body: "Một lớp đón tiếp số nhẹ nhàng: nguồn QR, lập hành trình và điều phối lượt đến cùng chia sẻ một lõi dữ liệu.",
  },
  {
    title: "Airport digital gateway",
    image: "/images/concepts/airport-gateway-concept.png",
    alt: "Original concept image of a speculative Ninh Bình airport digital gateway",
    body: "Một ý tưởng cửa ngõ số cho hành khách đến vùng: khám phá, ghép thiết bị và giữ attribution từ điểm chạm đầu tiên.",
  },
  {
    title: "Bái Đính cultural night",
    image: "/images/concepts/bai-dinh-cultural-night-concept.png",
    alt: "Original concept image of a restrained cultural night in a pagoda courtyard",
    body: "Một ý tưởng chương trình đêm tiết chế, cần thẩm định văn hóa, vận hành và thẩm quyền nghi lễ trước mọi triển khai thật.",
  },
] as const;

export function HomeEditorial({
  showConcepts,
  clientDemo,
}: {
  showConcepts: boolean;
  clientDemo: boolean;
}) {
  return (
    <>
      {showConcepts ? (
        <>
      <section className="bg-[#151a17] px-5 py-16 text-white sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#e7c78d]">
              Ninh Bình on Screen
            </p>
            <h2 className="font-display mt-4 text-5xl leading-none sm:text-7xl">
              Địa hình đã có ngôn ngữ điện ảnh riêng.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              Sông uốn giữa núi đá, đồng lúa thay màu theo mùa và tỷ lệ con
              người nhỏ trong cảnh quan tạo nên chất liệu kể chuyện mạnh. Ảnh
              dưới đây là tài sản gốc được tạo cho bản trình diễn, không trích
              từ phim và không tuyên bố một đoàn phim cụ thể đã quay tại đây.
            </p>
            <a
              href="https://vietnamtourism.gov.vn/en/post/20581"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex text-sm font-bold text-[#e7c78d] underline underline-offset-4"
            >
              Nguồn bối cảnh: Cục Du lịch Quốc gia Việt Nam
            </a>
          </div>
          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl">
            <Image
              src="/images/concepts/tam-coc-on-screen.png"
              alt="Original editorial concept of a Tam Cốc river journey in late-afternoon light"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#f4f0e7] px-5 py-16 text-[#151a17] sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#356957]">
              Concept Collaborations
            </p>
            <h2 className="font-display mt-4 text-5xl leading-none text-[#183f34] sm:text-7xl">
              Các ý tưởng để cùng đánh giá, không phải quan hệ đã công bố.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[#59654b]">
              Mọi hình ảnh trong phần này là concept nguyên bản. Không logo,
              không nhận diện đối tác và không ngụ ý tài trợ hay liên kết
              thương mại hiện hữu.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {concepts.map((concept) => (
              <article
                key={concept.title}
                className="overflow-hidden rounded-3xl border border-[#d7d5cd] bg-[#fbfaf6]"
              >
                <div className="relative aspect-[3/2]">
                  <Image
                    src={concept.image}
                    alt={concept.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-[#fbfaf6]/90 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#71551f] backdrop-blur">
                    Concept
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl text-[#183f34]">
                    {concept.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#59654b]">
                    {concept.body}
                  </p>
                  <p className="mt-4 border-t border-[#dedbd2] pt-4 text-xs leading-5 text-[#7a725f]">
                    Concept demonstration only — no existing affiliation or
                    implementation claim.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
        </>
      ) : null}

      <section className="bg-[#dfece6] px-5 py-14 text-[#183f34] sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
              One shared data core
            </p>
            <h2 className="font-display mt-4 text-4xl leading-tight sm:text-6xl">
              Điều khách nhìn thấy và điều vận hành xử lý gặp nhau trên cùng
              một lõi dữ liệu có phân quyền.
            </h2>
            <p className="mt-5 max-w-2xl leading-7 text-[#4d5b55]">
              Khu vực nội bộ yêu cầu tài khoản operator được xác thực. Khách
              truy cập không nhìn thấy hoặc nhận được quyền điều hành.
              {clientDemo
                ? " Phiên trình diễn ghép hai thiết bị trong một phòng dữ liệu tạm thời."
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex min-h-12 items-center rounded-full bg-[#183f34] px-6 font-bold text-white"
            >
              Khám phá bản đồ
            </Link>
            <Link
              href="/ops/login"
              className="inline-flex min-h-12 items-center rounded-full border border-[#183f34] px-6 font-bold"
            >
              Operator sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
