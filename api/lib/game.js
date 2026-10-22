// Goldilocks game core. Pure and deterministic: same inputs, same outputs. No I/O here.
'use strict';
const crypto=require('crypto');
// Same hash and PRNG as planets.js, so the initial orbit matches what the site renders.
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const num=(k,d)=>process.env[k]!=null&&process.env[k]!==''?+process.env[k]:d;
function config(){return{
  HZ_IN:num('HZ_IN',.95),HZ_OUT:num('HZ_OUT',1.37),
  TICK_MS:num('TICK_MS',3600e3),TICK_HOURS:num('TICK_HOURS',0), // game hours per tick; 0 means TICK_MS in real hours (test runs compress time)                 // accounting tick (hourly)
  DRIFT_MAX:num('DRIFT_MAX',.0015),               // max secular drift per tick, fraction of semi-major axis
  ECC_MIN:num('ECC_MIN',.01),ECC_MAX:num('ECC_MAX',.06),ECC_PERIOD_TICKS:num('ECC_PERIOD_TICKS',72),
  THRUST_STEP:num('THRUST_STEP',.02),THRUST_LAMPORTS:num('THRUST_LAMPORTS',1e7),FREE_BURNS_PER_DAY:num('FREE_BURNS_PER_DAY',1),
  MASS_UNIT_BPS:num('MASS_UNIT_BPS',1),          // 0.01% of supply = 1 mass
  MASS_CAP_BPS:num('MASS_CAP_BPS',50),           // 0.5% of supply cap = 50 mass
  MASS_CURVE:process.env.MASS_CURVE||'linear',   // linear | log
  FREE_MASS:num('FREE_MASS',1),
  MIN_HOLD_MS:num('MIN_HOLD_MS',24*3600e3),
  STAGES:(process.env.STAGES||'Barren:0,Prebiotic:12,Microbial:48,Multicellular:120,Complex:240,Life:400').split(',').map(x=>{const [n,h]=x.split(':');return{name:n,hours:+h}}),
  SPLIT_HZ:num('SPLIT_HZ',.7),SPLIT_JACKPOT:num('SPLIT_JACKPOT',.2),SPLIT_OPS:num('SPLIT_OPS',.1),
  MIN_PAYOUT_LAMPORTS:num('MIN_PAYOUT_LAMPORTS',2e6),
  EPOCH_MS:num('EPOCH_MS',24*3600e3),
  EPOCH_ANCHOR_MS:num('EPOCH_ANCHOR_MS',Date.UTC(2026,0,1,12,0,0)), // 20:00 Asia/Taipei
};}
// Initial orbit: identical draw order to planets.js planetType (r() kind, r() au).
function initialAu(w){const r=rng(hash(w));r();return .82+r()*.5;}
function orbitParams(w,C){const g=rng(hash(w+'orbit'));return{ecc:C.ECC_MIN+g()*(C.ECC_MAX-C.ECC_MIN),phase:g()*Math.PI*2,period:C.ECC_PERIOD_TICKS*(.7+g()*.6)};}
// Secular drift for a tick, deterministic from wallet and tick index, biased so planets wander out of the zone.
function driftAt(w,tick,C){const h=crypto.createHash('sha256').update(w+':'+tick).digest();const u=h.readUInt32BE(0)/4294967296;const bias=(rng(hash(w+'bias'))()<.5?-1:1)*.35;return C.DRIFT_MAX*Math.max(-1,Math.min(1,(u*2-1)+bias));}
// Instantaneous distance including eccentricity oscillation.
function distance(p,tick,C){const o=orbitParams(p.wallet,C);return p.a*(1+o.ecc*Math.sin(o.phase+2*Math.PI*tick/o.period));}
const th=C=>C.TICK_HOURS||C.TICK_MS/3600e3;
const zoneOf=(d,C)=>d<C.HZ_IN?'hot':d>C.HZ_OUT?'cold':'habitable';
function stageOf(hours,C){let s=C.STAGES[0];for(const x of C.STAGES)if(hours>=x.hours)s=x;return s.name;}
// Mass from token balance (raw units) and supply.
function massFrom(bal,supply,C){if(!supply||!bal)return 0;const bps=Number(BigInt(bal)*1000000n/BigInt(supply))/100; // basis points with 2 decimals
  if(bps<C.MASS_UNIT_BPS)return 0;const b=Math.min(bps,C.MASS_CAP_BPS);
  if(C.MASS_CURVE==='log')return +(1+Math.log2(b/C.MASS_UNIT_BPS)*(C.MASS_CAP_BPS/C.MASS_UNIT_BPS-1)/Math.log2(C.MASS_CAP_BPS/C.MASS_UNIT_BPS)).toFixed(4);
  return +(b/C.MASS_UNIT_BPS).toFixed(4);}
