import Link from "next/link";
import { readPublicEnvironment } from "@/config/experience";
import { getPackageBySlug } from "@/content/packages";
import { CheckoutExperience } from "@/components/commerce/checkout-experience";
import { SetupState } from "@/components/shared/setup-state";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const environment = readPublicEnvironment();
  if (environment.status === "missing") {
    return <SetupState environment={environment} surface="Sandbox checkout" />;
  }
  if (!environment.config.sandboxPaymentEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-5 text-[#151a17]">
        <section className="max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
            Production mode
          </p>
          <h1 className="font-display mt-3 text-4xl text-[#183f34]">
            Online checkout is not configured.
          </h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            Sandbox payment controls are intentionally hidden outside the
            client-demonstration mode. No live payment adapter is claimed.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold"
          >
            Back to catalog
          </Link>
        </section>
      </main>
    );
  }
  const params = await searchParams;
  const packageSlug =
    typeof params.package === "string" ? params.package : "slow-ninh-binh";
  const packageItem = getPackageBySlug(packageSlug);
  if (!packageItem) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-5">
        <p>Gói demo không tồn tại.</p>
      </main>
    );
  }
  const itineraryId =
    typeof params.journey === "string" ? params.journey : undefined;

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/packages/${packageItem.slug}${itineraryId ? `?journey=${itineraryId}` : ""}`}
          className="text-sm font-bold text-[#356957]"
        >
          ← Chi tiết gói
        </Link>
        <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          Production-shaped sandbox lifecycle
        </p>
        <h1 className="font-display mt-4 text-5xl leading-[0.96] text-[#183f34] sm:text-7xl">
          Xác nhận rõ ràng,
          <br />
          không có giao dịch thật.
        </h1>
        <div className="mt-10">
          <CheckoutExperience
            packageItem={packageItem}
            itineraryId={itineraryId}
          />
        </div>
      </div>
    </main>
  );
}
