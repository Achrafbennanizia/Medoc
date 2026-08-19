# Cluster network reset runbook

Owner-only action: **Settings → System → Reset network** (`cluster_execute_cluster_reset` IPC).

## Prerequisites

- Role **PHYSICIAN** with `ops.system` on the **licensed owner admin** device.
- Password re-entry; TOTP if enrolled.
- Typed confirmation: practice slug **or** `RESET-<first8 cluster_id>`.

## Modes

| Mode | IPC value | Effect |
|------|-----------|--------|
| Network only | `network_only` | Clears verbund tables, license KV, onboarding/portal/sync KV, device keychain keys. **Keeps** `medoc.db` clinical data. |
| Full wipe | `full_wipe` | Above plus deletes `medoc.db` (+ WAL/SHM), SQLCipher keychain entry, `db-key.wrap/salt`. |

## Owner flow

1. Optional: create backup at `/ops`.
2. Choose mode → confirm with password + phrase.
3. Rust stops verbund listener + LAN server, broadcasts signed `CLUSTER_RESET` to member `last_ip` addresses, revokes peers, wipes local state.
4. UI logs out and reloads → `/onboarding/lizenz` → practice setup → login.

## Member devices

- **Online:** inbound `CLUSTER_RESET` or 30s poll via `ClusterStatusRequest` → local wipe → `cluster-reset-required` event → reload → `/onboarding/beitreten`.
- **Offline:** reset applies on next app start when poll finds pending reset or queued token in `verbund.cluster_reset_pending.v1`.

## Dev alternative

Full filesystem reset (no in-app UI):

```bash
bash scripts/dev-onboarding-reset.sh
```

Use in-app reset when testing network-only mode or multi-device notify without deleting the whole DB file.

## Manual QA checklist

1. Owner + member paired → owner **network only** reset → owner sees license onboarding; patient list preserved after re-onboarding.
2. Member online during reset → auto reload → join flow.
3. Member offline → open later → reset within ~30s poll.
4. Owner **full wipe** → empty DB; requires backup ack in UI.
5. RECEPTION cannot see reset panel (no `ops.system`).

## Security

- `ops.system` + `require_owner_admin` + password (+ TOTP) + typed phrase.
- Reset token signed with cluster master Ed25519 key; pubkey embedded in token JSON.
- Audit: `CLUSTER_RESET_REQUESTED`, `CLUSTER_RESET_COMPLETE`, `CLUSTER_RESET_APPLIED`.
