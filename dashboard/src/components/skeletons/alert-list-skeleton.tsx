import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder for the alerts list. Renders three card-shaped
 * blocks with the same vertical rhythm as a real `AlertCard` so the swap
 * to live data is a fade-in instead of a layout shift.
 */
export function AlertListSkeleton({ count = 3 }: { readonly count?: number }): React.JSX.Element {
  return (
    <ol className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <AlertCardSkeleton />
        </li>
      ))}
    </ol>
  );
}

function AlertCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-xl border border-stroke bg-surface/60 p-5 pl-6">
      <div className="flex items-center justify-between border-b border-stroke pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}
