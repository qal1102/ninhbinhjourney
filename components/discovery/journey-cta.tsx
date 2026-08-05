import Link from "next/link";

export type JourneyCtaCopy = {
  title: string;
  body: string;
  primary: string;
  secondary: string;
  offer: string;
};

/**
 * Khoi ket cua danh muc diem den: nguoi doc vua luot qua ca 15 noi, cau
 * hoi dat dung luc con dang phan van -- dan thang sang bo lap hanh trinh.
 *
 * Tach rieng khoi `DestinationZigzag` ngay 05/08: danh muc gio chia lam
 * hai nhip (zigzag cho vai diem dau, `DestinationIndex` cho phan con lai),
 * nen khoi ket nay phai dung SAU CA HAI chu khong con thuoc ve rieng
 * zigzag nua.
 */
export function JourneyCta({ copy }: { copy: JourneyCtaCopy }) {
  return (
    <section className="bg-[#FBFAF6] px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[10px] bg-[#183F34] px-6 py-14 text-center text-[#FBFAF6] sm:px-12 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <h3 className="font-display text-3xl leading-tight sm:text-5xl">{copy.title}</h3>
            <p className="mt-5 text-lg leading-relaxed text-[#D8E5DE]">{copy.body}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/plan"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#E7B96A] px-8 font-bold text-[#183F34] transition hover:bg-[#F2CE8C]"
              >
                {copy.primary}
              </Link>
              <Link
                href="/packages"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#FBFAF6]/40 px-8 font-semibold transition hover:bg-white/10"
              >
                {copy.secondary}
              </Link>
            </div>
            <p className="mt-6 text-sm text-[#A8CEC1]">{copy.offer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
