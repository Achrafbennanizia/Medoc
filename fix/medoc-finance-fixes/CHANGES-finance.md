# MeDoc step 2: invoices, payments, day close and balance

This builds on step 1 (official documents) and is based on the code you sent on 10.11.2026 (`invoice-balance-dayclose-pdf.txt`). Run `apply-medoc-finance-fixes.sh` from the repo root, as with step 1.

```bash
cd ~/pro/Medoc
git status                                   # clean tree
export MEDOC_VENDOR_PUBKEY=<64 hex>          # as for your normal build
"./medoc-export-fixes 2/apply-medoc-finance-fixes.sh" all
```

Commands: `all`, `apply`, `i18n`, `test`, `status`, `revert`. The script works on the branch `fix/finance-workflows`.

## What was wrong

**Day close**
- The browser computed every figure (cash, income, counts) and the server stored whatever it received. A wrong or manipulated client produced an "official" daily report.
- Cash was counted against "cash payments of the day" only. There was no opening balance and no float, deposits, withdrawals or bank deposits, so a drawer with change in it never matched.
- Payments were assigned to a day by `created_at`. When a 0 € placeholder (created at treatment time) was filled days later, the money landed on the treatment day, not on the day it was received.
- The server-side day filter used `date(created_at)` in UTC, while the browser filtered by local day. Payments between midnight and 01:00 (02:00 in summer) disappeared from both days.
- Several closings per date were possible, and they could be deleted. A difference needed no reason. No one was recorded as having closed the day.
- The daily report PDF was built from browser data and could be issued without a closing.

**Payments**
- `update_payment_status` accepted any status, so a booking could be set to PAID without money coming in.
- A partially paid booking with money received could be deleted.
- The dashboard "outstanding" summed the paid part of open bookings, and "income" ignored partial payments.

**Invoices**
- The same treatment could be invoiced twice.
- Unreleased treatments could be invoiced (payments already required release).
- There was no due date. The § 286 Abs. 3 BGB notice was missing, so a consumer only falls into default after 30 days if the invoice says so.
- There were no open items (Offene Posten), no payment state and no reminder or dunning workflow.
- "Generate PDF" issued the final numbered invoice right away, with no draft preview.
- The invoice date used `toISOString()` (UTC), which gave yesterday's date after midnight.
- The recipient was always the patient, so there was no parent or guardian for children.
- `append_invoice_document` let the client store any invoice with any number outside the registry.
- The history list dropped GOZ fields on reload and showed the net line sum instead of the gross total.

**Balance wizard**
- Income came from payments the user ticked by hand.
- Expenses were demo contracts plus product unit prices.
- The period was free text, and IBAN and tax number were typed in again.
- Totals came from the client, and reception could read them. A "Bilanz" is also the wrong concept for a practice that uses cash accounting (§ 4 Abs. 3 EStG).

## What changed

### Cash journal (new: `finance_schema.rs`)
- New table `payment_receipt`. Triggers on `payment` book one signed line for every money movement, at the time it happens:
  - a booking with money,
  - a placeholder being filled,
  - a partial payment being raised,
  - a method change (reversed under the old method, booked again under the new one),
  - a cancellation (reversal).
- The journal is append-only.
- `reconcile()` repairs it if a write ever bypassed the triggers. Existing payments are carried over once, dated at their creation.
- Tables are created on first use, so no migration file is touched.

### Day close (new: `cash_book.rs`)
- `prepare_day_close(date)` returns the server-computed draft:
  - opening balance, which is the counted cash of the last closing,
  - cash receipts, movements and the expected cash,
  - card and transfer totals,
  - late entries from earlier days,
  - cash payments not yet checked at the desk.
- `close_day` takes the counted cash (a total, or a count per denomination), the card terminal total and a note.
  - A count is mandatory.
  - A difference needs a reason.
  - The date can't be in the future, and can't be before the last closing.
  - In one transaction it records the protocol, locks the journal lines and issues the Kassenbericht `TB-YYYY-nnnnnn`. The report contains the cash book with running balance, non-cash payments, the count record and signature lines.
- `correct_day_close` creates a correction protocol with its own TB number that references the original. The original becomes `CORRECTED`. Only the latest closing can be corrected.
- Protocols can't be deleted or edited (trigger). The legacy `create_day_close_protocol` still works, but ignores the client figures.
- Cash movements cover float, deposit, withdrawal, bank deposit and cash expense. A cash expense needs a voucher number. Movements are reversed by a new entry and never deleted.
- `issue_report_pdf` refuses `daily_report`. The Kassenbericht only comes from `close_day`.

### Invoices and receivables (new: `receivables.rs`)
- Every invoice line carries `source_ref` (`treatment:<id>` / `examination:<id>`).
- Before issuing (and in the preview), the server checks:
  - the record belongs to the patient,
  - a physician released it,
  - it is not already on an open invoice (error `error.invoice.already_invoiced`).
