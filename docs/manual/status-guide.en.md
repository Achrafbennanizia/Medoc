# MeDoc status guide

> Generated — do not edit. Run `node scripts/generate-manuals.mjs`.

Every item has exactly one status. Flags (e.g. “Rescheduled”) are extra hints shown next to it and never replace the status. Lists are always ordered: needs attention → to do → in progress → awaiting review → done → closed.

## Appointment

Starts as: **Planned** · `appointment.status · domain/status.rs AppointmentStatus`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Planned** (`PLANNED`) | Booked, not yet confirmed. Can be edited, moved by drag & drop, reminded or deleted. | To do | Confirmed, Completed, Cancelled, No-show | Editable, Can be deleted, Can be moved, Reminders |
| **Confirmed** (`CONFIRMED`) | Patient is expected. Can still be moved; start it with “In progress” when the patient arrives. | To do | In progress, Completed, Cancelled, No-show | Editable, Can be moved, Reminders |
| **In progress** (`IN_PROGRESS`) | Patient is being treated now. Can no longer be moved; finish with “Completed”. | In progress | Completed | Editable |
| **Completed** (`COMPLETED`) | The visit took place. Locked in the calendar; services can be billed and printed. | Done | Final | Billable, Printable |
| **No-show** (`NO_SHOW`) | Patient did not come and did not cancel. Slot is free; can be reopened as Planned. | Closed | Planned | Can be reopened |
| **Cancelled** (`CANCELLED`) | Cancelled by patient or practice. Slot is free; can be reopened or deleted. | Closed | Planned | Can be reopened, Can be deleted |

Flags (not statuses): Rescheduled · Emergency

## Patient

Starts as: **New** · `patient.status · domain/status.rs PatientStatus`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **New** (`NEW`) | First visit; master data incomplete. Editable; can still be deleted. | To do | In treatment, Treatment completed, Closed (read-only), Archived | Editable, Can be deleted |
| **In treatment** (`ACTIVE`) | Patient in ongoing care. Editable; services can be billed. | In progress | Treatment completed, Closed (read-only), Archived | Editable, Billable |
| **Treatment completed** (`VALIDATED`) | Treatment finished and checked by a physician. Still editable and billable. | Done | Closed (read-only), Archived | Editable, Billable, Printable |
| **Closed (read-only)** (`READONLY`) | Record locked for retention. Nothing can be changed; documents can still be printed. | Closed | Archived | Printable |
| **Archived** (`ARCHIVED`) | Hidden from all lists (use “Show archived”). Can be reactivated to In treatment. | Closed | In treatment | Can be reopened, Hidden from lists |

## Patient list tabs

Starts as: **New patients** · `Patients page tabs · patient_repo::filter_counts / patient-status-filter.ts` · _Set automatically by the app_

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **New patients** (`NEW_PATIENT`) | Patients with status New. | To do | In treatment | Locked |
| **In treatment** (`IN_TREATMENT`) | Patients with status In treatment (active care). | In progress | Treatment completed | Locked |
| **Treatment completed** (`CLOSED`) | Patients whose treatment is completed or closed. Each patient is in exactly one of New / In treatment / Completed. | Done | Final | Locked |
| **Invoice open** (`INVOICE_OPEN`) | At least one unpaid or partly paid payment. Can overlap with the other tabs. | Needs attention | Final | Locked |
| **Record open** (`CHART_OPEN`) | The patient record is a draft, in review or declined — documentation still needs work. | Needs attention | Final | Locked |

## Patient record

Starts as: **Draft** · `patient_chart.status · workflow_transitions.rs (forward / validate / decline)`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Draft** (`DRAFT`) | Being documented. Editable; send it to a physician when ready. | To do | In review, Validated, Declined | Editable |
| **In review** (`IN_PROGRESS`) | Waiting in the physician's validation queue (Records to validate). | Awaiting review | Validated, Declined | Editable |
| **Declined** (`DECLINED`) | Returned by the physician with a reason. Correct it, then send it again. | Needs attention | Draft, In review | Editable |
| **Validated** (`VALIDATED`) | Approved by a physician. Billing can be released; reopening sends it back to review. | Done | In review | Billable, Printable |
| **Closed (read-only)** (`READONLY`) | Locked for retention. Can be printed, not changed. | Closed | Final | Printable |

## Treatment

