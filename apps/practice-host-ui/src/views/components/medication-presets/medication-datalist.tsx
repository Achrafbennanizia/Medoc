/** Suggestion list of the practice's active predefined medications, for `<input list={id}>`. */
import { useMedicationSuggestions } from "@/lib/use-medication-suggestions";

export function MedicationDatalist({ id }: { id: string }) {
    const suggestions = useMedicationSuggestions();
    return (
        <datalist id={id}>
            {suggestions.map((s) => (
                <option key={s.label} value={s.label} />
            ))}
        </datalist>
    );
}
