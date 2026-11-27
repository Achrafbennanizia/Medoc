# Site facts: what the websites may claim

**Date:** 2026-11-26. Verified against the code in this repository and against the cited sources. Use only what is here; if a claim is not here, do not make it. Companion to [site-architecture.md](site-architecture.md).

## MeDoc Dentist features (checked in the code)

Status: `exists` = in the app today; `partial` = respect the caveats; `missing` = never claim it.

### 1a. Validation workflow: reception hands work to the dentist, the dentist validates (chart validation queue; guest inbox in Essentiel)

- **Status:** partial
- **Editions:** Validation queue and chart hand-off: Cabinet (duo) and Cabinet+ (group), capability `validation` (editions.yaml:22,46,52). The gate is enforced in code today. The 5 queue commands sit behind #[cfg(feature = "cap-validation")] in register.rs. The page loads behind __CAP_VALIDATION__, and feature-modules.ts refuses the route. The hand-off dialog is behind __CAP_TASKS__. The CI surface check blocks leaks into Solo. Cabinet+ also routes validation through Sharing/Allowances: only doctors allowed by the chart owner's clinical rule may validate, and the list has a Mine/All/Other doctor filter. Essentiel (solo) has no validation queue. It uses the guest inbox instead (capability `guest_inbox`, also enforced): the guest account's saves are staged until the admin clicks Add or Dismiss. Per-section and per-item 'validated by' ticks on the chart (chart_validation) are not gated and exist in all three editions.
- **True claim:** In Cabinet and Cabinet+, reception can send a patient's chart to the dentist for review with a short note. It appears in the dentist's 'To validate' list with a count in the sidebar, the dentist validates or declines it, and each step is logged. In Essentiel, whatever the guest account enters (appointments, new or changed patients, cash payments) waits in your Inbox until you add it or dismiss it.
- **Caveats:** Reception does not 'draft' clinical content. Examinations, treatments, findings and anamnesis need patient.write_medical, which is physician-only by default (rbac.yaml:25). What reception actually does is hand the chart over (forward), and create patients, appointments, payments and tickets. The queue lists every chart in DRAFT or IN_PROGRESS, so a newly created chart (default DRAFT) shows up without anyone forwarding it. Editing a chart that is already validated does not send it back for review. Validate and decline are gated by RBAC actions that permission overrides can change: 'only a dentist' is the default, not a hard rule. The person who forwarded a chart is not notified when it is validated or declined. There is no configurable 'validation policy' setting: the ValidationPolicy strategy in the plan does not exist in code. Essentiel's guest inbox has these limits: it covers only 6 commands (create, update or move an appointment; create or update a patient; create a payment); it shows new values, not a before/after diff; there is no pending overlay in the calendar; and Add does not warn if the record changed after the proposal (editions-plan.md:819). Separately, a verify-track task that reception marks done also needs the dentist's confirmation (see the Tasks entry).

### 1b. Keeping an eye on every change (change history / audit log for the dentist)

- **Status:** partial
- **Editions:** All three editions (Essentiel, Cabinet, Cabinet+). Not gated by any capability: the audit commands are unconditional in register.rs and the /audit route is core. Opening it needs `audit.read`, which is physician-only by default. No edition has per-author or per-device change records or a per-patient history yet: plan item T5.8 is not started.
- **True claim:** MeDoc logs who did what and when: records created and changed, charts validated, guest proposals added or dismissed, exports. Each entry is chained with an HMAC so tampering shows. The dentist can page through the log, show only emergency-access entries, and export it as CSV. Reception accounts cannot open it by default.
- **Caveats:** The log is kept per computer: audit_log is DeviceLocal and does not sync. In a multi-computer Cabinet or Cabinet+ practice, the dentist's log therefore does not show changes made on reception's computer. There is no per-patient History tab, no before/after values, and no filter by person or patient; the user column shows the raw account id, not a name. Many commands write their audit entry best-effort (`.ok()`), so 'every change' is not guaranteed. The planned Cabinet+ items (author and device columns, maintenance view, per-device audit chains; T5.8) are not started. Do not claim 'see every change your team makes' for multi-computer setups.

### 2. Tasks: the dentist sends a task to reception instead of talking (tasks, tickets, comments, next-appointment hints, bell)

- **Status:** exists
- **Editions:** Cabinet (duo) and Cabinet+ (group), capability `tasks` (editions.yaml:20,46,52). The gate is enforced today. All 13 task and ticket commands plus list_task_team_directory are behind #[cfg(feature = "cap-tasks")]. The Tasks pages load behind __CAP_TASKS__ and feature-modules.ts refuses their routes. The patient-file hand-off dialogs, the 'send to reception' button on the next-appointment plan and the task notification source are all behind __CAP_TASKS__. Essentiel has none of these. Exception: the next-appointment note itself (chart_next_appointment_* commands, and the reception teaser when booking) is not gated and exists in all editions, although editions.yaml lists 'next-appointment hints' under `tasks`. Cabinet+ has no per-doctor task fields or filters yet (T5.4).
- **True claim:** In Cabinet and Cabinet+, the dentist sends a task from the patient's file to reception, either to the whole front desk or to one named person. It lands in their task list and notification bell. For billing, printing, patient-data and other tasks, reception marks the task done with a short note or a linked payment, and the dentist confirms it or sends it back with a reason. Both sides can comment on a task. Reception can send a ticket to the dentist the same way, and the dentist's 'next appointment' plan goes to reception in one click.
- **Caveats:** Tickets and appointment-plan tasks follow a simple track (open, seen, done) with no confirmation step by the dentist. A task must be linked to a patient, except when the dentist creates it from the admin tab. Comments do not raise a notification, and a dentist confirming a task does not notify reception; only 'sent back' (to the assignees) and 'done' (to the creator) do. Delivery is polled every 30 s and synced between computers, not instant push. The older practice_ticket commands (create_practice_ticket etc.) are registered, but no UI calls them; tickets in the UI are practice_task rows of kind TICKET. In Essentiel there are no tasks. The next-appointment note still exists there and pre-fills booking, and booking that patient clears the note and notifies the appointment's dentist.

### 3. Status policy (appointment, patient, chart, task/ticket, document statuses and their rules)

