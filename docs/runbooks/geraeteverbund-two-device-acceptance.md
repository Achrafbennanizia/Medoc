# Geräteverbund — Two-Device Acceptance Runbook

**Stand:** 2026-06-10  
**Spec:** [`docs/v-model/03-architektur/feature-geraeteverbund.md`](../v-model/03-architektur/feature-geraeteverbund.md)

## Prerequisites

- Two machines on the same LAN (or two processes with `MEDOC_VERBUND_DEVICE_SECRET` each).
- Valid vendor license token for device A (owner).
- `bash tools/dev-tauri.sh` on both, or release builds.

## Checklist (§14 acceptance criteria)

| # | Criterion | Steps | Pass |
|---|-----------|-------|------|
| 1 | Fresh install → onboarding only | Reset DB / new `medoc-data`; start app → only `/onboarding` paths, no patient routes | ☐ |
| 2 | License → owner seat meter matches tier | Device A: activate license → seat meter reflects edition (Basis 1/1·1/2, Pro 1/2·1/5, Enterprise 1/3·1/10) | ☐ |
| 3 | Join with SAS | Device B: **Beitreten** → scan/connect → A accepts → read 4 digits on A → enter on B | ☐ |
| 4 | Wrong SAS never provisions | Repeat join; enter `0000` → no provision; seat freed | ☐ |
| 5 | Member in registry | On A: Geräteverbund panel shows B fingerprint ACTIVE MEMBER | ☐ |
| 6 | One-time provisioning | Second provision attempt on B rejected (`alreadyProvisioned`) | ☐ |
| 7 | Tampered reconnect blocked | Alter B pubkey in DB or present wrong cert → deny + blocklist | ☐ |
| 8 | Seat caps | Fill tier caps → next join refused; reinstall shows reclaim hint on matching hostname | ☐ |
| 11 | HTTP host still serves browser | `medoc-lan` :8787 web UI reachable; only HTTP **pairing** is deprecated at cutover | ☐ |
| 9 | No cleartext payloads | Wireshark on LAN: payloads after handshake are opaque (Noise/AEAD) | ☐ |
| 10 | Audit trail | `audit` view or `verify_audit_chain` shows VERBUND/KOPPLUNG events | ☐ |

## Automated helpers

```bash
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
cargo test -p medoc-sync verbund
cargo test -p medoc-sync --test verbund_net_loopback
```

## Rollback

- Revoke member on owner: Einstellungen → System → Geräteverbund → Widerrufen.
- Block rogue fingerprint: Sperren → appears in blocklist.
