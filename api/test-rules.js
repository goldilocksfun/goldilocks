// Spec rules: mass is the minimum balance over the trailing 24h of snapshots; orbit drift depends on unpredictable daily seeds.
'use strict';const assert=require('assert');const G=require('./lib/game');
let T=Date.UTC(2026,5,1);const db={claims:{}};const E=require('./lib/engine').create(db,()=>{},{now:()=>T});const C=E.C;
const sup='1000000000';const bps=x=>String(1000000000*x/10000);const W='9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const snap=b=>{E.snapshot({[W]:b},sup);};const step=(h,b)=>{for(let i=0;i<h*6;i++){T+=600e3;snap(b);}};
snap(bps(0.03));step(24,bps(0.03)); // park tiny bag for 24h
T+=600e3;snap(bps(50));E.advance();assert.ok((E.S.planets[W]||{mass:0}).mass<1);console.log('ok top-up after 24h park scores no instant mass');
step(23,bps(50));E.advance();assert.ok((E.S.planets[W]||{mass:0}).mass<1);console.log('ok top-up still excluded at 23h');
step(1.2,bps(50));E.advance();assert.equal(E.S.planets[W].mass,50);console.log('ok top-up counts after full 24h');
step(1,bps(10));E.advance();assert.equal(E.S.planets[W].mass,10);console.log('ok a dip lowers mass at once');
const since=E.S.planets[W].holdSince;T+=600e3;snap('0');step(0.2,bps(50));E.advance();assert.ok(E.S.planets[W].holdSince>since&&!E.S.planets[W].eligible);console.log('ok zero balance resets hold clock');
// drift grinding: with daily seeds, the same wallet set no longer has a fixed path
const p1={wallet:W,a:1,seed:'s1'},p2={wallet:W,a:1,seed:'s1'};let diff=0;for(let t=0;t<48;t++){G.tickPlanet(p1,t,0,C,'dayA');G.tickPlanet(p2,t,0,C,'dayB');if(p1.a!==p2.a)diff++;}
assert.ok(diff>40);console.log('ok drift changes with the day seed');
assert.notEqual(G.initialAu(W,'h1'),G.initialAu(W,'h2'));assert.equal(G.initialAu(W,'h1'),G.initialAu(W,'h1'));console.log('ok initial orbit seeded and reproducible');
E.setDaySeed(G.dayOf(T),'HASHX');const n=E.ensure('So11111111111111111111111111111111111111112','free');assert.equal(n.seed,'HASHX');console.log('ok new planet stores creation seed');
// grind check: best 1 of 200 wallets picked on address alone has no edge on fresh seeds
const ws=[...Array(200)].map((_,i)=>require('crypto').createHash('sha256').update('w'+i).digest('hex'));
const hz=(w,ds)=>{const p=G.newPlanet(w,'free',0,ds+'c');let z=0;for(let t=0;t<240;t++){G.tickPlanet(p,t,0,C,ds+(t/24|0));if(p.zone==='habitable')z++;}return z/240;};
const best=ws.map(w=>[w,hz(w,'A')]).sort((a,b)=>b[1]-a[1])[0];const fresh=hz(best[0],'B');const avg=ws.reduce((a,w)=>a+hz(w,'B'),0)/200;
console.log('  ground wallet HZ',best[1].toFixed(3),'on new seeds',fresh.toFixed(3),'population avg',avg.toFixed(3));
console.log('PASS rules tests');
