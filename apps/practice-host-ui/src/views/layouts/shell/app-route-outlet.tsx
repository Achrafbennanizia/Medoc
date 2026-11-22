/** The routed page, with a loading fallback and the route error guard. */
import { memo, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { RouteOutletGuard } from "../../components/route-outlet-guard";
import { PageLoading } from "../../components/ui/page-status";

export const AppRouteOutlet = memo(function AppRouteOutlet({ currency, timeZone, loadingLabel }: { currency: string; timeZone: string; loadingLabel: string }) {
    // Remount routes when practice currency or time zone changes so money labels,
    // "today" highlights, and day-close buckets pick up the new settings immediately.
    return (
        <Suspense fallback={<PageLoading label={loadingLabel} />}>
            <RouteOutletGuard>
                <Outlet key={`${currency}:${timeZone}`} />
            </RouteOutletGuard>
        </Suspense>
    );
});
