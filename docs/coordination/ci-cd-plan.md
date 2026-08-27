# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

## Scope

This plan implements a four-tier pipeline for the current MeDoc workspace layout:

- Rust workspace at repository root (`Cargo.toml`) with members under `apps/*` and `crates/*`.
- JavaScript workspace at repository root (`package.json`) with workspaces under `apps/*` and `packages/*`.

## Tier map

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking verification gate |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | PR head branch only | Deterministic formatting/lint auto-fix |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, `workflow_run` (failed `verify` on `main`) | New proposal branch only | Draft fix proposal with evidence |
| 4 | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No | Re-verify and build signed release artifacts |

## Guardrails encoded

1. Verify tier does not run `--fix` commands and does not commit.
2. Auto-fix runs only for pull requests, with loop guard `github.actor != 'github-actions[bot]'`.
3. Auto-fix only runs deterministic commands (`cargo fmt`, lint/format scripts, ESLint `--fix` fallback).
4. Fix-proposal creates a draft PR only; no auto-merge behavior is present.
5. Fix-proposal detects path touches containing `security`, `audit`, `crypto`, `rbac`, or `auth`, applies `needs-human-review`, and hard-stops.
6. Release uses a protected `release` environment and runs `verify` as the gate before build.
7. All workflows set timeout limits and concurrency cancellation to ensure termination.

## Package manager strategy

All workflows detect lockfiles in this order:

1. `pnpm-lock.yaml` → `pnpm`
2. `yarn.lock` → `yarn`
3. fallback `npm`

Install and run commands branch by detected package manager instead of hardcoding npm in workflow logic.

## Release invariants

- Release gate reruns full Tier 1 verification on the tagged commit.
- Build stage performs verification (`cargo test --workspace`) and signed bundle generation only.
- Source mutation is not performed in release jobs.
- Artifact upload and provenance attestation are emitted from the release build matrix.
