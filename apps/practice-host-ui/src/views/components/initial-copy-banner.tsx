/**
 * Side notification while a new replica copies the practice, or the main device sends it.
 * Same chrome as the toast stack. Polls the same sync status as the replica badge.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useT, useTParams } from "@/lib/i18n";
import {
    syncGetStatus,
    type InitialCopyStatus,
} from "@/systems/practice-host/controllers/sync.controller";

const POLL_MS = 2_000;

export function InitialCopyBanner() {
    const t = useT();
    const tp = useTParams();
    const [copy, setCopy] = useState<InitialCopyStatus | null>(null);

    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            try {
                const snap = await syncGetStatus();
                if (cancelled) return;
                const next = snap.initialCopy;
                setCopy(next && next.total > 0 ? next : null);
            } catch {
                if (!cancelled) setCopy(null);
            }
        };

        void tick();
        const id = window.setInterval(() => void tick(), POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, []);

    if (!copy) return null;

    const done = Math.max(0, Math.min(copy.done, copy.total));
    const pct = Math.round((done / copy.total) * 100);
    const sending = copy.side === "master";
    const title = sending
        ? tp("sync.initial_copy.sending", { device: copy.deviceLabel || t("sync.initial_copy.device_fallback") })
        : t("sync.initial_copy.copying");
    const progress = tp("sync.initial_copy.progress", { done, total: copy.total });

    return createPortal(
        <div className="toast-stack initial-copy-toast-host">
            <div
                className="toast-item info animate-slide-up"
                role="status"
                aria-live="polite"
            >
                <div className="toast-item-inner">
                    <span className="toast-info-dot" aria-hidden />
                    <span className="toast-message">
                        <span className="initial-copy-toast__title">{title}</span>
                        <span className="initial-copy-toast__meta">{progress}</span>
                    </span>
                </div>
                <div
                    className="toast-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={copy.total}
                    aria-valuenow={done}
                    aria-label={title}
                >
                    <div
                        className="toast-progress-bar is-determinate"
                        style={{ ["--copy-pct" as string]: `${pct}%` }}
                    />
                </div>
            </div>
        </div>,
        document.body,
    );
}