- **Status:** exists
- **Editions:** Core, all editions; statuses are not a capability. Backend checks run in every build. Task, ticket and chart-review statuses only change in Cabinet and Cabinet+, because the commands are compiled out of Essentiel. Guest proposal statuses (PENDING, ADDED, DISMISSED) exist only in Essentiel. Help → Status guide shows every entity in every edition (not filtered by edition) and does not list guest proposal statuses.
- **True claim:** Appointments, patients, charts, payments, orders and practice tasks each have a fixed set of statuses and allowed next steps, and MeDoc refuses changes out of order. A completed appointment can't go back to planned and a paid payment can't be reopened. An issued prescription is never overwritten: a correction creates a new version and marks the old one replaced. Help → Status guide explains every status, built from the same definitions the screens use.
- **Caveats:** Statuses and rules as coded:
- Appointment: PLANNED, CONFIRMED, IN_PROGRESS, COMPLETED, NO_SHOW, CANCELLED. PLANNED can go to CONFIRMED, COMPLETED, CANCELLED or NO_SHOW. CONFIRMED can go to IN_PROGRESS, COMPLETED, CANCELLED or NO_SHOW. IN_PROGRESS can go to COMPLETED. CANCELLED and NO_SHOW can reopen to PLANNED. COMPLETED is final.
- Patient: NEW, ACTIVE, VALIDATED, READONLY, ARCHIVED. Forward only; archiving is allowed from any status; unarchiving goes only to ACTIVE. A NEW patient becomes ACTIVE automatically after a completed appointment. The patient list tabs (New, In treatment, Closed, Invoice open, Record open) are derived.
- Chart: DRAFT, IN_PROGRESS, VALIDATED, DECLINED, READONLY. Forwarding (not from READONLY) sets IN_PROGRESS. Validate from DRAFT, IN_PROGRESS or DECLINED; decline from DRAFT or IN_PROGRESS. GDPR sets READONLY.
- Payment: OUTSTANDING, PARTIALLY_PAID, PAID, CANCELLED. PAID and CANCELLED are final.
- Practice task: OPEN, IN_PROGRESS, DONE_RECEPTION, VALIDATED, BACK, VIEWED, DONE. Verify track: OPEN, IN_PROGRESS, DONE_RECEPTION, then VALIDATED or BACK; DONE_RECEPTION needs a note or a payment, and BACK needs a reason. Simple track (TICKET, APPOINTMENT): OPEN, VIEWED, DONE. VALIDATED and DONE are closed. A dentist with task.status.admin may set any status except out of a closed one.
- Legacy ticket: OPEN, IN_PROGRESS, DONE.
- Documents: issued_document (certificates, letters, invoices, reports) is ISSUED or CANCELLED, cancelled once. Prescription: DRAFT, ISSUED, REPLACED. Sick leave: ACTIVE, ENDED. Invoice status (OPEN, PARTIAL, PAID, OVERDUE, UNLINKED, CANCELLED and more) is derived from linked payments.
- Purchase order: OPEN, IN_TRANSIT, DELIVERED or CANCELLED.
- Guest proposal (Essentiel): PENDING, then ADDED or DISMISSED, decided once.
Gaps: treatment status (PLANNED, IN_PROGRESS, COMPLETED, DISCONTINUED, CANCELLED) exists only in the UI registry; the backend stores free text with no transition check. The registry's per-status 'what you can do' rules are used in only two UI places (appointment edit, reschedule). No status policy is user-configurable.

### 4. Notification bell / in-app notifications when something changes

- **Status:** partial
- **Editions:** The bell, notification center, OS notifications and sound are in all editions. The in-app notification commands are not gated (register.rs:191-196) and the bell is in the core layout. Task-related items come only from the task source (enabled only when __CAP_TASKS__) and from cap-gated commands: tasks assigned, done or sent back, and charts sent for review. Those therefore appear only in Cabinet and Cabinet+, enforced at compile time. Essentiel gets: appointment starting soon, appointments left outside changed working hours, next-appointment plan fulfilled, low stock, suspicious sign-in. Pending guest proposals there show as a sidebar Inbox badge, not in the bell.
- **True claim:** A bell in the top bar collects what needs your attention: appointments starting within 30 minutes, appointments left outside changed working hours, low stock and suspicious sign-ins. In Cabinet and Cabinet+ it also shows tasks assigned to you, finished or sent back, and charts sent to you for review. It refreshes every 30 seconds and can also show a system notification with a sound, set in Settings → Notifications.
- **Caveats:** This is not a general 'something changed' feed. The dentist is not notified when reception edits an appointment, a patient or a payment. Nobody is notified of task comments, of a chart being validated or declined, or of a task being confirmed. Notifications are polled (30 s, plus window focus and in-app events), not pushed. Read state for derived items (tasks, reminders, stock, security) is kept in this browser's localStorage per user for 14 days. Backend notification rows are marked read on the server and sync to other computers. Outside-hours notices are generated client-side when someone edits work hours, work days or blocked times. In Essentiel, guest proposals show only as the sidebar Inbox count. The legacy PRACTICE_TICKET notification producer has no UI caller.

### Daily close (day-close / Kassenabschluss workflow)

- **Status:** exists
- **Editions:** Capability day_close: Cabinet (duo) and Cabinet+ (group) only; Essentiel (solo) does not have it (config/editions.yaml:28,46,52). The gate is enforced in code, but only in the uncommitted working tree (editions plan P2 'in progress, uncommitted'). The 5 day-close commands are behind #[cfg(feature = "cap-day-close")]. The page loads only when __CAP_DAY_CLOSE__ is set, the route guard refuses the route, and the 'Day close' button on the invoice page is hidden. At committed HEAD the day_close capability does not exist, so every edition still has the workflow.
- **True claim:** At the end of the day you count the cash drawer, either as one total or note by note, and you can enter your card terminal's daily total. MeDoc works out what should be there from the day's bookings and will not close the day on a difference unless you write down why. Each closing is final and gets a numbered report. A mistake is fixed with a correction that points to the original, never by editing it.
- **Caveats:** Only two figures are typed in: the cash count and, optionally, the card terminal total. Bank transfers and 'other' methods appear as system totals only, so 'enter the counted amount for every payment method' is not true. There is no cheque payment method at all (config/enums.yaml:72-80). The note-by-note grid is the euro list (it includes a 500 note and 1, 2 and 5 cent coins) even for MAD practices; only the currency label changes. Only the latest closing can be corrected. The legal basis named in code and report text is German (GoBD / AO §146). The Essentiel exclusion exists only in the uncommitted working tree.

### Cash book (cash journal and cash movements)

- **Status:** partial
- **Editions:** Backend in all editions: payments are written to the payment_receipt journal, and record_cash_movement, reverse_cash_movement and list_cash_movements are registered without a cap gate (register.rs:494-496). The only UI for entering cash movements is inside the day-close form, so in practice Cabinet and Cabinet+ can record deposits, withdrawals, bank deposits and cash expenses, and Essentiel cannot (in the uncommitted working tree).
- **True claim:** Every cash payment is written to a cash journal by business day, and nothing in it can be edited or deleted afterwards. In Cabinet and Cabinet+ you also record deposits, withdrawals, bank deposits and cash expenses (each with a reason, and a voucher for expenses), and these flow into the next day close.
- **Caveats:** Essentiel has the journal in the backend but no screen to record cash movements or expenses, because that form is compiled out with the day close. Its period report will also list every cash day as 'unclosed', because Essentiel has no day close (a likely defect). There is no stand-alone cash-book page: the journal is seen through the day close, its reports, and the period report.

### Payments

- **Status:** exists
- **Editions:** All editions (no cap gate). Essentiel: payments saved by the guest account go to the admin's inbox to be added or dismissed. Cabinet+: payments carry a doctor (for_staff_id, collected_by), and the payment list follows the per-dentist sharing rules (cap-allowances).
- **True claim:** Record payments in cash, by card, by bank transfer or against an invoice, including partial payments against an expected total. MeDoc keeps paid, partly paid, outstanding and cancelled amounts apart. The finance view compares this month's income with the same days of last month and shows how much is still open.
- **Caveats:** No cheque method, which matters for Morocco. There is no card-terminal or bank integration: card and transfer payments are booked by hand. The 'per doctor' and 'collected by' fields only matter in Cabinet+.

