import { Button } from "./button";

export function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="card p-8 text-center max-w-md mx-auto" role="alert">
            <p className="text-body text-error mb-4">{message}</p>
            <Button type="button" onClick={onRetry}>
                Erneut versuchen
            </Button>
        </div>
    );
}

export function PageLoading({ label = "Laden…" }: { label?: string }) {
    return (
        <div
            className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant animate-fade-in"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-surface-container border-t-primary"
                aria-hidden
            />
            <span className="text-body">{label}</span>
        </div>
    );
}
