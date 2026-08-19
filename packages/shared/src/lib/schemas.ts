/**
 * Centralised Zod schemas for IPC boundary validation.
 *
 * Every controller that posts data to the backend should pass user input
 * through a schema in this file. Backend validation remains the source of
 * truth (defense in depth), but client-side validation gives instant,
 * actionable error messages without a round-trip.
 *
 * Conventions:
 * - Enum literals: `config/enums.yaml` → {@link ./enums.generated.ts} (via `cargo build`).
 * - Mirror the Rust DTO field names exactly (snake_case).
 * - Strings are trimmed only when the backend also trims them.
 */
import { z } from "zod";
import {
    FeedbackCategorySchema,
    SexSchema,
    PatientStatusSchema,
    RoleSchema,
    AppointmentKindSchema,
    AppointmentStatusSchema,
    PaymentMethodSchema,
} from "@/lib/schemas.enums.generated";

const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected format: YYYY-MM-DD");
const isoTime = z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected format: HH:MM");
const nonEmpty = (msg = "Required") =>
    z.string().min(1, msg);
const optionalText = z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((version) => (version == null || version === "" ? null : version));

export {
    ChartStatusSchema,
    FeedbackCategorySchema,
    SexSchema,
    PatientStatusSchema,
    RoleSchema,
    AppointmentKindSchema,
    AppointmentStatusSchema,
    PaymentMethodSchema,
    PaymentStatusSchema,
} from "@/lib/schemas.enums.generated";
/** @deprecated Use {@link SexSchema}. */
export const PatientSexSchema = SexSchema;

export const CreatePatientSchema = z.object({
    name: nonEmpty("Name is required").max(120),
    date_of_birth: isoDate,
    sex: SexSchema,
    insurance_number: nonEmpty("Insurance number is required").max(40),
    phone: optionalText,
    email: z
        .union([z.string().email("Invalid email"), z.literal(""), z.null(), z.undefined()])
        .optional()
        .transform((version) => (version == null || version === "" ? null : version)),
    address: optionalText,
});
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        phone: optionalText,
        email: z.union([z.string().email(), z.literal(""), z.null(), z.undefined()]).optional(),
        address: optionalText,
        status: PatientStatusSchema.optional(),
    })
    .strict();

export const CreateAppointmentSchema = z.object({
    date: isoDate,
    time: isoTime,
    kind: AppointmentKindSchema,
    patient_id: nonEmpty("Patient is required"),
    physician_id: nonEmpty("Provider is required"),
    notes: optionalText,
    chief_complaint: optionalText,
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

export const UpdateAppointmentSchema = z
    .object({
        date: isoDate.optional(),
        time: isoTime.optional(),
        kind: AppointmentKindSchema.optional(),
        status: AppointmentStatusSchema.optional(),
        notes: optionalText,
        chief_complaint: optionalText,
        physician_id: z.string().min(1).optional(),
    })
    .strict();

export const CreateStaffSchema = z.object({
    name: nonEmpty().max(120),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "At least 8 characters"),
    role: RoleSchema,
    activity_area: optionalText,
    specialty: optionalText,
    phone: optionalText,
});

export const UpdateStaffSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        email: z.string().email("Invalid email").optional(),
        role: RoleSchema.optional(),
        activity_area: optionalText,
        specialty: optionalText,
        phone: optionalText,
        available: z.boolean().optional(),
    })
    .strict();

/** Own account (Settings) — at least one field required. */
export const UpdateOwnProfileSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        email: z.string().email("Invalid email").optional(),
        activity_area: optionalText,
        specialty: optionalText,
        /** Empty string clears stored number (like backend). */
        phone: z.string().max(40).optional(),
    })
    .strict()
    .refine(
        (d) =>
            d.name != null ||
            d.email != null ||
            d.activity_area != null ||
            d.specialty != null ||
            d.phone !== undefined,
        { message: "Fill in at least one field to save" },
    );

export const CreatePaymentSchema = z.object({
    patient_id: nonEmpty(),
    amount: z.number().nonnegative("Amount must not be negative"),
    payment_method: PaymentMethodSchema,
    service_item_id: optionalText,
    description: optionalText,
    treatment_id: optionalText,
    examination_id: optionalText,
    amount_expected: z.number().finite().nonnegative().optional().nullable(),
});

export const UpdatePaymentSchema = z
    .object({
        id: nonEmpty(),
        amount: z.number().nonnegative(),
        payment_method: PaymentMethodSchema,
        service_item_id: optionalText,
        description: optionalText,
    })
    .strict();

export const CreatePurchaseOrderSchema = z.object({
    supplier: nonEmpty().max(200),
    item: nonEmpty().max(200),
    expected_on: z.union([isoDate, z.literal(""), z.null(), z.undefined()])
        .optional()
        .transform((version) => (version == null || version === "" ? null : version)),
    quantity: z.number().int().positive("Quantity must be > 0"),
    unit: optionalText,
    remark: optionalText,
    order_number: optionalText,
    pharma_consultant: optionalText,
    total_amount: z.number().finite().nonnegative().optional().nullable(),
});

export const UpdatePurchaseOrderSchema = z
    .object({
        supplier: z.string().min(1).max(200).optional(),
        item: z.string().min(1).max(200).optional(),
        quantity: z.number().int().positive("Quantity must be > 0").optional(),
        unit: optionalText,
        expected_on: z.union([isoDate, z.literal(""), z.null(), z.undefined()])
            .optional()
            .transform((version) => (version == null ? undefined : version === "" ? null : version)),
        remark: optionalText,
        order_number: optionalText,
        pharma_consultant: optionalText,
    })
    .strict();

