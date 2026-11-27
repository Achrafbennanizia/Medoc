import "../../../../../packages/ui/src/install-dom.test-helper";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import type { DoctorList } from "../components/use-doctor-list";
import { OrderDoctorCell, OrderDoctorFilter, OrderHiddenDoctorsNote } from "./purchase-order-doctor";

const doctors = [
    { id: "dr-a", name: "Dr. Alaoui" },
    { id: "dr-b", name: "Dr. Bennani" },
] as DoctorList["doctors"];
const list = (show: boolean): DoctorList => ({
    show,
    doctors,
    nameOf: (id) => doctors.find((d) => d.id === id)?.name,
});
const order = (o: Partial<PurchaseOrder>) => ({ id: "o1", item: "gloves", ...o }) as PurchaseOrder;

describe("orders: Cabinet+ doctor UI", () => {
    afterEach(cleanup);

    it("shows nothing with one dentist", () => {
        const { container } = render(
            <>
                <OrderDoctorFilter od={list(false)} value="" onChange={() => {}} />
                <OrderDoctorCell od={list(false)} order={order({ ordered_for_staff_id: "dr-a" })} />
                <OrderHiddenDoctorsNote od={list(false)} ids={["dr-b"]} />
            </>,
        );
        expect(container.textContent).toBe("");
    });

    it("names who the order is for, and who paid / approved when set", () => {
        const { container } = render(
            <OrderDoctorCell od={list(true)} order={order({ ordered_for_staff_id: "dr-a", paid_by_staff_id: "dr-b" })} />,
        );
        expect(container.textContent).toContain("Dr. Alaoui");
        expect(container.textContent).toContain("Dr. Bennani");
        expect(container.textContent).not.toContain("Approved");
    });

    it("shows a dash for an order without a doctor", () => {
        const { container } = render(<OrderDoctorCell od={list(true)} order={order({})} />);
        expect(container.textContent).toBe("—");
    });

    it("names the doctors whose orders are not shared, falling back to the id", () => {
        const { getByRole } = render(<OrderHiddenDoctorsNote od={list(true)} ids={["dr-b", "dr-x"]} />);
        expect(getByRole("status").textContent).toContain("Dr. Bennani, dr-x");
    });

    it("offers every doctor plus 'all' in the filter", () => {
        const { container } = render(<OrderDoctorFilter od={list(true)} value="" onChange={() => {}} />);
        const text = container.textContent ?? "";
        expect(text).toContain("Dr. Alaoui");
        expect(text).toContain("Dr. Bennani");
    });

    it("leaves doctors who do not share orders out of the filter", () => {
        const { container } = render(<OrderDoctorFilter od={list(true)} value="" onChange={() => {}} hidden={["dr-b"]} />);
        const text = container.textContent ?? "";
        expect(text).toContain("Dr. Alaoui");
        expect(text).not.toContain("Dr. Bennani");
    });
});
