# Bittrees, Inc. — Governance

The governance app for **Bittrees, Inc.** (`gov.bittrees.org`). Everything happens
in-app, no link-outs:

- **Snapshot governance** — create proposals, vote, and (for admins) moderate +
  edit space settings, all signed to the `gov.bittrees.eth` space.
- **BGOV mint** — mint Bittrees common stock (1000 BTREE/share → the Capital
  treasury), with the legacy equity disclosure.
- **Forum** — decentralized, wallet-signed discussions as on-chain EAS attestations
  on Base; starting a discussion requires ≥69 BGOV (the Associate tier).
- **Messenger** — wallet-native 1:1 DMs (XMTP) + token-gated community rooms (Push,
  tiered by BGOV: ≥1 / ≥69 / ≥210 / ≥420).
- **Structure** — the on-chain org map (the B.T.C. Group; Capital + Research are
  independent), with entity descriptions + avatars read live from ENS.
- **Become a contributor** — an application recorded on-chain (EAS on Base) but
  **encrypted**, readable only by the applicant and reviewers holding the `operations` role.
- Vision statement, Code of Conduct, and the Metaverse HQ.

## Stack

Vite 6 · React 19 · TypeScript · Tailwind v4 · wagmi 2 / viem 2 · RainbowKit ·
TanStack Query · react-router 7. Governance via Snapshot's GraphQL hub + sequencer;
forum/contributor via EAS on Base; messaging via XMTP (DMs) and Push (gated rooms).

## Develop

```bash
npm install
npm run dev      # http://localhost:5175
npm run build    # tsc -b && vite build
```

## Environment

Frontend (`VITE_`-prefixed, set in Vercel):

| Var | Purpose |
| --- | --- |
| `VITE_MAINNET_RPC_URL` | Dedicated mainnet RPC (Alchemy/Infura). Add `gov.bittrees.org` to its domain allowlist. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Reown/WalletConnect project id. Add `gov.bittrees.org` to its allowlist. |
| `VITE_GATE_URL` | Base URL of the chat gating function (default `https://gov.bittrees.org/api/gate`). |
| `VITE_PUSH_ROOM_SHAREHOLDERS` / `_ASSOCIATES` / `_JUNIOR` / `_PARTNERS` | Push group chat ids (set after creating each gated room). |

Serverless (the gating function): `MAINNET_RPC_URL` (optional; falls back to a public node).

## Deploy notes

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step (Vercel import, env vars,
Upstash Redis, domain, and the post-deploy admin steps). In brief:

- Vercel project pointed at `gov.bittrees.org`. `vercel.json` rewrites all non-`/api`
  routes to the SPA; the gating function is `api/gate.js`, with `/api/gate/*` routed to it
  via a `vercel.json` rewrite (Vite + Vercel functions don't support Next-style `[...catch-all]`).
- **Forum/contributor** auto-register their EAS schema on Base on the first post — no
  manual step.
- **Push rooms**: deploy `/api/gate`, then an admin creates each gated group once
  (`createGatedGroup()` in `src/lib/push.ts`) and the returned chat ids go into the
  `VITE_PUSH_ROOM_*` envs.
- **Shutter**: the Snapshot space ships with encrypted (shutter) voting; new proposals
  are created as plain so in-app votes work. Toggle the space default off via the
  in-app admin settings panel.
