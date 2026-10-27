// Daily SOL -> $LAUNCH swap with a mocked Jupiter and chain: amount rules, dry quote only, live send once, safety checks.
'use strict';const assert=require('assert');const W=require('./lib/swap');
const OUT='AhBidGAgv6QbKSWfrSCegGrzFLcBx4E5FNYTKHNQQj6C';const T={publicKey:{toBase58:()=>'Treasury'}};
const cfg=W.config({SWAP_ENABLED:'1',SOL_RESERVE:'0.1',SWAP_MAX_LAMPORTS_PER_DAY:'1000000000',SWAP_SLIPPAGE_BPS:'100'});
let calls={quote:0,swap:0},qOver={};
const fetch=async(u,o)=>{if(u.includes('/quote?')){calls.quote++;const p=new URL(u).searchParams;
    return{ok:true,json:async()=>Object.assign({inputMint:p.get('inputMint'),outputMint:p.get('outputMint'),inAmount:p.get('amount'),outAmount:'5000000000',otherAmountThreshold:'4950000000',slippageBps:+p.get('slippageBps'),priceImpactPct:'0.001',routePlan:[{swapInfo:{label:'Raydium CPMM'}}]},qOver)};}
  calls.swap++;const b=JSON.parse(o.body);assert.equal(b.userPublicKey,'Treasury');assert(b.wrapAndUnwrapSol);return{ok:true,json:async()=>({swapTransaction:'BASE64'})};};
let bal,sent=0,state='unknown',fail=false;
const chain={balance:async()=>bal,sigState:async()=>state,signSendRaw:async(b64,onSig)=>{assert.equal(b64,'BASE64');onSig('SWAPSIG',99);sent++;if(fail)throw new Error('Swap confirmation timeout: SWAPSIG');return 'SWAPSIG';}};
const ctx=(live)=>({fetch,cfg,live,treasury:T,outMint:OUT,chain,save:()=>{},now:()=>1});
(async()=>{
  assert.equal(cfg.reserve,1e8);assert.equal(W.amountFor(5e7,cfg),0);assert.equal(W.amountFor(1.15e8,cfg),1.5e7);assert.equal(W.amountFor(5e9,cfg),1e9);assert.equal(W.amountFor(1.05e8,cfg),0);
  console.log('ok swaps only SOL above the 0.1 SOL reserve, capped per day, skips dust below 0.01 SOL');
  assert.equal(W.config({}).enabled,false);console.log('ok SWAP_ENABLED defaults to off');
  let S={};bal=1.1e8+5e7;let r=await W.run(S,1,ctx(false));assert.equal(r.status,'quoted');assert.equal(r.lamports,6e7);assert.equal(r.quote.minOut,'4950000000');assert.deepEqual(r.quote.route,['Raydium CPMM']);assert.equal(calls.swap,0);assert.equal(sent,0);
  console.log('ok dry mode records the quote only, nothing signed');
  S={};r=await W.run(S,2,ctx(true));assert.equal(r.status,'confirmed');assert.equal(r.sig,'SWAPSIG');assert.equal(sent,1);
  r=await W.run(S,2,ctx(true));assert.equal(sent,1);assert.equal(calls.swap,1);console.log('ok live swap sent once per epoch, signature recorded');
  S={};fail=true;r=await W.run(S,3,ctx(true));assert.equal(r.status,'unconfirmed');assert.equal(r.sig,'SWAPSIG');fail=false;
  state='unknown';r=await W.run(S,3,ctx(true));assert.equal(sent,2);assert.equal(r.status,'unconfirmed');
  state='landed';r=await W.run(S,3,ctx(true));assert.equal(r.status,'confirmed');assert.equal(sent,2);console.log('ok timed-out swap is never resent, resolved from chain later');
  S={};bal=1.05e8;r=await W.run(S,4,ctx(true));assert.equal(r.status,'skipped');console.log('ok nothing to swap is recorded as skipped');
  S={};bal=5e8;qOver={slippageBps:500};await assert.rejects(W.run(S,5,ctx(true)),/slippage/);qOver={outputMint:'Other'};await assert.rejects(W.run(S,6,ctx(true)),/does not match/);qOver={};
  assert.equal(sent,2);console.log('ok quote with wrong mint or slippage above cap is refused');
  console.log('PASS 7 swap tests');})().catch(e=>{console.error(e);process.exit(1);});
