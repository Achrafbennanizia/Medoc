import "@/views/components/ui/install-dom.test-helper";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMasterDetailCrud, type CrudAdapter } from "./use-master-detail-crud";

type Item = { id: string; name: string };
type Form = { name: string };

function memoryAdapter(start: Item[]): CrudAdapter<Item, Form> & { rows: Item[] } {
    const a = {
        rows: [...start],
        list: async () => [...a.rows],
        create: async (f: Form) => {
            const item = { id: `id-${a.rows.length + 1}`, name: f.name };
            a.rows.push(item);
            return item;
        },
        update: async (item: Item, f: Form) => {
            a.rows = a.rows.map((r) => (r.id === item.id ? { ...r, name: f.name } : r));
            return { ...item, name: f.name };
        },
        remove: async (item: Item) => {
            a.rows = a.rows.filter((r) => r.id !== item.id);
        },
    };
    return a;
}

function setup(adapter: CrudAdapter<Item, Form>) {
    const onSaved = vi.fn();
    const hook = renderHook(() =>
        useMasterDetailCrud<Item, Form>({ adapter, emptyForm: () => ({ name: "" }), toForm: (i) => ({ name: i.name }), isValid: (f) => !!f.name, getId: (i) => i.id, onError: vi.fn(), onSaved }),
    );
    return { ...hook, onSaved };
}

describe("useMasterDetailCrud", () => {
    it("creates, selects the new row and reports it", async () => {
        const adapter = memoryAdapter([]);
        const { result, onSaved } = setup(adapter);
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.openCreate());
        expect(result.current.valid).toBe(false);
        act(() => result.current.setForm({ name: "Ibuprofen" }));
        await act(() => result.current.save());
        expect(result.current.items.map((i) => i.name)).toEqual(["Ibuprofen"]);
        expect(result.current.selected?.name).toBe("Ibuprofen");
        expect(result.current.mode).toBe("view");
        expect(onSaved).toHaveBeenCalledWith("created");
    });

    it("edits the selected row and deletes it after confirmation", async () => {
        const adapter = memoryAdapter([{ id: "a", name: "Old" }]);
        const { result } = setup(adapter);
        await waitFor(() => expect(result.current.items).toHaveLength(1));
        act(() => result.current.select(result.current.items[0]!));
        act(() => result.current.startEdit());
        expect(result.current.form).toEqual({ name: "Old" });
        act(() => result.current.setForm({ name: "New" }));
        await act(() => result.current.save());
        expect(result.current.selected?.name).toBe("New");
        act(() => result.current.askDelete());
        await act(() => result.current.confirmDelete());
        expect(result.current.items).toHaveLength(0);
        expect(result.current.mode).toBe("overview");
    });
});
