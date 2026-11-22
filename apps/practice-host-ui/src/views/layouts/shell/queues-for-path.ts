/** Which sync queues a page needs fresh when it opens (pure, unit-tested). */
export function queuesForPath(pathname: string): string[] | null {
    if (pathname === "/") return ["patients", "appointments", "charts", "orders"];
    if (pathname.startsWith("/appointments")) return ["appointments"];
    if (pathname.startsWith("/patients")) return ["patients"];
    if (pathname.startsWith("/charts")) return ["charts"];
    if (["/finance", "/balance-sheet", "/statistics"].some((p) => pathname.startsWith(p))) return ["finance"];
    if (pathname.startsWith("/purchase-orders") || pathname.startsWith("/products")) return ["orders"];
    if (pathname.startsWith("/tickets") || pathname.startsWith("/administration/tasks")) return ["tasks"];
    if (["/work-time", "/work-hours", "/work-days", "/work-plan"].some((p) => pathname.includes(p))) return ["work_time"];
    // Settings and the other screens share the practice and parameters queues.
    return ["practice", "parameters"];
}
