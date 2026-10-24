# Goldilocks payouts: how the daily pool is funded, split and paid

This document describes exactly what the backend in `api/` does. Every number below is a default in
`api/lib/game.js` (`config()`); the live values are published at `GET /api/game`.
Anyone can check each step against the Solana chain using only public data.

## 1. Where the money comes from

All income goes to one public **treasury address** (`TREASURY_ADDRESS`, shown as `treasury` in `GET /api/fees`).

- **Creator fees.** The token's creator fees are routed to the treasury address.
- **Thruster burns.** A paid burn sends 0.01 SOL (`THRUST_LAMPORTS`) to the treasury with a memo
  `goldilocks burn <in|out> <wallet> <nonce>`. Burn SOL is credited in full to the zone share of the next epoch.

Nothing else is income. There is no hidden source and no manual top-up of the pool in normal operation.

## 2. How each epoch's pool is measured on chain (`api/lib/fees.js`)

An epoch closes every day at **12:00 UTC**. Just before closing, the server scans the treasury's transaction
history (`getSignaturesForAddress`, `finalized` commitment) forward from the last processed signature.
For each new transaction it reads the treasury's balance change from the transaction metadata:

```
delta = postBalance(treasury) - preBalance(treasury)
if the treasury paid the network fee: delta += fee      (our own fee is not an outflow)
```

| Transaction                                             | Counted as pool income? |
|---------------------------------------------------------|-------------------------|
| Any transfer or program CPI that raises the balance     | yes, `delta`            |
| Creator-fee claim signed by the treasury itself         | yes, `delta` after fee  |
| Thruster burn (memo `goldilocks burn ...`)              | no, already in the burn share |
| Payouts and any other outflow (`delta <= 0`)            | no                      |
| Failed transaction                                      | no                      |
| Sent by a wallet listed in `FEE_IGNORE_FROM` (e.g. a team top-up for network fees) | no |

Safety rules:

- **No double counting.** Every processed signature is stored in the state file, together with a cursor.
  Restarts and rescans never count a signature twice. The counted amount is handed to exactly one epoch
  in the same step that closes it.
- **No stale numbers.** If any RPC call fails, the scan throws, nothing is changed, and the epoch stays open.
  It is retried every 30 seconds. An epoch is never closed with an old or partial pool.
- **History before start is ignored.** On first run the cursor is set to the newest signature; only later deposits count.
- **Solvency check.** A payout run starts only when the treasury holds every unpaid payout plus a reserve
  (`TREASURY_RESERVE_LAMPORTS`, default 0.01 SOL). Otherwise the epoch is marked `held` and can be retried.
- **Fallback.** `FEE_SOURCE=manual` uses `FEE_POOL_LAMPORTS` instead. An admin may close an epoch with an
  explicit pool; such epochs are labeled `source: "manual"` in the public ledger.

## 3. The 70 / 20 / 10 split

For each epoch `pool` = the on-chain income above.

| Share | Goes to |
|-------|---------|
| 70 percent of `pool` + all burn SOL | **Zone share**: planets that spent time inside the habitable zone this epoch |
| 20 percent of `pool` | **Life pool**, paid once per season (section 6) |
| 10 percent of `pool` | **Operations**. Accounted in `opsAccrued` (`GET /api/fees`). It stays in the treasury until moved by a person to `OPS_WALLET`; the server never moves it automatically. |

Rounding remainders of the zone share, and the whole zone share of an epoch in which no planet was eligible,
roll into the Life pool.

## 4. Who earns the zone share

- A wallet gets a planet when it holds at least 0.01 percent of supply. Every 0.01 percent is 1 mass,
  capped at 25 (0.25 percent). Mass uses the **lowest** balance held over the last 24 hours.
- Up to 200 free planets were claimed before launch. A free planet has mass 1 (or its holding mass, if higher).
- A planet is eligible after holding for 24 hours (free planets: 24 hours after launch or approval, whichever is later).
- The engine ticks every hour. Each hour an eligible planet spends inside the habitable zone (0.95 to 1.37 AU)
  adds `mass` to its weight. The zone share is split in proportion to weight.
- Orbits drift every hour from a seed that includes a daily blockhash (published at `GET /api/seeds`),
  so paths cannot be chosen in advance. A burn moves an orbit 2 percent in or out; one burn per day is free.

## 5. Minimum payout and weekly sweep

Amounts under 0.001 SOL (`MIN_PAYOUT_LAMPORTS`) carry over to the next epoch. Every 7th epoch
(`SWEEP_EVERY_EPOCHS`) all carried amounts are paid regardless of size.

## 6. Life pool and seasons

