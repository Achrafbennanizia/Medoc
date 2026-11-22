/** Monospace text for technical values (URLs, fingerprints, ids); long values wrap instead of overflowing. */
import type { ReactNode } from "react";

export function Mono({ children }: { children: ReactNode }) {
    return <code className="ui-mono">{children}</code>;
}
