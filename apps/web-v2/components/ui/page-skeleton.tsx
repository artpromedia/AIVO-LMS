import { Skeleton } from "@/components/ui/skeleton";

export type PageSkeletonVariant = "detail" | "table" | "cards" | "feed";

/**
 * Layout-preserving route skeletons. Each variant mirrors the broad shape of
 * its page family so content landing causes no layout shift; motion comes
 * from the Skeleton primitive, which inherits the global reduced-motion
 * kill-switch.
 */
export function PageSkeleton({
  variant,
  label = "Loading",
}: {
  variant: PageSkeletonVariant;
  label?: string;
}) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 py-2">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      {variant === "detail" && (
        <>
          <Skeleton className="h-40 w-full rounded-[24px]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </>
      )}
      {variant === "table" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {variant === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 w-full rounded-[20px]" />
          <Skeleton className="h-44 w-full rounded-[20px]" />
          <Skeleton className="h-44 w-full rounded-[20px]" />
        </div>
      )}
      {variant === "feed" && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-11/12" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
    </div>
  );
}
