# Device flavors and the access model

Two related changes:

1. **Build flavors.** The app is built either as the **main** app or as the **replica** app.
2. **Access model v2.** Roles, privileges and relationships, and a UI that adapts to each signed-in person.

## 1. Build flavors

### Why decide this at build time

Until now, every installation had every service, and a stored setting (`deployment.role`) decided at run time whether a device was main or replica. Main-only behaviour was guarded by about six separate checks. A replica binary still contained code for licence activation, access management and pairing approval, which a replica must never run.

With build flavors:
- the **replica binary does not contain** main-only services;
- in their place it contains **forwarders** that call the main device's HTTPS API for the signed-in person;
- the **main binary** contains everything and never forwards.

### What the flavor changes

| Layer | How the flavor is chosen | Effect |
|---|---|---|
| Rust (`medoc-core`, `medoc-practice`, `medoc`) | Cargo feature `replica` (default off = main) | `device::FLAVOR`, `#[cfg]`-selected implementations of main-only commands |
| Frontend (Vite) | `MEDOC_FLAVOR=replica` | `DEVICE_FLAVOR` constant; main-only screens hidden or shown as "on the main device" |
| Installer (Tauri) | `tauri.replica.conf.json` overlay | own product name and identifier, so both can be installed side by side for support |

Build commands:

```
npm run tauri:build            # main app
npm run tauri:build:replica    # replica app
```

### Main-only operations

One registry, `device::capabilities::MainOnly`, replaces the scattered checks:

| Operation | On the main app | On the replica app |
|---|---|---|
| Manage roles and privileges | local service | forwarded to the main device's API |
| Read role catalogue and staff access | local service | local, from the synced copy (works offline) |
| Activate licence / create practice | local | not available; join only |
| Accept and revoke devices (pairing) | local | not available |
| Issue numbered official documents | local | refused, as before (existing rule `issue_on_master_only`); moving it to the registry is a next step |

The replica app keeps its **synced local database** for everything else: patients, calendar, charts and cash work offline, and synchronise as before.

### Main link: the owner signs in on a replica

When someone signs in on a replica, the replica also signs that person in on the main device (same credentials, pinned TLS) and keeps the main device's token in memory only. This is the **main link**.

- Forwarded operations use that token, so the main device checks that person's own privileges. The replica never gains rights of its own.
- If the main device is offline, forwarded operations fail with a clear message ("needs a connection to the main device"). Local work continues.
- The token is dropped at sign-out, lock or idle timeout.

So when the practice owner signs in on a replica laptop, they can manage roles from there. A receptionist signed in on the same laptop cannot: the main device refuses.

## 2. Access model v2

### Layers

```
login role (PHYSICIAN / RECEPTION)          what kind of account: sets the ceiling
  └─ role (predefined profile)              front desk, dentist, practice manager, …
       └─ privileges: area × level          "Calendar: create", "Cash desk: full", …
            └─ per-person adjustments       raise or lower single areas, never above the ceiling
                 └─ relationship scope      "own records only" for calendar and medical record
```

- **Privilege**: a level in an area (`calendar:create`). Levels are cumulative: none < view < edit < create < full. Each privilege has a plain-language description and lists the actions it unlocks, generated from `ACTION_RULES`, so the guide and the enforcement can't drift apart.
- **Role**: a named set of privileges for a job. Roles are predefined and cover the common jobs (see the Help guide). The admin picks one, and may then adjust single areas.
- **Ceiling**: the highest level a login role can ever reach, whatever the admin picks. A reception account never gets clinical write access or account administration.
- **Relationship scope** (new): for the calendar and the medical record, a role can be limited to **own** records, meaning records where the person is the assigned clinician. This adds the relationship check (ReBAC) that the old model lacked: "may edit appointments" becomes "may edit *their own* appointments".

### Enforcement

- **Backend (authoritative):** `effective_allowed(action, role, overrides)` at every command, unchanged at the call sites. Relationship scopes are checked by `access::relation::require_own(...)` in the commands that change a specific record.
- **Frontend (adaptive, not a security boundary):** `useAccess()` exposes `can(action)`. Navigation, buttons and whole sections use it to show or hide, so each person sees only what they can use.

### Pairing improvements

- The pairing code grows from 4 to 6 digits (1 in 1,000,000 instead of 1 in 10,000).
- The replica app can only join: its first-start screen goes straight to "Join existing practice", and licence activation refuses to run in it (`domain::device::require_can_host`).

## Status

| Part | State |
|---|---|
| Flavors: Cargo feature `replica`, `VITE_MEDOC_FLAVOR`, `tauri.replica.conf.json`, npm scripts | Done. Both flavors compile and build. |
| Main-only registry (`domain::device`) and placement (`systems::main_device`) | Registry defines all three operations. Wired: manage access (placement and forwarding) and licence activation (`require_can_host`). Device-management commands don't consult it yet. |
| Main link (sign-in on the main device, token in memory, cleared at sign-out) | Done. |
| Access management: desktop commands, HTTPS routes on the main device (`/api/v1/access/*`), forwarders | Done. |
| Roles (15 predefined, 5 new), privilege catalogue, staff assignment panel, Help guide | Done. |
| Relationship scope "own appointments" (calendar): create, update, move and delete | Done. |
| Settings sections follow privileges instead of a fixed list per role | Done. |
| Pairing: 6-digit code, replica app cannot create a practice | Done. |

### Known limits and next steps

- **Medical record ownership.** Treatments and examinations have no responsible-clinician field, so "own patients only" can't be enforced yet. It needs a `responsible_staff_id` column first.
- **Older replicas** ignore `scope.own.*` entries (they don't know them), so the own-appointments limit is only enforced on devices running this version. Update every device.
- **Pairing codes** are derived on both sides; the main and replica apps must run the same version to pair.
- **Replica identifier.** The replica app installs as `de.medoc.app.replica`, with its own data folder. A device that ran the main app as a replica keeps its data under the old identifier: pair it again after installing the replica app.
- **Join requests** don't carry the flavor yet, so the main device can't tell the admin which app is asking.
- Remaining main-only checks (`issue_on_master_only`, cluster reset) still read the deployment setting themselves; move them to `domain::device`.
- Dedicated sync sub-router (review item 2).