Starts as: **Planned** · `treatment.treatment_status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Planned** (`PLANNED`) | Treatment is planned. Editable and can be deleted or scheduled. | To do | In progress, Completed, Cancelled | Editable, Can be deleted, Can be moved |
| **In progress** (`IN_PROGRESS`) | Treatment has started (e.g. multi-session). Finish it as Completed or Discontinued. | In progress | Completed, Discontinued | Editable |
| **Completed** (`COMPLETED`) | Treatment done. Can be released for billing and printed. | Done | Final | Billable, Printable |
| **Discontinued** (`DISCONTINUED`) | Stopped before completion. Work done so far can be billed. | Closed | Final | Billable, Printable |
| **Cancelled** (`CANCELLED`) | Will not be carried out. Not billable. | Closed | Final | Locked |

## Prescription

Starts as: **Issued** · `prescription.status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Draft** (`DRAFT`) | Not yet issued. Editable and deletable. | To do | Issued | Editable, Can be deleted |
| **Issued** (`ISSUED`) | Signed and handed out. Editing creates a corrected new version; the old one becomes Replaced. | Done | Replaced | Editable, Printable |
| **Replaced** (`REPLACED`) | Superseded by a corrected version. Hidden from lists; kept for the audit trail. | Closed | Final | Hidden from lists |

## Certificate / issued document

Starts as: **Issued** · `issued_document.status (certificates, letters, invoices)`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Issued** (`ISSUED`) | Valid document with a number. Can be reprinted; cancel it to correct. | Done | Cancelled | Printable |
| **Cancelled** (`CANCELLED`) | Cancelled with a cancellation document. Kept and printable for the record. | Closed | Final | Printable |

## Sick-leave certificate

Starts as: **Active** · `sick_leave_certificate.status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Active** (`ACTIVE`) | Incapacity period is running. Editable and printable. | In progress | Ended | Editable, Printable |
| **Ended** (`ENDED`) | Period is over. Printable only. | Closed | Final | Printable |

## Payment

Starts as: **Outstanding** · `payment.status · domain/status.rs PaymentStatus`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Outstanding** (`OUTSTANDING`) | Nothing paid yet. Editable, deletable; reminders possible. | To do | Partially paid, Paid, Cancelled | Editable, Can be deleted, Reminders |
| **Partially paid** (`PARTIALLY_PAID`) | Part is paid; the rest is open. Status follows the bookings automatically. | In progress | Paid, Cancelled | Editable, Can be deleted, Reminders |
| **Paid** (`PAID`) | Fully paid. Locked; receipt can be printed. | Done | Final | Printable |
| **Cancelled** (`CANCELLED`) | Voided. Not counted in revenue or day close. | Closed | Final | Locked |

## Invoice

Starts as: **Open** · `receivables.rs status_row (derived from linked payments and due date)` · _Set automatically by the app_

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Overdue** (`OVERDUE`) | Due date passed with a balance. A payment reminder can be issued. | Needs attention | Paid, Cancelled | Reminders, Printable |
| **No payment linked** (`UNLINKED`) | Payment state cannot be computed: the invoice has no linked bookings. | Needs attention | Final | Printable |
| **Open** (`OPEN`) | Issued, not paid, not yet due. | To do | Partially paid, Paid, Overdue, Cancelled | Printable |
| **Partially paid** (`PARTIAL`) | Some linked payments received; balance still open. | In progress | Paid, Overdue, Cancelled | Printable |
| **Paid** (`PAID`) | Linked payments cover the total. | Done | Final | Printable |
| **Cancelled** (`CANCELLED`) | Invoice was cancelled by a cancellation document. | Closed | Final | Printable |
| **Cancellation document** (`CANCELLATION`) | The document that cancels another invoice. | Closed | Final | Printable |
| **Imported** (`LEGACY`) | Imported from an older version; payment state not tracked. | Closed | Final | Printable |

## Purchase order

Starts as: **Open** · `purchase_order.status · workflow_transitions.rs`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Open** (`OPEN`) | Ordered, not shipped yet. Editable and deletable. | To do | In transit, Delivered, Cancelled | Editable, Can be deleted |
| **In transit** (`IN_TRANSIT`) | Shipped. Mark Delivered on arrival to book stock. | In progress | Delivered, Cancelled | Editable |
| **Delivered** (`DELIVERED`) | Received and added to stock. Locked. | Done | Final | Printable |
| **Cancelled** (`CANCELLED`) | Order withdrawn. Locked. | Closed | Final | Locked |

Flags (not statuses): Overdue

## Contract

Starts as: **Active** · `Administration → Contracts (activation + start/end dates)`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Not started** (`NOT_STARTED`) | Start date is in the future. No cost is counted yet. | To do | Active, Deactivated | Editable, Can be deleted |
| **Active** (`ACTIVE`) | Running. Cost is counted every period until it is deactivated or ends. | In progress | Deactivated, Ended | Editable |
| **Deactivated** (`INACTIVE`) | Stopped on the deactivation date. Cost is counted only up to that date; can be reactivated. | Closed | Active | Editable, Can be reopened, Can be deleted |
| **Ended** (`EXPIRED`) | End date has passed. No further cost. | Closed | Active | Editable, Can be reopened |

## Product / service

Starts as: **Active** · `product.active / treatment_catalog.active`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Active** (`ACTIVE`) | Selectable in bookings and billing. | In progress | Inactive | Editable, Billable |
| **Inactive** (`INACTIVE`) | Hidden from selection; existing bookings keep it. Can be reactivated. | Closed | Active | Editable, Can be reopened, Hidden from lists |

## Day close

Starts as: **Final** · `day_close_protocol`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Final** (`FINAL`) | Cash reconciled and protocol saved. Corrections create a new version. | Done | Corrected | Printable |
| **Corrected** (`CORRECTED`) | Superseded by a corrected protocol; kept for the audit trail. | Closed | Final | Printable |

## Practice task

Starts as: **Open** · `practice_task.status · workflow_transitions.rs (verify + simple track)`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Returned** (`BACK`) | Returned by the creator with a reason. Always listed first; rework it. | Needs attention | Open, In progress | Editable |
| **Open** (`OPEN`) | Waiting for the assignee to start. | To do | In progress, Seen | Editable, Can be deleted |
| **Seen** (`VIEWED`) | Simple track (tickets, appointments): the assignee has seen it; mark Done when handled. | In progress | Done, Open | Editable |
| **In progress** (`IN_PROGRESS`) | The assignee is working on it. | In progress | Done — awaiting review, Open | Editable |
| **Done — awaiting review** (`DONE_RECEPTION`) | Completed by the assignee; the creator validates or returns it. | Awaiting review | Validated, Returned | Locked |
| **Validated** (`VALIDATED`) | Checked and closed by the creator. Leaves the inbox. | Done | Final | Locked |
| **Done** (`DONE`) | Simple track finished. Leaves the inbox. | Done | Final | Locked |

## Ticket

Starts as: **Open** · `practice_ticket.status (legacy tickets)`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Open** (`OPEN`) | New message for a physician. | To do | In progress, Done | Editable |
| **In progress** (`IN_PROGRESS`) | Being handled. | In progress | Done, Open | Editable |
| **Done** (`DONE`) | Resolved. | Done | Final | Locked |

## Feedback report

Starts as: **Open** · `feedback.status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Open** (`OPEN`) | Submitted, not yet reviewed. | To do | In progress, Done | Editable |
| **In progress** (`IN_PROGRESS`) | Under review. | In progress | Done, Open | Editable |
| **Done** (`DONE`) | Handled. | Done | Final | Locked |

