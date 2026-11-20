# MeDoc error code manual

> Generated — do not edit. Run `node scripts/generate-manuals.mjs`.

Every error message shows a code such as MD-PAY-004. Search it here to see what happened and what to do. Codes never change between versions.

## General

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-001` | Conflict: … | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-002` | The data could not be saved or loaded (reference …). Please try again; if it persists, contact support with this reference. | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-APP-003` | Access denied. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-APP-004` | An unexpected internal error occurred (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-APP-005` | The practice server could not be reached. Check the network connection. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-APP-006` | … not found. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-APP-007` | This device is offline. Changes cannot be sent until the connection is back. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-APP-008` | Too many failed attempts — please wait … seconds. | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-APP-009` | The server took too long to answer. Please try again. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-APP-010` | Two-factor setup required. | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-APP-011` | Two-factor code required. | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-APP-012` | Not authorized. | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-APP-013` | Something went wrong. | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-APP-014` | … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Attachments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-ATT-001` | Document type must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-002` | File too large (max. 50 MB). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-003` | This file type is not supported. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-004` | Label must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Sign-in & two-factor

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-AUTH-001` | No device session ID | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-AUTH-002` | Invalid code — please try again | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-AUTH-003` | Two-factor is optional for this role — set up after sign-in | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-AUTH-004` | Please start setup first | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |

## Backup & restore

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-BAK-001` | Backup file not found. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-BAK-002` | Restored file is not a valid MeDoc database. | System problem | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-003` | File is not a valid SQLite backup (no signature, invalid header). | System problem | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-004` | Only .db files can be restored. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-BAK-005` | Invalid backup signature — restore aborted. | System problem | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Billing release

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-BIL-001` | … is not yet released for billing. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |

## Screen crash

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-BND-001` | The screen stopped working unexpectedly. | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |

## Emergency access

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-BRG-001` | Reason must be at least 10 characters long. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Patient record

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-CHT-001` | Message must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-002` | Not a physician: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-003` | Please select at least one physician. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-004` | Target must be a physician. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-005` | Unknown physician: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Practice network (cluster)

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-CLU-001` | Passphrase required. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |

## Device sessions

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-DEV-001` | The current session cannot be ended here — please sign out. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-DEV-002` | The current session is already trusted. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |

## Export

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-EXP-001` | Target folder must be an absolute path. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-002` | Invalid export data (Base64). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-003` | Invalid file name. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## LAN connection

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-LAN-001` | LAN client: command "…" is not available on the API server — use the practice host desktop app. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-002` | LAN client configuration incomplete (base URL or token missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-003` | LAN client configuration incomplete (base URL missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-004` | LAN HTTP …: … | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |

## Master data

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-MST-001` | Category and name required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-002` | Contact: name required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-003` | Start and end date required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-004` | Invalid contact. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-005` | Invalid or inactive product. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-006` | Invalid supplier. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-007` | Select supplier, contact, and product. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-008` | Supplier: name required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-009` | kind must be PRESCRIPTION or CERTIFICATE. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-010` | Title required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-MST-011` | Type must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Device pairing

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PAR-001` | Confirmation code expired. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAR-002` | Confirmation code incorrect. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-003` | Device ID is empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-004` | PIN must be exactly 4 digits. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-005` | Replica public key is empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Payments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PAY-001` | Invalid amount. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-002` | Amount must be greater than 0. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-003` | Only pending or partially paid payments can be deleted. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAY-004` | Please link only one target: treatment or examination. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAY-005` | Only pending or partially paid payments can be edited. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAY-006` | Examination not found or does not belong to this patient. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-PAY-007` | Payment exceeds the allowed limit for this examination (max. … € including this booking). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-008` | Payment exceeds the allowed limit for this treatment (max. … € including this booking). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-009` | Payment exceeds the open amount for this examination (max. … €, paid so far … €, target … €). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-010` | Payment exceeds the open amount for this treatment (max. … €, paid so far … €, target … €). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-011` | A positive payment amount is required when booking a service price. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-012` | Treatment not found or does not belong to this patient. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |

## Practice tasks

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-TSK-001` | Please specify target doctor (assigneeUserId). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-002` | Patient is required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-003` | Target must be a doctor. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-004` | Target must be a reception staff member. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-005` | Title must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Profile

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PRF-001` | Email must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-002` | Name must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-003` | Name too long (max. 120 characters). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-004` | No fields submitted to update. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Staff

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-STF-001` | Email address is already in use. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-STF-002` | Two-factor authentication is already active. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-STF-003` | Invalid code — please try again. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Work time

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-WTM-001` | No open session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-002` | No paused session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-003` | No running session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-004` | A work-time session is already running. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-005` | Session is not paused. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-006` | Session is not active. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-007` | week_start: YYYY-MM-DD format required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Status workflow

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-WFL-001` | Record is already validated or archived. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-002` | This record is archived (read-only) and cannot be changed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-003` | Record status … cannot be validated. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-004` | Unknown order status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-005` | Status transition …→… is not allowed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-006` | Task is already closed (VALIDATED). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-007` | Unknown task status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-008` | Only completed tasks can be validated or returned. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-009` | Unknown ticket status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
