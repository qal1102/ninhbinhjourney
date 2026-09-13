import { redirect } from "next/navigation";
import { CounterPriceBoardView } from "@/components/erp/counter-price-board";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { getCounterPriceBoard } from "@/lib/erp/counter-sale-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

export default async function CounterPriceBoardPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  // Giá bán là quyết định của giám đốc. Đang "xem thử" vai khác thì cũng bị
  // chặn, đúng như máy chủ chặn ở `erp_counter_actor_can_set_price`.
  if (user.role !== "director") redirect("/erp");

  const board = await getCounterPriceBoard();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <CounterPriceBoardView board={board} today={today} />
    </ErpShell>
  );
}
