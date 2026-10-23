// Unit tests: orbit sim determinism and drift, mass curve and sybil neutrality, payout math, carryover, jackpot, burn and epoch idempotency.
'use strict';const assert=require('assert');const G=require('./lib/game');const Eng=require('./lib/engine');
const C=G.config();let n=0;const ok=(m)=>{n++;console.log('ok',m);};
const W=['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU','9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM','4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T','2wmVCSfPxGPjrnMMn7rchp4uaeoTqN39mXFC2zhPdri9'];
// determinism
const run=()=>{const p=G.newPlanet(W[0],'free',0);p.mass=1;const tr=[];for(let t=0;t<200;t++){G.tickPlanet(p,t,t*C.TICK_MS,C);tr.push(p.d);}return tr;};
assert.deepStrictEqual(run(),run());ok('sim deterministic');
// initial orbit range, and drift pushes planets out of zone over time without burns
for(const w of W){const a=G.initialAu(w);assert(a>=.82&&a<=1.32);}ok('initial orbit from wallet hash in .82..1.32 AU');
let left=0;for(let i=0;i<40;i++){const w='T'+i+'x'.repeat(40);const p=G.newPlanet(w,'free',0);p.a=1.16;p.mass=1;for(let t=0;t<24*30;t++)G.tickPlanet(p,t,0,C);if(p.zone!=='habitable')left++;}
assert(left>=10,'drift should move many planets out of zone in 30 days, got '+left);ok('drift forces management ('+left+'/40 left HZ in 30 days)');
// burn +-2%
{const p=G.newPlanet(W[1],'free',0);const a=p.a;G.burn(p,'out',C);assert(Math.abs(p.a/a-1.02)<1e-12);G.burn(p,'in',C);assert(Math.abs(p.a/(a*1.02)-.98)<1e-12);ok('thruster step 2%');}
// mass: linear, 0.01% = 1, cap 0.25% = 25, sybil split neutral
const sup='1000000000000000';const bps=b=>String(BigInt(sup)*BigInt(Math.round(b*100))/1000000n);
assert.equal(G.massFrom(bps(1),sup,C),1);assert.equal(G.massFrom(bps(25),sup,C),25);assert.equal(G.massFrom(bps(50),sup,C),25);assert.equal(G.massFrom(bps(200),sup,C),25);assert.equal(G.massFrom(bps(.5),sup,C),0);
assert.equal(G.massFrom(bps(10),sup,C),10*G.massFrom(bps(1),sup,C));ok('linear mass, unit 1 bps, cap 25 bps, sybil split gives equal total mass');
// stages
assert.equal(G.stageOf(0,C),'Barren');assert.equal(G.stageOf(400,C),'Life');ok('evolution stages');
// payout math
{const r=G.computeEpoch({weights:{a:3,b:1},poolLamports:1e9},C);assert.equal(r.hz,7e8);assert.equal(r.jp,2e8);assert.equal(r.ops,1e8);assert.equal(r.shares.a,525e6);assert.equal(r.shares.b,175e6);
 const t=Object.values(r.pay).reduce((x,y)=>x+y,0)+r.jackpot+r.ops+Object.values(r.carry).reduce((x,y)=>x+y,0);assert.equal(t,1e9);ok('lamport conservation');}
{const r=G.computeEpoch({weights:{a:1000,b:1},poolLamports:1e9},C);assert(!r.pay.b&&r.carry.b>0);const r2=G.computeEpoch({weights:{b:1},poolLamports:0,carry:r.carry,burnLamports:3e6},C);assert(r2.pay.b>=C.MIN_PAYOUT_LAMPORTS);ok('min payout carryover then paid');}
{const r=G.computeEpoch({weights:{},poolLamports:1e9,jackpotBefore:5},C);assert.equal(r.jackpot,5+2e8+7e8);ok('empty zone sends HZ pool to jackpot');
 const r2=G.computeEpoch({weights:{a:1},poolLamports:1e9,jackpotBefore:1e8,lifeMass:{a:3,b:1}},C);assert.equal(r2.pay.b,75e6);assert.equal(r2.award.split.a,225e6);assert.equal(r2.jackpot,0);ok('season life jackpot split by mass');
 const r3=G.computeEpoch({weights:{a:1},poolLamports:0,carry:{b:5e5}},C);assert(!r3.pay.b&&r3.carry.b===5e5);const r4=G.computeEpoch({weights:{a:1},poolLamports:0,carry:{b:5e5},sweep:true},C);assert.equal(r4.pay.b,5e5);ok('min payout 0.001 SOL, weekly sweep pays carry');
 assert.equal(C.MIN_PAYOUT_LAMPORTS,1e6);assert.equal(C.MASS_CAP_BPS,25);
 {const f=G.newPlanet(W[2],'free',0);f.freeSince=0;f.mass=1;f.a=1.1;G.tickPlanet(f,1,23*3600e3,C);assert(!f.eligible);G.tickPlanet(f,2,24*3600e3,C);assert(f.eligible);ok('free planets wait 24h');}}
{const r=G.computeEpoch({weights:{a:1},poolLamports:0,burnLamports:1e7},C);assert.equal(r.hz,1e7);ok('burn proceeds go 100% to HZ pool');}
// engine idempotency and min hold
{let t=Date.UTC(2026,5,1);const db={claims:{[W[0]]:{wallet:W[0]}}};const E=Eng.create(db,()=>{},{now:()=>t});
 E.snapshot({[W[1]]:bps(5),[W[2]]:bps(5)},sup);E.advance();
 const b1=E.applyBurn(W[1],'out',{sig:'SIG1',paid:1e7});const b2=E.applyBurn(W[1],'out',{sig:'SIG1',paid:1e7});assert(b2.already);assert.equal(E.S.burnPool,1e7);ok('paid burn idempotent by signature');
 assert(!E.applyBurn(W[0],'in',{}).error);assert(E.applyBurn(W[0],'in',{}).error);ok('one free burn per day');
 for(let i=0;i<30;i++){t+=C.TICK_MS;E.advance();}
 assert(!E.S.planets[W[1]].eligible||t-E.S.planets[W[1]].holdSince>=C.MIN_HOLD_MS);ok('min hold time gates earnings');
 const e1=E.closeEpoch(1,1e9);const e2=E.closeEpoch(1,1e9);assert(e2.already);ok('epoch close idempotent');
 E.execute(e1.epoch,'dry').then(e=>{assert(e.payouts.every(p=>p.status==='dry-run'));ok('dry-run executor');console.log('PASS',n,'tests');});}
