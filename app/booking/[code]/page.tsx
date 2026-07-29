import { BookingConfirmation } from "@/components/commerce/booking-confirmation";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <BookingConfirmation code={(await params).code} />;
}