### Receipts

- **Status:** exists
- **Editions:** All editions (no cap gate).
- **True claim:** Hand the patient a numbered payment receipt as a PDF straight from their record. Numbers follow one gap-free series per country prefix (RC-… in Morocco).
- **Caveats:** The receipt number is also listed against each cash line in the journal. No e-mail or SMS sending was checked.

### Invoices in the Moroccan format

- **Status:** exists
- **Editions:** All editions (no cap gate). Cabinet+ adds the signing doctor's name per document (issue/signing_doctor.rs).
- **True claim:** When your practice bills in dirhams, MeDoc prints Moroccan invoices: your ICE, IF and TP (plus RC, CNSS and INPE if you enter them), a gap-free FA- number, each act with its date, tooth and NGAP code, totals before and after tax or the medical-act VAT exemption, and the total written out in French or Arabic. The invoice can be laid out in Arabic, right to left. Unpaid invoices can be followed up with numbered payment reminders.
- **Caveats:** The format is chosen automatically from the practice country (MA) or currency (MAD), not per invoice. The total in words is French or Arabic only. Reminder prefixes and the open-items logic come from the German model and have been adapted to France and Morocco.

### Credit notes

- **Status:** partial
- **Editions:** All editions (no cap gate). Needs the billing.cancel permission.
- **True claim:** To cancel an invoice you issue a numbered credit note (AV-…) for it, with a written reason. The credit note refers to the original invoice, which stays on file marked as cancelled. Nothing is deleted.
- **Caveats:** A credit note always cancels the whole invoice: there is no partial credit note and no refund of a single line. To correct part of an invoice, you cancel it and issue a new one.

### Purchase orders / supplier orders

- **Status:** exists
- **Editions:** All editions (no cap gate). The plan's Cabinet+ fields 'ordered for / paid by / approved by' exist only as database columns, with no UI.
- **True claim:** Order supplies from your suppliers and their reps with saved templates, and follow each order from open to in transit to delivered, with its expected date and price. The dashboard puts open and late orders in front of you. When an order is marked delivered, its quantity is added to that product's stock.
- **Caveats:** One item per order (no multi-line orders or baskets). The order list shows each order's price but no total spend, no spend per supplier and no budget. Stock is updated only when exactly one active product has the same name. There is no approval step, no 'ordered for' and no 'paid by' in the UI. Orders are not sent to suppliers electronically.

### Expenses and spending overview (period report / balance sheet)

- **Status:** partial
- **Editions:** The period report is in all editions (no gate on compute/create/reprint_period_report). Recording cash expenses needs the day-close form, so only Cabinet and Cabinet+. Contracts (recurring costs) are in all editions.
- **True claim:** For any month, quarter or year, MeDoc sets the money you actually received against your spending: cash expenses, delivered supplier orders and your running contracts. It shows the result, what is still unpaid, and every expense line with its source. Each saved report is numbered and cannot be changed.
- **Caveats:** Spending is collected per period report, not tracked live. There is no per-supplier or per-category spend view and no budget or alert. Contract costs are pro-rata estimates. Cash expenses can only be entered in Cabinet and Cabinet+, so an Essentiel report shows only delivered orders and contracts as expenses. In Essentiel the report also flags every cash day as unclosed.

### Stock / products

- **Status:** partial
- **Editions:** All editions (no cap gate).
- **True claim:** Keep a product list with categories, prices and quantities on hand, and delivered orders add to the quantity automatically.
- **Caveats:** The stock and minimum-stock UI is switched off by a hard-coded flag. Users cannot set a minimum, so the 'low stock' counters on the dashboard and statistics depend on seeded or legacy data. Stock is never reduced by use in treatments (no consumption tracking). Do not market low-stock alerts or inventory management yet.

### Statistics (activity, revenue, treatment mix, month comparison)

- **Status:** exists
- **Editions:** The statistics page is in all editions. Per-doctor comparison table and doctor filter: Cabinet+ only (CORE_CAPS.multi_doctor and the cap-allowances sharing scope, enforced in the working tree). Work-time panel: Cabinet and Cabinet+ only (__CAP_WORK_TIME__).
- **True claim:** See your practice in real figures: patients, new patients, appointments, treatments and income per month over 6 or 12 months, your treatment mix by category, and income by payment method. Each key figure shows its change against last month, compared fairly with the same part of last month so a month in progress does not look like a drop.
- **Caveats:** Every figure is a real count or amount. The 'improvement' is only the percentage change against last month: no year-over-year comparison, no targets, no benchmarks. The treatment mix counts treatments (all time), not revenue per treatment. Revenue by payment method is all-time and counts fully paid payments only. Order statistics are counts, not money. There is no statistics export yet.

### Spotting where a problem is

- **Status:** partial
- **Editions:** All editions for the signals listed. The per-doctor breakdown that would locate a problem by dentist is Cabinet+ only.
- **True claim:** MeDoc flags what needs attention as you work: figures that fell against last month, orders that are late, cash that does not match the count, days not yet closed, and invoices still unpaid.
- **Caveats:** No automatic diagnosis, anomaly detection or explanation of why a figure dropped. The dashboard 'Insights' card is fixed text, not analysis. To find the cause, the user drills into the charts; in Cabinet+ they can also break figures down by doctor. Do not claim the app 'tells you where the problem is'.

### Calendar: drag and drop, day/week/month views, slot placement, overview

- **Status:** partial
- **Editions:** Core module, so all three editions have it: Essentiel (solo), Cabinet (duo), Cabinet+ (group). The doctor dimension needs the multi_doctor capability and is Cabinet+ only: up to 4 doctor columns side by side in the day view, plus doctor filter chips and the legend. That gate is enforced at build time: __CAP_MULTI_DOCTOR__ -> DOCTOR_CONTEXT (Vite define per MEDOC_EDITION), so Essentiel and Cabinet bundles never show doctor UI. In Essentiel the guest login can create, change and move appointments, but those saves are staged for the admin's Add/Dismiss inbox (editions-plan T2.4). Calendar code is not compiled out of any edition.
- **True claim:** See your agenda by day, week or month and reschedule by dragging an appointment to another time or day. MeDoc snaps it to a 5-minute step inside opening hours, pushes that doctor's following appointments back to make room, refuses moves into breaks or absences, and gives you Undo. In Cabinet+, two to four doctors' agendas sit side by side in the day view.
- **Caveats:** (1) No chairs or rooms. Drag changes only date and time, never the chair or the doctor, so 'moving a patient to the right chair' is MISSING. A room_id column exists in the schema but nothing uses it. (2) Dragging between doctor columns in Cabinet+ does not reassign the doctor. To change the doctor, edit the appointment. (3) Drag works in the day and week views only. In the month view you click a day to open it. (4) Drag is mouse-only (onMouseDown/mousemove), with no touch or pointer events, so it will not work on a tablet. (5) No list or agenda view of all appointments. The overview is the day sidebar stats, the month load colours and the dashboard 'today' list. (6) Drag can be switched off in Settings (it is on by default). (7) Several calendar files (appointments.tsx, day-split.tsx) and the edition-gate files are uncommitted in the working tree.

### Conflicts, errors and mismatches the app flags

