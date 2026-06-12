import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "../../..");
const targets = ["apps/practice-host-ui/src", "packages"];
const spacingPattern = "(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-\\[[^\\]]+\\]";

function runTailwindSpacingLint() {
    try {
        const output = execFileSync(
            "rg",
            ["--line-number", "--color", "never", "--glob", "*.{ts,tsx,js,jsx}", spacingPattern, ...targets],
            { cwd: workspaceRoot, encoding: "utf8" },
        );
        if (output.trim().length > 0) {
            console.error("Arbitrary Tailwind spacing values detected:");
            console.error(output.trim());
            process.exit(1);
        }
    } catch (error) {
        const status = typeof error === "object" && error && "status" in error ? error.status : null;
        // ripgrep exits with status 1 when no matches are found.
        if (status === 1) {
            console.log("Tailwind spacing lint passed: no arbitrary spacing utilities found.");
            return;
        }
        throw error;
    }
    console.log("Tailwind spacing lint passed: no arbitrary spacing utilities found.");
}

runTailwindSpacingLint();
