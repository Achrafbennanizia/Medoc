import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type TotpEnrollment = {
    secret_base32: string;
    provisioning_uri: string;
    issuer: string;
    account_name: string;
};

export type TotpStatus = {
    required: boolean;
    enrolled: boolean;
    pending: boolean;
};

export const getTotpStatus = () => practiceSystem.invoke<TotpStatus>("get_totp_status");

export const startTotpEnrollment = () =>
    practiceSystem.invoke<TotpEnrollment>("start_totp_enrollment");

export const confirmTotpEnrollment = (code: string) =>
    practiceSystem.invoke<void>("confirm_totp_enrollment", { code });

export const startTotpEnrollmentLogin = (email: string, passwort: string) =>
    practiceSystem.invoke<TotpEnrollment>("start_totp_enrollment_login", { email, passwort });

export const confirmTotpEnrollmentLogin = (email: string, passwort: string, code: string) =>
    practiceSystem.invoke<void>("confirm_totp_enrollment_login", { email, passwort, code });
