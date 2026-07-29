import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGES } from "@/content/packages";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { OpsShell } from "@/components/ops/ops-shell";

export default async function OpsCatalogPage() {
  let context;
  try {
    context = await getActiveOperatorRun([
      "check-in-agent",
      "site-supervisor",
      "icc-operator",
      "finance",
      "content",
      "admin",
    ]);
  } catch (error) {
    if (error instanceof DomainError && error.code === "PERMISSION_DENIED") {
      redirect("/ops/login");
    }
    redirect("/ops/settings/demo");
  }
  return (
    <OpsShell
      title="Catalog"
      eyebrow="Destinations · products · demonstration pricing"
      operator={context.operator}
      room={context.run}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
          <h2 className="font-display text-2xl">Configured destinations</h2>
          <div className="mt-4 space-y-3">
            {DESTINATIONS.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#f4f0e7] p-4">
                <div className="flex justify-between gap-4">
                  <p className="font-bold">{item.name.vi}</p>
                  <p className="text-xs">{item.mobilityLevel}</p>
                </div>
                <p className="mt-1 text-xs text-[#59654b]">
                  {item.demoOpeningWindow} · Demo information · reviewed{" "}
                  {item.source.reviewedAt}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
          <h2 className="font-display text-2xl">Service-commerce products</h2>
          <div className="mt-4 space-y-3">
            {PACKAGES.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#edf3f0] p-4">
                <div className="flex justify-between gap-4">
                  <p className="font-bold">{item.name}</p>
                  <p className="font-bold">
                    {item.demoPriceVnd.toLocaleString("vi-VN")} VND
                  </p>
                </div>
                <p className="mt-1 text-xs text-[#59654b]">
                  Demonstration price · {item.ledgerType}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </OpsShell>
  );
}