- **Status:** exists
- **Editions:** Appointment overlap, opening-hours and absence checks, allergy vs prescription, form/IPC validation and chart-completeness gaps are core code in all editions (Essentiel, Cabinet, Cabinet+). Day-close cash and card mismatches need the day_close capability (Cabinet, Cabinet+), enforced in code: the Rust commands prepare_day_close, close_day, correct_day_close etc. are #[cfg(feature = "cap-day-close")] and the UI route/page sits behind __CAP_DAY_CLOSE__. Essentiel has no day-close workflow (the cash book stays). Sync conflicts need the net capability (Cabinet, Cabinet+), enforced in code: the sync_problem_* commands are #[cfg(feature = "cap-net")] and Essentiel links no sync code.
- **True claim:** MeDoc stops double-booking a doctor and bookings during breaks, closures or absences, and it warns you when changed opening hours leave existing appointments outside them. Before a prescription is saved, its active substance is checked against the allergies in the anamnesis, by name and by drug group, and the doctor has to confirm before it is issued anyway. In Cabinet and Cabinet+, day close shows any difference between counted cash and the cash book, or between the card terminal and recorded card payments, and asks for a reason. Edits made on two computers at once land in the admin's conflict list instead of being lost.
- **Caveats:** Exact list of what is flagged: (1) overlapping appointments for the same doctor (refused by the backend); (2) times outside hours, in breaks or blocked periods, or during absences (refused, plus a 180-day scan that sends notifications); (3) prescription substance vs recorded allergy (blocks until confirmed; the override is audited); (4) day close: cash variance, card-terminal variance, denomination total mismatch, future date, day already closed, later close exists, correction only of the latest close and only with a reason; (5) form/IPC validation errors with MD- codes, the chart-completeness badge, contradictory tooth statuses; (6) sync: field conflicts, unique-key clashes (e.g. the same insurance number on two devices), incoming changes that kept failing, local changes that could not be sent; (7) a broken audit chain. Limits: the allergy check is a short, conservative list of 9 dental-relevant drug groups, and the code says it does not replace a drug database. It only runs when an anamnesis form exists, and it also matches free text such as food or material entries in the allergies section. Alternative times suggested after a booking conflict only skip slots with the exact same start time (hasPhysicianSlotConflict), so a suggestion can still overlap; the backend would then refuse it. No overlap check across rooms or chairs, since rooms do not exist. Essentiel has no day close at all, so it has no cash-mismatch flag. The field-conflict inbox (merge_fields.rs, settings-sync-conflicts.tsx, FIELD_CONFLICT in problems.rs) is uncommitted in the working tree; GAVE_UP, UNIQUE_CONFLICT and NOT_SENT are committed.

### Patient overview, quick actions, fast data entry, patient search

- **Status:** exists
- **Editions:** Core in all editions (Essentiel, Cabinet, Cabinet+). In Essentiel, patients the guest creates or changes are staged for the admin's inbox (patient-create.tsx:115 isProposal). The clinical tabs and the header mini tooth chart need the clinical-view right; the Essentiel guest gets it only if the admin turns it on. The ticket and hand-off dialogs are gated by __CAP_TASKS__ (Cabinet, Cabinet+). There is no edition gate on search or on the overview itself.
- **True claim:** Every patient record opens on one header with status, an open-invoice warning, age, phone, email, insurance number and address, a mini tooth chart, and the basics still missing (insurance number, anamnesis, tooth findings, examination). Search patients by name, phone, email or insurance number with 'did you mean' suggestions. Book an appointment, write a prescription, email or call straight from the list. A new patient's master data and anamnesis, including allergies, go into one form.
- **Caveats:** (1) The global search box and ⌘K palette do NOT search patients. They only list pages and 'new' actions, although the placeholder says 'Search patients, actions, or views…' (packages/shared/locales/en.json:3327). Patient search lives on the Patients page and in the patient pickers. (2) The anamnesis part of the new-patient form is saved only for users with medical write rights. (3) The header buttons for task to reception, review request and discharge leaflet are hidden in v1 by a flag. (4) In Essentiel the guest is a RECEPTION login. The header 'ticket to doctor' button is not edition-gated, but its dialog is (__CAP_TASKS__), so in Essentiel the button likely does nothing. Not verified in the running app. (5) Search is a LIKE substring match. The fuzzy part is name suggestions only (Levenshtein <= 2, switchable).

### Keyboard shortcuts and command palette

