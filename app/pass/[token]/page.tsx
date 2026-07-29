import { PassExperience } from "@/components/commerce/pass-experience";

export default async function PassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PassExperience token={(await params).token} />;
}
