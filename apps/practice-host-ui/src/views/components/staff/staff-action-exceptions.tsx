/**
 * Single-action exceptions for one person (FA-PERS-07): ALLOW / DENY one permission on top of
 * their role, the "full chart, read only" shortcut, and resetting them. Most changes belong in
 * the role and privileges above (StaffAccessPanel); these are for rare exceptions.
 */
import { useEffect, useState } from "react";
import { checkSession } from "@/systems/practice-host/controllers/auth.controller";
import {
    deleteStaffPermissionOverride,
    grantStaffAllPermissions,
    listStaffPermissionOverrides,
    resetStaffPermissionOverrides,
    setStaffFullChartReadonly,
    setStaffPermissionOverride,
} from "@/systems/practice-host/controllers/staff.controller";
import { isFullChartReadonlyOverrideActive, RBAC_ALL_ACTIONS } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { errorMessage } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/input";
import { useToastStore } from "../ui/toast-store";

export function StaffActionExceptions({ staffId }: { staffId: string }) {
    const [permOverrides, setPermOverrides] = useState<{ action: string; effect: "ALLOW" | "DENY" }[]>([]);
    const [permBusy, setPermBusy] = useState(false);
    const [newPermAction, setNewPermAction] = useState("");
    const [newPermEffect, setNewPermEffect] = useState<"ALLOW" | "DENY">("DENY");
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        let cancelled = false;
        setPermBusy(true);
        void listStaffPermissionOverrides(staffId)
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
    }, [staffId, toast, tp]);

    return (
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
                    gap: "var(--space-3)",
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    background: "var(--bg-elev)",
                    cursor: !permBusy ? "pointer" : "default",
                    opacity: permBusy ? 0.7 : 1,
                }}
            >
                <input
                    type="checkbox"
                    style={{ marginTop: "var(--space-1)" }}
                    checked={isFullChartReadonlyOverrideActive(permOverrides)}
                    disabled={permBusy}
                    onChange={(e) => {
                                                const enabled = e.target.checked;
                        void (async () => {
                            try {
                                setPermBusy(true);
                                await setStaffFullChartReadonly(staffId, enabled);
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
                                if (useAuthStore.getState().session?.user_id === staffId) {
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
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={permBusy}
                    onClick={() => {
                                                void (async () => {
                            try {
                                setPermBusy(true);
                                const n = await resetStaffPermissionOverrides(staffId);
                                setPermOverrides([]);
                                if (useAuthStore.getState().session?.user_id === staffId) {
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
                    disabled={permBusy}
                    onClick={() => {
                                                void (async () => {
                            try {
                                setPermBusy(true);
                                const n = await grantStaffAllPermissions(staffId);
                                const rows = RBAC_ALL_ACTIONS.map((action) => ({
                                    action,
                                    effect: "ALLOW" as const,
                                }));
                                setPermOverrides(rows);
                                if (useAuthStore.getState().session?.user_id === staffId) {
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
                <ul style={{ margin: 0, paddingInlineStart: "var(--space-4)", fontSize: 13 }}>
                    {permOverrides.map((row) => (
                        <li key={row.action} style={{ marginBottom: "var(--space-2)" }}>
                            <code>{row.action}</code> → <strong>{row.effect}</strong>{" "}
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ marginInlineStart: "var(--space-2)" }}
                                onClick={() => {
                                                                        void (async () => {
                                        const removed = row;
                                        try {
                                            await deleteStaffPermissionOverride(staffId, removed.action);
                                            setPermOverrides((prev) => prev.filter((x) => x.action !== removed.action));
                                            if (useAuthStore.getState().session?.user_id === staffId) {
                                                await checkSession();
                                            }
                                            toast(t("page.staff.toast_perm_removed"), "success", {
                                                onUndo: async () => {
                                                    try {
                                                        await setStaffPermissionOverride(staffId, removed.action, removed.effect);
                                                        setPermOverrides((prev) => {
                                                            const rest = prev.filter((x) => x.action !== removed.action);
                                                            return [...rest, removed].sort((x, y) =>
                                                                x.action.localeCompare(y.action),
                                                            );
                                                        });
                                                        if (useAuthStore.getState().session?.user_id === staffId) {
                                                            await checkSession();
                                                        }
                                                    } catch (err) {
                                                        toast(errorMessage(err), "error");
                                                    }
                                                },
                                            });
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
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
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
                                                const a = newPermAction.trim();
                        if (!a) {
                            toast(t("page.staff.toast_perm_action_required"), "info");
                            return;
                        }
                        void (async () => {
                            const previous = permOverrides.find((row) => row.action === a);
                            try {
                                await setStaffPermissionOverride(staffId, a, newPermEffect);
                                setPermOverrides((prev) => {
                                    const rest = prev.filter((x) => x.action !== a);
                                    return [...rest, { action: a, effect: newPermEffect }].sort((x, y) =>
                                        x.action.localeCompare(y.action),
                                    );
                                });
                                setNewPermAction("");
                                if (useAuthStore.getState().session?.user_id === staffId) {
                                    await checkSession();
                                }
                                toast(t("page.staff.toast_perm_saved"), "success", {
                                    onUndo: async () => {
                                        try {
                                            if (previous) {
                                                await setStaffPermissionOverride(staffId, a, previous.effect);
                                                setPermOverrides((prev) => {
                                                    const rest = prev.filter((x) => x.action !== a);
                                                    return [...rest, previous].sort((x, y) =>
                                                        x.action.localeCompare(y.action),
                                                    );
                                                });
                                            } else {
                                                await deleteStaffPermissionOverride(staffId, a);
                                                setPermOverrides((prev) => prev.filter((x) => x.action !== a));
                                            }
                                            if (useAuthStore.getState().session?.user_id === staffId) {
                                                await checkSession();
                                            }
                                        } catch (err) {
                                            toast(errorMessage(err), "error");
                                        }
                                    },
                                });
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
    );
}
