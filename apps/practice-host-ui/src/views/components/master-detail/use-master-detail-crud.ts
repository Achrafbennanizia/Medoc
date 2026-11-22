/**
 * State of a list / detail editing page (Administration master data): the list, the selected row,
 * create / view / edit mode with a form draft, saving and deleting. Storage is behind an adapter, so
 * the same behaviour serves any record type (Dependency Inversion: the page depends on the adapter
 * interface, not on a controller).
 */
import { useCallback, useEffect, useState } from "react";

export type CrudAdapter<T, F> = {
    list: () => Promise<T[]>;
    create: (form: F) => Promise<T>;
    update: (item: T, form: F) => Promise<T>;
    remove: (item: T) => Promise<void>;
};

export type CrudMode = "overview" | "create" | "view" | "edit";

type Options<T, F> = {
    adapter: CrudAdapter<T, F>;
    emptyForm: () => F;
    toForm: (item: T) => F;
    isValid: (form: F) => boolean;
    getId: (item: T) => string;
    onError: (e: unknown) => void;
    onSaved?: (kind: "created" | "updated" | "deleted") => void;
};

export function useMasterDetailCrud<T, F>({ adapter, emptyForm, toForm, isValid, getId, onError, onSaved }: Options<T, F>) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mode, setMode] = useState<CrudMode>("overview");
    const [form, setForm] = useState<F>(emptyForm);
    const [busy, setBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setItems(await adapter.list());
        } catch (e) {
            setLoadError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [adapter]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const selected = items.find((i) => getId(i) === selectedId) ?? null;

    const run = async (op: () => Promise<void>) => {
        setBusy(true);
        try {
            await op();
        } catch (e) {
            onError(e);
        } finally {
            setBusy(false);
        }
    };

    return {
        items,
        loading,
        loadError,
        reload,
        selected,
        mode,
        form,
        setForm,
        busy,
        valid: isValid(form),
        deleteTarget,
        openCreate: () => {
            setSelectedId(null);
            setForm(emptyForm());
            setMode("create");
        },
        select: (item: T) => {
            setSelectedId(getId(item));
            setMode("view");
        },
        startEdit: () => {
            if (!selected) return;
            setForm(toForm(selected));
            setMode("edit");
        },
        cancel: () => setMode(selected ? "view" : "overview"),
        save: () =>
            run(async () => {
                if (mode === "create") {
                    const created = await adapter.create(form);
                    setItems(await adapter.list());
                    setSelectedId(getId(created));
                    onSaved?.("created");
                } else if (mode === "edit" && selected) {
                    await adapter.update(selected, form);
                    setItems(await adapter.list());
                    onSaved?.("updated");
                }
                setMode("view");
            }),
        askDelete: () => setDeleteTarget(selected),
        cancelDelete: () => setDeleteTarget(null),
        confirmDelete: () =>
            run(async () => {
                if (!deleteTarget) return;
                await adapter.remove(deleteTarget);
                setDeleteTarget(null);
                setSelectedId(null);
                setMode("overview");
                setItems(await adapter.list());
                onSaved?.("deleted");
            }),
    };
}

export type MasterDetailCrud<T, F> = ReturnType<typeof useMasterDetailCrud<T, F>>;