- The server sets the due date (invoice date plus payment term). The invoice shows "Zahlbar bis" and the § 286 Abs. 3 BGB notice.
- `list_invoice_status` shows each invoice's paid and open amount and its state: `OPEN`, `PARTIAL`, `PAID`, `OVERDUE`, `CANCELLED` or `CANCELLATION`. Invoices from before `source_ref` existed show as `UNLINKED`.
- Reminders `MA-YYYY-nnnnnn` come in three levels: Zahlungserinnerung, 1. Mahnung, 2. Mahnung.
  - The first reminder is only possible once the invoice is overdue. Each next level only after the previous deadline has passed.
  - A fee is allowed from level 2.
  - The new deadline is 14 days.
  - Reminders are stored, immutable and can be printed as a copy.
- `append_invoice_document` only accepts legacy imports without a registry number (`RE-…` is refused). Such rows show as "Altbestand".

### Period report (new: `period_report.rs`)
- Income is the money received in the period (Zuflussprinzip), by payment method and by month.
- Expenses come from cash book expenses, delivered purchase orders (`purchase_order.total_amount`) and running contracts. Contract costs are pro rata and marked as estimates.
- Invoiced amounts, cancellations and open receivables at the end of the period are shown for information only.
- Days with cash but no closing are flagged.
- Only finished periods can be saved. A saved report gets a `BE-YYYY-nnnnnn` number and can't be changed or deleted. The preview works at any time.
- `get_balance_sheet` is corrected:
  - income = all money received,
  - outstanding = what is still open.
- Reception no longer reads saved reports.

### Payments
- Status changes by hand are limited to `CANCELLED`; everything else follows from the amounts.
- Deleting a booking with money received is refused (command and trigger). Cancel it instead.

### PDF
- On the invoice, a long information block pushes the content down instead of overlapping the title.
- Report tables accept column widths. Columns headed Einnahme, Ausgabe or Bestand are right-aligned.
- Reports carry the practice footer and optional signature lines.
- Continuation pages of reports and charts use the document language instead of always English.

### UI
- **Day close page:** server draft, count by denomination, card terminal check, cash movements, a confirmation step, the Kassenbericht shown right after closing, copy and correction (no delete). The detail view loads the journal of that closing instead of all payments ever.
- **Invoice page:**
  - "Vorschau (Entwurf)" plus "Rechnung ausstellen" with a confirmation step,
  - a different recipient for parents or guardians,
  - status badges and an open/overdue filter,
  - due date, paid and open amounts, cancellation links,
  - reminder dialog with preview,
  - the Stornieren button only on issued invoices.
- **Balance:** the new period report page replaces the wizard. Saved reports open as a copy PDF instead of having a delete button.

## Tested

On a copy of your code with the script, end to end:
- The patch applies cleanly. `register.rs` gets the 14 new commands. The translation keys are added and removed again on `revert`.
- `medoc-core`:
  - 144 tests pass, including the new `finance_workflow_tests` (day close with float, denominations, late placeholder fill, bank deposit, correction, immutability; double billing, release check, overdue, reminder levels, fee rule; period report income, expenses and receivables).
  - The 7 license tests fail only because of the dummy vendor key in my environment.
- `medoc-practice` compiles. I had to stub the functions missing from the upload, which are the same 7 errors as last time.
- All 13 sample PDFs pass qpdf, pdfinfo and the text checks, and I looked at them.

Not tested here:
- `tsc` and `vitest` (no `node_modules` in the upload). The script runs them. I syntax-checked and type-checked the changed TypeScript files against the parts of the code I had, but not against your UI component props (`Input max/min`, `Dialog footer`).

## Still open

1. **TSE (§ 146a AO, KassenSichV).** If MeDoc counts as an electronic recording system with a cash function, cash entries need a certified technical security device and receipts must be offered to the payer. That is a hardware and certification question for your tax advisor. This patch prepares the data (an append-only journal with timestamps), but it adds no TSE.
2. **Replica timestamps.** Payments booked on a replica get their journal line when the change reaches the master, so the timestamp is the sync time. Day close only runs on the master.
3. **Partial payments.** A partial payment is still one payment row whose amount grows. The journal fixes the booking dates, but a separate "Zahlung erfassen" entry per receipt would be cleaner for the UI.
4. **Old invoices.** Invoices issued before this patch have no `source_ref`. They show as `UNLINKED`, without payment state or reminders.
5. **Interest and collection.** There is no default interest (§ 288 BGB) and no handover to a collection agency.
6. **TypeScript.** Run `tsc --noEmit` and fix any prop mismatch with your UI components.

Have your tax advisor confirm the Kassenbericht layout, the period report and the reminder texts before going live.