A planet that spends 400 hours in the zone reaches the stage Life (stages: Barren 0, Prebiotic 12,
Microbial 48, Multicellular 120, Complex 240, Life 400 hours). Leaving the zone removes 2 hours of progress per hour outside.
Seasons are UTC calendar quarters. The first epoch of a new quarter splits the whole Life pool by mass among every
planet that reached Life during the previous quarter, then evolution resets for everyone.

## 7. How to verify an epoch yourself

1. `GET /api/ledger/<epoch>` returns the epoch record:
   - `source.txs`: every deposit signature that funded the pool with its lamports;
   - `pool`, `split.zone`, `split.lifePool`, `split.ops`;
   - `payouts`: wallet, lamports, status and **payout signature**.
2. Look up each `source.txs[].sig` in any explorer and confirm the treasury balance change equals `lamports`.
3. Check that `pool` equals the sum of `source.txs[].lamports`, and that the split is 70 / 20 / 10 of `pool`
   (floor rounding; burn SOL added to the zone share).
4. Look up each payout `sig` and confirm the transfer from the treasury to that wallet.
5. Cross-check the treasury's full history in an explorer: every inflow should appear in exactly one epoch's
   `source.txs` (except burns and `FEE_IGNORE_FROM` senders), and every outflow should be a payout or a published operations transfer.
6. `GET /api/fees` shows deposits counted since the last close (`pendingTxs`) and the scanner status.
   `GET /api/epochs` lists recent epochs; `GET /api/earnings/<wallet>` lists one wallet's payouts.

## 8. Configuration (environment variables, never committed)

| Variable | Meaning |
|----------|---------|
| `TREASURY_ADDRESS` | Public address whose deposits fund the pool. Defaults to the payout key's address. |
| `TREASURY_FILE` | Path to the payout key file on the server. Never in this repository. |
| `FEE_SOURCE` | `chain` (default) or `manual` |
| `FEE_POOL_LAMPORTS` | Pool used when `FEE_SOURCE=manual` |
| `FEE_IGNORE_FROM` | Comma list of sender wallets whose deposits are not income |
| `TREASURY_RESERVE_LAMPORTS` | Balance kept back for network fees (default 10000000) |
| `OPS_WALLET` | Published destination for the operations share (moved manually) |
| `PAYOUT_MODE` | `dry` records the plan without sending; `live` sends (on mainnet only together with `MAINNET_ENABLED=1`) |
| `MAINNET_ENABLED` | Must be `1` for any mainnet connection at all |
| `PRIORITY_MICROLAMPORTS` | Priority fee per compute unit (default 20000) |
| `MAX_PAYOUT_PER_WALLET_LAMPORTS` | Sanity cap per wallet per epoch (default 5 SOL) |
| `MAX_PAYOUT_PER_EPOCH_LAMPORTS` | Sanity cap per epoch (default 50 SOL) |
| `PAYOUTS_PAUSED` | `1` pauses every transfer (kill switch that cannot be lifted from the admin API) |
| `EXCLUDE_WALLETS` | Treasury, deployer, bonding curve, pool and team wallets: never a planet, never paid |

## 9. How payouts are sent (`api/lib/payout.js`, `api/lib/engine.js`, `api/lib/chain.js`)

1. **The plan is fixed at close.** When an epoch closes, every payout row (wallet, lamports) is stored. Dry and live
   runs use the same plan. Rows recorded as `dry-run` are final and are never sent by a later live run.
2. **Guards, before anything is signed:** kill switch, excluded wallets (marked `excluded`), per-wallet cap,
   per-epoch cap, treasury balance at least the unpaid total plus the reserve. If any guard fails the epoch is
   marked `held` with the reason and nothing moves.
3. **Batches.** Up to 10 transfers per transaction (`PAYOUT_BATCH`), with a compute budget and a priority fee.
   A batch is atomic: all its transfers land or none do.
4. **Sign, persist, then send.** The signature of each batch is written to the state file before the
   transaction is broadcast. The same signed bytes are rebroadcast every 2 seconds until confirmed or until the
   blockhash expires.
5. **Crash or timeout recovery.** On the next run every row that already has a signature is checked on chain first:
   `landed` rows become `sent`; a signature that can still land is left alone (`unconfirmed`); only a signature
   whose blockhash has provably expired (block height past its last valid height) is replaced and resent.
   So a crash before or after broadcasting can never pay a wallet twice.
6. **Records.** Every confirmed row keeps its transaction signature, shown in `GET /api/ledger/<epoch>` and
   appended to the server's payout ledger.
7. **Operations share.** Only an admin call moves it, only to `OPS_WALLET`, never more than the accounted
   `opsAccrued - opsSent`, and never while an earlier operations transfer is unconfirmed. Each transfer is listed in `GET /api/fees` (`opsTransfers`).