function newPlanet(w,src,now){return{wallet:w,src,a:initialAu(w),created:now,massAt:0,mass:0,holdSince:null,zoneTicks:0,lifeTicks:0,weight:0,stage:'Barren',burns:[],lastTick:-1,zone:null,d:null};}
// One accounting tick for one planet. Returns weight earned this tick.
function tickPlanet(p,tick,now,C){p.a=p.a*(1+driftAt(p.wallet,tick,C));p.a=Math.max(.3,Math.min(3,p.a));const d=distance(p,tick,C);p.d=+d.toFixed(5);p.zone=zoneOf(d,C);p.lastTick=tick;
  const eligible=p.mass>0&&(p.src==='free'||(p.holdSince!=null&&now-p.holdSince>=C.MIN_HOLD_MS));p.eligible=eligible;let w=0;
  if(p.zone==='habitable'&&p.mass>0){p.zoneTicks++;p.lifeTicks++;if(eligible){w=p.mass;p.weight+=w;}}
  else if(p.lifeTicks>0)p.lifeTicks=Math.max(0,p.lifeTicks-2); // leaving the zone erodes evolution progress
  const hrs=p.lifeTicks*th(C);p.stage=stageOf(hrs,C);return w;}
function burn(p,dir,C){p.a=p.a*(1+(dir==='in'?-1:1)*C.THRUST_STEP);return p.a;}
// Epoch payout math. weights: {wallet:weight}. pool in lamports (integer). carry: {wallet:lamports owed below minimum}.
function computeEpoch({weights,poolLamports,burnLamports=0,carry={},jackpotBefore=0,lifeWinner=null},C){const pool=Math.floor(poolLamports);
  const hz=Math.floor(pool*C.SPLIT_HZ)+Math.floor(burnLamports),jp=Math.floor(pool*C.SPLIT_JACKPOT),ops=pool-Math.floor(pool*C.SPLIT_HZ)-jp;
  const tot=Object.values(weights).reduce((a,b)=>a+b,0);const shares={};let dist=0;
  const ws=Object.keys(weights).filter(w=>weights[w]>0).sort();
  for(const w of ws){const s=Math.floor(hz*weights[w]/tot);shares[w]=s;dist+=s;}
  const dust=hz-dist; // rounding remainder rolls into jackpot
  const newCarry={},pay={};const all=new Set([...Object.keys(shares),...Object.keys(carry)]);
  for(const w of [...all].sort()){const owed=(shares[w]||0)+(carry[w]||0);if(owed>=C.MIN_PAYOUT_LAMPORTS)pay[w]=owed;else if(owed>0)newCarry[w]=owed;}
  let jackpot=jackpotBefore+jp+dust;if(tot===0)for(const w in shares)delete shares[w];let award=null;
  if(lifeWinner&&jackpot>0){award={wallet:lifeWinner,lamports:jackpot};pay[lifeWinner]=(pay[lifeWinner]||0)+jackpot;jackpot=0;}
  return{pool,burn:Math.floor(burnLamports),hz,jp,ops,dust,totalWeight:tot,shares,pay,carry:newCarry,jackpot,award};}
const epochIndex=(t,C)=>Math.floor((t-C.EPOCH_ANCHOR_MS)/C.EPOCH_MS);
module.exports={th,hash,rng,config,initialAu,orbitParams,driftAt,distance,zoneOf,stageOf,massFrom,newPlanet,tickPlanet,burn,computeEpoch,epochIndex};
