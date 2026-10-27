# Mainnet launch runbook

No secrets belong in this repository. Keys and API keys are set only in the hosting provider's environment
or secret files.

$GOLDILOCKS launches on uselaunch.fun (Raydium LaunchLab). The coin is created by the uselaunch master wallet, so the
mint address is only known once the coin is live. Rewards are paid in $LAUNCH, not SOL (docs/PAYOUTS.md).

Launch time: 2026-10-27 16:00 UTC (`LAUNCH_AT=1793116800000`). Free planets go live at that moment and start their
24 hour wait.

1. **Before launch: confirm the $LAUNCH mint.** Read it from uselaunch.fun and an explorer, check its decimals, and
   set `LAUNCH_MINT` (and `LAUNCH_DECIMALS` if not 6). The server refuses to pay if the decimals do not match the mint.
2. **Freeze claims on the old service**, then export them with
   `node api/migrate-claims.js --from <old service url> --to <new DATA_FILE>` (dry run: counts and diff),
   then the same command with `--apply`. Only claims, codes, X handles, X ids, reviews, the claim counter and the
   claim post id move; game state starts empty. Running it twice changes nothing.
3. **Create the coin on uselaunch.fun** from the @playgoldilocks X account (one coin per X account). Record the
   $GOLDILOCKS mint and the LaunchLab bonding-curve vault from the creation transaction.
4. **Environment:** `CLUSTER=mainnet-beta`, `MAINNET_ENABLED=1`, `PAYOUT_MODE=dry` (switch to `live` after the first
   day's ledger has been checked), `TOKEN_MINT` ($GOLDILOCKS), `LAUNCH_MINT` ($LAUNCH), `TREASURY_FILE` (secret file),
   `OPS_WALLET`, `POOL_SOURCE=chain`, `POOL_SHARE_BPS`, `MIN_PAYOUT_LAUNCH`, `EXCLUDE_WALLETS`, `DATA_FILE` (new file),
   `LAUNCH_AT`, RPC settings.
   `EXCLUDE_WALLETS`: `OPS_WALLET`, the uselaunch master wallet, the bonding-curve vault, burn addresses and team
   wallets now; add the Raydium pool vault when the coin migrates. The treasury is excluded automatically.
5. **Fund the treasury.** Buy the initial $LAUNCH seed at launch and send it to the treasury address (its token
   account is created by the first transfer), plus about 0.1 SOL as the reserve for network fees and new token account
   rent (each first payout to a wallet costs about 0.002 SOL). Thruster burns add SOL over time.
   Swap settings: `SWAP_ENABLED=1`, `SOL_RESERVE=0.1`, `SWAP_SLIPPAGE_BPS`, `SWAP_MAX_LAMPORTS_PER_DAY`. In dry payout
   mode the daily swap is quoted only; check the `swap` record on the first ledger before going live.
6. **Day 1:** dry run. Compare `GET /api/ledger/<epoch>` with the treasury token account in an explorer
   (docs/PAYOUTS.md, section 8). `POST /api/admin/pool-preview` shows the pool the next close would use.
7. **Go live:** set `PAYOUT_MODE=live`. Emergency stop: `PAYOUTS_PAUSED=1` or `POST /api/admin/pause`.
