// Daily treasury swap: SOL above a reserve -> $LAUNCH, through Jupiter, just before the 12:00 UTC close.
//
// The treasury collects SOL from paid thruster burns (0.01 SOL each). Once a day, before the pool is measured, the
// SOL above SOL_RESERVE is swapped into $LAUNCH so it becomes part of the reward pool. Every step is public:
//   - the Jupiter quote (in amount, expected out, minimum out, slippage, route) is stored on the epoch,
//   - the swap transaction signature is stored on the epoch before it is broadcast,
//   - the result is published at GET /api/ledger/<epoch> as `swap`.
// Anyone can open the signature in an explorer: SOL leaves the treasury, $LAUNCH arrives in the treasury token account.
//
// Flags:
//   SWAP_ENABLED=0 (default)  no swap step at all.
//   SWAP_ENABLED=1, payout mode dry   quote only, recorded as status 'quoted'. Nothing is signed.
//   SWAP_ENABLED=1, payout mode live  quote, sign, send, confirm.
// Limits: SWAP_SLIPPAGE_BPS (default 100 = 1%), SWAP_MAX_LAMPORTS_PER_DAY (default 1 SOL), SWAP_MIN_LAMPORTS
// (default 0.01 SOL, smaller amounts wait), SOL_RESERVE in SOL (default 0.1) or SOL_RESERVE_LAMPORTS.
//
// Idempotent per epoch: S.swaps[idx] is written with the signature before sending. A later run for the same epoch
// never sends a second swap; it only asks the chain what happened to the first one.
'use strict';
const WSOL='So11111111111111111111111111111111111111112';

const num=(env,k,d)=>env[k]!=null&&env[k]!==''?+env[k]:d;
function config(env=process.env){return{
  enabled:env.SWAP_ENABLED==='1',
  api:env.JUPITER_API||'https://lite-api.jup.ag/swap/v1',
  slippageBps:num(env,'SWAP_SLIPPAGE_BPS',100),
  maxPerDay:num(env,'SWAP_MAX_LAMPORTS_PER_DAY',1e9),
  minSwap:num(env,'SWAP_MIN_LAMPORTS',1e7),
  reserve:num(env,'SOL_RESERVE_LAMPORTS',Math.round(num(env,'SOL_RESERVE',0.1)*1e9)),
};}

// How many lamports to swap: everything above the reserve, capped per day, skipped when below the minimum.
function amountFor(balance,cfg){const a=Math.min(Math.max(0,balance-cfg.reserve),cfg.maxPerDay);return a>=cfg.minSwap?Math.floor(a):0;}

async function quote(fetch,cfg,outMint,lamports){
  const u=`${cfg.api}/quote?inputMint=${WSOL}&outputMint=${outMint}&amount=${lamports}&slippageBps=${cfg.slippageBps}&restrictIntermediateTokens=true`;
  const r=await fetch(u);if(!r.ok)throw new Error('jupiter quote '+r.status);const q=await r.json();
  if(!q||q.inputMint!==WSOL||q.outputMint!==outMint||String(q.inAmount)!==String(lamports))throw new Error('jupiter quote does not match the request');
  if(+q.slippageBps>cfg.slippageBps)throw new Error('jupiter quote slippage above cap');
  return q;}

// run(S, idx, ctx): ctx = {fetch, cfg, live:boolean, treasury:{publicKey}, outMint, chain:{balance, signSendRaw, sigState}, save, now}
// chain.signSendRaw(base64Tx, onSig) signs the Jupiter transaction with the treasury key, reports the signature through
// onSig before broadcasting, and resolves when confirmed. Returns the swap record (also stored at S.swaps[idx]).
async function run(S,idx,ctx){const {fetch,cfg,live,treasury,outMint,chain,save}=ctx;const now=ctx.now||Date.now;
  S.swaps=S.swaps||{};const prev=S.swaps[idx];
  if(prev&&(prev.status==='confirmed'||prev.status==='quoted'||prev.status==='skipped'))return prev;
  if(prev&&prev.sig){const st=await chain.sigState(prev.sig,prev.lvh).catch(()=>'unknown');
    if(st==='landed'){prev.status='confirmed';save();return prev;}if(st==='unknown'){prev.status='unconfirmed';save();return prev;}
    prev.status='expired';save();return prev;} // never retried for the same epoch; the SOL simply stays for the next day
  const owner=treasury.publicKey.toBase58();const bal=await chain.balance(owner);const lamports=amountFor(bal,cfg);
  const rec={epoch:idx,at:now(),treasury:owner,inputMint:WSOL,outputMint:outMint,solBalance:bal,reserve:cfg.reserve,lamports,mode:live?'live':'dry'};
  if(!lamports){rec.status='skipped';rec.reason='SOL above reserve below minimum';S.swaps[idx]=rec;save();return rec;}
  const q=await quote(fetch,cfg,outMint,lamports);
  Object.assign(rec,{quote:{inAmount:q.inAmount,outAmount:q.outAmount,minOut:q.otherAmountThreshold,slippageBps:+q.slippageBps,priceImpactPct:q.priceImpactPct,route:(q.routePlan||[]).map(r=>r.swapInfo&&r.swapInfo.label).filter(Boolean)}});
  if(!live){rec.status='quoted';S.swaps[idx]=rec;save();return rec;}
  const r=await fetch(`${cfg.api}/swap`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quoteResponse:q,userPublicKey:owner,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:'auto'})});
  if(!r.ok)throw new Error('jupiter swap '+r.status);const {swapTransaction}=await r.json();if(!swapTransaction)throw new Error('jupiter swap: no transaction');
  rec.status='sending';S.swaps[idx]=rec;save();
  try{await chain.signSendRaw(swapTransaction,(sig,lvh)=>{rec.sig=sig;rec.lvh=lvh;save();});rec.status='confirmed';}
  catch(x){rec.status=rec.sig?'unconfirmed':'failed';rec.error=String(x.message||x).slice(0,160);}
  save();return rec;}

module.exports={config,amountFor,quote,run,WSOL};
