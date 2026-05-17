import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
