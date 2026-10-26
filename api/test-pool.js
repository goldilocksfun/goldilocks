// Daily $LAUNCH pool from the treasury balance: committed amounts are never released twice, share setting, RPC failure.
'use strict';const assert=require('assert');const P=require('./lib/pool');
const bal=(amount)=>async()=>({amount,slot:123,tokenAccount:'TA',mint:'M',decimals:6});
(async()=>{
  let S={jackpot:0,carry:{},epochs:[]};
  let r=await P.measure(S,bal(1000e6),{treasury:'T'});assert.equal(r.amount,1000e6);assert.equal(r.free,1000e6);assert.equal(r.source,'treasury-balance');console.log('ok empty state releases the whole free balance');
  S={jackpot:200e6,carry:{a:3e5,b:2e5},opsAccrued:100e6,opsSent:40e6,epochs:[{payouts:[{amount:7e6,status:'pending'},{amount:5e6,status:'sent'},{amount:4e6,status:'excluded'},{amount:9e6,status:'dry-run'},{amount:1e6,status:'unconfirmed'}]}]};
  r=await P.measure(S,bal(1000e6),{treasury:'T'});
  assert.deepEqual(r.committed,{lifePool:200e6,carry:5e5,ops:60e6,unsent:8e6,total:200e6+5e5+60e6+8e6});assert.equal(r.amount,1000e6-r.committed.total);console.log('ok Life pool, carry, unmoved ops share and owed rows are held back');
  r=await P.measure(S,bal(100e6),{treasury:'T'});assert.equal(r.amount,0);assert.equal(r.free,0);console.log('ok balance below committed releases nothing');
  r=await P.measure({jackpot:0,carry:{},epochs:[]},bal(1001),{treasury:'T',shareBps:1000});assert.equal(r.amount,100);console.log('ok POOL_SHARE_BPS releases a share and floors');
  await assert.rejects(P.measure(S,async()=>{throw new Error('rpc down')},{treasury:'T'}));console.log('ok RPC failure throws');
  // round trip with the engine: closing an epoch on the pool and measuring again never releases the same units twice
  const E=require('./lib/engine').create({claims:{}},()=>{},{now:()=>Date.UTC(2026,10,1,12)});const W='9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
  E.ensure(W,'hold');E.S.planets[W].weight=10;let treasury=1000e6;
  const m1=await P.measure(E.S,bal(treasury),{treasury:'T'});const e1=E.closeEpoch(1,m1.amount).epoch;E.S.opsAccrued=e1.ops;
  const paid=e1.payouts.reduce((a,p)=>a+p.amount,0);assert.equal(paid,700e6);
  const m2=await P.measure(E.S,bal(treasury),{treasury:'T'});assert.equal(m2.amount,0);console.log('ok nothing new released while the first payout is still owed');
  for(const p of e1.payouts)p.status='sent';treasury-=paid;
  const m3=await P.measure(E.S,bal(treasury),{treasury:'T'});assert.equal(m3.amount,0);console.log('ok after payout, Life pool and ops share stay held back');
  treasury+=50e6;const m4=await P.measure(E.S,bal(treasury),{treasury:'T'});assert.equal(m4.amount,50e6);console.log('ok a later deposit is released exactly once');
  console.log('PASS 9 pool tests');})().catch(e=>{console.error(e);process.exit(1);});
