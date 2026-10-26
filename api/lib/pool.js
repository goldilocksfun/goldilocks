// Daily $LAUNCH pool, measured from the treasury balance on chain.
//
// Goldilocks launches on uselaunch.fun (Raydium LaunchLab). Coins there are created by the uselaunch master wallet and
// the coin creator receives no trading fees, so there is no creator-fee income to measure. Rewards are paid in $LAUNCH
// instead, out of whatever $LAUNCH the public treasury holds.
//
// At each epoch close (12:00 UTC) the pool is computed from public data only:
//
//   balance    = $LAUNCH in the treasury's associated token account for LAUNCH_MINT  (read at 'finalized')
//   committed  = Life pool not yet awarded                                  (S.jackpot)
//              + carried-over rewards below the minimum payout              (sum of S.carry)
//              + operations share accounted but not yet moved               (opsAccrued - opsSent)
//              + rows of earlier epochs that are still owed (not sent, not excluded, not dry-run)
//   free       = max(0, balance - committed)
//   pool       = floor(free * POOL_SHARE_BPS / 10000)                       (default 10000: all of it)
//
// So every $LAUNCH that reaches the treasury, from any source, is released exactly once, and $LAUNCH already promised
// to someone is never counted again. The inputs and the result are stored on the epoch and published at
// GET /api/ledger/<epoch> (source "treasury-balance"), so anyone can recompute it from the treasury token account.
//
// If the balance cannot be read the function throws: the caller keeps the epoch open and retries, it never closes an
// epoch on a stale or guessed number.
'use strict';

const OWED=new Set(['pending','sending','unconfirmed','failed']);

function committed(S){
  const carry=Object.values(S.carry||{}).reduce((a,b)=>a+b,0);
  const ops=Math.max(0,(S.opsAccrued||0)-(S.opsSent||0));
  let unsent=0;for(const e of S.epochs||[])for(const p of e.payouts||[])if(OWED.has(p.status))unsent+=p.amount;
  const lifePool=S.jackpot||0;
  return{lifePool,carry,ops,unsent,total:lifePool+carry+ops+unsent};
}

// read: async () => {amount, slot, tokenAccount, mint, decimals}  (chain.tokenBalanceAt bound to the treasury)
async function measure(S,read,{treasury,shareBps=10000}){
  const b=await read();
  if(!Number.isSafeInteger(b.amount)||b.amount<0)throw new Error('pool: bad treasury balance');
  const c=committed(S);const free=Math.max(0,b.amount-c.total);
  const amount=Math.floor(free*Math.max(0,Math.min(10000,shareBps))/10000);
  return{source:'treasury-balance',unit:'LAUNCH',mint:b.mint,decimals:b.decimals,treasury,tokenAccount:b.tokenAccount,slot:b.slot,
    balance:b.amount,committed:c,free,shareBps,amount};
}

module.exports={measure,committed};
