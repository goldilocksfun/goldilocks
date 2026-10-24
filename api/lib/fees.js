// On-chain fee intake for the daily payout pool.
//
// Every SOL deposit into the treasury address (pump.fun creator fees are routed there) is measured from the chain,
// never typed in by hand. The scanner walks the treasury's transaction history forward from a persisted cursor and,
// for every finalized transaction, reads the treasury's own balance change from the transaction metadata:
//
//   delta = postBalance - preBalance            (lamports, from meta, so it covers CPI transfers too)
//   if the treasury paid the network fee, the fee is added back, so our own fee is never counted as an outflow
//
// A transaction is counted as income when delta > 0, unless it is
//   - a thruster burn (memo "goldilocks burn ..."): that SOL is already credited to the zone share through the burn pool,
//   - signed by a wallet in FEE_IGNORE_FROM (for example a team wallet topping up the treasury for fees or rent),
//   - failed on chain.
// Outflows (our payouts, delta < 0) are ignored. Each counted signature is stored, so a restart or a rescan never counts it twice.
//
// The scan uses 'finalized' commitment only. If any RPC call fails the scan throws and nothing is changed: the caller must
// not close the epoch with a stale number, it retries on the next loop instead.
'use strict';

const BURN_MEMO = /goldilocks burn (in|out) /;

// state: a plain object persisted inside DATA_FILE (db.game.fees). Created on first use.
function initState(S) {
  S.fees = S.fees || {
    cursor: null,     // newest signature already processed (scan resumes after it)
    pending: 0,       // lamports counted since the last epoch close, not yet assigned to an epoch
    pendingTxs: [],   // [{sig, slot, blockTime, lamports}] behind `pending`, published with the epoch
    seen: {},         // sig -> 1 for every counted or skipped signature (bounded, see prune)
    lastScanAt: null, lastScanOk: null, lastError: null,
  };
  return S.fees;
}

// rpc: {signatures(address, {until, before, limit}), transaction(sig)} - thin wrappers around
// getSignaturesForAddress and getParsedTransaction, both at 'finalized'. Injected so tests can run without a network.
async function scan(S, rpc, { treasury, ignoreFrom = new Set(), now = Date.now() }) {
  const F = initState(S);
  if (!treasury) throw new Error('fees: TREASURY_ADDRESS not set');

  // 1. Collect every signature newer than the cursor (newest first from RPC, paginated with `before`).
  const fresh = [];
  let before;
  for (let page = 0; page < 50; page++) {
    const batch = await rpc.signatures(treasury, { until: F.cursor || undefined, before, limit: 1000 });
    fresh.push(...batch);
    if (batch.length < 1000) break;
    before = batch[batch.length - 1].signature;
    if (page === 49) throw new Error('fees: more than 50k new signatures, refusing partial scan');
  }

  // First run: start counting from now. History before the service started is never counted.
  if (F.cursor === null) {
    F.cursor = fresh.length ? fresh[0].signature : '';
    F.lastScanAt = now; F.lastScanOk = now; F.lastError = null;
    return { added: 0, txs: 0, initialized: true };
  }

  // 2. Read every transaction first (oldest first). Any failure throws before state is touched.
  const ordered = fresh.slice().reverse();
  const rows = [];
  for (const s of ordered) {
    if (F.seen[s.signature]) continue;
    if (s.err) { rows.push({ sig: s.signature, skip: 'failed' }); continue; }
    const tx = await rpc.transaction(s.signature);
    if (!tx) throw new Error('fees: transaction not available yet ' + s.signature.slice(0, 8));
    rows.push(classify(tx, s.signature, treasury, ignoreFrom));
  }

  // 3. Commit in one step.
  let added = 0;
  for (const r of rows) {
    F.seen[r.sig] = 1;
    if (r.lamports > 0) {
      F.pending += r.lamports; added += r.lamports;
      F.pendingTxs.push({ sig: r.sig, slot: r.slot, blockTime: r.blockTime, lamports: r.lamports });
    }
  }
  if (fresh.length) F.cursor = fresh[0].signature;
  prune(F);
  F.lastScanAt = now; F.lastScanOk = now; F.lastError = null;
  return { added, txs: rows.length };
}

// Treasury balance change for one parsed transaction, and whether it counts as income.
function classify(tx, sig, treasury, ignoreFrom) {
  const keys = tx.transaction.message.accountKeys.map(k => String(k.pubkey || k));
  const i = keys.indexOf(treasury);
  const base = { sig, slot: tx.slot, blockTime: tx.blockTime, lamports: 0 };
  if (tx.meta && tx.meta.err) return Object.assign(base, { skip: 'failed' });
  if (i < 0) return Object.assign(base, { skip: 'not-touching-treasury' });
  let delta = tx.meta.postBalances[i] - tx.meta.preBalances[i];
  if (i === 0) delta += tx.meta.fee;                       // treasury was fee payer: our fee is not an outflow
  const logs = (tx.meta.logMessages || []).join('\n');
  if (BURN_MEMO.test(logs)) return Object.assign(base, { skip: 'burn' });
  if (ignoreFrom.has(keys[0])) return Object.assign(base, { skip: 'ignored-sender' });
  if (delta <= 0) return Object.assign(base, { skip: 'outflow' });
  return Object.assign(base, { lamports: delta });
}

// Hand the pending amount to an epoch. Called inside the same synchronous step that closes the epoch,
// so the amount can never be assigned to two epochs.
function take(S) {
  const F = initState(S);
  const out = { lamports: F.pending, txs: F.pendingTxs };
  F.pending = 0; F.pendingTxs = [];
  return out;
}

function prune(F) {
  const k = Object.keys(F.seen);
  if (k.length > 20000) for (const s of k.slice(0, k.length - 20000)) delete F.seen[s];
}

// Real RPC adapter (finalized commitment).
function rpcFrom(conn, web3) {
  return {
    signatures: (addr, o) => conn.getSignaturesForAddress(new web3.PublicKey(addr), o, 'finalized'),
    transaction: sig => conn.getParsedTransaction(sig, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }),
  };
}

module.exports = { scan, take, classify, initState, rpcFrom };
