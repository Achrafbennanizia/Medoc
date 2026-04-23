"use client";

import { X } from "lucide-react";

export { ConfirmDialog } from "./dialog";

export function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-green-50 border border-green-200 p-3">
            <span className="text-sm text-green-700">{message}</span>
            <button type="button" onClick={onClose} className="text-green-500 hover:text-green-700">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ErrorMessage({ message }: { message: string }) {
    return (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
            <span className="text-sm text-red-700">{message}</span>
        </div>
    );
}

export function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
    );
}
