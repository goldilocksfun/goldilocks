// On-chain fee intake: counting rules, idempotence and RPC failure safety (no network).
'use strict';const assert=require('assert');const F=require('./lib/fees');
const T='Treasury1111111111111111111111111111111111',U='User11111111111111111111111111111111111111',TEAM='Team11111111111111111111111111111111111111';
// fake chain: list of txs, newest last
const chainTxs=[];let fail=false;
const tx=(sig,payer,pre,post,{fee=5000,logs=[],err=null}={})=>chainTxs.push({sig,tx:{slot:chainTxs.length+1,blockTime:1e9+chainTxs.length,
  transaction:{message:{accountKeys:payer===T?[{pubkey:T},{pubkey:U}]:[{pubkey:payer},{pubkey:T}]}},meta:{err,fee,logMessages:logs,preBalances:payer===T?[pre,0]:[1e9,pre],postBalances:payer===T?[post,0]:[1e9,post]}}});
const rpc={signatures:async(addr,{until})=>{if(fail)throw new Error('rpc down');const out=[];for(let i=chainTxs.length-1;i>=0;i--){if(chainTxs[i].sig===until)break;out.push({signature:chainTxs[i].sig,err:chainTxs[i].tx.meta.err});}return out;},
  transaction:async s=>{if(fail)throw new Error('rpc down');return chainTxs.find(x=>x.sig===s).tx;}};
(async()=>{const S={};
  tx('old',U,0,5e9);                                   // history before start: never counted
  let r=await F.scan(S,rpc,{treasury:T});assert(r.initialized);assert.equal(S.fees.pending,0);console.log('ok history before start is not counted');
  tx('fee1',U,5e9,5.3e9);                              // creator fee deposit 0.3 SOL
  tx('claim',T,5.3e9,5.3e9+2e8-5000);                  // treasury claims 0.2 SOL creator fees, pays 5000 fee itself
  tx('payout',T,5.5e9,5.4e9-5000);                     // our payout: outflow
  tx('burn',U,5.4e9,5.41e9,{logs:['Program log: Memo (len 40): "goldilocks burn in Abc 123"']}); // burn: already in burn pool
  tx('team',TEAM,5.41e9,6.41e9);                       // team top-up, ignored by config
  tx('bad',U,6.41e9,6.41e9,{err:{x:1}});               // failed tx
  r=await F.scan(S,rpc,{treasury:T,ignoreFrom:new Set([TEAM])});
  assert.equal(S.fees.pending,3e8+2e8);assert.deepEqual(S.fees.pendingTxs.map(x=>x.sig),['fee1','claim']);console.log('ok deposits and treasury-signed claims counted, payouts/burns/team/failed skipped');
  r=await F.scan(S,rpc,{treasury:T,ignoreFrom:new Set([TEAM])});assert.equal(S.fees.pending,5e8);console.log('ok rescan does not double count');
  S.fees.cursor='payout';r=await F.scan(S,rpc,{treasury:T,ignoreFrom:new Set([TEAM])});assert.equal(S.fees.pending,5e8);console.log('ok rewound cursor still does not double count (seen set)');
  tx('fee2',U,6.41e9,6.51e9);fail=true;const before=JSON.stringify(S);
  await assert.rejects(F.scan(S,rpc,{treasury:T}));assert.equal(JSON.stringify(S),before);console.log('ok RPC failure throws and leaves state untouched');
  fail=false;const t=F.take(S);assert.equal(t.lamports,5e8);assert.equal(S.fees.pending,0);
  await F.scan(S,rpc,{treasury:T});assert.equal(S.fees.pending,1e8);console.log('ok take() hands pending to one epoch, later deposits go to the next');
  console.log('PASS 6 fee tests');})().catch(e=>{console.error(e);process.exit(1);});
