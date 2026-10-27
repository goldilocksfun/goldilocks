// Devnet end-to-end test of the live $LAUNCH payout path with real process crashes. Devnet only; refuses any other cluster.
// Needs LAUNCH_MINT set to a devnet test mint, and the treasury funded with that token and some devnet SOL.
// usage: node dev-live-crash.js <dir> plan|run [crashAt=signed|sent] [batchNo]
'use strict';
if((process.env.CLUSTER||'devnet')!=='devnet')throw new Error('devnet only');
const fs=require('fs'),path=require('path');const chain=require('./lib/chain');const P=require('./lib/payout');
const dir=process.argv[2],cmd=process.argv[3],crashAt=process.argv[4],crashBatch=+process.argv[5]||0;
const F=path.join(dir,'state.json');const db=fs.existsSync(F)?JSON.parse(fs.readFileSync(F)):{claims:{}};
const save=()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(db));fs.renameSync(F+'.tmp',F);};
const E=require('./lib/engine').create(db,save);const treasury=chain.loadOrCreateKeypair(path.join(dir,'treasury.json'));
(async()=>{
  if(cmd==='plan'){const rows=[...Array(25).keys()].map(()=>({wallet:chain.web3.Keypair.generate().publicKey.toBase58(),amount:2e6+Math.floor(Math.random()*1e6),status:'pending',sig:null}));
    db.game.epochs.push({idx:1,payouts:rows});save();console.log('treasury',treasury.publicKey.toBase58(),'rows',rows.length,'total',rows.reduce((a,r)=>a+r.amount,0));return;}
  const e=db.game.epochs[0];let batch=0;
  const hook=stage=>{if(stage==='signed')batch++;if(crashAt===stage&&batch===crashBatch){console.log('CRASH at',stage,'of batch',batch);process.exit(3);}};
  await P.run(e,{E,S:E.S,save,mode:'live',chain,treasury,exclude:new Set(),ledger:null,hook,cfg:P.config({})});
  const st={};for(const p of e.payouts)st[p.status]=(st[p.status]||0)+1;console.log('statuses',JSON.stringify(st),'held',e.held||null);
  if(cmd==='verify'){let bad=0;for(const p of e.payouts){const b=await chain.tokenBalance(p.wallet);if(b!==p.amount){bad++;console.log('MISMATCH',p.wallet,b,p.amount);}}
    console.log(bad?'FAIL':'PASS','on-chain balances',e.payouts.length-bad,'of',e.payouts.length,'exact');}
})().catch(x=>{console.error('ERR',x.message);process.exit(1);});
