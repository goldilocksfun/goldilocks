// Launch gating for free planets, free 24h wait from max(launch, approval), quarterly Life jackpot split by mass, weekly sweep.
'use strict';const assert=require('assert');
const LAUNCH=Date.UTC(2026,8,20,4);process.env.LAUNCH_AT=String(LAUNCH);process.env.STAGES='Barren:0,Life:2';
const G=require('./lib/game');let T=LAUNCH-5*86400e3;
const A='9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',B='So11111111111111111111111111111111111111112';
const db={claims:{[A]:{status:'final',finalAt:T}}};const E=require('./lib/engine').create(db,()=>{},{now:()=>T});const C=E.C;
E.advance();assert(!E.S.planets[A]);console.log('ok no free planet before launch');
T=LAUNCH+60e3;E.advance();E.S.planets[A].a=1.15;T=LAUNCH+23*3600e3;E.S.planets[A].mass=1;assert(!G.tickPlanet(E.S.planets[A],1,T,C));E.S.planets[A].weight=0;assert.equal(E.S.planets[A].freeSince,LAUNCH);console.log('ok free planet goes live at launch, clock from launch');
db.claims[B]={status:'final',finalAt:LAUNCH+86400e3};T=LAUNCH+86400e3+60e3;E.advance();assert.equal(E.S.planets[B].freeSince,LAUNCH+86400e3);console.log('ok post-launch claim clock from approval');
for(const w of[A,B])E.S.planets[w].a=1.15;E.S.planets[A].lifeTicks=0;
const tickTo=t=>{while(T<t){T+=3600e3;for(const w of[A,B])E.S.planets[w].a=1.15;E.advance();}};
tickTo(LAUNCH+86400e3+20*3600e3);assert(E.S.planets[A].eligible&&!E.S.planets[B].eligible);tickTo(LAUNCH+2*86400e3+3600e3);assert(E.S.planets[B].eligible);console.log('ok free planet earns only after 24h');
tickTo(LAUNCH+3*86400e3);E.S.lifeSet[B]=3;E.S.lifeSet[A]=1;E.S.jackpot=4e8;
const i0=E.closeEpoch(100,0).epoch;assert(!i0.award&&i0.season===E.S.season);
T=Date.UTC(2026,9,2);const e=E.closeEpoch(101,0).epoch;assert.equal(e.award.split[B],3e8);assert.equal(e.award.split[A],1e8);assert.equal(E.S.jackpot,0);assert.deepEqual(E.S.lifeSet,{});assert.equal(E.S.planets[A].lifeTicks,0);console.log('ok quarter rollover splits jackpot by mass and resets evolution');
E.S.carry={[A]:4e5};const s=E.closeEpoch(105,0).epoch;assert(s.sweep&&s.payouts.some(p=>p.wallet===A&&p.amount===4e5));console.log('ok weekly sweep');
console.log('PASS season tests');
assert.equal(G.seasonOf(Date.UTC(2026,8,30,23,59)),2026*4+2);assert.equal(G.seasonOf(Date.UTC(2026,9,1,0,0)),2026*4+3);assert.equal(G.dayOf(Date.UTC(2026,9,1,23,0)),G.dayOf(Date.UTC(2026,9,1,0,0)));assert.equal(new Date(C.EPOCH_ANCHOR_MS).getUTCHours(),12);console.log('ok UTC quarters, UTC days, epoch close 12:00 UTC');
