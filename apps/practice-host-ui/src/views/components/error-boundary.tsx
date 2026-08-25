import { t } from "@/lib/i18n";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { emitWorkflowEventFireAndForget, workflowErrorDetail } from "@/services/workflow-logger.service";

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/// Catches uncaught render errors and displays a recovery UI instead of a
/// blank screen. Logs the error so the user can copy details for support.
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[medoc] uncaught render error", error, info);
        emitWorkflowEventFireAndForget({
            step: "error",
            action: "react_error_boundary",
            outcome: "render_crash",
            detail: workflowErrorDetail(error),
            metadata: {
                componentStack: workflowErrorDetail(info.componentStack ?? ""),
            },
        });
    }

    private handleReload = () => {
        this.setState({ error: null });
        window.location.reload();
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <div role="alert" className="min-h-screen flex items-center justify-center bg-surface p-6">
                <div className="max-w-md w-full bg-surface-container rounded-xl p-6 border border-error/30">
                    <h1 className="text-title text-error font-semibold">{t("common.unexpected_error")}</h1>
                    <p className="mt-2 text-body text-on-surface-variant">
                        {t("error.boundary.body")}
                    </p>
                    <pre className="mt-4 max-h-40 overflow-auto bg-surface text-caption p-2 rounded text-on-surface-variant">
                        {error.message}
                    </pre>
                    <button
                        onClick={this.handleReload}
                        className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-body-medium"
                    >
                        {t("common.reload")}
                    </button>
                </div>
            </div>
        );
    }
}
