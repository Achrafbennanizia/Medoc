# Geräteverbund (Licensing, LAN Coupling, Secure Data Exchange)

> **Stack:** Tauri 2 · Rust (edition 2021) · React 19 + TS + Vite · Zustand · sqlx/SQLite  
> **Status:** specification + implementation (evolution of `medoc-sync` pairing)  
> **Implementation paths:** `crates/shared/medoc-sync/src/verbund/`, `crates/app/medoc-practice/src/commands/network/verbund/`, `packages/app/practice-host/src/pages/onboarding/`

Single source of truth for the Geräteverbund feature: a device that is not directly licensed may join a practice cluster owned by a licensed admin device, receive an equivalent license seat through one-time secure provisioning, and exchange data with other cluster devices over an always-encrypted, LAN-only channel.

---

## 1. Scope and non-goals

**In scope:** license activation, seat-based licensing, LAN discovery + pairing with 4-digit SAS, one-time provisioning, authoritative device registry, encrypted data exchange, onboarding gate + admin panel.

**Non-goals (YAGNI):** no cloud sync, NAT traversal, or relay servers; no multi-practice federation; no new app RBAC roles; no replacement of existing user auth.

---

## 2. Two orthogonal concepts

| Axis | Question | Values | Location |
|------|----------|--------|----------|
| App RBAC (existing) | What may this logged-in user do? | ARZT / REZEPTION / … | `medoc-core/src/application/rbac.rs` |
| Seat role (new) | What may this device do in the cluster? | ADMIN / MEMBER | `medoc-sync/src/verbund/enums.rs` |

---

## 3. License and seat model

One **Lizenz** → one **Verbund** (`cluster_id`). Seat caps are **derived from the vendor license edition** (Systementwurf §8.1 / FA-LIC-02), not hardcoded:

| Edition | max_total | max_admin | max_member |
|---------|-----------|-----------|------------|
| Basis / BASIC | 2 | 1 | 1 |
| Professional / PRO | 5 | 2 | 3 |
| Enterprise | 10 | 3 | 7 |

Enterprise uses the spec default (10/3/7). Owner activates license → first ADMIN seat + cluster CA. Joined devices receive **seat certificates** signed by cluster CA.

**Migration / forced re-pair:** Rows in `sync_device` backfilled from legacy pairing without `fingerprint` + 32-byte `pubkey` are set to `geraet_status = PENDING` and **must not** authenticate until re-provisioned. Registry verification and seat counting ignore incomplete identities.

---

## 3.1 Hybrid transport architecture (desktop mesh + browser HTTP)

Geräteverbund is **not** a replacement for `medoc-lan`. The architecture is **hybrid**:

| Client type | Transport | Purpose |
|-------------|-----------|---------|
| **Desktop ↔ desktop** | Noise XX/KK over TCP :49300 + mDNS | Pairing, provisioning, encrypted mesh sync between Tauri installs |
| **Browser / tablet / phone** (NFA-NET-04/05) | TLS 1.3 HTTPS via `medoc-lan` (:8787) | Responsive Rezeption web UI — browsers cannot speak Noise/CBOR |

**Cutover scope:** retire **HTTP pairing endpoints** on `medoc-lan` after the phase-5 frontend cutover. The **HTTP web-UI host** (`medoc-lan` Axum server, JWT session, `/api/v1/*`) **remains** for LAN browser clients. Do not remove `medoc-lan` itself.

**Migration timing:** both transports coexist from phase 2 through phase 5. HTTP pairing (`pairing_scan`, `pairing_submit_request`, …) stays available until onboarding + `verbund-beitreten` paths are production-ready — not at phase-4 IPC completion.

---

## 4. OSI protocol mapping

| Layer | Mechanism |
|------:|-----------|
| L7 | `JOIN_REQUEST`, `PROVISION`, `DATA_*`, … (CBOR) |
| L6 | ChaCha20-Poly1305 AEAD, SAS from handshake hash |
| L5 | Noise XX (pairing) / KK (reconnect) |
| L4 | TCP :49300 + mDNS `_medoc-verbund._tcp` |
| L3 | Private bind only (RFC1918, link-local, ULA) |

---

## 5. Pairing state machine

Scan → JOIN_REQUEST → admin accept (atomic seat) → SAS on admin → SAS_CONFIRM on joiner → one-time PROVISION → registry upsert → reconnect via Noise KK + seat cert.

---

## 6. Security model

Ed25519 device identity; fingerprint = base32(sha256(pubkey)); registry authority; blocklist on mismatch; audit categories VERBUND / KOPPLUNG.

---

## 7. UI surfaces

- **Pre-login onboarding:** `/onboarding` — activate license or join verbund (`verbund-beitreten.tsx`).
- **Admin panel:** Einstellungen → System → Geräteverbund (`geraeteverbund-panel.tsx`).
- **Reinstall reclaim:** when a join request hostname matches an active device, admin sees a suggested reclaim fingerprint and can **Ersetzen (Neuinstallation)** before accept — revokes the stale seat so caps are not exhausted by wiped devices.

---

## 8. Module layout (actual repo paths)

| Layer | Path |
|-------|------|
| Domain | `crates/shared/medoc-sync/src/verbund/` |
| Crypto | `crates/shared/medoc-sync/src/verbund/crypto/` |
| Net | `crates/shared/medoc-sync/src/net/` |
| Services | `crates/shared/medoc-sync/src/verbund/services/` |
| IPC | `crates/app/medoc-practice/src/commands/network/verbund/` |
| Frontend | `packages/app/practice-host/src/pages/onboarding/`, `geraeteverbund-panel.tsx` |

---

## 9. Database schema

Tables: `lizenz`, `geraet_blocklist`, `provisioning_state`; extensions to `sync_device` and `pairing_request`. See `crates/shared/medoc-core/src/infrastructure/database/migrations/verbund_tables.rs`.

---

## 10. Tauri commands

`verbund_status`, `lizenz_activate`, `verbund_discover_admins`, `verbund_send_join_request`, `verbund_submit_sas`, `verbund_start_listener`, `verbund_list_pending`, `verbund_accept_request`, `verbund_reject_request`, `verbund_list_devices`, `verbund_reclaim_device`, `verbund_revoke_device`, `verbund_block_device`, `verbund_unblock_device`.

Legacy `pairing_*` commands delegate to these during migration.

---

## 11–15. SOLID, compliance, phases, acceptance

See implementation plan and `docs/runbooks/geraeteverbund-two-device-acceptance.md`. Compliance updates: SOUP (`09-soup-liste.md`), ISO 14971 hazards, DSGVO Art. 32, private-bind threat-model note in `architekturentwurf.md`.
