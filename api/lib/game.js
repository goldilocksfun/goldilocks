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
  MASS_CAP_BPS:num('MASS_CAP_BPS',25),           // 0.25% of supply cap = 25 mass
  MASS_CURVE:process.env.MASS_CURVE||'linear',   // linear | log
  FREE_MASS:num('FREE_MASS',1),
  MIN_HOLD_MS:num('MIN_HOLD_MS',24*3600e3),
  STAGES:(process.env.STAGES||'Barren:0,Prebiotic:12,Microbial:48,Multicellular:120,Complex:240,Life:400').split(',').map(x=>{const [n,h]=x.split(':');return{name:n,hours:+h}}),
  SPLIT_HZ:num('SPLIT_HZ',.7),SPLIT_JACKPOT:num('SPLIT_JACKPOT',.2),SPLIT_OPS:num('SPLIT_OPS',.1),
  PAYOUT_BATCH:num('PAYOUT_BATCH',10),          // transfers per payout transaction
  MIN_PAYOUT_LAMPORTS:num('MIN_PAYOUT_LAMPORTS',1e6),
  SWEEP_EVERY_EPOCHS:num('SWEEP_EVERY_EPOCHS',7), // weekly: carryovers below the minimum are paid out regardless
  LAUNCH_AT:num('LAUNCH_AT',0),                   // token launch time (ms). Free planets exist and start their 24h wait only from here
  EPOCH_MS:num('EPOCH_MS',24*3600e3),
  EPOCH_ANCHOR_MS:num('EPOCH_ANCHOR_MS',Date.UTC(2026,0,1,12,0,0)), // 12:00 UTC
};}
// Initial orbit: identical draw order to planets.js planetType (r() kind, r() au).
// seed: recent blockhash at planet creation. Empty seed keeps the address-only orbit (site preview, legacy planets).
function initialAu(w,seed){const r=rng(hash(w+(seed?':'+seed:'')));r();return .82+r()*.5;}
function orbitParams(w,C,seed){const g=rng(hash(w+'orbit'+(seed?':'+seed:'')));return{ecc:C.ECC_MIN+g()*(C.ECC_MAX-C.ECC_MIN),phase:g()*Math.PI*2,period:C.ECC_PERIOD_TICKS*(.7+g()*.6)};}
// Secular drift for a tick, deterministic from wallet and tick index, biased so planets wander out of the zone.
// daySeed: recent blockhash fetched each UTC day, unknown in advance, so wallets cannot be ground for a favourable path.
function driftAt(w,tick,C,daySeed,seed){const h=crypto.createHash('sha256').update(w+':'+tick+(daySeed?':'+daySeed:'')).digest();const u=h.readUInt32BE(0)/4294967296;const bias=(rng(hash(w+'bias'+(seed?':'+seed:'')))()<.5?-1:1)*.35;return C.DRIFT_MAX*Math.max(-1,Math.min(1,(u*2-1)+bias));}
// Instantaneous distance including eccentricity oscillation.
function distance(p,tick,C){const o=orbitParams(p.wallet,C,p.seed);return p.a*(1+o.ecc*Math.sin(o.phase+2*Math.PI*tick/o.period));}
const th=C=>C.TICK_HOURS||C.TICK_MS/3600e3;
const zoneOf=(d,C)=>d<C.HZ_IN?'hot':d>C.HZ_OUT?'cold':'habitable';
function stageOf(hours,C){let s=C.STAGES[0];for(const x of C.STAGES)if(hours>=x.hours)s=x;return s.name;}
// Mass from token balance (raw units) and supply.
function massFrom(bal,supply,C){if(!supply||!bal)return 0;const bps=Number(BigInt(bal)*1000000n/BigInt(supply))/100; // basis points with 2 decimals
  if(bps<C.MASS_UNIT_BPS)return 0;const b=Math.min(bps,C.MASS_CAP_BPS);
  if(C.MASS_CURVE==='log')return +(1+Math.log2(b/C.MASS_UNIT_BPS)*(C.MASS_CAP_BPS/C.MASS_UNIT_BPS-1)/Math.log2(C.MASS_CAP_BPS/C.MASS_UNIT_BPS)).toFixed(4);
  return +(b/C.MASS_UNIT_BPS).toFixed(4);}
