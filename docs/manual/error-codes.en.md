# MeDoc error code manual

> Generated — do not edit. Run `node scripts/generate-manuals.mjs`.

Every error message shows a code such as MD-PAY-004. Search it here to see what happened and what to do. Codes never change between versions.

## Access rights

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-055` | This belongs to another dentist, who has not allowed you to change it. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-APP-042` | You can only change your own appointments. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## General

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-001` | Conflict: … | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-002` | The data could not be saved or loaded (reference …). Please try again; if it persists, contact support with this reference. | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-APP-015` | This function is switched off for this practice (…). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
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
| `MD-APP-100` | LAN port … already in use (another MeDoc instance). Not starting a second LAN service. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-101` | LAN server already running. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-132` | MeDoc Dentist is already running (database in use). Open the existing window instead of starting a second copy. _(technical check, shown in English)_ | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-133` | remote commands are not available yet _(technical check, shown in English)_ | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-103` | The practice already has accounts. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-104` | … must be zero or more | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-129` | … must be hex _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-134` | …: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-130` | cache name not allowed: … _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-105` | CSV header must contain at least 'name' and 'date_of_birth' _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-106` | CSV header: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-107` | Database is locked — enter passphrase to unlock. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-109` | Invalid bind_addr/http_port combination. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-110` | Invalid id | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-135` | invalid number block | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-111` | Invalid provider token (expected pm_ or tok_ prefix) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-141` | invalid sequence _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-112` | Keyring account already in use: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-113` | LAN config: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-136` | missing argument … _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-114` | Name and a valid e-mail are required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-115` | No compatible scan program found (e.g. simple-scan). Please install one or place files manually in the watch folder. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-137` | not a MeDoc support file, or not for this key | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-138` | number block needs a holder device | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-131` | offline cache not allowed: … _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-117` | Path has no file name | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-118` | Path is outside the allowed folder | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-119` | Path must not contain .. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-120` | Path: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-121` | Port must be > 0. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-122` | prefix must be 1-16 letters or digits | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-139` | records of … have no owner | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-123` | Root path: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-124` | settingsJson: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-125` | System scanner is not supported on this platform. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-126` | The password must have at least … characters. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-140` | this record names no dentist _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-127` | ui-prefs JSON: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APP-128` | unknown number style … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Appointments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APT-100` | A new appointment starts as PLANNED or CONFIRMED | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-101` | Clinician not found on this device. Sign in with a local staff account, or wait until accounts have synced from the main device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-102` | Comment must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-103` | Date range must be 0-… days _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-APT-104` | Duration must be between 5 and 720 minutes | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-105` | Patient not found | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-106` | Reason for return to reception is required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-107` | Short note or payment link required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APT-108` | Unknown task type: … (allowed: {}) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Attachments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-ATT-001` | Document type must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-002` | File too large (max. 50 MB). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-003` | This file type is not supported. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-ATT-004` | Label must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Audit log

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-AUD-100` | Audit chain is intact — no acknowledgement needed | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-AUD-101` | patient_id missing _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

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
| `MD-BAK-006` | Another backup action is running. Try again in a moment. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-BAK-007` | The backup could not be compressed and encrypted (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-008` | This backup cannot be opened with this practice's key. It belongs to another practice or was altered. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-009` | The backup could not be deleted (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-010` | The disk is full: the backup could not be written. Free up space and try again (reference …). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-BAK-001` | Backup file not found. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-BAK-024` | Choose a full folder path. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-BAK-025` | MeDoc cannot write to this folder. Check that the drive is connected and not read-only. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-BAK-011` | The backup folder cannot be opened or created (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-002` | Restored file is not a valid MeDoc database. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-003` | File is not a valid SQLite backup (no signature, invalid header). | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-012` | This is the last backup and cannot be deleted. Use “Delete and start again” to replace it. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-BAK-013` | The practice key could not be loaded, so backups cannot be sealed or opened (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-014` | MeDoc is not allowed to write to the backup folder. Check the folder permissions (reference …). | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-BAK-015` | This file is not a MeDoc backup. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-004` | Only .db files can be restored. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-BAK-016` | Only backups in the MeDoc backup folder can be deleted. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-BAK-017` | The backup file could not be read (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-018` | Give a reason (at least 3 characters). It is kept in the audit log. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-BAK-019` | The restore could not replace the database. The current data was kept (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-020` | Restore cancelled: the safety backup of the current data failed. Nothing was changed (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-005` | Invalid backup signature — restore aborted. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-021` | The database snapshot for the backup failed (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-022` | The backup could not be unpacked (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-023` | The backup file could not be written (reference …). | System problem · Retrying can help | An unexpected technical problem occurred on this device or the server. | Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy). |
| `MD-BAK-100` | audit json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-101` | audit missing: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-102` | ciphertext: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-103` | invalid nonce length _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-104` | invalid password verifier _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-105` | json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-106` | nonce: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-107` | salt: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-108` | vault json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-109` | vault missing: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-110` | verifier key: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-111` | verifier salt: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-BAK-112` | wrong USB kit password | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

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

