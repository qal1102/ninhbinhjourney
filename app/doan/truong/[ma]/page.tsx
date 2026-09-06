import { VisitorGroupLeaderExperience } from "@/components/commerce/visitor-group-leader-page";

export default async function VisitorGroupLeaderPage({
  params,
}: {
  params: Promise<{ ma: string }>;
}) {
  return <VisitorGroupLeaderExperience groupCode={(await params).ma} />;
}
