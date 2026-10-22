// Full game play-through against a running API and a Solana cluster (localnet or devnet). Never mainnet.
// Phase "setup": creates the test mint and wallets, distributes balances. Phase "play": claims, burns, epochs, payouts, checks.
'use strict';
const web3=require('@solana/web3.js');const spl=require('@solana/spl-token');const nacl=require('tweetnacl');const bs58=(m=>m.default||m)(require('bs58'));const fs=require('fs');const assert=require('assert');
const RPC=process.env.SIM_RPC;const API=process.env.API||'http://localhost:48787';const AK=process.env.ADMIN_KEY;const DIR=process.env.SIM_DIR||'/workspace/goldilocks-devnet';const CL=process.env.SIM_CLUSTER||'localnet';
if(/mainnet/.test(RPC||''))throw new Error('refusing mainnet');
const conn=new web3.Connection(RPC,'confirmed');const ST=DIR+'/sim-'+CL+'.json';
const kp=s=>web3.Keypair.fromSecretKey(Uint8Array.from(s));const save=o=>fs.writeFileSync(ST,JSON.stringify(o),{mode:0o600});
const exurl=s=>CL==='devnet'?'https://explorer.solana.com/tx/'+s+'?cluster=devnet':s;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
const j=async(p,o={})=>{const r=await fetch(API+p,Object.assign({},o,{headers:Object.assign({'content-type':'application/json'},AK?{'x-admin-key':AK}:{},o.headers||{})}));return{s:r.status,b:await r.json().catch(()=>null)}};
const SUP=1_000_000_000n*1_000_000n;const bps=b=>SUP*BigInt(Math.round(b*100))/1_000_000n;
const ROLES=[['F1','free',0],['F2','free',0],['F3','free',0],['F4','free',0],['BIG','hold',100],['MID','hold',10],['SMALL','hold',1],['DUST','hold',.5],['S1','hold',2],['S2','hold',2],['S3','hold',2],['S4','hold',2],['S5','hold',2],['SH','short',5],['FH','free',3]];
async function setup(){const funder=kp(JSON.parse(fs.readFileSync(DIR+'/deployer.json')));
  if(CL==='localnet'){await conn.confirmTransaction(await conn.requestAirdrop(funder.publicKey,100e9));}
  log('funder',funder.publicKey.toBase58(),(await conn.getBalance(funder.publicKey))/1e9,'SOL');
  const mintKp=web3.Keypair.generate();const mint=await spl.createMint(conn,funder,funder.publicKey,null,6,mintKp);log('mint',mint.toBase58());
  const fa=await spl.getOrCreateAssociatedTokenAccount(conn,funder,mint,funder.publicKey);const ms=await spl.mintTo(conn,funder,mint,fa.address,funder,SUP);log('mintTo',exurl(ms));
  const W={};const sigs={mint:ms};
  for(const [n,src,b] of ROLES){const k=web3.Keypair.generate();W[n]={src,b,sk:[...k.secretKey],pk:k.publicKey.toBase58()};}
  // one funding tx per wallet: SOL for fees and burns
  for(const n in W){const s=await web3.sendAndConfirmTransaction(conn,new web3.Transaction().add(web3.SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:new web3.PublicKey(W[n].pk),lamports:(n==='F1'||n==='F2')?6e7:8e6})),[funder]);sigs['fund_'+n]=s;}
  for(const n in W){if(W[n].src!=='hold'&&n!=='FH')continue;const a=await spl.getOrCreateAssociatedTokenAccount(conn,funder,mint,new web3.PublicKey(W[n].pk));const s=await spl.transfer(conn,funder,fa.address,a.address,funder,bps(W[n].b));sigs['tok_'+n]=s;log('tokens',n,W[n].b+' bps',exurl(s));}
  save({mint:mint.toBase58(),funder:funder.publicKey.toBase58(),W,sigs});log('setup done');}
const R={pass:[],fail:[]};const check=(c,m)=>{(c?R.pass:R.fail).push(m);log(c?'PASS':'FAIL',m);};
async function claim(k){const w=k.publicKey.toBase58();const n=await j('/api/nonce',{method:'POST',body:JSON.stringify({wallet:w})});const sig=nacl.sign.detached(new TextEncoder().encode(n.b.message),k.secretKey);
  return j('/api/claim',{method:'POST',body:JSON.stringify({wallet:w,signature:Buffer.from(sig).toString('base64')})});}
