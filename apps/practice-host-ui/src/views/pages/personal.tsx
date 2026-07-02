import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { checkSession } from "@/systems/practice-host/controllers/auth.controller";
import {
    adminUnlockBruteForce,
    createPersonal,
    deletePersonal,
    deletePersonalPermissionOverride,
    getStaffQuota,
    grantPersonalAllPermissions,
    listPersonal,
    listPersonalPermissionOverrides,
    resetPersonalPermissionOverrides,
    setPersonalPasswordByAdmin,
    setPersonalPermissionOverride,
    updatePersonal,
    type StaffQuota,
} from "@/systems/practice-host/controllers/personal.controller";
import { MAX_TOTAL_PERSONAL } from "@/lib/mvp-security-config";
import { allowed, parseRole, RBAC_ALL_ACTIONS } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { errorMessage, formatDate } from "@/lib/utils";
import type { Personal } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { EditIcon } from "@/lib/icons";
import { passwordPolicyError } from "@/lib/password-policy";
import { PasswordPolicyHints } from "../components/password-policy-hints";
import type { Rolle } from "@/models/types";
import { ACTIVE_ROLE_WIRES } from "@/lib/deferred-roles";
import { useT, useTParams } from "@/lib/i18n";

function initialsFromName(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("");
}

const ROLLE_VALUE_OPTIONS = [
    { value: "ARZT" as const, key: "enum.rolle.arzt" },
    { value: "REZEPTION" as const, key: "enum.rolle.rezeption" },
] as const satisfies ReadonlyArray<{ value: (typeof ACTIVE_ROLE_WIRES)[number]; key: string }>;

function formatQuotaLine(used: number, max: number, t: (key: string) => string): string {
    const base = `${used}/${max}`;
    return used > max ? `${base} ${t("page.personal.quota_limit_exceeded")}` : base;
}

function quotaOverCapHint(staffQuota: StaffQuota, t: (key: string) => string): string | null {
    const over =
        staffQuota.used_arzt > staffQuota.max_arzt ||
        staffQuota.used_rezeption > staffQuota.max_rezeption ||
        staffQuota.used_total > staffQuota.max_total;
    if (!over) return null;
    return t("page.personal.quota_over_cap");
}

