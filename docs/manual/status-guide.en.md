# MeDoc status guide

> Generated — do not edit. Run `node scripts/generate-manuals.mjs`.

Every item has exactly one status. Flags (e.g. “Rescheduled”) are extra hints shown next to it and never replace the status. Lists are always ordered: needs attention → to do → in progress → awaiting review → done → closed.

## Appointment

Starts as: **Planned** · `appointment.status (config/enums.yaml · AppointmentStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Planned** (`PLANNED`) | Booked, not yet confirmed by the patient or practice. | To do | Confirmed, Completed, Cancelled, No-show |
| **Confirmed** (`CONFIRMED`) | Confirmed; the patient is expected at the booked time. | In progress | Completed, Cancelled, No-show |
| **Completed** (`COMPLETED`) | The visit took place. Ready for documentation and billing. | Done | Final |
| **No-show** (`NO_SHOW`) | The patient did not attend and did not cancel. Final. | Closed | Final |
| **Cancelled** (`CANCELLED`) | Cancelled by the patient or practice. The slot is free again. Final. | Closed | Final |

Flags (not statuses): Rescheduled · Emergency

## Patient

Starts as: **New** · `patient.status (config/enums.yaml · PatientStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **New** (`NEW`) | First-time visitor; master data not yet complete. | To do | Active, Validated, Archived |
| **Active** (`ACTIVE`) | Patient in ongoing care. | In progress | Validated, Archived |
| **Validated** (`VALIDATED`) | Master data and record checked by a physician. | Done | Active, Archived |
| **Archived** (`READONLY`) | Archived: kept for retention, read-only. Final. | Closed | Final |

## Patient record

Starts as: **Draft** · `patient_chart.status (config/enums.yaml · ChartStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Draft** (`DRAFT`) | Being documented; not yet sent for review. | To do | In review, Validated, Declined |
| **In review** (`IN_PROGRESS`) | Sent to a physician and waiting in the validation queue. | Awaiting review | Validated, Declined |
| **Declined** (`DECLINED`) | Returned by the physician; needs correction before resubmitting. | Needs attention | In review, Validated |
| **Validated** (`VALIDATED`) | Approved by a physician. Billing can be released. | Done | In review |
| **Archived** (`READONLY`) | Locked for retention; no further changes. Final. | Closed | Final |

## Payment

Starts as: **Outstanding** · `payment.status (config/enums.yaml · PaymentStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Outstanding** (`OUTSTANDING`) | Nothing paid yet. | To do | Partially paid, Paid, Cancelled |
| **Partially paid** (`PARTIALLY_PAID`) | Part of the amount is paid; the rest is still open. | In progress | Paid, Cancelled |
| **Paid** (`PAID`) | Fully paid. Final. | Done | Final |
| **Cancelled** (`CANCELLED`) | Voided; does not count toward revenue. Final. | Closed | Final |

## Purchase order

Starts as: **Open** · `purchase_order.status (config/enums.yaml · OrderStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Open** (`OPEN`) | Created, not yet shipped by the supplier. | To do | In transit, Delivered, Cancelled |
| **In transit** (`IN_TRANSIT`) | Shipped and on its way. | In progress | Delivered, Cancelled |
| **Delivered** (`DELIVERED`) | Received and booked into stock. Final. | Done | Final |
| **Cancelled** (`CANCELLED`) | Order withdrawn. Final. | Closed | Final |

Flags (not statuses): Overdue

## Practice task

Starts as: **Open** · `practice_task.status (workflow_transitions.rs · TASK_STATUSES)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Returned** (`BACK`) | Returned by the creator with a reason; needs rework first. | Needs attention | Open, In progress |
| **Open** (`OPEN`) | Waiting for the assignee to start. | To do | In progress |
| **In progress** (`IN_PROGRESS`) | The assignee is working on it. | In progress | Done — awaiting review, Open |
| **Done — awaiting review** (`DONE_RECEPTION`) | Completed by the assignee; the creator must validate or return it. | Awaiting review | Validated, Returned |
| **Validated** (`VALIDATED`) | Checked and closed by the creator. Final. | Done | Final |

## Ticket

Starts as: **Open** · `practice_ticket.status (workflow_transitions.rs)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Open** (`OPEN`) | New message for a physician. | To do | In progress, Done |
| **In progress** (`IN_PROGRESS`) | Being handled. | In progress | Done, Open |
| **Done** (`DONE`) | Resolved. Final. | Done | Final |

## Feedback report

Starts as: **Open** · `feedback.status (config/enums.yaml · FeedbackStatus)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Open** (`OPEN`) | Submitted, not yet reviewed. | To do | In progress, Done |
| **In progress** (`IN_PROGRESS`) | Under review. | In progress | Done, Open |
| **Done** (`DONE`) | Handled. Final. | Done | Final |

## Prescription

Starts as: **Draft** · `prescription.status`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Draft** (`DRAFT`) | Editable; not yet given to the patient. | To do | Issued |
| **Issued** (`ISSUED`) | Signed and handed out or sent. Final. | Done | Final |

## Device session trust

Starts as: **Unchecked** · `device_session.trust_status`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Suspicious** (`SUSPECTED`) | Flagged as suspicious; review and end it if unknown. | Needs attention | Trusted, Unchecked |
| **Unchecked** (`UNCHECKED`) | New sign-in from this device; not yet reviewed. | To do | Trusted, Suspicious |
| **Trusted** (`TRUSTED`) | Marked as a known practice device. | Done | Suspicious |

## Device pairing

Starts as: **Pending** · `pairing_request.status (sync_tables.rs CHECK)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Pending** (`PENDING`) | Request received; waiting for approval on the host. | To do | Accepted, Rejected |
| **Accepted** (`ACCEPTED`) | Device is paired and may sync. | Done | Revoked |
| **Rejected** (`REJECTED`) | Request denied. Final. | Closed | Final |
| **Revoked** (`REVOKED`) | Previously accepted device was removed. Final. | Closed | Final |

Flags (not statuses): Confirm code

## Work-time session

Starts as: **Running** · `work_time_session.status (rust_only.rs CHECK)`

| Status | Meaning | Phase | Can change to |
|---|---|---|---|
| **Running** (`RUNNING`) | Time is being recorded. | In progress | Paused, Ended |
| **Paused** (`PAUSED`) | Break; time is not counted until resumed. | To do | Running, Ended |
| **Ended** (`ENDED`) | Session closed. Final. | Closed | Final |
