/** @generated from config/enums.yaml — do not edit. */
import { z } from "zod";
import { APPOINTMENT_KIND_VALUES, APPOINTMENT_STATUS_VALUES, CHART_STATUS_VALUES, FEEDBACK_CATEGORY_VALUES, PATIENT_STATUS_VALUES, PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES, ROLE_VALUES, SEX_VALUES } from "./enums.generated";

export const ChartStatusSchema = z.enum(CHART_STATUS_VALUES);
export const FeedbackCategorySchema = z.enum(FEEDBACK_CATEGORY_VALUES);
export const SexSchema = z.enum(SEX_VALUES);
export const PatientStatusSchema = z.enum(PATIENT_STATUS_VALUES);
export const RoleSchema = z.enum(ROLE_VALUES);
export const AppointmentKindSchema = z.enum(APPOINTMENT_KIND_VALUES);
export const AppointmentStatusSchema = z.enum(APPOINTMENT_STATUS_VALUES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);