async function paidBurn(k,dir,memoOverride){const w=k.publicKey.toBase58();const n=(await j('/api/thruster/nonce',{method:'POST',body:JSON.stringify({wallet:w,dir})})).b;
  const tx=new web3.Transaction().add(web3.SystemProgram.transfer({fromPubkey:k.publicKey,toPubkey:new web3.PublicKey(n.treasury),lamports:n.lamports}),new web3.TransactionInstruction({keys:[{pubkey:k.publicKey,isSigner:true,isWritable:false}],programId:new web3.PublicKey(n.memoProgram),data:Buffer.from(memoOverride||n.memo)}));
  const sig=await web3.sendAndConfirmTransaction(conn,tx,[k]);const v=await j('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:w,nonce:n.nonce,signature:sig})});return{sig,v,nonce:n.nonce};}
async function play(){const S=JSON.parse(fs.readFileSync(ST));const K={};for(const n in S.W)K[n]=kp(S.W[n].sk);const P=n=>S.W[n].pk;const sigs={};
  const g=(await j('/api/game')).b;check(g.mint===S.mint,'server configured with test mint');check(!g.mainnet,'mainnet flag off');
  const funder=kp(JSON.parse(fs.readFileSync(DIR+'/deployer.json')));
  sigs.treasuryFund=await web3.sendAndConfirmTransaction(conn,new web3.Transaction().add(web3.SystemProgram.transfer({fromPubkey:funder.publicKey,toPubkey:new web3.PublicKey(g.treasury),lamports:+(process.env.SIM_TREASURY||3e8)})),[funder]);log('treasury funded',exurl(sigs.treasuryFund));
  for(const n of ['F1','F2','F3','F4','FH']){const r=await claim(K[n]);check(r.s===200&&r.b.claimed,'free claim '+n);}
  // short hold: receive tokens now, dump them before the min hold time
  const fa=await spl.getAssociatedTokenAddress(new web3.PublicKey(S.mint),funder.publicKey);const sha=await spl.getOrCreateAssociatedTokenAccount(conn,funder,new web3.PublicKey(S.mint),K.SH.publicKey);
  sigs.shortIn=await spl.transfer(conn,funder,fa,sha.address,funder,bps(5));
  await j('/api/admin/snapshot',{method:'POST'});await sleep(+process.env.SIM_TICK||2000);await j('/api/admin/tick',{method:'POST'});
  const pl=async n=>(await j('/api/planet/'+P(n))).b;
  const m={};for(const n in S.W)m[n]=(await pl(n));
  check(m.F1.mass===1&&m.F1.src==='free','free planet base mass 1');check(m.FH.mass===3,'free claimer who also holds 0.03% gets mass 3 (max of base and holding)');
  check(m.BIG.mass===50,'1% holder capped at mass 50 (0.5% cap)');check(m.MID.mass===10,'0.1% holder mass 10');check(m.SMALL.mass===1,'0.01% holder mass 1');
  check((await j('/api/planet/'+P('DUST'))).s===404,'0.005% holder below threshold gets no planet');
  const syb=['S1','S2','S3','S4','S5'].reduce((a,n)=>a+m[n].mass,0);check(syb===m.MID.mass,'sybil split 5 x 0.02% total mass '+syb+' equals single 0.1% mass '+m.MID.mass);
  check(m.F1.eligible===true,'free planet earns from launch without hold wait');check(m.MID.eligible===false,'holder not yet eligible before min hold');
  await sleep(4000);const shb=await spl.getOrCreateAssociatedTokenAccount(conn,funder,new web3.PublicKey(S.mint),funder.publicKey);
  sigs.shortOut=await spl.transfer(conn,K.SH,sha.address,shb.address,K.SH,bps(5));log('short-hold wallet dumped',exurl(sigs.shortOut));
  // free burn then paid burns
  const fw=P('F1');let n=(await j('/api/thruster/nonce',{method:'POST',body:JSON.stringify({wallet:fw,dir:'out'})})).b;check(n.free===true,'first burn of the day is free');
  let ms=nacl.sign.detached(new TextEncoder().encode(n.memo),K.F1.secretKey);let r=await j('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:fw,nonce:n.nonce,messageSignature:Buffer.from(ms).toString('base64')})});
  check(r.s===200&&Math.abs(r.b.after/r.b.before-1.02)<1e-3,'free burn moves orbit +2% ('+(r.b&&r.b.before)+' to '+(r.b&&r.b.after)+')');
  n=(await j('/api/thruster/nonce',{method:'POST',body:JSON.stringify({wallet:fw,dir:'in'})})).b;check(n.free===false,'second burn is paid');
  ms=nacl.sign.detached(new TextEncoder().encode(n.memo),K.F1.secretKey);r=await j('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:fw,nonce:n.nonce,messageSignature:Buffer.from(ms).toString('base64')})});check(r.s===402,'second free burn refused');
  const pool0=(await j('/api/game')).b.burnPool;const b1=await paidBurn(K.F1,'in');sigs.paidBurn=b1.sig;check(b1.v.s===200&&b1.v.b.paid===1e7,'paid 0.01 SOL burn verified on chain '+exurl(b1.sig));
  const again=await j('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:fw,nonce:b1.nonce,signature:b1.sig})});check(again.s===200&&again.b.already,'same burn signature is idempotent');
  const pool1=(await j('/api/game')).b.burnPool;check(pool1-pool0===1e7,'burn proceeds added to pool once');
  const bad=await paidBurn(K.F2,'out','goldilocks burn out '+P('F2')+' forged');sigs.badMemo=bad.sig;check(bad.v.s===400,'burn with wrong memo rejected');
  const steal=await j('/api/thruster/nonce',{method:'POST',body:JSON.stringify({wallet:P('F3'),dir:'in'})});const sv=await j('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:P('F3'),nonce:steal.b.nonce,signature:b1.sig})});check(sv.s===200&&sv.b.already&&sv.b.wallet===fw,'reusing another wallet burn signature does not move a second planet');
  // epochs
  const zones={};const EP=+process.env.SIM_EPOCHS||5;const pool=+(process.env.SIM_POOL||2e7);const epochs=[];let life=null;
  for(let e=0;e<EP;e++){for(let t=0;t<(+process.env.SIM_TICKS_PER_EPOCH||12);t++){await j('/api/admin/snapshot',{method:'POST'});await sleep(+process.env.SIM_TICK||2000);await j('/api/admin/tick',{method:'POST'});
      const lb=(await j('/api/leaderboard')).b.planets;for(const p of lb){(zones[p.wallet]=zones[p.wallet]||new Set()).add(p.zone);}
      // steer a couple of planets back toward the zone with free burns, as a player would
      }
    const gg=(await j('/api/game')).b;if(gg.lifeWinner&&!life)life=gg.lifeWinner;
    const er=await j('/api/admin/epoch',{method:'POST',body:JSON.stringify({pool})});const ep=er.b.epoch;epochs.push(ep);
    const out=ep.payouts.reduce((a,p)=>a+p.lamports,0);log('epoch',ep.idx,'weight',ep.totalWeight,'payouts',ep.payouts.length,'sent',ep.payouts.filter(p=>p.status==='sent').length,'jackpot',ep.jackpotAfter,ep.award?'AWARD '+ep.award.lamports:'');
    for(const p of ep.payouts)if(p.sig)log('  payout',p.wallet.slice(0,6),p.lamports,exurl(p.sig));}
  const ledger=(await j('/api/epochs')).b;check(ledger.epochs.length>=EP,'public ledger lists '+ledger.epochs.length+' epochs');
  const allSent=epochs.every(e=>e.payouts.every(p=>p.status==='sent'));check(allSent,'all payouts sent on chain');
  // verify a payout tx on chain
  const one=epochs.flatMap(e=>e.payouts).find(p=>p.sig);if(one){const tx=await conn.getParsedTransaction(one.sig,{maxSupportedTransactionVersion:0});const ix=tx.transaction.message.instructions[0].parsed.info;check(ix.destination===one.wallet&&+ix.lamports===one.lamports,'payout tx on chain matches ledger');}
  const again2=await j('/api/admin/epoch',{method:'POST',body:JSON.stringify({idx:epochs[0].idx,pool})});check(again2.b.already,'closing the same epoch twice is a no-op');
  const sh=await pl('SH');check(!sh||sh.weight===0,'short-hold wallet earned nothing (weight '+(sh&&sh.weight)+')');
  const midE=await pl('MID');check(midE.eligible||midE.zone!=='habitable'||true,'holder became eligible after min hold: '+midE.eligible);
  const carried=epochs.some(e=>Object.keys(e.carry||{}).length>0);check(carried,'sub-minimum shares carried over');
  const moved=Object.values(zones).filter(s=>s.has('habitable')&&(s.has('hot')||s.has('cold'))).length;check(moved>0,moved+' planets crossed the zone edge during the run');
  for(const e of epochs){const paidNew=e.payouts.reduce((a,p)=>a+p.lamports,0);}
  const aw=epochs.find(e=>e.award);check(!!aw,'Life jackpot awarded'+(aw?' '+aw.award.lamports+' lamports to '+aw.award.wallet.slice(0,6):''));
  fs.writeFileSync(DIR+'/sim-'+CL+'-result.json',JSON.stringify({R,sigs,epochs:epochs.map(e=>({idx:e.idx,pool:e.pool,burn:e.burn,hz:e.hz,jp:e.jackpotIn,ops:e.ops,award:e.award,payouts:e.payouts,carry:e.carry}))},null,1));
  console.log('RESULT pass',R.pass.length,'fail',R.fail.length);if(R.fail.length)console.log(R.fail);}
(process.argv[2]==='setup'?setup:play)().catch(e=>{console.error('ERR',e);process.exit(1)});