function newPlanet(w,src,now,seed){return{wallet:w,src,seed:seed||null,a:initialAu(w,seed),created:now,massAt:0,mass:0,holdSince:null,zoneTicks:0,lifeTicks:0,weight:0,stage:'Barren',burns:[],lastTick:-1,zone:null,d:null};}
// One accounting tick for one planet. Returns weight earned this tick.
function tickPlanet(p,tick,now,C,daySeed){p.a=p.a*(1+driftAt(p.wallet,tick,C,daySeed,p.seed));p.a=Math.max(.3,Math.min(3,p.a));const d=distance(p,tick,C);p.d=+d.toFixed(5);p.zone=zoneOf(d,C);p.lastTick=tick;
  const since=p.src==='free'?Math.max(p.freeSince||p.created||0,C.LAUNCH_AT||0):p.holdSince;
  const eligible=p.mass>0&&since!=null&&now-since>=C.MIN_HOLD_MS;p.eligible=eligible;let w=0;
  if(p.zone==='habitable'&&p.mass>0){p.zoneTicks++;p.lifeTicks++;if(eligible){w=p.mass;p.weight+=w;}}
  else if(p.lifeTicks>0)p.lifeTicks=Math.max(0,p.lifeTicks-2); // leaving the zone erodes evolution progress
  const hrs=p.lifeTicks*th(C);p.stage=stageOf(hrs,C);return w;}
function burn(p,dir,C){p.a=p.a*(1+(dir==='in'?-1:1)*C.THRUST_STEP);return p.a;}
// Epoch payout math. weights: {wallet:weight}. pool in lamports (integer). carry: {wallet:lamports owed below minimum}.
function computeEpoch({weights,poolLamports,burnLamports=0,carry={},jackpotBefore=0,lifeMass=null,sweep=false},C){const pool=Math.floor(poolLamports);
  const hz=Math.floor(pool*C.SPLIT_HZ)+Math.floor(burnLamports),jp=Math.floor(pool*C.SPLIT_JACKPOT),ops=pool-Math.floor(pool*C.SPLIT_HZ)-jp;
  const tot=Object.values(weights).reduce((a,b)=>a+b,0);const shares={};let dist=0;
  const ws=Object.keys(weights).filter(w=>weights[w]>0).sort();
  for(const w of ws){const s=Math.floor(hz*weights[w]/tot);shares[w]=s;dist+=s;}
  const dust=hz-dist; // rounding remainder rolls into jackpot
  const newCarry={},pay={};const all=new Set([...Object.keys(shares),...Object.keys(carry)]);
  for(const w of [...all].sort()){const owed=(shares[w]||0)+(carry[w]||0);if(owed>=C.MIN_PAYOUT_LAMPORTS||(sweep&&owed>0))pay[w]=owed;else if(owed>0)newCarry[w]=owed;}
  let jackpot=jackpotBefore+jp+dust;if(tot===0)for(const w in shares)delete shares[w];let award=null;
  // Season Life jackpot: split by mass among every planet that reached Life in the season. Remainder rolls into the next season.
  if(lifeMass&&jackpot>0){const lw=Object.keys(lifeMass).filter(w=>lifeMass[w]>0).sort();const lt=lw.reduce((a,w)=>a+lifeMass[w],0);
    if(lt>0){const split={};let given=0;for(const w of lw){const a=Math.floor(jackpot*lifeMass[w]/lt);if(a>0){split[w]=a;pay[w]=(pay[w]||0)+a;given+=a;}}
      award={lamports:given,wallets:lw.length,split};jackpot-=given;}}
  return{pool,burn:Math.floor(burnLamports),hz,jp,ops,dust,totalWeight:tot,shares,pay,carry:newCarry,jackpot,award};}
const seasonOf=t=>{const d=new Date(t);return d.getUTCFullYear()*4+Math.floor(d.getUTCMonth()/3);}; // UTC calendar quarter
const dayOf=t=>Math.floor(t/86400e3); // UTC calendar day
const epochIndex=(t,C)=>Math.floor((t-C.EPOCH_ANCHOR_MS)/C.EPOCH_MS);
module.exports={th,hash,rng,config,initialAu,orbitParams,driftAt,distance,zoneOf,stageOf,massFrom,newPlanet,tickPlanet,burn,computeEpoch,epochIndex,dayOf,seasonOf};
