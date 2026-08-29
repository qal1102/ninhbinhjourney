import { VisitorGroupMemberExperience } from "@/components/commerce/visitor-group-member-page";

export default async function VisitorGroupMemberPage({
  params,
}: {
  params: Promise<{ ma: string }>;
}) {
  return <VisitorGroupMemberExperience memberCode={(await params).ma} />;
}
