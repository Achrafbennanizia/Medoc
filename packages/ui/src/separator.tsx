import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, ...rest }: HTMLAttributes<HTMLHRElement>) {
    return <hr className={cn("ui-separator", className)} role="separator" {...rest} />;
}
