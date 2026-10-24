// Live payout guards with a fake chain (no network): modes, kill switch, caps, exclusions, balance, crash recovery.
'use strict';const assert=require('assert');const P=require('./lib/payout');
const db={claims:{}};const E=require('./lib/engine').create(db,()=>{});const S=E.S;const save=()=>{};
const onChain={};let n=0,crash=null;
const chain={balance:async()=>bal,sigState:async s=>onChain[s]?'landed':'expired',
  transfer:async(f,to,l,onSig,h)=>chain.transferMany(f,[{to,lamports:l}],onSig,h),
  transferMany:async(f,items,onSig)=>{const s='sig'+(n++);onSig(s,1);if(crash==='after-sign'){crash=null;throw Object.assign(new Error('crash'),{crash:1});}
    onChain[s]=items;if(crash==='after-send'){crash=null;throw new Error('Confirmation timeout: '+s);}return s;}};
let bal=10e9;const treasury={publicKey:{toBase58:()=>'T'}};
const ep=(idx,rows)=>({idx,payouts:rows.map(([w,l])=>({wallet:w,lamports:l,status:'pending',sig:null}))});
const paid=()=>{const t={};for(const s in onChain)for(const it of onChain[s])t[it.to]=(t[it.to]||0)+it.lamports;return t;};
const ctx=(o={})=>Object.assign({E,S,save,mode:'live',chain,treasury,exclude:new Set(),cfg:Object.assign(P.config({}),o.cfg||{})},o);
(async()=>{
  assert.equal(P.modeFor({payoutMode:'live',cluster:'mainnet-beta',mainnetEnabled:false}),'dry');
  assert.equal(P.modeFor({payoutMode:'live',cluster:'mainnet-beta',mainnetEnabled:true}),'live');
  assert.equal(P.modeFor({payoutMode:'dry',cluster:'mainnet-beta',mainnetEnabled:true}),'dry');
  assert.equal(P.modeFor({payoutMode:'live',cluster:'devnet',mainnetEnabled:false}),'live');console.log('ok mainnet live needs PAYOUT_MODE=live and MAINNET_ENABLED');
  const rows=[...Array(25).keys()].map(i=>['W'+i,1e7+i]);
  const d=ep(1,rows);await P.run(d,ctx({mode:'dry'}));assert(d.payouts.every(p=>p.status==='dry-run'));assert.equal(n,0);
  await P.run(d,ctx());assert.equal(n,0);console.log('ok dry plan is never sent by a later live run');
  S.paused=true;let e=ep(2,rows);await P.run(e,ctx());assert.match(e.held,/paused/);assert.equal(n,0);S.paused=false;console.log('ok kill switch holds the epoch');
  e=ep(3,[['A',6e9]]);await P.run(e,ctx());assert.match(e.held,/per-wallet/);e=ep(4,[...Array(11).keys()].map(i=>['B'+i,4.9e9]));await P.run(e,ctx());assert.match(e.held,/per-epoch/);assert.equal(n,0);console.log('ok per-wallet and per-epoch caps hold the epoch');
  bal=1e8;e=ep(5,rows);await P.run(e,ctx());assert.match(e.held,/below payouts/);assert.equal(n,0);bal=10e9;console.log('ok low treasury balance holds the epoch');
  e=ep(6,rows);await P.run(e,ctx({exclude:new Set(['W3'])}));assert.equal(e.payouts.find(p=>p.wallet==='W3').status,'excluded');assert(!paid().W3);console.log('ok excluded wallets are never paid');
  // crash after signing batch 2 (never sent), and timeout after sending batch 3 (landed): retry pays each wallet exactly once
  for(const k in onChain)delete onChain[k];e=ep(7,rows);let c=0;const orig=chain.transferMany;
  chain.transferMany=async(...a)=>{c++;if(c===2)crash='after-sign';if(c===3)crash='after-send';return orig(...a);};
  await P.run(e,ctx());chain.transferMany=orig;
  await P.run(e,ctx());await P.run(e,ctx());
  const t=paid();for(const [w,l] of rows)assert.equal(t[w],l,w);assert(e.payouts.every(p=>p.status==='sent'));console.log('ok crash after sign and after send: every wallet paid exactly once');
  console.log('PASS 7 live payout tests');})().catch(e=>{console.error(e);process.exit(1);});
