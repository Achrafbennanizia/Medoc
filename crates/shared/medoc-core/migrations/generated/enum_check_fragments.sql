-- @generated from config/enums.yaml — reference CHECK fragments for migrations.
-- Do not edit; regenerate with `cargo build`.

-- ChartStatus (patient_chart.status)
-- CHECK (... IN ('DRAFT','IN_PROGRESS','VALIDATED','READONLY'))

-- OrderStatus (purchase_order.status)
-- CHECK (... IN ('OPEN','IN_TRANSIT','DELIVERED','CANCELLED'))

-- FeedbackCategory (feedback.category)
-- CHECK (... IN ('feedback','vigilance','technical'))

-- FeedbackStatus (feedback.status)
-- CHECK (... IN ('OPEN','IN_PROGRESS','DONE'))

-- Sex (patient.sex)
-- CHECK (... IN ('MALE','FEMALE','DIVERSE'))

-- PatientStatus (patient.status)
-- CHECK (... IN ('NEW','ACTIVE','VALIDATED','READONLY'))

-- Role (staff.role)
-- CHECK (... IN ('PHYSICIAN','RECEPTION','TAX_ADVISOR','PHARMA_CONSULTANT'))

-- AppointmentKind (appointment.kind)
-- CHECK (... IN ('FIRST_VISIT','EXAMINATION','TREATMENT','CHECKUP','CONSULTATION'))

-- AppointmentStatus (appointment.status)
-- CHECK (... IN ('PLANNED','CONFIRMED','COMPLETED','NO_SHOW','CANCELLED'))

-- PaymentMethod (payment.payment_method)
-- CHECK (... IN ('CASH','CARD','BANK_TRANSFER','INVOICE'))

-- PaymentStatus (payment.status)
-- CHECK (... IN ('OUTSTANDING','PAID','PARTIALLY_PAID','CANCELLED'))

