/**
 * Solo inbox: what the guest proposed, for the admin to add or dismiss (editions-plan.md §4.2).
 * The guest sees its own proposals and what became of them.
 *
 * Rows follow the Linear triage list: hairline-separated, a title that says what changes, one
 * description line with the facts needed to decide, muted metadata, actions on the right.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { describeProposal } from "@/lib/guest-inbox-text";
import { useAuthStore } from "@/models/store/auth-store";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import {
    addStagedChange,
    dismissStagedChange,
    listStagedChanges,
    PROPOSAL_SENT_EVENT,
    PROPOSALS_CHANGED_EVENT,
    type StagedChange,
} from "@/systems/practice-host/controllers/guest.controller";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";

type Tab = "pending" | "decided";

export function GuestInboxPage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const isAdmin = useAuthStore((s) => s.session?.role) === "PHYSICIAN";
    const [tab, setTab] = useState<Tab>("pending");
    const [rows, setRows] = useState<StagedChange[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [names, setNames] = useState<Map<string, string>>(new Map());
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rowError, setRowError] = useState<Record<string, string>>({});
    const [dismissing, setDismissing] = useState<{ id: string; reason: string } | null>(null);
    const [confirmDismissAll, setConfirmDismissAll] = useState(false);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const list = await listStagedChanges(tab === "pending" ? "PENDING" : undefined);
            setRows(tab === "pending" ? list : list.filter((r) => r.status !== "PENDING"));
        } catch (e) {
            setLoadError(errorMessage(e));
        }
    }, [tab]);

    useEffect(() => {
        void load();
        const reload = () => void load();
        window.addEventListener(PROPOSAL_SENT_EVENT, reload);
        window.addEventListener(PROPOSALS_CHANGED_EVENT, reload);
        return () => {
            window.removeEventListener(PROPOSAL_SENT_EVENT, reload);
            window.removeEventListener(PROPOSALS_CHANGED_EVENT, reload);
        };
    }, [load]);

    useEffect(() => {
        void listPatients()
            .then((ps) => setNames(new Map(ps.map((p) => [p.id, p.name]))))
            .catch(() => undefined);
    }, []);

    const textCtx = useMemo(
        () => ({
            t,
            tp,
            patientName: (id: string | undefined) => (id && names.get(id)) || t("guest.inbox.unknown_patient"),
            date: (d: string) => formatDate(d),
            money: (n: number) => formatCurrency(n),
        }),
        [t, tp, names],
    );

    const groups = useMemo(() => {
        const out: { day: string; items: StagedChange[] }[] = [];
        for (const r of rows ?? []) {
            const day = r.createdAt.slice(0, 10);
            const last = out[out.length - 1];
            if (last?.day === day) last.items.push(r);
            else out.push({ day, items: [r] });
        }
        return out;
    }, [rows]);

    const decide = async (row: StagedChange, action: "add" | "dismiss", reason?: string) => {
        setBusyId(row.id);
        setRowError((e) => ({ ...e, [row.id]: "" }));
        try {
            if (action === "add") await addStagedChange(row.id);
            else await dismissStagedChange(row.id, reason);
            setRows((rs) => rs?.filter((r) => r.id !== row.id) ?? null);
            setDismissing(null);
            return true;
        } catch (e) {
            // Stays waiting: the admin sees why it could not be added (e.g. the slot is taken now).
            setRowError((er) => ({ ...er, [row.id]: errorMessage(e) }));
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const decideAll = async (action: "add" | "dismiss") => {
        setConfirmDismissAll(false);
        let done = 0;
        for (const r of rows ?? []) if (await decide(r, action)) done += 1;
        toast(tp(action === "add" ? "guest.inbox.added_n" : "guest.inbox.dismissed_n", { count: done }), "success");
    };

    const pendingCount = tab === "pending" ? (rows?.length ?? 0) : 0;

    return (
        <div className="practice-workspace-page guest-inbox-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("guest.inbox.title")}
                subtitle={isAdmin ? t("guest.inbox.subtitle_admin") : t("guest.inbox.subtitle_guest")}
                actions={
                    isAdmin && pendingCount > 1 ? (
                        <div className="row" style={{ gap: "var(--space-2)" }}>
                            <Button size="sm" onClick={() => void decideAll("add")} disabled={busyId != null}>
                                {t("guest.inbox.add_all")}
                            </Button>
                            <Button
                                size="sm"
                                variant={confirmDismissAll ? "danger" : "ghost"}
                                onClick={() => (confirmDismissAll ? void decideAll("dismiss") : setConfirmDismissAll(true))}
                                disabled={busyId != null}
                            >
                                {confirmDismissAll ? t("guest.inbox.dismiss_all_confirm") : t("guest.inbox.dismiss_all")}
                            </Button>
                        </div>
                    ) : null
                }
            />

            <div className="guest-inbox-tabs" role="tablist" aria-label={t("guest.inbox.title")}>
                {(["pending", "decided"] as const).map((k) => (
                    <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={tab === k}
                        className={`guest-inbox-tab${tab === k ? " is-active" : ""}`}
                        onClick={() => setTab(k)}
                    >
                        {t(`guest.inbox.tab.${k}`)}
                    </button>
                ))}
            </div>

            {loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : rows === null ? (
                <PageLoading label={t("common.loading")} />
            ) : rows.length === 0 ? (
                <EmptyState
                    title={tab === "pending" ? t("guest.inbox.empty_title") : t("guest.inbox.empty_decided_title")}
                    description={isAdmin ? t("guest.inbox.empty_body_admin") : t("guest.inbox.empty_body_guest")}
                />
            ) : (
                groups.map((g) => (
                    <section key={g.day} className="guest-inbox-group" aria-label={formatDate(g.day)}>
                        <h2 className="guest-inbox-day">{formatDate(g.day)}</h2>
                        <ul className="guest-inbox-list">
                            {g.items.map((r) => {
                                const text = describeProposal(r, textCtx);
                                const busy = busyId === r.id;
                                return (
                                    <li key={r.id} className="guest-inbox-row">
                                        <div className="guest-inbox-row__main">
                                            <div className="guest-inbox-row__title">{text.title}</div>
                                            {text.description ? <div className="guest-inbox-row__desc">{text.description}</div> : null}
                                            <div className="guest-inbox-row__meta">
                                                {r.status === "PENDING"
                                                    ? tp("guest.inbox.meta_proposed", { when: formatDateTime(r.createdAt) })
                                                    : tp(`guest.inbox.meta_${r.status.toLowerCase()}`, { when: formatDateTime(r.decidedAt ?? r.createdAt) })}
                                                {r.reason ? ` · ${tp("guest.inbox.reason", { reason: r.reason })}` : null}
                                            </div>
                                            {rowError[r.id] ? <div className="guest-inbox-row__error" role="alert">{rowError[r.id]}</div> : null}
                                            {dismissing?.id === r.id ? (
                                                <div className="guest-inbox-row__dismiss">
                                                    <Input
                                                        label={t("guest.inbox.reason_label")}
                                                        value={dismissing.reason}
                                                        onChange={(e) => setDismissing({ id: r.id, reason: e.target.value })}
                                                        placeholder={t("guest.inbox.reason_ph")}
                                                        maxLength={300}
                                                        autoFocus
                                                    />
                                                    <Button size="sm" variant="danger" loading={busy} onClick={() => void decide(r, "dismiss", dismissing.reason)}>
                                                        {t("guest.inbox.dismiss")}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setDismissing(null)}>
                                                        {t("common.cancel")}
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </div>
                                        {isAdmin && r.status === "PENDING" && dismissing?.id !== r.id ? (
                                            <div className="guest-inbox-row__actions">
                                                <Button size="sm" loading={busy} disabled={busyId != null} onClick={() => void decide(r, "add")}>
                                                    {t("guest.inbox.add")}
                                                </Button>
                                                <Button size="sm" variant="ghost" disabled={busyId != null} onClick={() => setDismissing({ id: r.id, reason: "" })}>
                                                    {t("guest.inbox.dismiss")}
                                                </Button>
                                            </div>
                                        ) : !isAdmin ? (
                                            <span className={`guest-inbox-status guest-inbox-status--${r.status.toLowerCase()}`}>
                                                {t(`guest.inbox.status.${r.status.toLowerCase()}`)}
                                            </span>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))
            )}
        </div>
    );
}
