// Payout safety: parallel execute does not double pay; a stored signature is not resent until proven expired.
'use strict';const assert=require('assert');const db={claims:{}};const E=require('./lib/engine').create(db,()=>{});
let sent=[];const send=async(w,l,onSig)=>{const s='sig'+sent.length;onSig(s,100);await new Promise(r=>setTimeout(r,20));sent.push([w,l]);return s;};
(async()=>{const e={idx:1,payouts:[{wallet:'A',lamports:5e6,status:'pending',sig:null},{wallet:'B',lamports:3e6,status:'pending',sig:null}]};
  await Promise.all([E.execute(e,'devnet',send,async()=>'unknown'),E.execute(e,'devnet',send,async()=>'unknown')]);assert.equal(sent.length,2);console.log('ok parallel execute pays once');
  const e2={idx:2,payouts:[{wallet:'C',lamports:5e6,status:'sending',sig:'old',lvh:5}]};sent=[];
  await E.execute(e2,'devnet',send,async()=>'unknown');assert.equal(sent.length,0);assert.equal(e2.payouts[0].status,'unconfirmed');console.log('ok unknown signature is not resent');
  await E.execute(e2,'devnet',send,async()=>'landed');assert.equal(sent.length,0);assert.equal(e2.payouts[0].status,'sent');console.log('ok landed signature marked sent');
  const e3={idx:3,payouts:[{wallet:'D',lamports:5e6,status:'failed',sig:'old',lvh:5}]};await E.execute(e3,'devnet',send,async()=>'expired');assert.equal(sent.length,1);console.log('ok expired signature resent once');
  console.log('PASS 4 payout tests');})().catch(e=>{console.error(e);process.exit(1);});
