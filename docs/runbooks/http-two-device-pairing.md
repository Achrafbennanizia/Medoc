# HTTP two-device pairing acceptance

**v1 path:** HTTP serverless pairing (`pairing_scan_lan`, `pairing_submit_request`, `pairing_decide`, replica sync). Geräteverbund wire remains flagged for v1.1.

## Prerequisites

- Two machines on the same LAN
- Master: `deployment.serverless_master` with valid license
- Replica: `deployment.serverless_peer` + role `REPLICA`

## Checklist

1. **Master** — Einstellungen → System → Pairing-Inbox visible; `pairing_master_info` returns device id.
2. **Replica** — Pairing scan page finds master via LAN scan (or manual URL).
3. **Replica** — Submit pairing request with device label; **Abbrechen** returns to scan without stale poll.
4. **Master** — Accept request in inbox; note 4-digit PIN if prompted.
5. **Replica** — Enter PIN; activation token persisted (`pairing_persist_token`).
6. **Replica** — `sync_run_now` or automatic connect pulls clinical data.
7. **Owner-only** — Non-owner replica cannot `import_activation_manifest` or `lizenz_activate` (403).
8. **Merge** — After connect, verify deterministic data on both sides (see `docs/architecture/serverless-sync.md` push-then-pull).

## Automated smoke

```bash
scripts/two-device-sync-smoke.sh   # when two hosts configured
cargo test -p medoc-e2e lan_pairing_sync -- --nocapture
```

## Ledger

Record pass/fail in `docs/coordination/validation.md` under Wave 7 ship gate.
