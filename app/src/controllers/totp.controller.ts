import { tauriInvoke } from "../services/tauri.service";

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

export const getTotpStatus = () => tauriInvoke<TotpStatus>("get_totp_status");

export const startTotpEnrollment = () =>
    tauriInvoke<TotpEnrollment>("start_totp_enrollment");

export const confirmTotpEnrollment = (code: string) =>
    tauriInvoke<void>("confirm_totp_enrollment", { code });

export const startTotpEnrollmentLogin = (email: string, passwort: string) =>
    tauriInvoke<TotpEnrollment>("start_totp_enrollment_login", { email, passwort });

export const confirmTotpEnrollmentLogin = (email: string, passwort: string, code: string) =>
    tauriInvoke<void>("confirm_totp_enrollment_login", { email, passwort, code });