## Device session trust

Starts as: **Unchecked** · `device_session trust flags`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Suspicious** (`SUSPECTED`) | Flagged as suspicious. Notifies you; end it if you do not recognise it. | Needs attention | Trusted, Unchecked | Can be deleted |
| **Unchecked** (`UNCHECKED`) | New sign-in from this device, not reviewed yet. | To do | Trusted, Suspicious | Can be deleted |
| **Trusted** (`TRUSTED`) | Known practice device. | Done | Suspicious | Can be deleted |

## Device registration

Starts as: **Pending** · `provisioning_state.device_status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Pending** (`PENDING`) | Device is registering; waiting for approval on the host. | To do | Active, Blocked | Locked |
| **Active** (`ACTIVE`) | Registered and allowed to connect. | Done | Revoked, Blocked | Locked |
| **Blocked** (`BLOCKED`) | Temporarily blocked from connecting; can be unblocked. | Needs attention | Active | Can be reopened |
| **Revoked** (`REVOKED`) | Removed permanently. Must pair again. | Closed | Final | Locked |

## Device pairing

Starts as: **Pending** · `pairing_request.status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Pending** (`PENDING`) | Request received; approve or reject on the host. | To do | Accepted, Rejected | Locked |
| **Accepted** (`ACCEPTED`) | Paired; the device syncs. | Done | Revoked | Locked |
| **Rejected** (`REJECTED`) | Request denied. | Closed | Final | Locked |
| **Revoked** (`REVOKED`) | Previously paired device removed. | Closed | Final | Locked |

Flags (not statuses): Confirm code

## Work-time session

Starts as: **Running** · `work_time_session.status`

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Running** (`RUNNING`) | Time is being recorded. | In progress | Paused, Ended | Editable |
| **Paused** (`PAUSED`) | On break; time is not counted. | To do | Running, Ended | Editable |
| **Ended** (`ENDED`) | Session closed; can be corrected by an admin. | Closed | Final | Editable |

## Connection

Starts as: **Connected** · `Top bar connectivity + replica outbox (connectivity.controller.ts, sync-status-badge.tsx)` · _Set automatically by the app_

| Status | Meaning | Phase | Can change to | The app allows |
|---|---|---|---|---|
| **Offline** (`OFFLINE`) | Host not reachable. Changes wait until the connection is back. | Needs attention | Connected | Locked |
| **Syncing** (`SYNC_PENDING`) | Changes are saved locally and being sent to the host. | In progress | Connected, Offline | Locked |
| **Connected** (`ONLINE`) | Changes are saved and shared immediately. | Done | Syncing, Offline | Locked |
