import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getAppKv, setAppKv } from "@/controllers/settings-page.controller";
import {
    buildInvoiceHeaderAddressLines,
    getInvoicePraxisFromStorage,
    hydrateInvoicePraxisFromAppKv,
    isValidPraxisDigitId,
    isValidPraxisIban,
    praxisRechnungPflichtMissing,
    saveInvoicePraxisToStorage,
    syncInvoicePraxisToAppKv,
    type InvoicePraxis,
} from "@/lib/invoice-leistung";
import {
    loadPraxisHeaderPrivacy,
    savePraxisHeaderPrivacy,
    maskPraxisExportToken,
    type PraxisHeaderPrivacyKey,
    type PraxisHeaderPrivacyV1,
} from "@/lib/praxis-header-privacy";
import { errorMessage } from "@/lib/utils";
import { ChevronRightIcon, EyeIcon, EyeOffIcon, UploadCircleIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { EinstellungenPraxisBillingSection } from "./einstellungen-praxis-billing";

function formatAddrOneLine(addr: string): string {
    return addr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
}

export type EinstellungenPraxisSectionProps = {
    sessionUserId: string | undefined;
    onOpenArbeitsablaeufe: () => void;
};

export function EinstellungenPraxisSection({ sessionUserId, onOpenArbeitsablaeufe }: EinstellungenPraxisSectionProps) {
    const toast = useToastStore((s) => s.add);
    const [editPraxisName, setEditPraxisName] = useState(false);
    const [draftPraxisName, setDraftPraxisName] = useState("");
    const [editPraxisAddr, setEditPraxisAddr] = useState(false);
    const [draftPraxisAddr, setDraftPraxisAddr] = useState("");
    const [editPraxisOeffnungszeiten, setEditPraxisOeffnungszeiten] = useState(false);
    const [draftPraxisOeffnungszeiten, setDraftPraxisOeffnungszeiten] = useState("");
    const [editPraxisKv, setEditPraxisKv] = useState(false);
    const [draftPraxisKv, setDraftPraxisKv] = useState("");
    const [editPraxisExtra, setEditPraxisExtra] = useState(false);
    const [praxisExtraSnapshot, setPraxisExtraSnapshot] = useState<InvoicePraxis | null>(null);
    const [editPraxisBilling, setEditPraxisBilling] = useState(false);
    const [praxisBillingSnapshot, setPraxisBillingSnapshot] = useState<InvoicePraxis | null>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [praxis, setPraxis] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const raw = await getAppKv("praxis.logo.v1");
                if (c || !raw) return;
                const j = JSON.parse(raw) as { mime?: string; data?: string };
                if (j.mime && j.data) setLogoPreviewUrl(`data:${j.mime};base64,${j.data}`);
            } catch {
                /* Web / fehlend */
            }
        })();
        return () => {
            c = true;
        };
    }, []);

    useEffect(() => {
        const editingPraxis =
            editPraxisName ||
            editPraxisAddr ||
            editPraxisOeffnungszeiten ||
            editPraxisKv ||
            editPraxisExtra ||
            editPraxisBilling;
        if (!sessionUserId || editingPraxis) return;
        let cancelled = false;
        void hydrateInvoicePraxisFromAppKv().then((fromKv) => {
            if (cancelled || !fromKv) return;
            setPraxis(fromKv);
            setDraftPraxisName(fromKv.name);
            setDraftPraxisAddr(fromKv.addr);
            setDraftPraxisOeffnungszeiten(fromKv.oeffnungszeiten ?? "");
            setDraftPraxisKv(fromKv.kv_nummer ?? "");
        });
        return () => {
            cancelled = true;
        };
    }, [
        sessionUserId,
        editPraxisName,
        editPraxisAddr,
        editPraxisOeffnungszeiten,
        editPraxisKv,
        editPraxisExtra,
        editPraxisBilling,
    ]);

    function applyPraxisPatch(patch: Partial<InvoicePraxis>) {
        setPraxis((p) => {
            const next = { ...p, ...patch };
            saveInvoicePraxisToStorage(next);
            void syncInvoicePraxisToAppKv(next).catch((e) => {
                toast(`Praxis-Synchronisation fehlgeschlagen: ${errorMessage(e)}`, "warning");
            });
            return next;
        });
    }

    function savePraxisName() {
        const t = draftPraxisName.trim();
        if (!t) {
            toast("Praxisname erforderlich", "error");
            return;
        }
        applyPraxisPatch({ name: t });
        toast("Praxisname gespeichert", "success");
        setEditPraxisName(false);
    }

    function savePraxisAddr() {
        const t = draftPraxisAddr.trim();
        if (!t) {
            toast("Adresse erforderlich", "error");
            return;
        }
        applyPraxisPatch({ addr: draftPraxisAddr });
        toast("Adresse gespeichert", "success");
        setEditPraxisAddr(false);
    }

    function savePraxisOeffnungszeiten() {
        applyPraxisPatch({ oeffnungszeiten: draftPraxisOeffnungszeiten.trim() || undefined });
        toast("Öffnungszeiten gespeichert", "success");
        setEditPraxisOeffnungszeiten(false);
    }

    function savePraxisKv() {
        const t = draftPraxisKv.trim();
        if (!t) {
            toast("KV-Nummer erforderlich", "error");
            return;
        }
        applyPraxisPatch({ kv_nummer: t });
        toast("KV-Nummer gespeichert", "success");
        setEditPraxisKv(false);
    }

    function startEditPraxisExtra() {
        setPraxisExtraSnapshot({ ...praxis });
        setEditPraxisExtra(true);
    }

    function cancelPraxisExtra() {
        if (praxisExtraSnapshot) setPraxis(praxisExtraSnapshot);
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    function savePraxisExtra() {
        saveInvoicePraxisToStorage(praxis);
        void syncInvoicePraxisToAppKv(praxis).catch((e) => {
            toast(`Praxis-Synchronisation fehlgeschlagen: ${errorMessage(e)}`, "warning");
        });
        toast("Kontakt & Steuern gespeichert", "success");
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    const praxisBillingIncomplete = useMemo(() => praxisRechnungPflichtMissing(praxis), [praxis]);

    function startEditPraxisBilling() {
        setPraxisBillingSnapshot({ ...praxis });
        setEditPraxisBilling(true);
    }

    function cancelPraxisBilling() {
        if (praxisBillingSnapshot) setPraxis(praxisBillingSnapshot);
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    function savePraxisBilling() {
        const zanr = (praxis.zanr ?? "").trim();
        const bsnr = (praxis.bsnr ?? "").trim();
        const iban = (praxis.bankverbindung_iban ?? "").trim();
        if (zanr && !isValidPraxisDigitId(zanr)) {
            toast("ZANR: genau 9 Ziffern erforderlich", "error");
            return;
        }
        if (bsnr && !isValidPraxisDigitId(bsnr)) {
            toast("BSNR: genau 9 Ziffern erforderlich", "error");
            return;
        }
        if (iban && !isValidPraxisIban(iban)) {
            toast("IBAN: ungültiges Format (DE: DE + 20 Ziffern)", "error");
            return;
        }
        const zt = praxis.zahlungsziel_tage ?? 14;
        const next: InvoicePraxis = {
            ...praxis,
            zahlungsziel_tage: Number.isFinite(zt) && zt > 0 ? Math.round(zt) : 14,
            ust_befreiung_hinweis:
                (praxis.ust_befreiung_hinweis ?? "").trim() || "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG",
        };
        setPraxis(next);
        saveInvoicePraxisToStorage(next);
        void syncInvoicePraxisToAppKv(next).catch((e) => {
            toast(`Praxis-Synchronisation fehlgeschlagen: ${errorMessage(e)}`, "warning");
        });
        toast("Rechnungs-Stammdaten gespeichert", "success");
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    async function onPraxisLogoFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 750_000) {
            toast("Datei zu groß (max. ca. 750 KB)", "error");
            return;
        }
        setLogoBusy(true);
        try {
            const buf = await f.arrayBuffer();
            let bin = "";
            const bytes = new Uint8Array(buf);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
            const data = btoa(bin);
            const mime = f.type && f.type.startsWith("image/") ? f.type : "image/png";
            await setAppKv("praxis.logo.v1", JSON.stringify({ mime, data }));
            setLogoPreviewUrl(`data:${mime};base64,${data}`);
            toast("Logo gespeichert", "success");
        } catch (err) {
            toast(`Logo: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
            setLogoBusy(false);
        }
    }

    return (
        <>
    <section className="settings-subcard">
        <div className="card-head">
            <div>
                <div className="card-title">Praxis</div>
                <p className="card-sub">Grunddaten · werden auf Rezepten und Rechnungen gedruckt</p>
            </div>
        </div>
        {praxisBillingIncomplete ? (
            <div
                className="card-pad"
                role="status"
                style={{
                    margin: "0 var(--card-pad-x) var(--space-3)",
                    padding: "var(--space-3)",
                    borderRadius: 8,
                    background: "var(--warn-bg, #fff8e6)",
                    border: "1px solid var(--warn-border, #e6c200)",
                    color: "var(--text)",
                    fontSize: "0.92rem",
                }}
            >
                <strong>Wichtig:</strong> Pflichtangaben für Rechnungen/Rezepte fehlen. Bitte füllen Sie
                Behandler-Name, ZANR, BSNR und IBAN aus.
            </div>
        ) : null}
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>Praxisname</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(praxis.name ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisName ? (
                    <>
                        <Input
                            value={draftPraxisName}
                            onChange={(e) => setDraftPraxisName(e.target.value)}
                            aria-label="Praxisname"
                            style={{ minWidth: 160, maxWidth: 280 }}
                        />
                        <Button type="button" onClick={() => void savePraxisName()}>Speichern</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisName(praxis.name);
                                setEditPraxisName(false);
                            }}
                        >
                            Abbrechen
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPraxisName(praxis.name);
                            setEditPraxisName(true);
                        }}
                    >
                        Bearbeiten
                    </Button>
                )}
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12, flexDirection: "column" }}>
            <div className="row" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span className="settings-field-label">
                        <b>Adresse</b>
                        <span className="req" aria-hidden>
                            *
                        </span>
                    </span>
                    <div className="settings-row-muted">{formatAddrOneLine(praxis.addr) || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editPraxisAddr ? (
                        <>
                            <Button type="button" onClick={() => void savePraxisAddr()}>Speichern</Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setDraftPraxisAddr(praxis.addr);
                                    setEditPraxisAddr(false);
                                }}
                            >
                                Abbrechen
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisAddr(praxis.addr);
                                setEditPraxisAddr(true);
                            }}
                        >
                            Bearbeiten
                        </Button>
                    )}
                </div>
            </div>
            {editPraxisAddr ? (
                <PraxisAddressArea label="Adresse bearbeiten" value={draftPraxisAddr} onChange={setDraftPraxisAddr} />
            ) : null}
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>Öffnungszeiten</b>
                <div className="settings-row-muted">{(praxis.oeffnungszeiten ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisOeffnungszeiten ? (
                    <>
                        <Input
                            value={draftPraxisOeffnungszeiten}
                            onChange={(e) => setDraftPraxisOeffnungszeiten(e.target.value)}
                            aria-label="Öffnungszeiten"
                            placeholder="z. B. Mo–Fr 08:00–18:00 · Sa 09:00–13:00"
                            style={{ minWidth: 160, maxWidth: 320 }}
                        />
                        <Button type="button" onClick={() => void savePraxisOeffnungszeiten()}>Speichern</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                                setEditPraxisOeffnungszeiten(false);
                            }}
                        >
                            Abbrechen
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                            setEditPraxisOeffnungszeiten(true);
                        }}
                    >
                        Bearbeiten
                    </Button>
                )}
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>KV-Nummer</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(praxis.kv_nummer ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisKv ? (
                    <>
                        <Input
                            value={draftPraxisKv}
                            onChange={(e) => setDraftPraxisKv(e.target.value)}
                            aria-label="KV-Nummer"
                            style={{ minWidth: 160, maxWidth: 220 }}
                        />
                        <Button type="button" onClick={() => void savePraxisKv()}>Speichern</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisKv(praxis.kv_nummer ?? "");
                                setEditPraxisKv(false);
                            }}
                        >
                            Abbrechen
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPraxisKv(praxis.kv_nummer ?? "");
                            setEditPraxisKv(true);
                        }}
                    >
                        Bearbeiten
                    </Button>
                )}
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "center" }}>
            <div>
                <b>Logo</b>
                <div className="card-sub">Wird auf Dokumenten im PDF-Export verwendet</div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="" style={{ height: 40, width: "auto", borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                ) : null}
                <input id="praxis-logo-file" className="sr-only" type="file" accept="image/*" onChange={(e) => void onPraxisLogoFile(e)} />
                <Button type="button" variant="secondary" loading={logoBusy} disabled={logoBusy} onClick={() => document.getElementById("praxis-logo-file")?.click()}>
                    <span className="row" style={{ gap: 8, alignItems: "center" }}>
                        <UploadCircleIcon size={18} />
                        Hochladen
                    </span>
                </Button>
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>Kontakt, Web &amp; Steuern</b>
                <div className="settings-row-muted">Telefon, E-Mail, USt-IdNr. … für PDF-Kopf</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisExtra ? (
                    <>
                        <Button type="button" onClick={() => void savePraxisExtra()}>Speichern</Button>
                        <Button type="button" variant="secondary" onClick={() => void cancelPraxisExtra()}>
                            Abbrechen
                        </Button>
                    </>
                ) : (
                    <Button type="button" variant="secondary" onClick={() => void startEditPraxisExtra()}>
                        Bearbeiten
                    </Button>
                )}
            </div>
        </div>
        {editPraxisExtra ? (
            <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        id="px-tel"
                        label="Telefon"
                        type="tel"
                        value={praxis.telefon ?? ""}
                        onChange={(e) => setPraxis((p) => ({ ...p, telefon: e.target.value }))}
                    />
                    <Input id="px-fax" label="Fax" value={praxis.fax ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, fax: e.target.value }))} />
                    <Input
                        id="px-em"
                        label="E-Mail"
                        type="email"
                        value={praxis.email ?? ""}
                        onChange={(e) => setPraxis((p) => ({ ...p, email: e.target.value }))}
                    />
                    <Input id="px-web" label="Webseite" type="url" value={praxis.web ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, web: e.target.value }))} />
                    <Input id="px-ust" label="USt-IdNr." value={praxis.ust_id ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, ust_id: e.target.value }))} />
                    <Input id="px-st" label="Steuernummer" value={praxis.steuernummer ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, steuernummer: e.target.value }))} />
                </div>
            </div>
        ) : null}
        <EinstellungenPraxisBillingSection
            praxis={praxis}
            editing={editPraxisBilling}
            onStartEdit={startEditPraxisBilling}
            onCancel={cancelPraxisBilling}
            onSave={savePraxisBilling}
            onChange={(patch) => setPraxis((p) => ({ ...p, ...patch }))}
        />
        <button type="button" className="settings-row-clickable" onClick={() => onOpenArbeitsablaeufe()}>
            <div>
                <b>Termine &amp; Kalender</b>
                <div className="settings-row-muted">Puffer, Erinnerungen, Standardansicht</div>
            </div>
            <span className="settings-chevron" aria-hidden>
                <ChevronRightIcon size={18} />
            </span>
        </button>
    </section>
    <details className="settings-subcard">
        <summary style={{ padding: "var(--space-4) var(--card-pad-x)", cursor: "pointer", fontWeight: 650, listStyle: "none" }} className="settings-details-summary">
            Briefkopf-Vorschau
        </summary>
        <div className="card-pad settings-praxis-body" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
            <PraxisBriefkopfPreview praxis={praxis} />
        </div>
    </details>
        </>
    );
}


function PraxisAddressArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const id = "praxis-addr";
    return (
        <label className="input-wrap" htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label">{label}</span>
            <textarea
                id={id}
                className="input-edit settings-praxis-addr-ta"
                rows={5}
                autoComplete="street-address"
                spellCheck={false}
                placeholder={"Straße Hausnummer\nPLZ Ort"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="card-sub settings-praxis-field-hint" style={{ margin: 0 }}>
                Eine Zeile pro Zeile wie auf dem Briefpapier; Leerzeilen mit Enter.
            </p>
        </label>
    );
}

/** Eine Zeile in der Briefkopf-Vorschau: Wert per Auge maskierbar — dieselbe Einstellung wirkt auf PDF-Exporte. */
function PraxisPreviewRevealRow({
    label,
    value,
    revealed,
    onToggle,
    dense,
}: {
    label: string;
    value: string;
    revealed: boolean;
    onToggle: () => void;
    dense?: boolean;
}) {
    const v = value.trim();
    if (!v) return null;
    const title = revealed ? `${label} in der Vorschau ausblenden` : `${label} in der Vorschau einblenden`;
    return (
        <div
            className={`settings-praxis-preview__reveal-row${dense ? " settings-praxis-preview__reveal-row--dense" : ""}`}
            role="group"
            aria-label={label}
        >
            <span className="settings-praxis-preview__reveal-label">{label}</span>
            <span className={`settings-praxis-preview__reveal-value${revealed ? "" : " is-masked"}`}>
                {revealed ? v : maskPraxisExportToken(v)}
            </span>
            <button
                type="button"
                className="settings-praxis-preview__reveal-btn"
                onClick={onToggle}
                aria-pressed={revealed}
                title={title}
            >
                <span className="settings-praxis-preview__reveal-ic" aria-hidden>
                    {revealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </span>
                <span className="sr-only">{title}</span>
            </button>
        </div>
    );
}

function PraxisBriefkopfPreview({ praxis }: { praxis: InvoicePraxis }) {
    const [revealed, setRevealed] = useState<PraxisHeaderPrivacyV1>(() => loadPraxisHeaderPrivacy());

    useEffect(() => {
        savePraxisHeaderPrivacy(revealed);
    }, [revealed]);

    const pdfAddressLines = useMemo(() => buildInvoiceHeaderAddressLines(praxis, revealed), [praxis, revealed]);
    const name = (praxis.name ?? "").trim();
    const addrLines = (praxis.addr ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tel = (praxis.telefon ?? "").trim();
    const fax = (praxis.fax ?? "").trim();
    const em = (praxis.email ?? "").trim();
    const web = (praxis.web ?? "").trim().replace(/^https?:\/\//i, "");
    const kv = (praxis.kv_nummer ?? "").trim();
    const ust = (praxis.ust_id ?? "").trim();
    const st = (praxis.steuernummer ?? "").trim();
    const oz = (praxis.oeffnungszeiten ?? "").trim();

    const hasContact = Boolean(tel || fax || em || web);
    const hasRegister = Boolean(kv || ust || st || oz);
    const hasAny = Boolean(name || addrLines.length || hasContact || hasRegister);

    const activeRevealKeys = useMemo(() => {
        const keys: PraxisHeaderPrivacyKey[] = [];
        if (tel) keys.push("tel");
        if (fax) keys.push("fax");
        if (em) keys.push("email");
        if (web) keys.push("web");
        if (kv) keys.push("kv");
        if (ust) keys.push("ust");
        if (st) keys.push("steuer");
        if (oz) keys.push("oz");
        return keys;
    }, [tel, fax, em, web, kv, ust, st, oz]);

    const allRevealedForPresent = useMemo(
        () => activeRevealKeys.length === 0 || activeRevealKeys.every((k) => revealed[k]),
        [activeRevealKeys, revealed],
    );

    const toggleReveal = useCallback((k: PraxisHeaderPrivacyKey) => {
        setRevealed((r) => ({ ...r, [k]: !r[k] }));
    }, []);

    const onBulkRevealToggle = useCallback(() => {
        setRevealed((r) => {
            if (activeRevealKeys.length === 0) return r;
            const everyOn = activeRevealKeys.every((k) => r[k]);
            const target = !everyOn;
            const next = { ...r };
            for (const k of activeRevealKeys) next[k] = target;
            return next;
        });
    }, [activeRevealKeys]);

    return (
        <aside className="settings-praxis-preview" aria-label="Vorschau Briefkopf">
            <div className="settings-praxis-preview__toolbar">
                <div className="settings-praxis-preview__kicker">Vorschau</div>
                {activeRevealKeys.length > 0 ? (
                    <button
                        type="button"
                        className={`settings-praxis-preview__bulk${allRevealedForPresent ? " is-all-on" : ""}`}
                        onClick={onBulkRevealToggle}
                        title={allRevealedForPresent ? "Kontakt und Register in der Vorschau maskieren" : "Alle maskierten Zeilen wieder einblenden"}
                    >
                        {allRevealedForPresent ? "Alle maskieren" : "Alle einblenden"}
                    </button>
                ) : null}
            </div>
            <p className="settings-praxis-preview__sub">
                Lesefreundliches Briefpapier: Praxisname zuerst, darunter Anschrift. Pro Zeile kannst du Werte
                maskieren — dieselben Schalter gelten für Rechnungs-PDF, Tagesbericht und den Praxis-Kopf bei Attest,
                Rezept und Quittung. Stammdaten bleiben gespeichert. Unten: technische
                PDF-Reihenfolge der kleinen Kopfzeile.
            </p>
            <div className="settings-praxis-preview__paper">
                {!hasAny ? (
                    <p className="settings-praxis-preview__empty">Stammdaten eintragen — die Vorschau aktualisiert sich live.</p>
                ) : (
                    <div className="settings-praxis-preview__letter">
                        {name ? <div className="settings-praxis-preview__brand">{name}</div> : (
                            <div className="settings-praxis-preview__muted settings-praxis-preview__muted--block">(kein Praxisname)</div>
                        )}

                        {addrLines.length ? (
                            <div className="settings-praxis-preview__address">
                                {addrLines.map((line, i) => (
                                    <div key={i}>{line}</div>
                                ))}
                            </div>
                        ) : name ? (
                            <p className="settings-praxis-preview__muted settings-praxis-preview__muted--block">(keine Anschrift)</p>
                        ) : null}

                        {hasContact ? (
                            <div className="settings-praxis-preview__reveal-group" aria-label="Kontakt in der Vorschau">
                                <PraxisPreviewRevealRow label="Tel." value={tel} revealed={revealed.tel} onToggle={() => toggleReveal("tel")} />
                                <PraxisPreviewRevealRow label="Fax" value={fax} revealed={revealed.fax} onToggle={() => toggleReveal("fax")} />
                                <PraxisPreviewRevealRow label="E-Mail" value={em} revealed={revealed.email} onToggle={() => toggleReveal("email")} />
                                <PraxisPreviewRevealRow label="Web" value={web} revealed={revealed.web} onToggle={() => toggleReveal("web")} />
                            </div>
                        ) : null}

                        {hasRegister ? (
                            <div
                                className="settings-praxis-preview__reveal-group settings-praxis-preview__reveal-group--register"
                                aria-label="Register und Hinweise in der Vorschau"
                            >
                                <PraxisPreviewRevealRow
                                    label="KV- / Betriebsnr."
                                    value={kv}
                                    revealed={revealed.kv}
                                    onToggle={() => toggleReveal("kv")}
                                    dense
                                />
                                <PraxisPreviewRevealRow
                                    label="USt-IdNr."
                                    value={ust}
                                    revealed={revealed.ust}
                                    onToggle={() => toggleReveal("ust")}
                                    dense
                                />
                                <PraxisPreviewRevealRow
                                    label="St.-Nr."
                                    value={st}
                                    revealed={revealed.steuer}
                                    onToggle={() => toggleReveal("steuer")}
                                    dense
                                />
                                <PraxisPreviewRevealRow label="Öffn." value={oz} revealed={revealed.oz} onToggle={() => toggleReveal("oz")} dense />
                            </div>
                        ) : null}

                        {pdfAddressLines.length > 0 ? (
                            <div className="settings-praxis-preview__pdf-ref">
                                <div className="settings-praxis-preview__pdf-ref-label">PDF: Reihenfolge der kleinen Kopfzeile (9&nbsp;pt)</div>
                                <div className="settings-praxis-preview__pdf-ref-lines">
                                    {pdfAddressLines.map((line, i) => (
                                        <div key={i} className="settings-praxis-preview__pdf-ref-line">
                                            {line}
                                        </div>
                                    ))}
                                </div>
                                <p className="settings-praxis-preview__pdf-ref-note">Direkt darunter folgt im PDF der Praxisname (größer) — wie oben dargestellt.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </aside>
    );
}
