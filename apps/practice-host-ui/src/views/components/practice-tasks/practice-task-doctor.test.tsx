import "../../../../../../packages/ui/src/install-dom.test-helper";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { DoctorList } from "../use-doctor-list";
import { TaskDoctorCell, TaskHiddenDoctorsNote } from "./practice-task-doctor";

const doctors = [{ id: "dr-a", name: "Dr. Alaoui" }] as DoctorList["doctors"];
const list = (show: boolean): DoctorList => ({ show, doctors, nameOf: (id) => doctors.find((d) => d.id === id)?.name });

describe("tasks: Cabinet+ doctor UI", () => {
    afterEach(cleanup);

    it("renders the doctor cell only in multi-doctor practices", () => {
        const row = (show: boolean, id: string | null) =>
            render(
                <table>
                    <tbody>
                        <tr>
                            <TaskDoctorCell td={list(show)} doctorId={id} />
                        </tr>
                    </tbody>
                </table>,
            ).container.querySelector("td")?.textContent;
        expect(row(false, "dr-a")).toBeUndefined();
        cleanup();
        expect(row(true, "dr-a")).toBe("Dr. Alaoui");
        cleanup();
        expect(row(true, null)).toBe("—");
    });

    it("lists hidden doctors only when there are some", () => {
        expect(render(<TaskHiddenDoctorsNote td={list(true)} ids={[]} />).container.textContent).toBe("");
        cleanup();
        expect(render(<TaskHiddenDoctorsNote td={list(true)} ids={["dr-a"]} />).getByRole("status").textContent).toContain("Dr. Alaoui");
    });
});