export const CreateServiceItemSchema = z.object({
    name: nonEmpty().max(200),
    description: optionalText,
    category: nonEmpty().max(80),
    price: z.number().nonnegative(),
});

export const UpdateServiceItemSchema = z
    .object({
        name: z.string().min(1).max(200).optional(),
        description: optionalText,
        category: z.string().min(1).max(80).optional(),
        price: z.number().nonnegative().optional(),
        active: z.boolean().optional(),
    })
    .strict();

export const CreatePrescriptionSchema = z.object({
    patient_id: nonEmpty("Patient is required"),
    physician_id: nonEmpty(),
    medication: nonEmpty("Medication is required").max(200),
    active_ingredient: optionalText,
    dosage: nonEmpty().max(200),
    duration: nonEmpty().max(200),
    instructions: optionalText,
    pzn: optionalText,
    dosage_form: optionalText,
    pack_size: optionalText,
    quantity: z.number().int().positive().optional().nullable(),
    aut_idem: z.boolean().optional().nullable(),
    prescription_type: z.enum(["PRIVAT", "KASSE", "BTM"]).optional().nullable(),
    icd10_code: optionalText,
    prescribing_physician_id: optionalText,
});

export const UpdatePrescriptionSchema = z.object({
    id: nonEmpty(),
    medication: nonEmpty().max(200),
    active_ingredient: optionalText,
    dosage: nonEmpty().max(200),
    duration: nonEmpty().max(200),
    instructions: optionalText,
    pzn: optionalText,
    dosage_form: optionalText,
    pack_size: optionalText,
    quantity: z.number().int().positive().optional().nullable(),
    aut_idem: z.boolean().optional().nullable(),
    prescription_type: z.enum(["PRIVAT", "KASSE", "BTM"]).optional().nullable(),
    icd10_code: optionalText,
    prescribing_physician_id: optionalText,
});

export const CreateCertificateSchema = z.object({
    patient_id: nonEmpty(),
    physician_id: nonEmpty(),
    kind: nonEmpty(),
    body_text: nonEmpty().max(5000),
    valid_from: isoDate,
    valid_until: isoDate,
    icd10_code: optionalText,
    first_or_follow_up: z.enum(["FIRST", "FOLLOW_UP"]).optional().nullable(),
    employer: optionalText,
    issuing_physician_id: optionalText,
});

export const CreateTreatmentSchema = z.object({
    chart_id: nonEmpty(),
    kind: nonEmpty(),
    description: optionalText,
    teeth: optionalText,
    material: optionalText,
    notes: optionalText,
    category: optionalText,
    service_name: optionalText,
    treatment_number: optionalText,
    session_number: z.number().int().optional().nullable(),
    treatment_status: optionalText,
    total_cost: z.number().finite().optional().nullable(),
    appointment_required: z.boolean().optional().nullable(),
    treatment_date: z.union([isoDate, z.literal(""), z.null()]).optional().nullable().transform((version) => (version === "" ? null : version)),
});

export const UpdateTreatmentSchema = z.object({
    id: nonEmpty(),
    kind: nonEmpty(),
    description: optionalText,
    teeth: optionalText,
    material: optionalText,
    notes: optionalText,
    category: optionalText,
    service_name: optionalText,
    treatment_number: optionalText,
    session_number: z.number().int().optional().nullable(),
    treatment_status: optionalText,
    total_cost: z.number().finite().optional().nullable(),
    appointment_required: z.boolean().optional().nullable(),
    treatment_date: z.union([isoDate, z.literal(""), z.null()]).optional().nullable().transform((version) => (version === "" ? null : version)),
});

export const CreateExaminationSchema = z.object({
    chart_id: nonEmpty(),
    chief_complaint: optionalText,
    results: optionalText,
    diagnosis: optionalText,
    examination_number: optionalText,
    category: optionalText,
    service_name: optionalText,
    total_cost: z.number().finite().optional().nullable(),
});

export const UpdateExaminationSchema = z.object({
    id: nonEmpty(),
    chief_complaint: optionalText,
    results: optionalText,
    diagnosis: optionalText,
    category: optionalText,
    service_name: optionalText,
    total_cost: z.number().finite().optional().nullable(),
});

export const CreateDentalFindingSchema = z.object({
    chart_id: nonEmpty(),
    tooth_number: z.number().int(),
    finding: nonEmpty(),
    diagnosis: optionalText,
    notes: optionalText,
});

export const CreateBalanceSheetSnapshotSchema = z.object({
    period: nonEmpty(),
    kind: nonEmpty(),
    label: nonEmpty(),
    income_cents: z.number().int().nonnegative(),
    expenses_cents: z.number().int().nonnegative(),
    payload: z.unknown(),
});

export const CreateFeedbackSchema = z.object({
    category: FeedbackCategorySchema,
    subject: z.string().min(3, "Subject too short").max(200),
    message: z.string().min(10, "Message too short").max(4000),
    reference: optionalText,
});

export type UpdateServiceItemInput = z.infer<typeof UpdateServiceItemSchema>;

/**
 * Convert a ZodError into a single human-readable string suitable for toasts.
 * Joins all issues with `"; "`.
 */
export function zodErrorToMessage(err: unknown): string {
    if (err instanceof z.ZodError) {
        if (!err.issues.length) return "Validation error";
        return err.issues
            .map((issue) => {
                const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
                return `${path}${issue.message}`;
            })
            .join("; ");
    }
    return err instanceof Error ? err.message : String(err);
}

/**
 * Throw a typed error with a user-facing message if the parse fails.
 * Use at controller boundaries: `const safe = parseOrThrow(Schema, data);`
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new Error(zodErrorToMessage(result.error));
    }
    return result.data;
}
