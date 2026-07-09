import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import { SonderSperrzeitenPage } from "./sonder-sperrzeiten";

vi.mock("@/lib/use-rbac", () => ({
    useRbac: () => ({
        canWritePraxisplanung: true,
    }),
}));

vi.mock("@/lib/praxis-planning", async () => {
    const actual = await vi.importActual<typeof import("@/lib/praxis-planning")>(
        "@/lib/praxis-planning",
    );
    return {
        ...actual,
        loadPraxisArbeitszeitenConfig: vi.fn(),
        savePraxisArbeitszeitenConfig: vi.fn(),
    };
});

const BASE_CFG: PraxisArbeitszeitenConfig = {
    plan: {
        mo: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
        di: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
        mi: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
        do: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
        fr: { aktiv: true, segments: [{ from: "08:00", to: "15:00" }] },
        sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
        so: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
    },
    pauseVon: "12:30",
    pauseBis: "13:30",
    slotMin: "30",
    closures: [],
};

describe("SonderSperrzeitenPage loading behavior", () => {
    beforeEach(() => {
        vi.mocked(loadPraxisArbeitszeitenConfig).mockReset();
    });

    it("shows load error and supports retry", async () => {
        const user = userEvent.setup();
        vi.mocked(loadPraxisArbeitszeitenConfig)
            .mockRejectedValueOnce(new Error("backend offline"))
            .mockResolvedValue(BASE_CFG);

        render(<SonderSperrzeitenPage />);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });
        await user.click(screen.getByRole("button", { name: /retry/i }));

        await waitFor(() => {
            expect(screen.queryByRole("alert")).toBeNull();
        });
        expect(loadPraxisArbeitszeitenConfig).toHaveBeenCalledTimes(2);
    });
});
