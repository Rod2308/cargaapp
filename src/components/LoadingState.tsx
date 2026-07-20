import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ListSkeletonProps = {
  rows?: number;
  className?: string;
  itemClassName?: string;
};

/** Vertical list of card-shaped skeletons — matches card-lift rows. */
export function ListSkeleton({ rows = 3, className, itemClassName }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "card-lift flex items-center gap-3 p-4",
            itemClassName,
          )}
        >
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

type GridSkeletonProps = {
  count?: number;
  className?: string;
  itemHeight?: string;
};

/** Grid of card-shaped skeletons — matches workout / student cards. */
export function GridSkeleton({
  count = 4,
  className,
  itemHeight = "h-32",
}: GridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      aria-hidden
      aria-busy
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("card-lift w-full", itemHeight)} />
      ))}
    </div>
  );
}

type PageSkeletonProps = {
  className?: string;
};

/** Full-page centered loader skeleton — replaces "Carregando..." plain text. */
export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div className={cn("app-container space-y-4 pt-8", className)} aria-busy>
      <Skeleton className="h-8 w-2/3 max-w-xs" />
      <Skeleton className="h-4 w-1/2 max-w-[240px]" />
      <div className="pt-2">
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}
