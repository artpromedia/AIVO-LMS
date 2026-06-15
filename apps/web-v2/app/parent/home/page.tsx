import { ParentHomeView } from "../_components/parent-home-view";

export const dynamic = "force-dynamic";

export default async function ParentHome({
  searchParams,
}: {
  searchParams: Promise<{ learner?: string }>;
}) {
  const { learner } = await searchParams;
  return <ParentHomeView selectedLearnerId={learner} />;
}
