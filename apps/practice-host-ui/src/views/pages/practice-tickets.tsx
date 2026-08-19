import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "../components/ui/button";
import { PracticeTaskAdminPanel } from "../components/practice-tasks/practice-task-admin-panel";
import { PracticeTaskInboxPanel } from "../components/practice-tasks/practice-task-inbox-panel";
import { WorkspacePageHeader } from "../components/administration-page-header";

type PracticeTasksTab = "inbox" | "verwalten";

function resolveTab(searchParams: URLSearchParams, canAdmin: boolean): PracticeTasksTab {
    if (!canAdmin) return "inbox";
    const tab = searchParams.get("tab");
    if (tab === "verwalten" || searchParams.get("verwalten") === "1") return "verwalten";
    return "inbox";
}

export function PracticeTicketsPage() {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const userId = session?.user_id ?? "";
    const role = session?.role ? parseRole(session.role) : null;
    const canAdminTasks = role != null && allowed("administration.read", role, session?.permission_overrides);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = useMemo(() => resolveTab(searchParams, canAdminTasks), [searchParams, canAdminTasks]);

    const isPhysician = role === "PHYSICIAN";
    const isReception = role === "RECEPTION";

    const [inboxRefreshKey, setInboxRefreshKey] = useState(0);

    useEffect(() => {
        if (searchParams.get("verwalten") === "1" && canAdminTasks) {
            setSearchParams({ tab: "verwalten" }, { replace: true });
        }
    }, [searchParams, canAdminTasks, setSearchParams]);

    const setTab = (tab: PracticeTasksTab) => {
        if (tab === "inbox") {
            setSearchParams({});
            return;
        }
        setSearchParams({ tab: "verwalten" });
    };

    const subtitle =
        activeTab === "verwalten"
            ? t("page.practice_tickets.subtitle_admin")
            : isPhysician
              ? t("page.practice_tickets.subtitle_physician")
              : isReception
                ? t("page.practice_tickets.subtitle_reception")
                : t("page.practice_tickets.subtitle_default");

    return (
        <div className="practice-tasks-page practice-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.practice_tickets.title")}
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
                                {t("page.practice_tickets.refresh")}
                            </Button>
                        ) : canAdminTasks ? (
                            <Button type="button" variant="secondary" size="sm" onClick={() => setTab("inbox")}>
                                {t("page.practice_tickets.back_to_inbox")}
                            </Button>
                        ) : null}
                        {canAdminTasks && activeTab === "inbox" ? (
                            <Button type="button" variant="primary" size="sm" onClick={() => setTab("verwalten")}>
                                {t("page.practice_tickets.tab_admin")}
                            </Button>
                        ) : null}
                    </>
                }
            />

            {activeTab === "verwalten" && canAdminTasks ? (
                <div id="practice-tasks-admin-panel">
                    <PracticeTaskAdminPanel embedded backHref="/tickets" />
                </div>
            ) : (
                <div id="practice-tasks-inbox-panel">
                    <PracticeTaskInboxPanel
                        key={inboxRefreshKey}
                        userId={userId}
                        isPhysician={isPhysician}
                        isReception={isReception}
                        active={activeTab === "inbox"}
                    />
                </div>
            )}
        </div>
    );
}
