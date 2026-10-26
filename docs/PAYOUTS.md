# Goldilocks payouts: how the daily $LAUNCH pool is funded, split and paid

This document describes exactly what the backend in `api/` does. Every number below is a default in
`api/lib/game.js` (`config()`) or `api/lib/payout.js`; the live values are published at `GET /api/game`.
Anyone can check each step against the Solana chain using only public data.

## 1. Launch venue and what it means for rewards

$GOLDILOCKS launches on [uselaunch.fun](https://uselaunch.fun) (X: @_LaunchX), which runs on Raydium LaunchLab.

- The coin is created by the uselaunch master wallet in a private bundle, so nobody can buy in the creation block.
- Every trade pays a 3 percent fee: 1 percent buys back and burns $GOLDILOCKS, 1 percent buys back and burns $LAUNCH,
  1 percent goes to the uselaunch treasury. Raydium adds its own 0.25 percent.
- **The coin's creator receives no trading fees.** Goldilocks therefore has no creator-fee income, and the backend
  does not try to measure or claim any.

**All rewards are paid in $LAUNCH** (an SPL token, mint `LAUNCH_MINT`), never in SOL. Thruster burns are still paid in
SOL (section 2), because a burn is a game action, not a reward.

## 2. Where the $LAUNCH comes from

Rewards come from one public **treasury address** (`treasury` in `GET /api/game` and `GET /api/treasury`). Its
$LAUNCH sits in the treasury's associated token account for `LAUNCH_MINT` (`treasuryTokenAccount` in `GET /api/treasury`).

How $LAUNCH reaches the treasury is not decided by the code: the pool is simply whatever free $LAUNCH the treasury
holds at the close (section 3). Every deposit is a normal token transfer that anyone can see in an explorer.
The funding source is published separately by the team and must not be assumed from this document.

**Thruster burns.** A paid burn sends 0.01 SOL (`THRUST_LAMPORTS`) to the treasury with a memo
`goldilocks burn <in|out> <wallet> <nonce>`. This SOL is not part of the $LAUNCH pool. It stays in the treasury and
pays network fees and the rent for new token accounts when winners are paid for the first time (`thrusterSol` in
`GET /api/game` is the running total).

## 3. How each epoch's pool is measured (`api/lib/pool.js`)

An epoch closes every day at **12:00 UTC**. At the close the server reads the treasury token account balance at
`finalized` commitment and subtracts everything that is already promised:

```
balance    = $LAUNCH in the treasury token account (raw units)
committed  = Life pool not yet awarded
           + carried-over rewards below the minimum payout
           + operations share accounted but not yet moved
           + payout rows of earlier epochs still owed (pending, sending, unconfirmed or failed)
free       = max(0, balance - committed)
pool       = floor(free * POOL_SHARE_BPS / 10000)        default POOL_SHARE_BPS = 10000 (all of it)
```

Rules that follow from this:

- **Every unit is released once.** $LAUNCH already assigned to a player, the Life pool or operations is counted in
  `committed`, so a later epoch can never hand it out again. New deposits become part of the next close.
- **No stale numbers.** If the balance cannot be read the epoch stays open and is retried every 30 seconds.
  An epoch is never closed on an old or guessed balance.
- **Slower release is a setting.** `POOL_SHARE_BPS` below 10000 releases only that share of the free balance each
  day (for example 1000 = 10 percent per day), so one large deposit is spread over many days.
- **Manual fallback.** `POOL_SOURCE=manual` uses `MANUAL_POOL_UNITS`. An admin may close an epoch with an explicit
  pool; such epochs are labeled `source: "manual"` in the public ledger.

All inputs (`balance`, `slot`, every `committed` part, `free`, `shareBps`, `amount`) are stored on the epoch and
published at `GET /api/ledger/<epoch>`.

## 4. The 70 / 20 / 10 split

| Share | Goes to |
|-------|---------|
| 70 percent of `pool` | **Zone share**: planets that spent time inside the habitable zone this epoch |
| 20 percent of `pool` | **Life pool**, paid once per season (section 7) |
| 10 percent of `pool` | **Operations**. Accounted in `opsAccrued` (`GET /api/treasury`). It stays in the treasury until moved by a person to `OPS_WALLET`; the server never moves it automatically. |

Rounding remainders of the zone share, and the whole zone share of an epoch in which no planet was eligible,
roll into the Life pool.

## 5. Who earns the zone share

- A wallet gets a planet when it holds at least 0.01 percent of supply. Every 0.01 percent is 1 mass,
  capped at 25 (0.25 percent). Mass uses the **lowest** balance held over the last 24 hours.
- Up to 200 free planets were claimed before launch. A free planet has mass 1 (or its holding mass, if higher).
- A planet is eligible after holding for 24 hours (free planets: 24 hours after launch or approval, whichever is later).
- The engine ticks every hour. Each hour an eligible planet spends inside the habitable zone (0.95 to 1.37 AU)
  adds `mass` to its weight. The zone share is split in proportion to weight.
- Orbits drift every hour from a seed that includes a daily blockhash (published at `GET /api/seeds`),
  so paths cannot be chosen in advance. A burn moves an orbit 2 percent in or out; one burn per day is free.

## 6. Minimum payout and weekly sweep

Amounts under 1 $LAUNCH (`MIN_PAYOUT_LAUNCH`, or `MIN_PAYOUT_UNITS` in raw units) carry over to the next epoch.
Every 7th epoch (`SWEEP_EVERY_EPOCHS`) all carried amounts are paid regardless of size.

## 7. Life pool and seasons

A planet that spends 400 hours in the zone reaches the stage Life (stages: Barren 0, Prebiotic 12,
Microbial 48, Multicellular 120, Complex 240, Life 400 hours). Leaving the zone removes 2 hours of progress per hour outside.
Seasons are UTC calendar quarters. The first epoch of a new quarter splits the whole Life pool by mass among every
planet that reached Life during the previous quarter, then evolution resets for everyone.

## 8. How to verify an epoch yourself

1. `GET /api/ledger/<epoch>` returns the epoch record:
   - `source`: `mint`, `tokenAccount`, `slot`, `balance`, `committed` (lifePool, carry, ops, unsent), `free`, `shareBps`, `amount`;
   - `pool`, `split.zone`, `split.lifePool`, `split.ops`;
   - `payouts`: wallet, amount (raw $LAUNCH units), status and **payout signature**.
2. Open `source.tokenAccount` in an explorer and confirm it is the treasury's token account for `source.mint`
   and that its balance at `source.slot` equals `source.balance`.
3. Check `free = balance - committed.total` (never below zero), `pool = floor(free * shareBps / 10000)`, and that the
   split is 70 / 20 / 10 of `pool` with floor rounding.
4. Look up each payout `sig` and confirm a `TransferChecked` of that amount of `LAUNCH_MINT` from the treasury token
   account to the wallet's associated token account.
5. Cross-check the treasury token account's full history: every outflow should be a payout row or a published
   operations transfer (`opsTransfers` in `GET /api/treasury`).
6. `GET /api/treasury` shows what is committed right now; `GET /api/epochs` lists recent epochs;
   `GET /api/earnings/<wallet>` lists one wallet's payouts.

Amounts in the API are raw units. Divide by 10^`rewardDecimals` (`GET /api/game`, 6 by default) for whole $LAUNCH.

## 9. Configuration (environment variables, never committed)

| Variable | Meaning |
|----------|---------|
| `LAUNCH_MINT` | $LAUNCH mint address. Every reward is paid in this token. |
| `LAUNCH_DECIMALS` | Decimals of $LAUNCH (default 6). The server refuses to pay if this differs from the mint on chain. |
| `TOKEN_MINT` | $GOLDILOCKS mint. Holdings give planet mass. |
| `TREASURY_FILE` | Path to the treasury key file on the server. Never in this repository. Its address is the public treasury. |
| `POOL_SOURCE` | `chain` (default when `LAUNCH_MINT` is set) or `manual` |
| `POOL_SHARE_BPS` | Share of the free treasury balance released per epoch, in basis points (default 10000) |
| `MANUAL_POOL_UNITS` | Pool in raw units when `POOL_SOURCE=manual` |
| `MIN_PAYOUT_LAUNCH` / `MIN_PAYOUT_UNITS` | Minimum payout, in whole $LAUNCH or raw units (default 1 $LAUNCH) |
| `TREASURY_SOL_RESERVE_LAMPORTS` | SOL always kept for network fees (default 0.02 SOL) |
| `SOL_PER_PAYOUT_LAMPORTS` | SOL budget per payout row: fee plus new token account rent (default 0.0021 SOL) |
| `OPS_WALLET` | Published destination for the operations share (moved manually, in $LAUNCH) |
| `PAYOUT_MODE` | `dry` records the plan without sending; `live` sends (on mainnet only together with `MAINNET_ENABLED=1`) |
| `MAINNET_ENABLED` | Must be `1` for any mainnet connection at all |
| `PAYOUT_BATCH` | Rows per payout transaction (default 5) |
| `PRIORITY_MICROLAMPORTS` | Priority fee per compute unit (default 20000) |
| `MAX_PAYOUT_PER_WALLET_LAUNCH` / `_UNITS` | Sanity cap per wallet per epoch (default 5,000,000 $LAUNCH) |
| `MAX_PAYOUT_PER_EPOCH_LAUNCH` / `_UNITS` | Sanity cap per epoch (default 50,000,000 $LAUNCH) |
| `PAYOUTS_PAUSED` | `1` pauses every transfer (kill switch that cannot be lifted from the admin API) |
| `EXCLUDE_WALLETS` | Never a planet, never paid. Set: treasury (added automatically), `OPS_WALLET`, the uselaunch master wallet, the LaunchLab bonding-curve vault for $GOLDILOCKS, the Raydium pool vault after migration, burn addresses, team wallets |

Removed with the move to uselaunch: `FEE_SOURCE`, `FEE_POOL_LAMPORTS`, `FEE_IGNORE_FROM`, `TREASURY_ADDRESS`,
`MIN_PAYOUT_LAMPORTS`, `MAX_PAYOUT_PER_*_LAMPORTS` and `GET /api/fees` as a fee scanner (it now returns the same as
`GET /api/treasury`).

## 10. How payouts are sent (`api/lib/payout.js`, `api/lib/engine.js`, `api/lib/chain.js`)

1. **The plan is fixed at close.** When an epoch closes, every payout row (wallet, amount in raw $LAUNCH units) is stored. Dry and live
   runs use the same plan. Rows recorded as `dry-run` are final and are never sent by a later live run.
2. **Guards, before anything is signed:** kill switch, excluded wallets (marked `excluded`), per-wallet cap,
   per-epoch cap, treasury $LAUNCH balance at least the unpaid total, treasury SOL balance at least the reserve plus
   `SOL_PER_PAYOUT_LAMPORTS` for each row (network fee and, for a first payout, the new token account's rent). If any guard fails the epoch is
   marked `held` with the reason and nothing moves.
3. **Batches.** Up to 5 rows per transaction (`PAYOUT_BATCH`), with a compute budget and a priority fee. Each row is
   two instructions: Associated Token Account `CreateIdempotent` for the winner (creates the account only if missing)
   and Token `TransferChecked` from the treasury's $LAUNCH account (mint and decimals checked on chain).
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
7. **Operations share.** Paid in $LAUNCH. Only an admin call moves it, only to `OPS_WALLET`, never more than the accounted
   `opsAccrued - opsSent`, and never while an earlier operations transfer is unconfirmed. Each transfer is listed in `GET /api/treasury` (`opsTransfers`).
