import { forwardRef, useImperativeHandle } from "react";
import type { ChartSavePending } from "@/lib/patient-detail-utils";
import { PatientDetailPrescriptionTabPanel } from "./patient-detail-prescription-tab-panel";
import { usePatientDetailPrescriptionTab, type PatientDetailPrescriptionTabProps } from "./use-patient-detail-prescription-tab";

export type PatientDetailPrescriptionTabHandle = {
    flushChartSaveConfirm: (p: ChartSavePending) => Promise<boolean>;
};

export const PatientDetailPrescriptionTab = forwardRef<PatientDetailPrescriptionTabHandle, PatientDetailPrescriptionTabProps>(
    function PatientDetailPrescriptionTab(props, ref) {
        const state = usePatientDetailPrescriptionTab(props);
        useImperativeHandle(
            ref,
            () => ({ flushChartSaveConfirm: state.flushChartSaveConfirm }),
            [state.flushChartSaveConfirm],
        );
        const { flushChartSaveConfirm: _flushHandler, ...panelProps } = state;
        void _flushHandler;
        return <PatientDetailPrescriptionTabPanel {...panelProps} />;
    },
);