## Cash book

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-016` | This cash movement has already been reversed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-APP-017` | Please enter an amount greater than 0. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-018` | Unknown cash movement type. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-019` | Booked cash entries cannot be changed or deleted. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-020` | Please enter a reason. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-021` | Cash expenses need a voucher number. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Certificates

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-CRT-100` | date_from: YYYY-MM-DD _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CRT-101` | date_to must not be before date_from _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CRT-102` | date_to: YYYY-MM-DD _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CRT-103` | Document is required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CRT-104` | Valid-to date must not be before valid-from date | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Patient record

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-CHT-001` | Message must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-002` | Not a physician: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-003` | Please select at least one physician. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-004` | Target must be a physician. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-005` | Unknown physician: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-100` | Payment already started for this line; create a correction instead | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-CHT-101` | Invalid Base64 data. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CHT-103` | invalid patient list tab _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CHT-102` | invalid patient status filter | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Practice network (cluster)

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-CLU-001` | Passphrase required. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-CLU-100` | This device is already paired. Revoke it on the main device before pairing it again. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-CLU-101` | Activation manifest version {} not supported _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-102` | admin endpoint kv: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-103` | Admin host and port required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-104` | Ciphertext: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-105` | Cluster CA key does not match the published public key | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-106` | Cluster full: maximum {} devices _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-107` | cluster_ca_pubkey length invalid _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-108` | cluster_ca_pubkey: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-109` | cluster_id length {} (expected 16) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-110` | cluster_id: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-111` | Confirmation phrase does not match. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-112` | Decryption failed (wrong passphrase or tampered manifest) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-113` | deployment json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-114` | Device already provisioned (one-time only) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-115` | Device key does not match the published public key | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-116` | Device key signature verification failed _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-117` | device secret hex: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-118` | device secret utf8: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-119` | device_pubkey invalid: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-120` | device_pubkey length invalid _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-121` | device_pubkey must be 32 bytes _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-122` | device_pubkey: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-123` | handshake transcript base64: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-124` | Handshake transcript missing. The joining device must send a new join request, then accept it again. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-125` | join lan auth kv: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-126` | KDF salt: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-127` | Kein Reset outstanding | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-128` | Main device address invalid — please join the network again. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-129` | Manifest {} not readable: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-130` | Manifest JSON invalid: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-131` | MEDOC_CLUSTER_DEVICE_SECRET must be 64 hex chars _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-132` | No ADMIN seat available (max {}). Request again as MEMBER. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-133` | No cluster | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-134` | No cluster activated | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-135` | No main device stored — please join the network again. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-136` | No MEMBER seat available (max {}) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-137` | No user accounts received from the main device — main device must be signed in. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-138` | Nonce: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-139` | Practice-network listener requires an active license (owner) or license/provisioning (member) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-140` | provisioning json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-141` | Provisioning-Settings: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-142` | Replace: old and new fingerprint are identical | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-143` | Reset mode must be network_only or full_wipe. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-144` | Reset token invalid: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-145` | Reset token is for a different cluster _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-146` | Reset token signature invalid _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-147` | Reset token signed by an unknown cluster key _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-148` | SAS does not match _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-149` | SAS must be 4 digits _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-150` | Seat certificate decode: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-151` | Seat certificate JSON: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-152` | Seat certificate: expected prefix `…` _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-153` | Seat certificate: missing separator _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-154` | Session not ready for SAS _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-155` | sidecar json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-156` | Staff directory invalid: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-157` | Staff directory version not supported. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-158` | The main device has not accepted this request yet | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-159` | The main device is not reachable. Start it, then try again. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-CLU-160` | Too many wrong SAS entries. Accept the request again on the main device. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-161` | Unexpected KDF algorithm _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-CLU-162` | Unexpected plaintext length {} (expected 160) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Day close

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-DCL-001` | This day is already closed. Record a correction to change it. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-DCL-002` | Invalid amount. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-003` | Invalid date. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-004` | Invalid denomination or count. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-005` | A correction needs a reason. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-006` | Counted amount and denominations do not match. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-007` | The cash must be counted to close the day. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-008` | A future day cannot be closed. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-009` | A recorded closing is final. Please record a correction. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-010` | There is already a closing from {…}. Earlier days can no longer be closed. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-011` | There is no cash report for this closing (older entry). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-012` | This closing has already been corrected. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-013` | Only the latest closing can be corrected. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-014` | The cash report is created when the day is closed. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-DCL-015` | A difference needs a reason. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Main device and replicas

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-047` | This installation is damaged: its parts belong to different MeDoc editions. Reinstall MeDoc. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-043` | This needs a connection to the main device. Sign out and in again while the main device is reachable. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-044` | This can only be done on the main device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-045` | The main device cannot be reached. Check that it is on and in the same network. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-048` | This edition works on one computer only and has no practice network. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-046` | The replica app joins an existing practice; it cannot create one. Use the main app on the main device. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |

## Device sessions

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-DEV-001` | The current session cannot be ended here — please sign out. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-DEV-002` | The current session is already trusted. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |

## Documents & PDFs

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-DOC-100` | layout must be a JSON object _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-DOC-101` | PDF-Layout: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-DOC-102` | Template JSON: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Documents & PDFs

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-022` | Narcotics must be prescribed on the official BtM prescription form. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-023` | Please enter a reason for the cancellation. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-024` | Statutory insurance prescriptions are issued as e-prescriptions via the telematics infrastructure, not as PDF. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-025` | Issued documents cannot be changed or deleted. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-026` | Official documents can only be issued on the main device (MASTER). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-027` | A combined document may only contain entries of one patient. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-028` | This document cannot be cancelled (already cancelled or not an invoice). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-029` | Practice data incomplete: practice name and address are missing (Settings → Practice). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-030` | A receipt can only be issued for a paid payment. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-031` | Reprinting is not available for this document type. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-032` | Unknown copy variant. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-033` | Unknown document type. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-034` | The document contains characters that cannot be printed correctly in the PDF (e.g. Arabic or Cyrillic script). Please check the spelling. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Export

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-EXP-001` | Target folder must be an absolute path. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-004` | The target folder is outside the allowed export folder. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-002` | Invalid export data (Base64). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-003` | Invalid file name. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-EXP-100` | error reports to the MeDoc server are not available yet _(technical check, shown in English)_ | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |

