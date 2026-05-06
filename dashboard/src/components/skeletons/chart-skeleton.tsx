import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder for `VolumeChart`. Shape mirrors the real chart
 * (stats strip + 30 vertical bars) so the swap to live data feels like
 * a fade-in rather than a layout shift.
 */
const SKELETON_HEIGHTS = [
  18, 32, 22, 56, 64, 42, 28, 70, 36, 24,
  80, 90, 50, 38, 60, 44, 28, 22, 18, 30,
  40, 65, 78, 54, 36, 48, 26, 32, 70, 88,
];

export function ChartSkeleton(): React.JSX.Element {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {[60, 40, 56, 36].map((width) => (
          <div key={width} className="flex items-baseline gap-2">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-3.5" style={{ width: `${width}px` }} />
          </div>
        ))}
      </div>
      <div className="flex h-64 items-end gap-1.5 rounded-md bg-surface-base/40 px-2 pb-2 pt-2">
        {SKELETON_HEIGHTS.map((heightPct, index) => (
          <Skeleton
            key={index}
            className="flex-1 rounded-t"
            style={{ height: `${heightPct}%` }}
          />
        ))}
      </div>
    </div>
  );
}
