import { forwardRef, useImperativeHandle } from "react";
import type { AkteSavePending } from "@/lib/patient-detail-utils";
import { PatientDetailRezeptTabPanel } from "./patient-detail-rezept-tab-panel";
import { usePatientDetailRezeptTab, type PatientDetailRezeptTabProps } from "./use-patient-detail-rezept-tab";

export type PatientDetailRezeptTabHandle = {
    flushAkteSaveConfirm: (p: AkteSavePending) => Promise<boolean>;
};

export const PatientDetailRezeptTab = forwardRef<PatientDetailRezeptTabHandle, PatientDetailRezeptTabProps>(
    function PatientDetailRezeptTab(props, ref) {
        const state = usePatientDetailRezeptTab(props);
        useImperativeHandle(
            ref,
            () => ({ flushAkteSaveConfirm: state.flushAkteSaveConfirm }),
            [state.flushAkteSaveConfirm],
        );
        const { flushAkteSaveConfirm: _flushHandler, ...panelProps } = state;
        void _flushHandler;
        return <PatientDetailRezeptTabPanel {...panelProps} />;
    },
);
