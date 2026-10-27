// Batched payouts: one tx per batch, fallback to single sends on batch failure, stored batch signature resolves all rows.
'use strict';const assert=require('assert');process.env.PAYOUT_BATCH='10';const db={claims:{}};const E=require('./lib/engine').create(db,()=>{});
const rows=n=>[...Array(n)].map((_,i)=>({wallet:'W'+i,amount:2e6+i,status:'pending',sig:null}));const led=[];const onL=p=>led.push(p.wallet);
(async()=>{let batches=0,singles=0;const many=async(items,onSig)=>{batches++;onSig('B'+batches,9);return 'B'+batches;};const one=async(w,l,onSig)=>{singles++;onSig('S'+singles,9);return 'S'+singles;};
  let e={idx:1,payouts:rows(25)};await E.execute(e,'devnet',one,async()=>'unknown',many,onL);
  assert.equal(batches,3);assert.equal(singles,0);assert(e.payouts.every(p=>p.status==='sent'));assert.equal(led.length,25);assert.equal(new Set(e.payouts.map(p=>p.sig)).size,3);console.log('ok 25 rows in 3 batch transactions, ledger has 25 rows');
  await E.execute(e,'devnet',one,async()=>'unknown',many,onL);assert.equal(batches,3);assert.equal(led.length,25);console.log('ok re-run sends nothing');
  batches=0;singles=0;const bad=async(items,onSig)=>{batches++;throw new Error('Transaction failed: {"InstructionError":[3,"x"]}');};
  e={idx:2,payouts:rows(5)};await E.execute(e,'devnet',one,async()=>'unknown',bad,onL);assert.equal(batches,1);assert.equal(singles,5);assert(e.payouts.every(p=>p.status==='sent'));console.log('ok failed batch falls back to single sends');
  batches=0;const timeout=async(items,onSig)=>{onSig('T1',9);throw new Error('Confirmation timeout: T1');};
  e={idx:3,payouts:rows(4)};await E.execute(e,'devnet',one,async()=>'unknown',timeout,onL);assert(e.payouts.every(p=>p.status==='unconfirmed'&&p.sig==='T1'));console.log('ok timed out batch is held, not resent');
  singles=0;await E.execute(e,'devnet',one,async s=>s==='T1'?'landed':'unknown',many,onL);assert(e.payouts.every(p=>p.status==='sent'));assert.equal(singles,0);console.log('ok held batch confirmed later marks all rows sent');
  console.log('PASS batch tests');})().catch(x=>{console.error(x);process.exit(1);});