- **Status:** exists
- **Editions:** All editions. ⇧⌘T (new task) and G then T (go to tasks) only do something where the tasks capability exists (Cabinet, Cabinet+). The handlers check routeChildPathAllowed, which refuses routes of modules missing from the edition (feature-modules.ts + rbac.ts:264). The palette list is filtered by role and edition the same way.
- **True claim:** Press ⌘K (Ctrl+K on Windows) to jump to any page or 'new' action. ⌘N opens a new appointment, ⇧⌘N a new patient, and G followed by a letter goes straight to a section. In the calendar, D, W and M switch views, T jumps to today, N books, and the arrow keys page through time. ⌘/ opens the full, searchable shortcut list in Help.
- **Caveats:** (1) The palette is navigation only: pages and 'new' forms, no patient records, despite the placeholder text. (2) Shortcut hints in the UI are limited to the topbar '⌘K' chip, the palette footer, the ↵ marks, the '/' on Help search and the Help shortcuts page. Buttons carry no per-button shortcut tooltips. (3) The topbar chip shows '⌘K' on Windows too (hard-coded). (4) Alt+1…9 reads e.key as a digit. On macOS, Option+digit produces a symbol, so it very likely does nothing on Mac. Not tested. (5) The Help shortcut list is not filtered by edition, so Essentiel lists 'new task' and 'go to tasks', which do nothing there. (6) Shortcuts are ignored while focus is in an input or inside a dialog (apart from the dialog's own Esc/↑↓/Enter). (7) A code comment in shortcuts.ts names calendar keys 'D/W/M/H', but the handler and the registry use D/W/M/T/N.

### Tooth chart / odontogram

- **Status:** exists
- **Editions:** Core clinical code in all editions (Essentiel, Cabinet, Cabinet+). No capability gate.
- **True claim:** The tooth chart lays out all 32 permanent teeth in FDI order along a curved arch, with distinct crown and root outlines for incisors, canines, premolars and molars. Pick a status (caries, filling, crown, root fracture, missing, implant, planned) and click a tooth. Each status gets its own colour and mark, statuses can be combined, and contradicting ones are cleared automatically. Every tooth can be reached by keyboard and is named for screen readers.
- **Caveats:** (1) Permanent dentition only: no deciduous teeth (FDI 51-85). (2) No tooth surfaces (mesial/occlusal/distal/buccal/lingual) and no periodontal charting. Free-text 'pocket' maps to 'planned'. (3) Teeth are stored as FDI numbers, but the chart prints localized quadrant labels (UR1… / OR1… / HD1…), not the two-digit FDI numbers. Say 'FDI-ordered', not 'labelled with FDI numbers'. (4) The 'root' status means root fracture, not root-canal treatment. (5) The shapes are simplified SVG outlines (four tooth types), not anatomical drawings. How recognisable they look is a design judgement and was not checked visually here. (6) The clinical brush in DentalChart sets one status per click. Status combinations are built in the examination composer and the Help practice chart.

### Automatic daily backups (schedule, external folder, attachments)

- **Status:** exists
- **Editions:** All editions (Essentiel, Cabinet, Cabinet+). Nothing in the backup code is behind a cap-* feature. The commands need ops.backup, which rbac.yaml gives to PHYSICIAN only. The loop runs on every device, replicas included.
- **True claim:** MeDoc Dentist backs up the practice once a day by itself, with no one having to remember it. Backups can go to a USB stick or external drive, and X-rays and scans are included.
- **Caveats:** Only runs while the app is open: there is no background service, and the first check is 5 min after start. 'Once a day' means one if none exists yet for that local day. If the chosen drive is missing, the backup goes to the local folder (~/medoc-data/backups) and the page says so. The pre-update backup only matters once the updater ships; the plan says the first signed release has not run yet.

### Backup encryption and size

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** Every backup is compressed and then encrypted with AES-256-GCM, so patient data never touches the disk unencrypted. Compression makes a backup much smaller than the encrypted database (under a third in our tests).
- **Caveats:** Do not publish a fixed MB figure: the only measurement is the relative test ('under a third'). Attachments are not compressed, only encrypted and stored once (deduplicated). The pre-restore safety snapshot still uses the older .db format, which is SQLCipher-encrypted but not compressed. Restoring on another computer needs the practice key, which is the passphrase-wrapped key copied next to each backup (db-key.wrap/salt/kcv).

### Backup retention (3 days, last week, last half-year)

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** MeDoc Dentist keeps the last 3 days of backups, one from last week and one from the last half-year, and deletes older ones automatically so the disk never fills up.
- **Caveats:** That means at most about 5 backups, so there is no copy for each month or year. 'Last 3 days' means the last 3 days that have a backup, not 3 calendar days. Retention runs after each new backup in the active folder.

### Backup restore

- **Status:** exists
- **Editions:** All editions (no gate). PHYSICIAN only (ops.backup).
- **True claim:** Restoring takes one click in Settings -> Backups. Before anything is replaced, MeDoc Dentist first saves a copy of today's data, and it puts that copy back if the restore fails.
- **Caveats:** Restore replaces the whole database. It cannot restore a single patient or record. The older /ops page validates first with validate_backup, which only opens .db files (validate_open, restore.rs:275-283), so a .mdbk typed into that page is likely refused. Settings -> Backups does not have that problem.

### Backup verification

- **Status:** partial
- **Editions:** All editions (no gate).
- **True claim:** Every backup carries a cryptographic signature that MeDoc Dentist checks whenever it lists backups. A backup that was altered or damaged is flagged and cannot be restored.
- **Caveats:** No automatic test-restore exists: nothing opens or restores a backup in the background to prove it works. Verification means checking the signature, plus decryption at restore time. validate_backup does not handle the current .mdbk format. Do not claim 'tested restores'.

### Database encryption (SQLCipher, AES-256)

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** The whole practice database is encrypted on disk with SQLCipher (AES-256). The key stays in the computer's secure keychain, not next to the data.
- **Caveats:** Fallback: if the OS keychain is unavailable (ad-hoc USB builds, CI), the key goes in a 0600 file in the app data folder and a warning is logged. SQLCipher 4's default cipher (AES-256-CBC with HMAC page authentication) is relied on, not pinned in code.

### Roles: reception cannot see the medical chart

- **Status:** exists
- **Editions:** Cabinet and Cabinet+ have PHYSICIAN and RECEPTION staff accounts (cap-multi-staff). Essentiel has the admin (physician) plus one guest (RECEPTION role) whose clinical read is a switch, off by default. The role check is enforced in the backend in all editions.
- **True claim:** Reception does not see diagnoses or clinical findings by default, and the app's backend enforces this, not only the screen. Every chart read is written to the audit log.
- **Caveats:** Not absolute: the admin can grant medical read to a named person (per-person ALLOW override or access profile), and in Essentiel the guest has a 'may read the clinical record' switch. Say 'by default' or 'unless you allow it'.

### Tamper-evident audit chain (HMAC)

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** Every change and every chart read is recorded in an audit log where each entry is chained to the one before with a cryptographic HMAC, so an altered or deleted entry is detected.
- **Caveats:** Tamper-evident, not tamper-proof. When a break is found at start-up, the app automatically moves the broken entry and all later ones to audit_log_archive and logs AUDIT_CHAIN_REPAIRED. The chain then verifies again, and the UI shows a warning only if the break remains. The timestamp (created_at) is not part of the HMAC. Entries are per device; T5.8 (per-device chains, maintenance view) has not started.

### Sign-in protection (passwords, lockout, idle timeout)

- **Status:** exists
- **Editions:** All editions. The guest on/off check at sign-in only exists in Essentiel (cap-guest-inbox).
- **True claim:** Each person signs in with their own password, stored only as an Argon2id hash. After 5 wrong attempts the account locks for 15 minutes, and a session closes after 30 minutes without activity.
- **Caveats:** Sign-in is email + password only (see 2FA).

### Two-factor authentication (2FA / TOTP)

- **Status:** missing
- **Editions:** None. It is off in every edition.
- **True claim:** None today. At most: 'Two-factor sign-in is in preparation.'
- **Caveats:** TOTP code and tests exist, but the feature is switched off at compile time and not reachable from the UI. Do not claim 2FA. Break-glass emergency access is also off (mvp_security.rs:10).

### Editions: capability gates enforced at build time

- **Status:** partial
- **Editions:** Essentiel (solo) = guest_inbox. Cabinet (duo) = net, multi_staff, tasks, work_time, validation, lan_client, maintenance, day_close. Cabinet+ (group) = duo + multi_doctor, multi_admin, allowances. Gates are enforced in the working tree. At HEAD (6f2431ac 'Editions P0') every edition still contains all code.
- **True claim:** Essentiel is built for one dentist on one computer: network, team, task, work-time and day-close code is left out of the app, so the Essentiel binary is about 26% smaller (58.5 MB vs 78.9 MB, measured once on macOS). Cabinet adds the practice network, staff accounts, tasks, work time and chart validation. Cabinet+ adds several doctors, a second admin computer and per-dentist sharing rules.
- **Caveats:** All P1-P7 edition work is uncommitted (295 modified files, 188 untracked, e.g. guest.rs, allowances.rs and staged_change.rs untracked). HEAD release.yml has no edition matrix and the only release is v0.1.0, so no shipped binary differs by edition yet. lan_client and maintenance are listed caps but not gated separately: they come with cap-net, and the maintenance view (T5.8) has not started. The 'Not done' items in §8 still apply: no per-doctor task/finance/order filters (T5.4), no week view or chair columns per doctor. Size and bundle figures come from the plan's 2026-11-24 measurement, not a CI check.

### Guest inbox (Add / Dismiss) in Essentiel

- **Status:** exists
- **Editions:** Essentiel only (cap-guest-inbox, compiled out of Cabinet and Cabinet+). Implemented in the working tree, not committed.
- **True claim:** In Essentiel, a temporary helper can sign in as a guest. Their new appointments, patient details and cash payments wait in your inbox until you click Add or Dismiss, and nothing they enter reaches your records without your OK.
- **Caveats:** Only those 6 kinds of change can be proposed. Every other write by the guest is refused. The guest's calendar has no 'pending' overlay, edits show the new values but no before/after view, and Add does not warn if the record changed after the proposal (the normal checks run, and a failure keeps the item waiting). Guest read of the clinical record is off by default (switch in Settings -> Security -> Guest).

### Device, account and doctor limits

- **Status:** exists
- **Editions:** Essentiel 1 device / 2 accounts (admin + guest) / 1 doctor. Cabinet 3 devices (1 admin + 2) / 3 accounts / 1 doctor. Cabinet+ 5 devices (2 admin + 3) / 20 accounts / 4 doctors. Enforced from the build's edition in the working tree.
- **True claim:** Each edition sets how many computers can join the practice (1, 3 or 5) and how many sign-in accounts and doctors it holds (Essentiel: you plus one guest; Cabinet: 3 accounts, one dentist; Cabinet+: up to 20 accounts and 4 dentists). The limits are enforced by the database and at device pairing.
- **Caveats:** Uncommitted. Builds without an edition feature (e.g. medoc-core's own tests) fall back to the old MVP caps (1 physician, 4 reception, 5 total). Existing clusters keep the seat numbers stored at activation until the licence is activated again. 'One account per device' in Cabinet is not enforced, only the total of 3. The Cabinet+ limit of 2 admins applies to admin computers (seats), not as a separate cap on admin accounts.

### Cabinet+ only: several doctors, two admin hubs, sharing rules

- **Status:** partial
- **Editions:** Cabinet+ only (cap-multi-doctor, cap-multi-admin, cap-allowances). Working tree, uncommitted.
- **True claim:** Cabinet+ is for practices with several dentists: one calendar column per doctor, statistics per doctor, prescriptions and certificates signed by the dentist who issued them, and a second admin computer that keeps issuing invoice numbers when the main one is offline. Each dentist decides what they share.
- **Caveats:** Not done (per §8): per-doctor fields and filters in tasks, finance and orders. Week view per doctor, chair (room) columns, and dragging an appointment to another doctor's column. The record-privacy control exists only on appointments, not on clinical entries, documents or tasks. The 'for me / Dr B / both' target selector does not exist yet. Signing doctor is not yet applied to sick-leave notes, reports or invoices.

### Interface languages (FR, AR, DE, EN; Arabic right to left)

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** MeDoc Dentist works in French, Arabic, German and English. Arabic is laid out right to left, and documents can be printed in a different language from the one on screen.
- **Caveats:** Every key is present in all four files, but a handful of values match the English text (about 40 longer strings in fr/de, 16 in ar). No language review is recorded in code. Moroccan Darija and Tamazight are not included.

### Moroccan invoices in French and Arabic (ICE, IF, TP, RC, CNSS, INPE)

- **Status:** exists
- **Editions:** All editions (no gate).
- **True claim:** MeDoc Dentist prints Moroccan invoices in French or Arabic with your ICE, IF and TP (plus RC, CNSS and INPE when set), the medical-act VAT exemption notice and the total in words. It refuses to issue an invoice without ICE and IF.
- **Caveats:** The invoice has a 'code' column, but no NGAP act catalogue ships in the code ('NGAP' appears only in a doc comment), so practices enter their own act codes. Cancellation produces a credit note (avoir). The plan (§9) lists the Moroccan ordonnance fields as still to be confirmed with a professional body.

### Moroccan prescriptions and medical certificates (FR / AR)

- **Status:** exists
- **Editions:** All editions (no gate). Group-only signing-doctor block applies in Cabinet+.
- **True claim:** Prescriptions (ordonnances) and medical certificates, sick-leave notes included, print in French or Arabic on your practice letterhead with the dentist's INPE.
- **Caveats:** Plan §9: Moroccan ordonnance fields not yet confirmed legally. No e-prescription in Morocco (EPRESCRIPTION_ENABLED = false, and that integration is German).

### Works offline (no internet needed)

- **Status:** exists
- **Editions:** All editions. Essentiel contains no network code at all in the working tree.
- **True claim:** MeDoc Dentist runs entirely on your own computer: appointments, charts, invoices and backups work without an internet connection, and patient data is not sent to a cloud.
- **Caveats:** Internet is only used for optional things: update checks (GitHub release manifests) and the vendor company portal. Support files are saved locally and sent by the user's mail app.

### LAN multi-workstation (main computer + replicas)

- **Status:** exists
- **Editions:** Cabinet (1 main + up to 2 more computers) and Cabinet+ (2 admin hubs + 3) via cap-net. Compiled out of Essentiel in the working tree (Essentiel keeps the code at HEAD, but is limited to 1 seat).
- **True claim:** In Cabinet and Cabinet+, the reception PC and treatment-room computers share one practice database over your local network, encrypted and with every change signed. A computer that loses the connection keeps working and catches up when it is back.
- **Caveats:** Uncommitted edition gating, as above. Unsigned change batches from older versions are still accepted until the main device sets the require-signed flag (entry_signature.rs:11-12). Field-level merge covers only patients, appointments and tasks; other tables use row-level last-writer-wins, with conflicts listed for the admin. The browser/tablet client (lan_client) has no gate of its own, and the apps/lan-web-client named in docs/architecture/lan-client-deployment.md does not exist in apps/. Do not market tablet access.

## Statistics (each checked against its source)

Use the corrected claim and always cite the source next to the number. Figures from other countries support an advantage; they say nothing about our markets.

| Figure | Market | Supports | What the source says | Source |
|---|---|---|---|---|
| 13% of on-call time (~30 min per 4 h) | UK | faster patient search / time lost searching for paper records | In 50 hours of structured observation of junior doctors on call at two UK teaching hospitals, 13% of their time (about 30 minutes in a 4-hour period) went on searching. Searching for paperwork and searching for equipment made up most of it. | [Pinchin & Blakey, How much of a doctor's on-call shift is spent searching for equipment and paperwork? A mixed methods study (Future Hospital Journal) (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6465898/) |
| 24 antiresorptive cases missed on paper (0 with digital records) | Italy | faster patient search / fewer errors in handwritten records (dental-specific) | In Scarano et al. (BioMed Research International, 2025), 20 volunteer dental students reviewed 200 patient records split into paper (PMR) and digital (EHR) groups. With paper records, 24 cases of antiresorptive medication use went unnoticed, along with 6 patients on anticoagulant therapy and 1 penicillin allergy, for 31 oversights in all. The EHR group had no detected oversights. Caveats: the sample is small (20 dental students). The text and Table 1 also give different oversight means for the paper group: the text says 9.3 ± 0.46, while the table says 0.31 ± 0.46. The 31 itemized oversights spread across 100 paper records match the table's 0.31. The text and table also disagree on the time means. | [Scarano et al., A Digital Clinical Records Versus Paper Records in Dental Practice: A Comparative Study (BioMed Research International) (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12745653/) |
| 13.6% of visits | US (Colorado) | fewer lost or missing documents | Smith and colleagues surveyed 253 primary care clinicians at 32 clinics in the State Networks of Colorado Ambulatory Practices about 1,614 patient visits between May and December 2003. The clinicians reported that clinical information was missing in 13.6% of visits, nearly 1 in 7. They judged the missing information at least somewhat likely to adversely affect the patient 44% of the time. The source is JAMA 2005;293:565-571. | [Smith et al., Missing clinical information during primary care visits (JAMA 2005), via news release on EurekAlert (2005)](https://www.eurekalert.org/news-releases/465912) |
| 60% less likely | US (Colorado) | fewer lost or missing documents with electronic records | In the same JAMA study (Smith et al., JAMA 2005;293:565-571), missing clinical information was less likely when individual clinicians reported having full electronic records (60 percent less likely). The JAMA abstract gives this as OR 0.40 (95% CI 0.17-0.94). | [Smith et al., Missing clinical information during primary care visits (JAMA 2005), via news release on EurekAlert (2005)](https://www.eurekalert.org/news-releases/465912) |
| 15% of outpatient consultations | UK | fewer lost or missing documents / misfiled paper records | At three UK teaching hospitals that all used paper-based medical records, key items of clinical information were missing in 15% of outpatient consultations. Of those patients, 32% had a delay or disruption to their care and 20% had a risk of harm. | [Burnett et al., Missing Clinical Information in NHS hospital outpatient clinics: prevalence, causes and effects on patient care (BMC Health Services Research) (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3118108/) |
| 105 of 362 files (about 29%) | South Africa | fewer lost or misfiled paper records (dental-specific) | The audit set out to review 362 clinical records at a university dental hospital, but 105 files could not be retrieved because of the poor filing system, so only 257 were evaluated (71% of the planned sample). The Discussion puts the 105 irretrievable files down to the illegibility of the file number recorded in the patient administration book at the Admissions and Emergency (A&E) department. The Recommendations section says files were irretrievable "owing to illegibility and/or files that were lost". | [Audit of dental record-keeping at a university dental hospital (Health SA Gesondheid 28:2442) (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10784275/) |
| 70 minutes per patient visit | US | less administrative time (billing / insurance paperwork) | In the US, moving to fully electronic workflows saves 70 minutes on average per patient visit, which frees medical staff to focus on patient care. Automating claim status inquiries saves medical providers and staff up to 18 minutes on average per patient visit. Separately, adopting the electronic prior authorization standard saves providers and staff 14 minutes per authorization. | [CAQH, 2024 CAQH Index Key Takeaways (2024)](https://caqh.org/hubfs/Index/2024%20Index%20Report/CAQH%202024%20Index%20Report%20Key%20Takeaways%20FINAL.pdf) |
| 42.5% to 6.6% (about 7 times fewer errors) | US (New York) | fewer errors in handwritten prescriptions (legibility, medication errors) | In a study of 12 community practices, prescription errors among the 15 providers who adopted e-prescribing fell from 42.5% to 6.6% after one year. Among the 15 providers who kept writing by hand, errors rose slightly from 37.3% to 38.4%. E-prescribing completely eliminated illegibility problems. | [Weill Cornell Medicine news: Electronic Prescriptions Reduce Errors by Seven-Fold (Kaushal et al., Journal of General Internal Medicine) (2010)](https://news.weill.cornell.edu/news/2010/02/electronic-prescriptions-reduce-errors-by-seven-fold) |
| US$42 billion per year | Global | errors in handwritten prescriptions / medication errors | The WHO Medication Without Harm page says the global cost of medication errors has been estimated at US$42 billion a year. WHO formally launched its Medication Without Harm Global Patient Safety Challenge on 29 March 2017, at the Second Global Ministerial Patient Safety Summit in Bonn, Germany. | [WHO, Medication Without Harm (Global Patient Safety Challenge) (2017)](https://www.who.int/initiatives/medication-without-harm) |
| 67.8% vs 78.6% attendance | Global (systematic review of trials) | appointment reminders reduce no-shows | A Cochrane systematic review (Gurol-Urganci et al., 2013; 8 RCTs, 6,615 participants) found that overall attendance at appointments was 67.8% with no reminders and 78.6% with mobile text-message reminders. Phone call reminders reached 80.3%, so text messages had a similar effect to phone calls. The cost per text message per attendance was 55% and 65% lower than the cost per phone call reminder in the two estimates reported. The evidence was rated moderate quality. | [Cochrane review CD007458: Mobile phone messaging reminders for attendance at healthcare appointments (Gurol-Urganci et al.) (2013)](https://www.cochrane.org/evidence/CD007458_mobile-phone-messaging-reminders-attendance-healthcare-appointments) |
| US$6.64 million per healthcare breach | Global (IBM/Ponemon study) | cost of healthcare data breaches (encryption, security) | IBM's Cost of a Data Breach Report, released the week of July 31, 2026, puts the average healthcare breach at US$6.64 million. The global average across all industries is US$4.99 million. This is the 13th year in a row that healthcare has led all industries in breach costs. The healthcare average fell from US$7.42 million in last year's report. | [Chief Healthcare Executive: Cost of breaches: Healthcare still leads all sectors (on IBM Cost of a Data Breach Report 2026) (2026)](https://www.chiefhealthcareexecutive.com/view/cost-of-breaches-healthcare-still-leads-all-sectors-and-ai-is-used-in-more-attacks) |
| 264% increase | US | ransomware frequency (offline backups, encryption) | HHS has reported a 264% increase in large ransomware breaches since 2018. A STAT analysis of HHS Office for Civil Rights records found that as many as 172 million individuals (more than half the US population) may have been affected by large health data breaches reported to HHS in 2024. Of the 656 breaches reported as of December 4, 2024, 532 came from hacks and ransomware attacks. | [STAT News: Change Healthcare cyberattack drives 2024 record year for US health data breaches (citing HHS OCR) (2024)](https://www.statnews.com/2024/12/05/change-healthcare-cyberattack-2024-record-year-us-data-breaches/) |
| 95% (backups targeted); 66% of attempts succeeded | Global (14 countries) | backups / offline backups protect against ransomware | 95% of healthcare organisations hit by ransomware in the past year said attackers tried to compromise their backups during the attack, and two-thirds (66%) of those attempts succeeded. 67% of healthcare organisations were hit by ransomware in the 2024 survey, up from 60% in Sophos's 2023 study. The healthcare sample was 402 IT/cybersecurity leaders, part of a vendor-agnostic survey of 5,000 leaders in 14 countries run January–February 2024. Sophos is a security vendor and this is its own survey. | [Sophos, The State of Ransomware in Healthcare 2024 (2024)](https://www.sophos.com/en-us/blog/the-state-of-ransomware-in-healthcare-2024) |
| 88% of SMB breaches | Global (139 countries) | data loss / backups in small businesses and clinics | Ransomware was a component of 88% of breaches at small and medium-sized businesses, compared with 39% at larger organisations. Verizon notes that SMBs are less likely than large organisations to have up-to-date and readily available backups. | [Verizon 2025 Data Breach Investigations Report, Small- and Medium-Sized Business Snapshot (2025)](https://www.verizon.com/business/resources/infographics/2025-dbir-smb-snapshot.pdf) |
| nearly 2 million people | Morocco | data-breach risk in Morocco (encryption, access control) | In the April 2025 cyberattack on Morocco's National Social Security Fund (CNSS), more than 54,000 files were allegedly stolen, exposing information on nearly 2 million people, according to Moroccan media reports. | [The Record: Morocco investigates major data breach allegedly by Algerian hackers (2025)](https://therecord.media/morocco-investigates-breach-hackers-algeria) |
| 32 million beneficiaries / 88% of population | Morocco | Morocco context: AMO generalisation (more insured patients and claims paperwork) | According to the presentation note of the 2026 finance bill (PLF 2026), generalising compulsory health insurance (AMO) made it possible in 2025 to cover more than 32 million beneficiaries, or 88% of the population, up from only 42% before generalisation. The AMO-Tadamon scheme currently covers nearly 11 million beneficiaries. | [Maroc.ma (MAP): Généralisation de l'AMO : plus de 32 millions de bénéficiaires en 2025 (2025)](https://maroc.ma/fr/actualites/generalisation-de-lamo-plus-de-32-millions-de-beneficiaires-en-2025) |
| 50,000 to 300,000 DH fines; 24 months to connect | Morocco | Morocco context: Bill 52-26 health information system / shared medical record | Bladi.net (13 August 2026) reports that Bill 52.26 on the national integrated health information system ("système national intégré d'information sanitaire") was filed with the House of Representatives on 31 July 2026 and is not yet law. It would create a shared medical record for each patient, which professionals must update after each consultation or medical act. Facilities would have up to 24 months to connect their systems, counted from publication of the technical rules. A professional or facility head who fails to update the record faces a fine of 50,000 to 300,000 DH, and the same range applies to a facility that does not connect its IT system. Illegal access to a shared record carries a fine of up to 200,000 DH. Bladi does not mention the Hespress numbering (05.26) or the 22 July 2026 government approval reported by Le360. | [Bladi.net: Les médecins marocains risquent jusqu'à 300 000 DH d'amende (2026)](https://www.bladi.net/medecins-marocains-risquent-jusqu-dirhams,123105.html) |
| 50,000 to 300,000 DH (Art. 57); 20,000 to 200,000 DH (Art. 58) | Morocco | Morocco context: CNDP / Law 09-08 compliance (encryption, access control, security) | Under Law 09-08, Art. 57: anyone who processes personal data relating to health (or revealing racial or ethnic origin, political, philosophical or religious opinions, or trade-union membership) without the express consent of the persons concerned faces 6 months to 2 years in prison and a fine of 50,000 to 300,000 DH, or one of these two penalties. Art. 58: anyone who processes, or has someone process, personal data without the security measures required by Arts. 23 and 24 faces 3 months to 1 year in prison and a fine of 20,000 to 200,000 DH, or one of these two penalties. Art. 1(3) defines 'données sensibles' to include data relating to health, including genetic data. | [Loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel (official text, Ministry of Justice portal Adala) (2009)](https://adala.justice.gov.ma/api/uploads/2024/04/30/Protection des personnes physiques-1714464099884.pdf) |
| 6,552 private dental practices; 458 public-sector dentists | Morocco | Morocco context: size of the dental market | According to the Ministry of Health and Social Protection's carte sanitaire for 2025, as reported by Aujourd'hui le Maroc, the private sector had 6,552 dental practices (cabinets dentaires), and the public sector had 458 dentists. The 6,552 figure counts practices, not individual dentists. The article gives no total number of private-sector dentists. | [Aujourd'hui le Maroc: Carte sanitaire : le Maroc compte 34.173 médecins dans le public et le privé en 2025 (2025)](https://aujourdhui.ma/societe/carte-sanitaire-le-maroc-compte-34-173-medecins-dans-le-public-et-le-prive-en-2025) |
| 11 million DH (2021) to 1.7 billion DH (2024) | Morocco | Morocco context: Digital Morocco 2030 | Head of Government Aziz Akhannouch said public investment in digital rose from 11 million dirhams in 2021 to more than 1.7 billion dirhams in 2024. He said this at the opening of Oracle's second R&D hub in Agadir, as reported in a Maroc.ma (MAP) article on the Digital Morocco 2030 strategy dated 30 June 2026. The article gives no health-specific targets and does not mention health (santé) at all. | [Maroc.ma (MAP): La stratégie Digital Morocco 2030 fait du numérique un moteur de compétitivité et d'inclusion sociale (2026)](https://maroc.ma/index%2Ephp/fr/actualites/la-strategie-digital-morocco-2030-fait-du-numerique-un-moteur-de-competitivite-et-dinclusion-sociale) |

## True numbers about MeDoc and the company

- **Paying client projects evidenced:** 0 (Every project is the founder's own product, a personal tool, university work or a fictional-brand concept. MeDoc pilots are planned (3) but not done, per docs/launch/01-business-plan-morocco-first.md.)
- **MeDoc UI languages:** 4 (English, German, French, Arabic with RTL) (packages/shared/locales/{en,de,fr,ar}.json, each with 6,760 keys at parity, checked by npm run i18n:verify)
- **MeDoc translation keys per language:** 6,760 (Leaf-key count of each locale JSON on 2026-11-26)
- **MeDoc desktop target platforms:** 3 (Windows, macOS, Linux) (.github/workflows/release.yml matrix ubuntu-latest, macos-latest, windows-latest. CI tests run on Ubuntu and Windows.)
- **MeDoc independently runnable systems:** 3 (practice desktop host, LAN HTTPS server, company portal server) (README 'Three systems'; Cargo.toml [workspace.metadata.medoc.systems])
- **MeDoc Rust crates in workspace:** 13 (Cargo.toml workspace members)
- **MeDoc codebase size:** ~125k lines Rust (517 files), ~105k lines TypeScript/TSX (703 files) (wc -l over git-tracked .rs/.ts/.tsx files, excluding node_modules, third_party, dist and releases)
- **MeDoc automated tests (static count):** ~1,090 Rust test functions + ~555 frontend test cases in 123 files (grep of #[test]/#[tokio::test] attributes and it()/test() calls on 2026-11-26. This is a code count, not one recorded full passing run.)
- **MeDoc cross-system end-to-end tests (recorded green):** 85 (docs/coordination/coverage-snapshot.md, generated 2026-06-07)
- **MeDoc product screens with screenshots:** 26 (Unique screen names in website/public/product (full and -1000 sizes), seeded with demo data)
- **MeDoc development history:** 195 commits, 23 Apr 2026 to 25 Nov 2026 (git log in /Users/achraf/pro/Medoc)
- **Founded:** 2026. Founder-led. Not yet a registered company (no legal form, register entry or VAT number).
- **Website languages:** English, French, Arabic. (The app itself also has German, but the sites do not advertise it.)

## Tech stack used in this repository

Rust, Tauri 2, TypeScript, React 19, Vite, SQLite with SQLCipher, Node.js (build tooling), Cloudflare Workers (contact API of sifralabs.com), GitHub Actions (CI). Also: axum/tokio/rustls, AES-GCM, Ed25519, Argon2, Vitest, Playwright.
Logos in `sifralabs/public/img/stack/` (Simple Icons, CC0).

## Rules

- No testimonials until real ones exist. No paying-client projects exist yet: case studies are own products, labelled as such.
- No invented numbers, urgency, team size, registration details or legal form.
- Morocco only. France, Germany and the EU: one 'Europe: coming soon' mention. Other-country statistics may support an advantage, with source.
- Never claim: two-factor sign-in (not available), moving an appointment to another chair or room (no chairs in the calendar), automatic diagnosis of business problems, a per-patient change history, 'see every change your team makes' on several computers, cheque payments.
