import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { checkSession } from "@/systems/practice-host/controllers/auth.controller";
import {
    adminUnlockBruteForce,
    createStaff,
    deleteStaff,
    deleteStaffPermissionOverride,
    getStaffQuota,
    grantStaffAllPermissions,
    listStaff,
    listStaffPermissionOverrides,
    resetStaffPermissionOverrides,
    setStaffFullChartReadonly,
    setStaffPasswordByAdmin,
    setStaffPermissionOverride,
    updateStaff,
    type StaffQuota,
} from "@/systems/practice-host/controllers/staff.controller";
import { MAX_TOTAL_STAFF } from "@/lib/mvp-security-config";
import { allowed, isFullChartReadonlyOverrideActive, parseRole, RBAC_ALL_ACTIONS } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { errorMessage, formatDate } from "@/lib/utils";
import type { Staff } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon } from "@/lib/icons";
import { passwordPolicyError } from "@/lib/password-policy";
import { PasswordPolicyHints } from "../components/password-policy-hints";
import type { Role } from "@/models/types";
import { ACTIVE_ROLE_WIRES } from "@/lib/deferred-roles";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";

function initialsFromName(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("");
}

const ROLE_VALUE_OPTIONS = [
    { value: "PHYSICIAN" as const, key: "enum.role.physician" },
    { value: "RECEPTION" as const, key: "enum.role.reception" },
] as const satisfies ReadonlyArray<{ value: (typeof ACTIVE_ROLE_WIRES)[number]; key: string }>;

function formatQuotaLine(used: number, max: number, t: (key: string) => string): string {
    const base = `${used}/${max}`;
    return used > max ? `${base} ${t("page.staff.quota_limit_exceeded")}` : base;
}

function quotaOverCapHint(staffQuota: StaffQuota, t: (key: string) => string): string | null {
    const over =
        staffQuota.used_physician > staffQuota.max_physician ||
        staffQuota.used_reception > staffQuota.max_reception ||
        staffQuota.used_total > staffQuota.max_total;
    if (!over) return null;
    return t("page.staff.quota_over_cap");
}