export function PersonalPage() {
    const t = useT();
    const tp = useTParams();
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
    const [createErrors, setCreateErrors] = useState<{ name?: string; email?: string; passwort?: string }>({});
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Personal | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        rolle: "REZEPTION" as Rolle,
        taetigkeitsbereich: "",
        fachrichtung: "",
        telefon: "",
        verfuegbar: true,
    });
    const [editBusy, setEditBusy] = useState(false);
    const [resetPw, setResetPw] = useState("");
    const [resetPw2, setResetPw2] = useState("");
    const [resetPwError, setResetPwError] = useState<string | undefined>(undefined);
    const [resetBusy, setResetBusy] = useState(false);
    /** FA-PERS-07 overrides editor (edit mode only). */
    const [permOverrides, setPermOverrides] = useState<{ action: string; effect: "ALLOW" | "DENY" }[]>([]);
    const [permBusy, setPermBusy] = useState(false);
    const [newPermAction, setNewPermAction] = useState("");
    const [newPermEffect, setNewPermEffect] = useState<"ALLOW" | "DENY">("DENY");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [staffQuota, setStaffQuota] = useState<StaffQuota | null>(null);
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role != null && allowed("personal.write", role, session?.permission_overrides);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const [p, quota] = await Promise.all([listPersonal(), getStaffQuota()]);
                setPersonal(p);
                setStaffQuota(quota);
                setSelected((cur) => {
                    if (!cur) return null;
                    return p.find((x) => x.id === cur.id) ?? null;
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (isInitial) setLoadError(msg);
                else toast(tp("common.refresh_failed", { message: msg }));
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        [toast, tp],
    );

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    useEffect(() => {
        if (!selected?.id || !detailEdit || !canWrite) {
            setPermOverrides([]);
            return;
        }
        let cancelled = false;
        setPermBusy(true);
        void listPersonalPermissionOverrides(selected.id)
            .then((rows) => {
                if (cancelled) return;
                setPermOverrides(
                    rows.map((r) => ({
                        action: r.action,
                        effect: r.effect === "ALLOW" ? "ALLOW" : "DENY",
                    })),
                );
            })
            .catch((e) => {
                if (!cancelled) toast(tp("page.personal.toast_perm_load_failed", { message: errorMessage(e) }), "error");
            })
            .finally(() => {
                if (!cancelled) setPermBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selected?.id, detailEdit, canWrite, toast, tp]);

    const neuFromQuery = searchParams.get("neu");
    useEffect(() => {
        if (neuFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
        setCreateErrors({});
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("neu");
                return n;
            },
            { replace: true },
        );
    }, [neuFromQuery, canWrite, setSearchParams]);

    const toEditForm = (p: Personal) => ({
        name: p.name,
        email: p.email,
        rolle: p.rolle,
        taetigkeitsbereich: p.taetigkeitsbereich ?? "",
        fachrichtung: p.fachrichtung ?? "",
        telefon: p.telefon ?? "",
        verfuegbar: p.verfuegbar,
    });

    const openCreate = () => {
        if (staffQuota && staffQuota.used_total >= staffQuota.max_total) {
            toast(tp("page.personal.toast_max_users", { max: MAX_TOTAL_PERSONAL }), "error");
            return;
        }
        setCreating(true);
        setDetailEdit(false);
        setSelected(null);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
        setCreateErrors({});
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
    };

    const selectRow = (p: Personal) => {
        setCreating(false);
        setDetailEdit(false);
        setSelected(p);
    };

    const startEdit = () => {
        if (!selected) return;
        setDetailEdit(true);
        setEditForm(toEditForm(selected));
        setResetPw("");
        setResetPw2("");
        setResetPwError(undefined);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) setEditForm(toEditForm(selected));
        setResetPw("");
        setResetPw2("");
        setResetPwError(undefined);
    };

    const handlePasswordReset = async () => {
        if (!selected || !canWrite) return;
        setResetPwError(undefined);
        if (!resetPw) {
            setResetPwError(t("page.personal.toast_pw_required"));
            return;
        }
        const policyErr = passwordPolicyError(t, resetPw);
        if (policyErr) {
            setResetPwError(policyErr);
            return;
        }
        if (resetPw !== resetPw2) {
            setResetPwError(t("page.personal.toast_pw_mismatch"));
            return;
        }
        setResetBusy(true);
        try {
            await setPersonalPasswordByAdmin(selected.id, resetPw);
            toast(t("page.personal.toast_pw_set"), "success");
            setResetPw("");
            setResetPw2("");
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        } finally {
            setResetBusy(false);
        }
    };

    const handleUpdate = async () => {
        if (!selected || !canWrite) return;
        if (!editForm.name.trim() || !editForm.email.trim()) {
            toast(t("page.personal.toast_name_email_required"), "error");
            return;
        }
        setEditBusy(true);
        try {
            const updated = await updatePersonal(selected.id, {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                rolle: editForm.rolle,
                taetigkeitsbereich: editForm.taetigkeitsbereich.trim() || null,
                fachrichtung: editForm.fachrichtung.trim() || null,
                telefon: editForm.telefon.trim() || null,
                verfuegbar: editForm.verfuegbar,
            });
            toast(t("page.personal.toast_saved"), "success");
            setDetailEdit(false);
            setSelected(updated);
            void load();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        } finally {
            setEditBusy(false);
        }
    };

    const validateCreate = (): boolean => {
        const next: typeof createErrors = {};
        if (!createForm.name.trim()) next.name = t("page.personal.err_name_required");
        if (!createForm.email.trim()) {
            next.email = t("page.personal.err_email_required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(createForm.email.trim())) {
            next.email = t("page.personal.err_email_invalid");
        }
        if (!createForm.passwort) {
            next.passwort = t("page.personal.err_password_required");
        } else {
            const policyErr = passwordPolicyError(t, createForm.passwort);
            if (policyErr) next.passwort = policyErr;
        }
        setCreateErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleCreate = async () => {
        if (!canWrite || !validateCreate()) return;
        setCreateBusy(true);
        try {
            const created = await createPersonal({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                passwort: createForm.passwort,
                rolle: createForm.rolle,
            });
            toast(t("page.personal.toast_created"), "success");
            setCreating(false);
            setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
            setSelected(created);
            void load();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        } finally {
            setCreateBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId || !canWrite) return;
        setDeleteBusy(true);
        try {
            await deletePersonal(deleteId);
            toast(t("page.personal.toast_removed"), "success");
            setDetailEdit(false);
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            void load();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        } finally {
            setDeleteBusy(false);
        }
    };

    const sorted = useMemo(
        () => [...personal].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [personal],
    );

    const rolleOptions = useMemo(
        () => ROLLE_VALUE_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) })),
        [t],
    );

    const availableRolleOptions = useMemo(() => {
        if (!staffQuota) return rolleOptions;
        return rolleOptions.filter((o) => {
            if (o.value === "ARZT") {
                if (detailEdit && selected?.rolle === "ARZT") return true;
                return staffQuota.used_arzt < staffQuota.max_arzt;
            }
            if (o.value === "REZEPTION") {
                if (detailEdit && selected?.rolle === "REZEPTION") return true;
                return staffQuota.used_rezeption < staffQuota.max_rezeption;
            }
            return true;
        });
    }, [staffQuota, selected?.rolle, detailEdit, rolleOptions]);

    const atStaffCap = staffQuota != null && staffQuota.used_total >= staffQuota.max_total;

    const overCapHint = staffQuota ? quotaOverCapHint(staffQuota, t) : null;

    const quotaSubtitle = staffQuota
        ? tp("page.personal.subtitle_quota", {
              arzt: formatQuotaLine(staffQuota.used_arzt, staffQuota.max_arzt, t),
              rezeption: formatQuotaLine(staffQuota.used_rezeption, staffQuota.max_rezeption, t),
              max: MAX_TOTAL_PERSONAL,
              overCap: overCapHint ? ` — ${overCapHint}` : "",
          })
        : t("page.personal.subtitle_default");

    const readField = (label: string, value: string | null | boolean | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>
                {value === null || value === undefined || value === "" ? "—" : String(value)}
            </span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="personal-detail-card">
                    <CardHeader
                        title={t("page.personal.create_title")}
                        subtitle={t("page.personal.create_subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="personal-detail-card__body">
                        <Input
                            id="pers-new-name"
                            label={t("page.personal.label_name_req")}
                            value={createForm.name}
                            error={createErrors.name}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, name: e.target.value }));
                                if (createErrors.name) setCreateErrors((x) => ({ ...x, name: undefined }));
                            }}
                        />
                        <Input
                            id="pers-new-email"
                            type="email"
                            label={t("page.personal.label_email_req")}
                            value={createForm.email}
                            error={createErrors.email}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, email: e.target.value }));
                                if (createErrors.email) setCreateErrors((x) => ({ ...x, email: undefined }));
                            }}
                        />
                        <Input
                            id="pers-new-pw"
                            type="password"
                            label={t("page.personal.label_password_req")}
                            value={createForm.passwort}
                            error={createErrors.passwort}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, passwort: e.target.value }));
                                if (createErrors.passwort) setCreateErrors((x) => ({ ...x, passwort: undefined }));
                            }}
                        />
                        <PasswordPolicyHints password={createForm.passwort} idPrefix="pers-new" />
                        <Select
                            id="pers-new-rolle"
                            label={t("common.role")}
                            value={createForm.rolle}
                            onChange={(e) => setCreateForm((f) => ({ ...f, rolle: e.target.value }))}
                            options={availableRolleOptions.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} loading={createBusy} disabled={createBusy}>
                                {t("common.create")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && detailEdit && canWrite) {
            return (
                <Card className="personal-detail-card">
                    <CardHeader
                        title={t("page.personal.edit_title")}
                        subtitle={t("page.personal.edit_subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy || resetBusy}>
                                {t("common.cancel")}
                            </Button>
                        }
                    />
                    <div className="personal-detail-card__body">
                        <Input
                            id="pers-ed-name"
                            label={t("page.personal.label_name_req")}
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-email"
                            type="email"
                            label={t("page.personal.label_email_req")}
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        />
                        {canWrite ? (
                            <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        if (!editForm.email.trim()) {
                                            toast(t("page.personal.toast_email_required"), "error");
                                            return;
                                        }
                                        void (async () => {
                                            try {
                                                const n = await adminUnlockBruteForce(editForm.email);
                                                toast(
                                                    n > 0
                                                        ? tp("page.personal.toast_unlock_ok", { n })
                                                        : t("page.personal.toast_unlock_none"),
                                                    n > 0 ? "success" : "info",
                                                );
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.personal.unlock_btn")}
                                </Button>
                                <span className="card-sub" style={{ margin: 0 }}>
                                    {t("page.personal.unlock_hint")}
                                </span>
                            </div>
                        ) : null}
                        <Select
                            id="pers-ed-rolle"
                            label={t("common.role")}
                            value={editForm.rolle}
                            onChange={(e) => setEditForm((f) => ({ ...f, rolle: e.target.value as Rolle }))}
                            options={availableRolleOptions.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <Input
                            id="pers-ed-taet"
                            label={t("page.personal.label_taetigkeitsbereich")}
                            value={editForm.taetigkeitsbereich}
                            onChange={(e) => setEditForm((f) => ({ ...f, taetigkeitsbereich: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-fach"
                            label={t("page.personal.label_fachrichtung")}
                            value={editForm.fachrichtung}
                            onChange={(e) => setEditForm((f) => ({ ...f, fachrichtung: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-tel"
                            label={t("common.phone")}
                            value={editForm.telefon}
                            onChange={(e) => setEditForm((f) => ({ ...f, telefon: e.target.value }))}
                        />
                        <Select
                            id="pers-ed-status"
                            label={t("page.personal.label_status")}
                            value={editForm.verfuegbar ? "1" : "0"}
                            onChange={(e) => setEditForm((f) => ({ ...f, verfuegbar: e.target.value === "1" }))}
                            options={[
                                { value: "1", label: t("page.personal.avail_yes") },
                                { value: "0", label: t("page.personal.avail_no") },
                            ]}
                        />
                        <div className="personal-detail-card__section">
                            <p className="text-title" style={{ margin: 0, fontSize: 14 }}>
                                {t("page.personal.perm_section_title")}
                            </p>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.personal.perm_section_desc")}
                            </p>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!selected || permBusy}
                                    onClick={() => {
                                        if (!selected) return;
                                        void (async () => {
                                            try {
                                                setPermBusy(true);
                                                const n = await resetPersonalPermissionOverrides(selected.id);
                                                setPermOverrides([]);
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(
                                                    n > 0
                                                        ? tp("page.personal.toast_perm_reset_ok", { n })
                                                        : t("page.personal.toast_perm_reset_none"),
                                                    "success",
                                                );
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            } finally {
                                                setPermBusy(false);
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.personal.perm_reset")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!selected || permBusy}
                                    onClick={() => {
                                        if (!selected) return;
                                        void (async () => {
                                            try {
                                                setPermBusy(true);
                                                const n = await grantPersonalAllPermissions(selected.id);
                                                const rows = RBAC_ALL_ACTIONS.map((action) => ({
                                                    action,
                                                    effect: "ALLOW" as const,
                                                }));
                                                setPermOverrides(rows);
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(tp("page.personal.toast_perm_grant", { n }), "success");
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            } finally {
                                                setPermBusy(false);
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.personal.perm_grant_all")}
                                </Button>
                            </div>
                            {permBusy ? (
                                <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>{t("page.personal.perm_loading")}</p>
                            ) : (
                                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13 }}>
                                    {permOverrides.map((row) => (
                                        <li key={row.action} style={{ marginBottom: 6 }}>
                                            <code>{row.action}</code> → <strong>{row.effect}</strong>{" "}
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                style={{ marginInlineStart: 8 }}
                                                onClick={() => {
                                                    if (!selected) return;
                                                    void (async () => {
                                                        try {
                                                            await deletePersonalPermissionOverride(selected.id, row.action);
                                                            setPermOverrides((prev) => prev.filter((x) => x.action !== row.action));
                                                            if (useAuthStore.getState().session?.user_id === selected.id) {
                                                                await checkSession();
                                                            }
                                                            toast(t("page.personal.toast_perm_removed"), "success");
                                                        } catch (e) {
                                                            toast(errorMessage(e), "error");
                                                        }
                                                    })();
                                                }}
                                            >
                                                {t("common.remove")}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <Input
                                    id="perm-action"
                                    label={t("page.personal.perm_action")}
                                    value={newPermAction}
                                    onChange={(e) => setNewPermAction(e.target.value)}
                                    placeholder={t("page.personal.perm_action_ph")}
                                    list="perm-action-hints"
                                    style={{ flex: "1 1 200px", minWidth: 160 }}
                                />
                                <datalist id="perm-action-hints">
                                    {RBAC_ALL_ACTIONS.map((action) => (
                                        <option key={action} value={action} />
                                    ))}
                                </datalist>
                                <Select
                                    id="perm-eff"
                                    label={t("page.personal.perm_effect")}
                                    value={newPermEffect}
                                    onChange={(e) => setNewPermEffect(e.target.value as "ALLOW" | "DENY")}
                                    options={[
                                        { value: "ALLOW", label: "ALLOW" },
                                        { value: "DENY", label: "DENY" },
                                    ]}
                                    style={{ width: 120 }}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        if (!selected) return;
                                        const a = newPermAction.trim();
                                        if (!a) {
                                            toast(t("page.personal.toast_perm_action_required"), "info");
                                            return;
                                        }
                                        void (async () => {
                                            try {
                                                await setPersonalPermissionOverride(selected.id, a, newPermEffect);
                                                setPermOverrides((prev) => {
                                                    const rest = prev.filter((x) => x.action !== a);
                                                    return [...rest, { action: a, effect: newPermEffect }].sort((x, y) =>
                                                        x.action.localeCompare(y.action),
                                                    );
                                                });
                                                setNewPermAction("");
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(t("page.personal.toast_perm_saved"), "success");
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.personal.perm_add")}
                                </Button>
                            </div>
                        </div>
                        <div className="personal-detail-card__section">
                            <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.personal.pw_reset_title")}</p>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.personal.pw_reset_desc")}
                            </p>
                            <Input
                                id="pers-ed-pw1"
                                type="password"
                                autoComplete="new-password"
                                label={t("page.personal.pw_new")}
                                value={resetPw}
                                error={resetPwError}
                                onChange={(e) => {
                                    setResetPw(e.target.value);
                                    if (resetPwError) setResetPwError(undefined);
                                }}
                            />
                            <PasswordPolicyHints password={resetPw} idPrefix="pers-ed" />
                            <Input
                                id="pers-ed-pw2"
                                type="password"
                                autoComplete="new-password"
                                label={t("page.personal.pw_confirm")}
                                value={resetPw2}
                                onChange={(e) => {
                                    setResetPw2(e.target.value);
                                    if (resetPwError) setResetPwError(undefined);
                                }}
                            />
                            <div className="row" style={{ justifyContent: "flex-end" }}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void handlePasswordReset()}
                                    disabled={resetBusy}
                                    loading={resetBusy}
                                >
                                    {t("page.personal.pw_set")}
                                </Button>
                            </div>
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleUpdate()} loading={editBusy} disabled={editBusy || resetBusy}>
                                {t("page.personal.save_master")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const p = selected;
            return (
                <Card className="personal-detail-card">
                    <CardHeader
                        title={p.name}
                        subtitle={t("page.personal.detail_subtitle")}
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                        <EditIcon size={14} /> {t("common.edit")}
                                    </Button>
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(p.id)}>
                                        {t("common.remove")}
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="personal-detail-card__body">
                        <div className="personal-read-grid">
                            {readField(t("common.email"), p.email)}
                            {readField(t("common.role"), p.rolle)}
                            {readField(t("page.personal.label_taetigkeitsbereich"), p.taetigkeitsbereich ?? "—")}
                            {readField(t("page.personal.label_fachrichtung"), p.fachrichtung ?? "—")}
                            {readField(t("common.phone"), p.telefon ?? "—")}
                            {readField(t("page.personal.avail_yes"), p.verfuegbar ? t("common.yes") : t("common.no"))}
                            <div style={{ gridColumn: "1 / -1" }}>
                                {readField(t("page.personal.label_created"), formatDate(p.created_at))}
                            </div>
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="personal-detail-card personal-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("page.personal.select_hint_write")
                        : t("page.personal.select_hint_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="personal-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.personal.title")}
                subtitle={quotaSubtitle}
                actions={
                    <>
                        <Link to="/personal/arbeitsplan" className="btn btn-subtle">
                            {t("page.personal.link_arbeitsplan")}
                        </Link>
                        {canWrite ? (
                            <Button
                                type="button"
                                variant={creating ? "secondary" : "primary"}
                                onClick={creating ? cancelCreate : openCreate}
                                disabled={!creating && atStaffCap}
                            >
                                {creating ? t("common.cancel") : t("page.personal.btn_new")}
                            </Button>
                        ) : null}
                    </>
                }
            />

            {loading ? (
                <PageLoading label={t("page.personal.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="personal-workspace">
                    <div className="personal-workspace__list">
                        {sorted.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="👤"
                                    title={t("page.personal.empty_title")}
                                    description={
                                        canWrite ? t("page.personal.empty_desc_write") : t("page.personal.empty_desc_read")
                                    }
                                />
                            </Card>
                        ) : (
                            <div className="card personal-table-card tbl-data-card tbl-scroll">
                                <table className="tbl personal-tbl">
                                    <thead>
                                        <tr>
                                            <th scope="col" aria-label={t("common.avatar")} />
                                            <th scope="col">{t("page.personal.col_name")}</th>
                                            <th scope="col">{t("page.personal.col_role")}</th>
                                            <th scope="col">{t("page.personal.col_email")}</th>
                                            <th scope="col" style={{ textAlign: "end" }}>{t("page.personal.col_availability")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map((p) => {
                                            const isSel = !creating && selected?.id === p.id;
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={isSel ? "personal-row--selected" : undefined}
                                                    onClick={() => selectRow(p)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td>
                                                        <span className="av av--accent">
                                                            {initialsFromName(p.name)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{p.name}</span>
                                                    </td>
                                                    <td>
                                                        <span className="page-sub" style={{ fontSize: 13 }}>{p.rolle}</span>
                                                    </td>
                                                    <td>
                                                        <span className="page-sub" style={{ fontSize: 13, color: "var(--fg-3)" }}>{p.email}</span>
                                                    </td>
                                                    <td style={{ textAlign: "end" }}>
                                                        <Badge variant={p.verfuegbar ? "success" : "default"}>
                                                            {p.verfuegbar ? t("page.personal.avail_yes") : t("page.personal.avail_no")}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div className="personal-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => !deleteBusy && setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.personal.delete_title")}
                message={t("page.personal.delete_message")}
                confirmLabel={t("common.remove")}
                danger
                loading={deleteBusy}
            />
        </div>
    );
}
