import { useEffect, useRef, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useT } from "@/lib/i18n";
import { SearchIcon } from "@/lib/icons";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { HelpAbout } from "../components/help/help-about";
import { HelpAccessGuide } from "../components/help/help-access-guide";
import { HelpErrorCodes } from "../components/help/help-error-codes";
import { HelpGettingStarted } from "../components/help/help-getting-started";
import { HelpRecentErrors } from "../components/help/help-recent-errors";
import { HelpShortcuts } from "../components/help/help-shortcuts";
import { HelpStatusGuide } from "../components/help/help-status-guide";
import { HelpSupport } from "../components/help/help-support";
import { HelpToothChart } from "../components/help/help-tooth-chart";

export type HelpPageProps = {
    /** Embedded in Settings: no jumps to other routes */
    embedded?: boolean;
};

const ALL_TABS = ["start", "shortcuts", "statuses", "teeth", "access", "errors", "recent", "support", "about"] as const;
type HelpTab = (typeof ALL_TABS)[number];
/** The roles & access guide only where there is a team to give access to. */
const TABS: readonly HelpTab[] = __CAP_MULTI_STAFF__ ? ALL_TABS : ALL_TABS.filter((t) => t !== "access");

function isTab(v: string | null): v is HelpTab {
    return v != null && (TABS as readonly string[]).includes(v);
}

/**
 * Help center: getting started, keyboard shortcuts, status guide, error-code manual, recent errors, about.
 * State lives in the URL (`?tab=errors&q=MD-PAY-004`) so error toasts can deep-link here and the browser
 * back button works (Nielsen #3 user control, #10 help & documentation).
 */
export function HelpPage({ embedded = false }: HelpPageProps = {}) {
    const t = useT();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab: HelpTab = isTab(params.get("tab")) ? (params.get("tab") as HelpTab) : "start";
    const query = params.get("q") ?? "";
    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const role = useAuthStore((s) => s.session?.role);
    const parsedRole = parseRole(role);
    const canMigration = parsedRole != null && allowed("ops.migration", parsedRole);
    /** Support files carry logs and practice facts: practice admins only. */
    const tabs = parsedRole != null && allowed("ops.system", parsedRole) ? TABS : TABS.filter((id) => id !== "support");

    const update = (next: { tab?: HelpTab; q?: string }) => {
        const p = new URLSearchParams(params);
        if (next.tab) p.set("tab", next.tab);
        if (next.q !== undefined) {
            if (next.q) p.set("q", next.q);
            else p.delete("q");
        }
        setParams(p, { replace: next.tab === undefined });
    };

    /** "/" focuses search (common help-center convention). */
    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /** Error deep link: scroll the matching code into view. */
    useEffect(() => {
        if (tab !== "errors" || !/^MD-/i.test(query.trim())) return;
        const el = document.getElementById(`err-${query.trim().toUpperCase()}`);
        el?.scrollIntoView({ block: "center" });
    }, [tab, query]);

    const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!delta && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        const dir = document.documentElement.dir === "rtl" ? -delta : delta;
        const nextIdx = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (idx + dir + tabs.length) % tabs.length;
        const next = tabs[nextIdx]!;
        update({ tab: next });
        tabRefs.current[next]?.focus();
    };

    const routeLinks = embedded ? null : (
        <>
            <Button type="button" variant="secondary" onClick={() => navigate("/feedback")}>
                {t("page.help.link_feedback")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/compliance")}>
                {t("page.help.link_compliance")}
            </Button>
            {canMigration ? (
                <Button type="button" variant="secondary" onClick={() => navigate("/migration")}>
                    {t("page.help.link_migration")}
                </Button>
            ) : null}
        </>
    );

    return (
        <div className={`help-center ${embedded ? "" : "practice-workspace-page "}animate-fade-in--sticky-safe`}>
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.help.title")}
                subtitle={t("page.help.intro")}
            />

            <div className="help-center__bar">
                <div className="help-center__search">
                    <span className="help-center__search-icon" aria-hidden>
                        <SearchIcon size={14} />
                    </span>
                    <Input
                        ref={searchRef}
                        type="search"
                        value={query}
                        placeholder={t("help.search_placeholder")}
                        aria-label={t("help.search_aria")}
                        onChange={(e) => update({ q: e.target.value })}
                    />
                    <kbd className="kbd" aria-hidden>
                        /
                    </kbd>
                </div>
                <div className="help-center__tabs" role="tablist" aria-label={t("page.help.title")}>
                    {tabs.map((id, idx) => (
                        <button
                            key={id}
                            ref={(el) => {
                                tabRefs.current[id] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`help-tab-${id}`}
                            aria-selected={tab === id}
                            aria-controls={`help-panel-${id}`}
                            tabIndex={tab === id ? 0 : -1}
                            className="help-center__tab"
                            onClick={() => update({ tab: id })}
                            onKeyDown={(e) => onTabKey(e, idx)}
                        >
                            {t(`help.tab.${id}`)}
                        </button>
                    ))}
                </div>
            </div>

            <section
                id={`help-panel-${tab}`}
                role="tabpanel"
                aria-labelledby={`help-tab-${tab}`}
                className="help-center__panel"
                tabIndex={0}
            >
                {tab === "start" ? <HelpGettingStarted query={query} /> : null}
                {tab === "shortcuts" ? <HelpShortcuts query={query} /> : null}
                {tab === "statuses" ? <HelpStatusGuide query={query} /> : null}
                {tab === "teeth" ? <HelpToothChart query={query} /> : null}
                {__CAP_MULTI_STAFF__ && tab === "access" ? <HelpAccessGuide query={query} /> : null}
                {tab === "errors" ? <HelpErrorCodes query={query} /> : null}
                {tab === "recent" ? <HelpRecentErrors /> : null}
                {tab === "support" && tabs.includes("support") ? <HelpSupport initialRef={params.get("ref") ?? undefined} /> : null}
                {tab === "about" ? <HelpAbout links={routeLinks} onOpenRecentErrors={() => update({ tab: "recent" })} /> : null}
            </section>
        </div>
    );
}
