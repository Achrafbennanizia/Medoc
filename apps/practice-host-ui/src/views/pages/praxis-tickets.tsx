import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "../components/ui/button";
import { PraxisAufgabeAdminPanel } from "../components/praxis-aufgaben/praxis-aufgabe-admin-panel";
import { PraxisAufgabeInboxPanel } from "../components/praxis-aufgaben/praxis-aufgabe-inbox-panel";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

type PraxisAufgabenTab = "inbox" | "verwalten";

function resolveTab(searchParams: URLSearchParams, canAdmin: boolean): PraxisAufgabenTab {
    if (!canAdmin) return "inbox";
    const tab = searchParams.get("tab");
    if (tab === "verwalten" || searchParams.get("verwalten") === "1") return "verwalten";
    return "inbox";
}

export function PraxisTicketsPage() {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const userId = session?.user_id ?? "";
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canAdminAufgaben = role != null && allowed("verwaltung.read", role, session?.permission_overrides);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = useMemo(() => resolveTab(searchParams, canAdminAufgaben), [searchParams, canAdminAufgaben]);

    const isArzt = role === "ARZT";
    const isRezeption = role === "REZEPTION";

    const [inboxRefreshKey, setInboxRefreshKey] = useState(0);

    useEffect(() => {
        if (searchParams.get("verwalten") === "1" && canAdminAufgaben) {
            setSearchParams({ tab: "verwalten" }, { replace: true });
        }
    }, [searchParams, canAdminAufgaben, setSearchParams]);

    const setTab = (tab: PraxisAufgabenTab) => {
        if (tab === "inbox") {
            setSearchParams({});
            return;
        }
        setSearchParams({ tab: "verwalten" });
    };

    const subtitle =
        activeTab === "verwalten"
            ? t("page.praxis_tickets.subtitle_admin")
            : isArzt
              ? t("page.praxis_tickets.subtitle_arzt")
              : isRezeption
                ? t("page.praxis_tickets.subtitle_rezeption")
                : t("page.praxis_tickets.subtitle_default");

    return (
        <div className="praxis-aufgaben-page praxis-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.praxis_tickets.title")}
                subtitle={subtitle}
                actions={
                    <>
                        {activeTab === "inbox" ? (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setInboxRefreshKey((k) => k + 1)}
                            >
                                {t("page.praxis_tickets.refresh")}
                            </Button>
                        ) : canAdminAufgaben ? (
                            <Button type="button" variant="secondary" size="sm" onClick={() => setTab("inbox")}>
                                {t("page.praxis_tickets.back_to_inbox")}
                            </Button>
                        ) : null}
                        {canAdminAufgaben && activeTab === "inbox" ? (
                            <Button type="button" variant="primary" size="sm" onClick={() => setTab("verwalten")}>
                                {t("page.praxis_tickets.tab_admin")}
                            </Button>
                        ) : null}
                    </>
                }
            />

            {activeTab === "verwalten" && canAdminAufgaben ? (
                <div id="praxis-aufgaben-admin-panel">
                    <PraxisAufgabeAdminPanel embedded backHref="/tickets" />
                </div>
            ) : (
                <div id="praxis-aufgaben-inbox-panel">
                    <PraxisAufgabeInboxPanel
                        key={inboxRefreshKey}
                        userId={userId}
                        isArzt={isArzt}
                        isRezeption={isRezeption}
                        active={activeTab === "inbox"}
                    />
                </div>
            )}
        </div>
    );
}
