/** @generated from config/enums.yaml — do not edit. Run `cargo build` to refresh. */

export const APPOINTMENT_KIND_VALUES = ["FIRST_VISIT", "EXAMINATION", "TREATMENT", "CHECKUP", "CONSULTATION"] as const;
export type AppointmentKind = (typeof APPOINTMENT_KIND_VALUES)[number];

export const APPOINTMENT_STATUS_VALUES = ["PLANNED", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];

export const CHART_STATUS_VALUES = ["DRAFT", "IN_PROGRESS", "VALIDATED", "READONLY"] as const;
export type ChartStatus = (typeof CHART_STATUS_VALUES)[number];

export const FEEDBACK_CATEGORY_VALUES = ["feedback", "vigilance", "technical"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORY_VALUES)[number];

export const FEEDBACK_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];

export const ORDER_STATUS_VALUES = ["OPEN", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const PATIENT_STATUS_VALUES = ["NEW", "ACTIVE", "VALIDATED", "READONLY"] as const;
export type PatientStatus = (typeof PATIENT_STATUS_VALUES)[number];

export const PAYMENT_METHOD_VALUES = ["CASH", "CARD", "BANK_TRANSFER", "INVOICE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const PAYMENT_STATUS_VALUES = ["OUTSTANDING", "PAID", "PARTIALLY_PAID", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const ROLE_VALUES = ["PHYSICIAN", "RECEPTION", "TAX_ADVISOR", "PHARMA_CONSULTANT"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const SEX_VALUES = ["MALE", "FEMALE", "DIVERSE"] as const;
export type Sex = (typeof SEX_VALUES)[number];

