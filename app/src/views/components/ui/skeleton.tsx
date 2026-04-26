import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Shimmer placeholder; sets `aria-hidden` — pair with a live `role="status"` parent when loading a region. */
export function Skeleton({ className, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("skeleton-shimmer", className)} style={{ minHeight: "0.75em", ...style }} aria-hidden {...rest} />;
}