export function StaffPage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "RECEPTION" });
    const [createErrors, setCreateErrors] = useState<{ name?: string; email?: string; password?: string }>({});
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Staff | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        role: "RECEPTION" as Role,
        activity_area: "",
        specialty: "",
        phone: "",
        available: true,
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
    const role = parseRole(session?.role);
    const canWrite = role != null && allowed("staff.write", role, session?.permission_overrides);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const [p, quota] = await Promise.all([listStaff(), getStaffQuota()]);
                setStaff(p);
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
        void listStaffPermissionOverrides(selected.id)
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
                if (!cancelled) toast(tp("page.staff.toast_perm_load_failed", { message: errorMessage(e) }), "error");
            })
            .finally(() => {
                if (!cancelled) setPermBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selected?.id, detailEdit, canWrite, toast, tp]);

    const newFromQuery = searchParams.get("new");
    useEffect(() => {
        if (newFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm({ name: "", email: "", password: "", role: "RECEPTION" });
        setCreateErrors({});
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("new");
                return n;
            },
            { replace: true },
        );
    }, [newFromQuery, canWrite, setSearchParams]);

    const toEditForm = (p: Staff) => ({
        name: p.name,
        email: p.email,
        role: p.role,
        activity_area: p.activity_area ?? "",
        specialty: p.specialty ?? "",
        phone: p.phone ?? "",
        available: p.available,
    });

    const openCreate = () => {
        if (staffQuota && staffQuota.used_total >= staffQuota.max_total) {
            toast(tp("page.staff.toast_max_users", { max: MAX_TOTAL_STAFF }), "error");
            return;
        }
        setCreating(true);
        setDetailEdit(false);
        setSelected(null);
        setCreateForm({ name: "", email: "", password: "", role: "RECEPTION" });
        setCreateErrors({});
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm({ name: "", email: "", password: "", role: "RECEPTION" });
    };

    const selectRow = (p: Staff) => {
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
            setResetPwError(t("page.staff.toast_pw_required"));
            return;
        }
        const policyErr = passwordPolicyError(t, resetPw);
        if (policyErr) {
            setResetPwError(policyErr);
            return;
        }
        if (resetPw !== resetPw2) {
            setResetPwError(t("page.staff.toast_pw_mismatch"));
            return;
        }
        setResetBusy(true);
        try {
            await setStaffPasswordByAdmin(selected.id, resetPw);
            toast(t("page.staff.toast_pw_set"), "success");
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
            toast(t("page.staff.toast_name_email_required"), "error");
            return;
        }
        setEditBusy(true);
        try {
            const updated = await updateStaff(selected.id, {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                role: editForm.role,
                activity_area: editForm.activity_area.trim() || null,
                specialty: editForm.specialty.trim() || null,
                phone: editForm.phone.trim() || null,
                available: editForm.available,
            });
            toast(t("page.staff.toast_saved"), "success");
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
        if (!createForm.name.trim()) next.name = t("page.staff.err_name_required");
        if (!createForm.email.trim()) {
            next.email = t("page.staff.err_email_required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(createForm.email.trim())) {
            next.email = t("page.staff.err_email_invalid");
        }
        if (!createForm.password) {
            next.password = t("page.staff.err_password_required");
        } else {
            const policyErr = passwordPolicyError(t, createForm.password);
            if (policyErr) next.password = policyErr;
        }
        setCreateErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleCreate = async () => {
        if (!canWrite || !validateCreate()) return;
        setCreateBusy(true);
        try {
            const created = await createStaff({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                password: createForm.password,
                role: createForm.role,
            });
            toast(t("page.staff.toast_created"), "success");
            setCreating(false);
            setCreateForm({ name: "", email: "", password: "", role: "RECEPTION" });
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
            await deleteStaff(deleteId);
            toast(t("page.staff.toast_removed"), "success");
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
        () => [...staff].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [staff],
    );

    const roleOptions = useMemo(
        () => ROLE_VALUE_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) })),
        [t],
    );

    const availableRoleOptions = useMemo(() => {
        if (!staffQuota) return roleOptions;
        return roleOptions.filter((o) => {
            if (o.value === "PHYSICIAN") {
                if (detailEdit && selected?.role === "PHYSICIAN") return true;
                return staffQuota.used_physician < staffQuota.max_physician;
            }
            if (o.value === "RECEPTION") {
                if (detailEdit && selected?.role === "RECEPTION") return true;
                return staffQuota.used_reception < staffQuota.max_reception;
            }
            return true;
        });
    }, [staffQuota, selected?.role, detailEdit, roleOptions]);

    const atStaffCap = staffQuota != null && staffQuota.used_total >= staffQuota.max_total;

    const overCapHint = staffQuota ? quotaOverCapHint(staffQuota, t) : null;

    const quotaSubtitle = staffQuota
        ? tp("page.staff.subtitle_quota", {
              physician: formatQuotaLine(staffQuota.used_physician, staffQuota.max_physician, t),
              reception: formatQuotaLine(staffQuota.used_reception, staffQuota.max_reception, t),
              max: MAX_TOTAL_STAFF,
              overCap: overCapHint ? ` — ${overCapHint}` : "",
          })
        : t("page.staff.subtitle_default");

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
                <Card className="staff-detail-card">
                    <CardHeader
                        title={t("page.staff.create_title")}
                        subtitle={t("page.staff.create_subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="staff-detail-card__body">
                        <Input
                            id="pers-new-name"
                            label={t("page.staff.label_name_req")}
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
                            label={t("page.staff.label_email_req")}
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
                            label={t("page.staff.label_password_req")}
                            value={createForm.password}
                            error={createErrors.password}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, password: e.target.value }));
                                if (createErrors.password) setCreateErrors((x) => ({ ...x, password: undefined }));
                            }}
                        />
                        <PasswordPolicyHints password={createForm.password} idPrefix="pers-new" />
                        <Select
                            id="pers-new-role"
                            label={t("common.role")}
                            value={createForm.role}
                            onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                            options={availableRoleOptions.map((o) => ({ value: o.value, label: o.label }))}
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
                <Card className="staff-detail-card">
                    <CardHeader
                        title={t("page.staff.edit_title")}
                        subtitle={t("page.staff.edit_subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy || resetBusy}>
                                {t("common.cancel")}
                            </Button>
                        }
                    />
                    <div className="staff-detail-card__body">
                        <Input
                            id="pers-ed-name"
                            label={t("page.staff.label_name_req")}
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-email"
                            type="email"
                            label={t("page.staff.label_email_req")}
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
                                            toast(t("page.staff.toast_email_required"), "error");
                                            return;
                                        }
                                        void (async () => {
                                            try {
                                                const n = await adminUnlockBruteForce(editForm.email);
                                                toast(
                                                    n > 0
                                                        ? tp("page.staff.toast_unlock_ok", { n })
                                                        : t("page.staff.toast_unlock_none"),
                                                    n > 0 ? "success" : "info",
                                                );
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.staff.unlock_btn")}
                                </Button>
                                <span className="card-sub" style={{ margin: 0 }}>
                                    {t("page.staff.unlock_hint")}
                                </span>
                            </div>
                        ) : null}
                        <Select
                            id="pers-ed-role"
                            label={t("common.role")}
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                            options={availableRoleOptions.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <Input
                            id="pers-ed-taet"
                            label={t("page.staff.label_activity_area")}
                            value={editForm.activity_area}
                            onChange={(e) => setEditForm((f) => ({ ...f, activity_area: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-fach"
                            label={t("page.staff.label_specialty")}
                            value={editForm.specialty}
                            onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-tel"
                            label={t("common.phone")}
                            value={editForm.phone}
                            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                        <Select
                            id="pers-ed-status"
                            label={t("page.staff.label_status")}
                            value={editForm.available ? "1" : "0"}
                            onChange={(e) => setEditForm((f) => ({ ...f, available: e.target.value === "1" }))}
                            options={[
                                { value: "1", label: t("page.staff.avail_yes") },
                                { value: "0", label: t("page.staff.avail_no") },
                            ]}
                        />
                        <div className="staff-detail-card__section">
                            <p className="text-title" style={{ margin: 0, fontSize: 14 }}>
                                {t("page.staff.perm_section_title")}
                            </p>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.staff.perm_section_desc")}
                            </p>
                            <label
                                className="row"
                                style={{
                                    gap: 10,
                                    alignItems: "flex-start",
                                    padding: "10px 12px",
                                    border: "1px solid var(--line)",
                                    borderRadius: 10,
                                    background: "var(--bg-elev)",
                                    cursor: selected && !permBusy ? "pointer" : "default",
                                    opacity: permBusy ? 0.7 : 1,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    style={{ marginTop: 3 }}
                                    checked={isFullChartReadonlyOverrideActive(permOverrides)}
                                    disabled={!selected || permBusy}
                                    onChange={(e) => {
                                        if (!selected) return;
                                        const enabled = e.target.checked;
                                        void (async () => {
                                            try {
                                                setPermBusy(true);
                                                await setStaffFullChartReadonly(selected.id, enabled);
                                                setPermOverrides((prev) => {
                                                    const rest = prev.filter(
                                                        (x) =>
                                                            x.action !== "patient.read_medical"
                                                            && x.action !== "patient.write_medical",
                                                    );
                                                    if (!enabled) return rest;
                                                    return [
                                                        ...rest,
                                                        { action: "patient.read_medical", effect: "ALLOW" as const },
                                                        { action: "patient.write_medical", effect: "DENY" as const },
                                                    ].sort((a, b) => a.action.localeCompare(b.action));
                                                });
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(
                                                    enabled
                                                        ? t("page.staff.toast_chart_readonly_on")
                                                        : t("page.staff.toast_chart_readonly_off"),
                                                    "success",
                                                );
                                            } catch (err) {
                                                toast(errorMessage(err), "error");
                                            } finally {
                                                setPermBusy(false);
                                            }
                                        })();
                                    }}
                                />
                                <span>
                                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                                        {t("page.staff.chart_readonly_title")}
                                    </span>
                                    <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.45, marginTop: 2 }}>
                                        {t("page.staff.chart_readonly_desc")}
                                    </span>
                                </span>
                            </label>
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
                                                const n = await resetStaffPermissionOverrides(selected.id);
                                                setPermOverrides([]);
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(
                                                    n > 0
                                                        ? tp("page.staff.toast_perm_reset_ok", { n })
                                                        : t("page.staff.toast_perm_reset_none"),
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
                                    {t("page.staff.perm_reset")}
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
                                                const n = await grantStaffAllPermissions(selected.id);
                                                const rows = RBAC_ALL_ACTIONS.map((action) => ({
                                                    action,
                                                    effect: "ALLOW" as const,
                                                }));
                                                setPermOverrides(rows);
                                                if (useAuthStore.getState().session?.user_id === selected.id) {
                                                    await checkSession();
                                                }
                                                toast(tp("page.staff.toast_perm_grant", { n }), "success");
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            } finally {
                                                setPermBusy(false);
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.staff.perm_grant_all")}
                                </Button>
                            </div>
                            {permBusy ? (
                                <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>{t("page.staff.perm_loading")}</p>
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
                                                            await deleteStaffPermissionOverride(selected.id, row.action);
                                                            setPermOverrides((prev) => prev.filter((x) => x.action !== row.action));
                                                            if (useAuthStore.getState().session?.user_id === selected.id) {
                                                                await checkSession();
                                                            }
                                                            toast(t("page.staff.toast_perm_removed"), "success");
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
                                    label={t("page.staff.perm_action")}
                                    value={newPermAction}
                                    onChange={(e) => setNewPermAction(e.target.value)}
                                    placeholder={t("page.staff.perm_action_ph")}
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
                                    label={t("page.staff.perm_effect")}
                                    value={newPermEffect}
                                    onChange={(e) => setNewPermEffect(e.target.value as "ALLOW" | "DENY")}
                                    options={[
                                        { value: "ALLOW", label: t("page.staff.perm_effect_allow") },
                                        { value: "DENY", label: t("page.staff.perm_effect_deny") },
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
                                            toast(t("page.staff.toast_perm_action_required"), "info");
                                            return;
                                        }
                                        void (async () => {
                                            try {
                                                await setStaffPermissionOverride(selected.id, a, newPermEffect);
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
                                                toast(t("page.staff.toast_perm_saved"), "success");
                                            } catch (e) {
                                                toast(errorMessage(e), "error");
                                            }
                                        })();
                                    }}
                                >
                                    {t("page.staff.perm_add")}
                                </Button>
                            </div>
                        </div>
                        <div className="staff-detail-card__section">
                            <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.staff.pw_reset_title")}</p>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.staff.pw_reset_desc")}
                            </p>
                            <Input
                                id="pers-ed-pw1"
                                type="password"
                                autoComplete="new-password"
                                label={t("page.staff.pw_new")}
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
                                label={t("page.staff.pw_confirm")}
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
                                    {t("page.staff.pw_set")}
                                </Button>
                            </div>
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleUpdate()} loading={editBusy} disabled={editBusy || resetBusy}>
                                {t("page.staff.save_master")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const p = selected;
            return (
                <Card className="staff-detail-card">
                    <CardHeader
                        title={p.name}
                        subtitle={t("page.staff.detail_subtitle")}
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
                    <div className="staff-detail-card__body">
                        <div className="staff-read-grid">
                            {readField(t("common.email"), p.email)}
                            {readField(t("common.role"), p.role)}
                            {readField(t("page.staff.label_activity_area"), p.activity_area ?? "—")}
                            {readField(t("page.staff.label_specialty"), p.specialty ?? "—")}
                            {readField(t("common.phone"), p.phone ?? "—")}
                            {readField(t("page.staff.avail_yes"), p.available ? t("common.yes") : t("common.no"))}
                            <div style={{ gridColumn: "1 / -1" }}>
                                {readField(t("page.staff.label_created"), formatDate(p.created_at))}
                            </div>
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="staff-detail-card staff-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("page.staff.select_hint_write")
                        : t("page.staff.select_hint_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="staff-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                title={t("page.staff.title")}
                subtitle={quotaSubtitle}
                actions={
                    <>
                        <Link to="/staff/work-plan" className="btn btn-subtle">
                            {t("page.staff.link_work_plan")}
                        </Link>
                        {canWrite ? (
                            <Button
                                type="button"
                                variant={creating ? "secondary" : "primary"}
                                onClick={creating ? cancelCreate : openCreate}
                                disabled={!creating && atStaffCap}
                            >
                                {creating ? t("common.cancel") : t("page.staff.btn_new")}
                            </Button>
                        ) : null}
                    </>
                }
            />

            {loading ? (
                <PageLoading label={t("page.staff.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="staff-workspace">
                    <div className="staff-workspace__list">
                        {sorted.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="👤"
                                    title={t("page.staff.empty_title")}
                                    description={
                                        canWrite ? t("page.staff.empty_desc_write") : t("page.staff.empty_desc_read")
                                    }
                                />
                            </Card>
                        ) : (
                            <div className="card staff-table-card tbl-data-card tbl-scroll">
                                <table className="tbl staff-tbl">
                                    <thead>
                                        <tr>
                                            <th scope="col" aria-label={t("common.avatar")} />
                                            <th scope="col">{t("page.staff.col_name")}</th>
                                            <th scope="col">{t("page.staff.col_role")}</th>
                                            <th scope="col">{t("page.staff.col_email")}</th>
                                            <th scope="col" style={{ textAlign: "end" }}>{t("page.staff.col_availability")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map((p) => {
                                            const isSel = !creating && selected?.id === p.id;
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={isSel ? "staff-row--selected" : undefined}
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
                                                        <span className="page-sub" style={{ fontSize: 13 }}>{p.role}</span>
                                                    </td>
                                                    <td>
                                                        <span className="page-sub" style={{ fontSize: 13, color: "var(--fg-3)" }}>{p.email}</span>
                                                    </td>
                                                    <td style={{ textAlign: "end" }}>
                                                        <Badge variant={p.available ? "success" : "default"}>
                                                            {p.available ? t("page.staff.avail_yes") : t("page.staff.avail_no")}
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
                    <div className="staff-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => !deleteBusy && setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.staff.delete_title")}
                message={t("page.staff.delete_message")}
                confirmLabel={t("common.remove")}
                danger
                loading={deleteBusy}
            />
        </div>
    );
}
