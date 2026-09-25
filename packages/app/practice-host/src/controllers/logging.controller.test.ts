import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: vi.fn(),
    },
}));

import { practiceSystem } from "../adapters/practice-transport";
import { getLogLevel, getLogDir, logWorkflowEvent, setLogLevel } from "./logging.controller";

describe("logging.controller workflow bridge", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset();
    });

    it("forwards workflow payload to log_workflow_event", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(undefined);
        await logWorkflowEvent({
            route: "/patients",
            step: "route_enter",
            action: "navigate",
            status: "success",
        });
        expect(practiceSystem.invoke).toHaveBeenCalledWith("log_workflow_event", {
            payload: {
                route: "/patients",
                step: "route_enter",
                action: "navigate",
                status: "success",
            },
        });
    });

    it("keeps existing logging commands unchanged", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce("INFO");
        await getLogLevel();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("get_log_level");

        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(undefined);
        await setLogLevel("DEBUG");
        expect(practiceSystem.invoke).toHaveBeenCalledWith("set_log_level", { level: "DEBUG" });

        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce("/tmp/medoc/logs");
        await getLogDir();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("log_dir");
    });
});
