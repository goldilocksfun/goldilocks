// Stateful game engine: planets, snapshots, ticks, burns, epochs, payouts. State lives in db.game and persists via the server store.
'use strict';
const G=require('./game');
function create(db,save,opts={}){
  const C=G.config();const now=opts.now||(()=>Date.now());
  const S=db.game=db.game||{planets:{},snaps:{},tick:-1,burnSigs:{},burnPool:0,carry:{},jackpot:0,epochs:[],lifeWinner:null,lifeAwarded:false,freeBurns:{},supply:null,lastSnap:null};
  S.win=S.win||{};S.lifeSet=S.lifeSet||{};if(S.season==null)S.season=G.seasonOf(now());S.seeds=S.seeds||{};
  const curSeed=()=>S.seeds[G.dayOf(now())]||null;
  const ensure=(w,src,at)=>{let p=S.planets[w];if(!p){p=S.planets[w]=G.newPlanet(w,src,now(),curSeed());if(src==='free')p.freeSince=Math.max(at||now(),C.LAUNCH_AT||0);}else if(src==='free'&&p.src!=='free'){p.src='free';p.freeSince=Math.max(at||now(),C.LAUNCH_AT||0);}return p;};
  const launched=()=>!C.LAUNCH_AT||now()>=C.LAUNCH_AT;
  // Free claimed planets.
  // Free planets appear only after launch; their 24h wait starts at max(launch, approval).
  function syncClaims(){if(!launched())return;for(const w in db.claims){const st=db.claims[w].status;if(!st||st==='final')ensure(w,'free',db.claims[w].finalAt||now());}}
  // Holder snapshot: balances map {owner:raw}. Mass uses the MIN balance over the trailing MIN_HOLD_MS (24h) of snapshots,
  // kept as a monotonic queue per wallet. A top-up therefore counts only once it has been held for the full window.
  // since = first snapshot of the current unbroken non-zero streak; a zero balance resets it.
  const minBal=w=>{const x=S.win[w];return x&&x.q.length?x.q[0][1]:'0';};
  function snapshot(bal,supply){const t=now();S.supply=String(supply);S.lastSnap=t;const W=C.MIN_HOLD_MS;
    for(const w of new Set([...Object.keys(bal),...Object.keys(S.win)])){const b=BigInt(bal[w]||0);
      if(b<=0n){delete S.win[w];continue;}const x=S.win[w]||(S.win[w]={since:(S.planets[w]&&S.planets[w].src!=='free'&&S.planets[w].holdSince)||t,q:[]});
      while(x.q.length&&BigInt(x.q[x.q.length-1][1])>=b)x.q.pop();x.q.push([t,String(b)]);
      while(x.q.length>1&&x.q[0][0]<t-W)x.q.shift();}
    for(const w in S.win){if(G.massFrom(minBal(w),supply,C)>0){const p=ensure(w,'hold');p.holdSince=S.win[w].since;}}
    for(const w in S.planets){const p=S.planets[w];if(!S.win[w]&&p.src!=='free')p.holdSince=null;}
    S.lastBal=bal;
    for(const w in S.planets){const p=S.planets[w];const held=G.massFrom(minBal(w),supply,C);p.mass=Math.max(p.src==='free'?C.FREE_MASS:0,held);if(p.lastTick<0){p.d=+G.distance(p,Math.floor(t/C.TICK_MS),C).toFixed(5);p.zone=G.zoneOf(p.d,C);}}
    save();}
  function setDaySeed(day,hash){if(!S.seeds[day]){S.seeds[day]=String(hash);const keep=Object.keys(S.seeds).map(Number).sort((a,b)=>b-a).slice(400);for(const k of keep)delete S.seeds[k];save();}}
  // Advance accounting to the current tick (catches up missed ticks deterministically).
  function advance(){syncClaims();const target=Math.floor(now()/C.TICK_MS);if(S.tick<0)S.tick=target-1;let n=0;
    while(S.tick<target&&n<500){S.tick++;n++;const t=now();
      const ds=S.seeds[G.dayOf(S.tick*C.TICK_MS)]||null;
      for(const w in S.planets){const p=S.planets[w];const held=S.supply?G.massFrom(minBal(w),S.supply,C):0;
        p.mass=Math.max(p.src==='free'?C.FREE_MASS:0,held);if(p.src!=='free')p.holdSince=S.win[w]?S.win[w].since:null;
        G.tickPlanet(p,S.tick,t,C,ds);
        if(p.stage===C.STAGES[C.STAGES.length-1].name&&p.eligible){if(!S.lifeWinner){S.lifeWinner=w;S.lifeAt=t;}S.lifeSet[w]=Math.max(S.lifeSet[w]||0,p.mass);}}
    }if(n)save();return n;}
  function recordBal(bal){S.lastBal=bal;}
  function canFreeBurn(w){const day=Math.floor((now()+8*3600e3)/86400e3);return (S.freeBurns[w]||-1)!==day&&C.FREE_BURNS_PER_DAY>0;}
  function applyBurn(w,dir,{sig,paid}){const p=S.planets[w];if(!p)return{error:'No planet for this wallet.'};
    if(sig){if(S.burnSigs[sig])return Object.assign({already:true},S.burnSigs[sig]);S.burnPool+=paid;}
    else{if(!canFreeBurn(w))return{error:'Free burn already used today.'};S.freeBurns[w]=Math.floor((now()+8*3600e3)/86400e3);}
    const before=p.a;G.burn(p,dir,C);const r={wallet:w,dir,sig:sig||null,paid:paid||0,before:+before.toFixed(5),after:+p.a.toFixed(5),at:now()};p.burns.push(r);if(p.burns.length>50)p.burns.shift();if(sig)S.burnSigs[sig]=r;save();return r;}
  // Close an epoch: weights accumulated since last close become shares. Idempotent per epoch index.
  function closeEpoch(idx,poolLamports){if(S.epochs.some(e=>e.idx===idx))return{already:true,epoch:S.epochs.find(e=>e.idx===idx)};
    const weights={};for(const w in S.planets){const p=S.planets[w];const d=p.weight-(p.paidWeight||0);if(d>0)weights[w]=d;}
    // Season rollover: the first close in a new quarter pays the Life jackpot to the previous season's Life planets, then evolution resets.
    const cur=G.seasonOf(now());const roll=cur!==S.season;const lifeMass=roll&&Object.keys(S.lifeSet).length?S.lifeSet:null;
    const sweep=C.SWEEP_EVERY_EPOCHS>0&&idx%C.SWEEP_EVERY_EPOCHS===0;
    const r=G.computeEpoch({weights,poolLamports,burnLamports:S.burnPool,carry:S.carry,jackpotBefore:S.jackpot,lifeMass,sweep},C);
    for(const w in weights)S.planets[w].paidWeight=S.planets[w].weight;S.carry=r.carry;S.jackpot=r.jackpot;S.burnPool=0;
    if(r.award)r.award.season=S.season;
    if(roll){S.seasons=(S.seasons||[]).concat([{season:S.season,lifePlanets:Object.keys(S.lifeSet).length,award:r.award?r.award.lamports:0}]).slice(-20);
      S.season=cur;S.lifeSet={};S.lifeWinner=null;S.lifeAwarded=false;for(const w in S.planets){const p=S.planets[w];p.lifeTicks=0;p.stage=C.STAGES[0].name;}}
    const e={idx,closedAt:now(),pool:r.pool,burn:r.burn,hz:r.hz,jackpotIn:r.jp,ops:r.ops,totalWeight:r.totalWeight,jackpotAfter:r.jackpot,award:r.award,sweep,season:S.season,weights,shares:r.shares,
      payouts:Object.entries(r.pay).map(([wallet,lamports])=>({wallet,lamports,status:'pending',sig:null})),carry:r.carry};
    S.epochs.push(e);for(const x of S.epochs.slice(0,-14)){delete x.weights;delete x.shares;} // keep state bounded; payouts stay as the ledger
    save();return{epoch:e};}
  // Execute pending payouts. mode dry: mark dry-run. mode devnet: real transfers via send(wallet,lamports). Retries only unsent rows.
  // Execute pending payouts. mode dry: mark dry-run. mode devnet: real transfers via send(wallet,lamports,onSig).
  // The signature is stored before sending. A row with a stored signature is resent only after state(sig) proves the old one can never land.
  const running=new Set();
  // sendMany(items,onSig) sends up to BATCH rows in one atomic transaction; a failed batch falls back to one row per transaction.
  // onLedger(row,epoch) is called once per row when it is confirmed sent (append-only ledger outside the state file).
  async function execute(e,mode,send,state,sendMany,onLedger){if(running.has(e.idx))return e;running.add(e.idx);const B=Math.max(1,C.PAYOUT_BATCH||1);
    const done=p=>{p.status='sent';delete p.error;if(onLedger)try{onLedger(p,e);}catch(x){}};
    try{if(mode==='dry'){for(const p of e.payouts)if(p.status!=='sent')p.status='dry-run';save();return e;}
      // 1. resolve rows that already carry a signature
      const bySig={};for(const p of e.payouts)if(p.sig&&p.status!=='sent')(bySig[p.sig]=bySig[p.sig]||[]).push(p);
      for(const [sig,rows] of Object.entries(bySig)){let st='unknown';try{st=state?await state(sig,rows[0].lvh):'unknown';}catch(x){}
        if(st==='landed')rows.forEach(done);else if(st==='unknown')rows.forEach(p=>p.status='unconfirmed');else rows.forEach(p=>{p.sig=null;p.lvh=null;p.batch=null;});save();}
      // 2. send the rest in batches
      const todo=e.payouts.filter(p=>p.status!=='sent'&&!p.sig);
      for(let k=0;k<todo.length;k+=B){const grp=todo.slice(k,k+B);
        const mark=(rows,b)=>(sig,lvh)=>{rows.forEach(p=>{p.sig=sig;p.lvh=lvh;p.batch=b;p.status='sending';});save();};
        if(grp.length>1&&sendMany){try{await sendMany(grp.map(p=>({to:p.wallet,lamports:p.lamports})),mark(grp,grp.length));grp.forEach(done);save();continue;}
          catch(x){let st='unknown';if(grp[0].sig){try{st=state?await state(grp[0].sig,grp[0].lvh):'unknown';}catch(y){}}
            if(st==='landed'){grp.forEach(done);save();continue;}if(st==='unknown'&&grp[0].sig&&!/failed|too large|0x1|insufficient/i.test(String(x.message))){grp.forEach(p=>{p.status='unconfirmed';p.error=String(x.message||x).slice(0,160);});save();continue;}
            grp.forEach(p=>{p.sig=null;p.lvh=null;p.batch=null;});}}
        for(const p of grp){try{await send(p.wallet,p.lamports,mark([p],1));done(p);}catch(x){p.status='failed';p.error=String(x.message||x).slice(0,160);}save();}}}
    finally{running.delete(e.idx);}return e;}
  const pub=p=>p&&{wallet:p.wallet,src:p.src,au:+p.a.toFixed(5),distance:p.d,zone:p.zone,mass:p.mass,eligible:!!p.eligible,holdSince:p.holdSince,zoneHours:+(p.zoneTicks*G.th(C)).toFixed(2),evolutionHours:+(p.lifeTicks*G.th(C)).toFixed(2),stage:p.stage,weight:+p.weight.toFixed(4),burns:p.burns.slice(-10),freeBurnAvailable:canFreeBurn(p.wallet)};
  function earnings(w){const rows=[];let total=0;for(const e of S.epochs)for(const p of e.payouts)if(p.wallet===w){rows.push({epoch:e.idx,lamports:p.lamports,status:p.status,sig:p.sig,at:e.closedAt});if(p.status==='sent'||p.status==='dry-run')total+=p.lamports;}
    const p=S.planets[w];const pendingWeight=p?p.weight-(p.paidWeight||0):0;const tw=Object.values(S.planets).reduce((a,q)=>a+(q.weight-(q.paidWeight||0)),0);
    return{wallet:w,paidLamports:total,carryLamports:S.carry[w]||0,pendingWeight:+pendingWeight.toFixed(4),pendingShare:tw?+(pendingWeight/tw).toFixed(6):0,history:rows.reverse()};}
  function leaderboard(){return Object.values(S.planets).map(pub).sort((a,b)=>b.weight-a.weight||b.mass-a.mass).slice(0,100);}
  function forceSeasonEnd(){S.season=-1;save();}
  return{C,S,forceSeasonEnd,launched,setDaySeed,minBal,snapshot,recordBal,advance,applyBurn,canFreeBurn,closeEpoch,execute,pub,earnings,leaderboard,ensure};}
module.exports={create};