## Disabled functions

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-FEA-100` | This function is switched off for this practice (DICOM imaging). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-FEA-101` | This function is switched off for this practice (e-prescription). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-FEA-102` | This function is switched off for this practice (GDT device interface). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-FEA-103` | This function is switched off for this practice (Scanner). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |

## Data protection (GDPR)

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-035` | Erasure not allowed: the legal retention period runs until {…} (§ 630f BGB, § 147 AO). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Guest account

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-054` | This practice already has the maximum number of accounts, so the guest account cannot be added. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-049` | Only the guest sends proposals; the admin saves directly. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-050` | This proposal was already added or dismissed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-APP-051` | The guest account is turned off. Ask the admin. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-052` | The guest cannot propose this change. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-057` | The guest cannot create purchase orders. Confirm deliveries only, or ask the admin. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-APP-053` | Set a password for the guest account. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## History

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-058` | This kind of record has no history. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Stock & orders

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-INVT-100` | Item required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INVT-101` | Quantity must be positive | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INVT-102` | Stock must be zero or more | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INVT-103` | Supplier required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INVT-104` | Total amount invalid | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INVT-105` | Unknown status: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Invoices

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-INV-001` | “{…}” is already on invoice {…}. Cancel it first, then bill again. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-INV-002` | The service does not belong to this patient. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-003` | A cancellation invoice must name the original invoice. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-004` | The invoice date is missing or invalid (YYYY-MM-DD). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-005` | Only legacy entries without a registry number can be imported. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-006` | Item …: the amount must be greater than 0. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-007` | Item …: the amount does not match points × point value × factor. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-008` | Item …: analog billing is only allowed for GOZ items. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-009` | Item …: a cancellation line must be negative. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-010` | Item …: the date of the service is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-011` | Item …: the service description is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-012` | Item …: factor … above 3.5 needs a written agreement. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-013` | Item …: a factor below 1.0 is not allowed. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-014` | Item …: the fee factor is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-015` | Item …: factor … above 2.3 needs a written reason. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-016` | Item …: the fee number is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-017` | Item …: the point value is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-018` | Item …: an expense above 25.56 EUR needs the receipt attached. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-028` | The practice ICE is missing. A Moroccan invoice must show it — add it under Settings → Practice → Billing details. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-029` | The practice tax ID (IF) is missing. A Moroccan invoice must show it — add it under Settings → Practice → Billing details. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-019` | The invoice has no service lines. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-020` | “{…}” has not been released for billing by a physician. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-INV-021` | The invoice number is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-022` | The treated person’s name and date of birth are missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-023` | The practice name and address are missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-024` | The recipient’s name and address are missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-025` | A taxable line needs a tax number or VAT ID. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-026` | The invoice contains characters the PDF cannot print. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-027` | The VAT exemption notice is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-100` | document already cancelled | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-APP-108` | Date must be in yyyy-MM-dd format | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-101` | id and patient_id are required _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-INV-102` | Invalid interval | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-103` | Label required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-104` | Message too short (min. 10 characters) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-105` | Period required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-106` | Subject too short (min. 3 characters) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-INV-107` | Unknown category: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## LAN connection

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-LAN-001` | LAN client: command "…" is not available on the API server — use the practice host desktop app. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-002` | LAN client configuration incomplete (base URL or token missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-003` | LAN client configuration incomplete (base URL missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-004` | LAN HTTP …: … | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-LAN-100` | Unbekannter KV-Key: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LAN-101` | Unknown KV key: {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## License

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-LIC-001` | This license was issued for another computer. Paste the key issued for this computer, or join this computer to the main device. | Action blocked | Sign-in or two-factor verification is required or has failed. | Sign in again; if you are locked out, wait the shown time or ask an administrator. |
| `MD-LIC-100` | Administrator name too short. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-101` | Administrator password required (min. 8 characters). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-102` | device_id empty _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-LIC-103` | Invalid email. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-104` | License code missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-105` | Member devices only after joining the practice network. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-106` | Name too short. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-107` | New account only after joining an existing practice. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-108` | No user account exists — please create an administrator. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-109` | Password required (min. 8 characters). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-110` | Plan must be BASIC, PRO, or ENTERPRISE. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-111` | Practice setup is already complete. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-112` | Practice setup only on the licensed primary device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-113` | Registration failed (HTTP {}): {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-LIC-114` | Role must be PHYSICIAN or RECEPTION. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-115` | Skip is only allowed on the licensed primary device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-116` | Vendor portal base URL is missing. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-117` | Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-LIC-118` | Vendor portal URL is empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-119` | Vendor portal URL is missing a host. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-120` | Vendor portal URL must not include credentials. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-121` | Vendor portal URL must use https. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-LIC-122` | Vendor portal: API key missing (configuration or MEDOC_COMPANY_API_KEY). _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-LIC-123` | Vendor portal: practice_slug (tenant id) is missing. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

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

## Notifications

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-NTF-100` | No staff recipients available for this notification. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-NTF-101` | Notification kind and title are required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Document numbering

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-056` | Numbers … of sequence … are missing on this computer. No number is issued until an admin checks them (Help → Support). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Device pairing

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PAR-001` | Confirmation code expired. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAR-002` | Confirmation code incorrect. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-003` | Device ID is empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-006` | There is no accepted pairing for this device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-004` | PIN must be exactly 6 digits. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-007` | The main computer is still catching up after a restart. Try again in a few minutes. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-005` | Replica public key is empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-100` | A pairing request for this device is already pending | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAR-101` | pairing_request already awaiting PIN confirmation | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAR-102` | pairing_request already decided (status={}) _(technical check, shown in English)_ | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAR-103` | pairing_request is not awaiting PIN confirmation | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAR-104` | Activation token decode: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-105` | Activation token JSON: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-106` | Activation token version {} (expected 2) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-107` | Activation token: expected prefix `…` _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-108` | Activation token: invalid prefix _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-109` | Activation token: missing separator _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-110` | Cluster handshake missing; send a new join request from the replica. _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-111` | Master response incomplete (pubkey/deviceId missing) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAR-112` | No Bluetooth adapter found | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-113` | PIN confirmation failed (…): … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAR-114` | Too many PIN attempts — submit a new pairing request | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Payments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PAY-001` | Invalid amount. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-002` | Amount must be greater than 0. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-013` | Money was already received for this booking. Cancel it instead of deleting. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-003` | Only pending or partially paid payments can be deleted. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAY-004` | Please link only one target: treatment or examination. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-PAY-005` | Only pending or partially paid payments can be edited. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAY-006` | Examination not found or does not belong to this patient. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-PAY-007` | Payment exceeds the allowed limit for this examination (max. … € including this booking). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-008` | Payment exceeds the allowed limit for this treatment (max. … € including this booking). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-009` | Payment exceeds the open amount for this examination (max. … €, paid so far … €, target … €). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-010` | Payment exceeds the open amount for this treatment (max. … €, paid so far … €, target … €). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-011` | A positive payment amount is required when booking a service price. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-014` | The payment status follows from the amounts. Only “cancelled” can be set by hand. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-PAY-012` | Treatment not found or does not belong to this patient. | Needs your input | The item no longer exists or was removed on another device. | Refresh the list (Ctrl/⌘ R) and open the item again. |
| `MD-PAY-100` | Amount must be positive | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-101` | Cut-off date must be YYYY-MM-DD | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-102` | Cut-off date required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-103` | Invalid amounts | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-104` | Invalid counted amount | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-105` | Invalid metrics _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-PAY-106` | Invalid variance | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PAY-107` | Unknown currency | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Period report

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-036` | Invalid period (two years at most). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-037` | This report has no PDF in the document registry. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-038` | Only finished periods can be saved. The preview is always available. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Practice tasks

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-TSK-001` | Please specify the assigned physician. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-002` | Patient is required. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-003` | Target must be a doctor. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-004` | Target must be a reception staff member. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-005` | Title must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TSK-100` | Notification user is not a staff account on this device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Prescriptions

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-RXP-001` | Allergy warning: the patient is allergic to …, and this prescription contains …. Check the anamnesis before issuing it. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-RXP-100` | This prescription was already corrected; edit the newest version | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-RXP-101` | Invalid KIM address | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-RXP-102` | Invalid KVNR format: {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-RXP-103` | Invalid PZN: {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-RXP-104` | LANR must contain 9 digits | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-RXP-105` | Quantity must be between 1 and 99 | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Profile

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-PRF-001` | Email must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-002` | Name must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-003` | Name too long (max. 120 characters). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-PRF-004` | No fields submitted to update. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Payment reminders

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-039` | A reminder fee is only allowed from the first dunning letter on. | Action blocked | Your role does not have the permission for this action. | Ask a physician or administrator to perform it or to grant the permission. |
| `MD-APP-040` | The next reminder level is only possible after the last deadline. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-APP-041` | No reminder is possible for this invoice. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Scanner

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-SCN-100` | source has no filename | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Security & encryption

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-SEC-100` | Two-factor authentication is not active | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-SEC-101` | Authenticator code required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SEC-102` | Break-glass access is currently disabled | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SEC-103` | Could not open database with SQLCipher (check passphrase). _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-104` | Invalid code — please try again | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SEC-105` | Invalid signature _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-106` | Invalid signature length _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-107` | Password policy: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SEC-108` | rekey: old key does not open the database _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-109` | Signature missing _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-110` | Signature not decodable: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SEC-111` | Two-factor authentication is currently disabled | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Settings

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-SET-100` | Stored work hours are invalid | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SET-103` | The compliance checklist is invalid _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SET-102` | The medication list is invalid _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SET-101` | Unknown KV key: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Setup

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-SUP-100` | Passphrases do not match. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Staff

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-STF-001` | Email address is already in use. | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-STF-002` | Two-factor authentication is already active. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-STF-003` | Invalid code — please try again. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-100` | Two-factor authentication is already active | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-STF-101` | {} cannot exceed "{}" for this role _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-STF-102` | … cannot be granted to this role | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-103` | Access rights are managed on the main device. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-104` | Action must not be empty. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-105` | At least one active person must keep the right to manage access. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-106` | effect must be ALLOW or DENY. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-107` | This access profile is made for another role. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-108` | This account still owns appointments or clinical documents. Assign another clinician first, then remove the account. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-116` | This area cannot be limited to own records: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-109` | Unknown access area: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-STF-110` | Unknown access level: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-STF-111` | Unknown access profile: … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-112` | Unknown permission action. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-113` | You cannot change your own access rights. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-STF-114` | You cannot grant more than your own access to {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-STF-115` | You cannot remove the account you are signed in with. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Device sync

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-SYN-001` | A received change has an invalid signature and was not applied. The data was changed on the way or the sender is not genuine. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-002` | Changes arrived signed with a key this device does not know for the sender. Pair the device again. | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-003` | This device sent changes without a signature. Update it to the current version, then sync again. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-SYN-004` | Sync is paused: this computer and the main computer run versions that cannot sync together. Update the older one; work done meanwhile is kept and sent afterwards. | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-SYN-100` | cluster port … already in use (another MeDoc instance) | Needs your input | The change conflicts with existing data (duplicate or competing edit). | Use a different value, or reload and apply your change again. |
| `MD-SYN-101` | blob hash mismatch _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-102` | cbor decode: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-103` | cipher frame length invalid _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-104` | cipher read timed out _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-105` | cluster … rejected (…): … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-106` | cluster join rejected (…): … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-152` | conflict payload: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-107` | Device-cluster listener may only bind private LAN addresses (rejected: …) | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-108` | Frame too large _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-109` | Frame too short _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-110` | handshake message too large _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-111` | handshake timed out _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-112` | Invalid frame length _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-113` | LAN TLS pin is not a SHA-256 fingerprint | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-114` | Main device not reachable — document numbers are issued by the main device (…) | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-115` | Main device refused number allocation (…): … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-116` | Master pubkey invalid: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-117` | Master pubkey length {} (expected 32) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-118` | Master pubkey not decodable: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-119` | master secret hex: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-120` | master secret utf8: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-121` | master_base_url missing _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-122` | master_base_url missing for mesh sync _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-123` | master_pubkey missing for mesh peer-list verification _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-124` | MEDOC_PAIRING_MASTER_SECRET must be 64 hex chars (32 bytes) _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-125` | mesh sync requires serverless_peer REPLICA _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-126` | Message too large | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-127` | no known sync queue in the exchange request _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-128` | no master device registered | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-153` | not a field conflict table _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-154` | number block refused (…) | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-155` | number block: … | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-129` | peer … has no TLS pin _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-130` | re-pair required | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-131` | reconcile rows request exceeds … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-132` | reconcile runs on a replica only | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-133` | reconcile waits until the outbox is empty _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-134` | replica auth: fingerprint is not this device's identity | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-135` | Replica not paired — complete the pairing flow | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-136` | staff directory rejected (…): … | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-137` | sync app_kv: payload key does not match entity id _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-138` | sync entity_table not allow-listed: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-139` | sync exchange requires fromDeviceId | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-140` | sync payload json: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-141` | sync payload must be a JSON object _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-142` | sync pull requires serverless_peer REPLICA _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-143` | sync push device_id mismatch _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-144` | sync push requires serverless_peer mode _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-145` | sync push to master requires REPLICA role | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-146` | sync TLS pin missing — refusing to accept an unpinned certificate | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-SYN-147` | sync.deployment.v1: … _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-148` | table … is not on a sync queue _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-149` | unknown sync op: {} _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-150` | wire frame overrun _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-SYN-151` | wire frame too large _(technical check, shown in English)_ | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Treatments

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-TRT-001` | A multiplier above 3.5 needs an agreement under § 2 GOZ. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TRT-002` | The multiplier must be between 1.0 and 3.5 (above only with an agreement under § 2 GOZ). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TRT-003` | A multiplier above 2.3 needs a written justification (§ 10(3) GOZ). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TRT-004` | GOZ/GOÄ services need a fee number and points. | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-TRT-005` | Invalid fee schedule (allowed: GOZ, GOÄ, material, lab, other). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## App screens

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-UIX-500` | A receipt can only be issued for a paid payment | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-501` | error catalog is missing … _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-502` | LAN client configuration incomplete (base URL missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-UIX-503` | LAN client configuration incomplete (base URL or token missing). | Action blocked · Retrying can help | This device cannot reach the practice host or LAN server. | Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection. |
| `MD-UIX-505` | MeDoc repository root not found from … _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-506` | native-go-menu: missing label key for "…" _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-507` | native-go-menu: missing ROUTE_VISIBILITY for path "…" _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-514` | not loaded _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-508` | Pairing handle missing _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-509` | Pairing handle missing sessionId _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-510` | PDF missing | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-511` | Practice master data incomplete for receipts | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-512` | SAS digits missing from accept response _(technical check, shown in English)_ | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UIX-513` | Stored work hours are invalid | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Updates

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-APP-116` | No update available | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UPD-100` | This update cannot be installed on this version | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UPD-101` | update is for …/…, this computer runs …/… | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |
| `MD-UPD-102` | update manifest is not signed by MeDoc | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UPD-103` | update manifest versions do not match | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |
| `MD-UPD-104` | update manifest: … | Action blocked | A file or signature failed an integrity check. Nothing was changed. | Use the original, unmodified file. Do not retry with the same file. |

## Work time

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-WTM-001` | No open session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-002` | No paused session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-003` | No running session. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-004` | A work-time session is already running. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-005` | Session is not paused. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-006` | Session is not active. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WTM-007` | The week must start on a calendar date (YYYY-MM-DD). | Needs your input | A value you entered is missing or has the wrong format. | Correct the highlighted field and save again. |

## Status workflow

| Code | Message | Severity | Why it happens | What to do |
|---|---|---|---|---|
| `MD-WFL-001` | Record is already validated or archived. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-002` | This record is archived (read-only) and cannot be changed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-003` | Record status … cannot be validated. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-004` | Unknown order status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-005` | Status transition …→… is not allowed. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-010` | Unknown status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-006` | Task is already closed (VALIDATED). | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-007` | Unknown task status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-008` | Only completed tasks can be validated or returned. | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
| `MD-WFL-009` | Unknown ticket status: … | Needs your input | The item is in a status that does not allow this action. | Check the item's current status (see Status guide) and use one of the allowed next steps. |
