# Mainnet launch runbook

No secrets belong in this repository. Keys and API keys are set only in the hosting provider's environment
or secret files.

1. **Freeze claims on the old service**, then export them with
   `node api/migrate-claims.js --from <old service url> --to <new DATA_FILE>` (dry run: counts and diff),
   then the same command with `--apply`. Only claims, codes, X handles, X ids, reviews, the claim counter and the
   claim post id move; game state starts empty. Running it twice changes nothing.
2. **Environment:** `CLUSTER=mainnet-beta`, `MAINNET_ENABLED=1`, `PAYOUT_MODE=dry` (switch to `live` after the first
   day's ledger has been checked), `TOKEN_MINT`, `TREASURY_FILE` (secret file), `TREASURY_ADDRESS`, `OPS_WALLET`,
   `FEE_SOURCE=chain`, `FEE_IGNORE_FROM` (wallets that top up the treasury for network fees), `EXCLUDE_WALLETS`
   (treasury, operations, deployer, bonding curve, pool, team), `DATA_FILE` (new file), `LAUNCH_AT`, RPC settings.
3. **Creator fees** are routed to `TREASURY_ADDRESS`. Fund the treasury with a small amount for network fees from a
   wallet listed in `FEE_IGNORE_FROM`.
4. **Day 1:** dry run. Compare `GET /api/ledger/<epoch>` with the treasury's history in an explorer (docs/PAYOUTS.md, section 7).
5. **Go live:** set `PAYOUT_MODE=live`. Emergency stop: `PAYOUTS_PAUSED=1` or `POST /api/admin/pause`.
