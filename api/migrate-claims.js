// Copy the free-planet claim data from the current state into a new DATA_FILE (for example the mainnet one).
// Only claim data moves: claims, codes, xhandles, reviews, plus xids and seq, which keep the
// "one planet per X account" rule and the claim numbering intact, and cfg (current claim post id).
// Game state (planets, epochs, payouts, Life pool) is never copied.
//
//   node migrate-claims.js --from <export.json | https://host> --to <new DATA_FILE>           dry run: counts and diff only
//   node migrate-claims.js --from ... --to ... --apply                                           write (atomic, with backup)
//
// A URL source is read with GET /api/admin/export using ADMIN_KEY from the environment (read-only, never printed).
// Idempotent: running it again with the same source reports 0 changes. The source is never modified.
'use strict';
const fs=require('fs');
const KEYS=['claims','codes','xhandles','reviews','xids'];
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const from=arg('--from'),to=arg('--to'),apply=process.argv.includes('--apply');
if(!from||!to){console.error('usage: node migrate-claims.js --from <file|url> --to <file> [--apply]');process.exit(2);}

async function load(){
  if(/^https?:\/\//.test(from)){
    if(!process.env.ADMIN_KEY)throw new Error('ADMIN_KEY not set');
    const r=await fetch(from.replace(/\/$/,'')+'/api/admin/export',{headers:{'x-admin-key':process.env.ADMIN_KEY}});
    if(!r.ok)throw new Error('export failed: HTTP '+r.status);return r.json();}
  return JSON.parse(fs.readFileSync(from,'utf8'));}

function diff(src,dst){const out={};
  for(const k of KEYS){const a=src[k]||{},b=dst[k]||{};let add=0,chg=0,same=0,onlyTarget=0;
    for(const id in a){if(!(id in b))add++;else if(JSON.stringify(a[id])!==JSON.stringify(b[id]))chg++;else same++;}
    for(const id in b)if(!(id in a))onlyTarget++;
    out[k]={source:Object.keys(a).length,add,change:chg,same,onlyInTarget:onlyTarget};}
  out.seq={source:src.seq||0,target:dst.seq||0};return out;}

function check(src){const errs=[];const C=src.claims||{};
  for(const w in C){const c=C[w];if(c.wallet!==w)errs.push('claim key mismatch '+w);if(c.code&&src.codes&&src.codes[c.code]!==w)errs.push('code not mapped for '+w);}
  for(const h in src.xhandles||{})if(!C[src.xhandles[h]])errs.push('xhandle without claim @'+h);
  const nos=Object.values(C).map(c=>c.no).filter(n=>n!=null);if(nos.length&&Math.max(...nos)>(src.seq||0))errs.push('seq lower than highest claim number');
  return errs;}

(async()=>{
  const src=await load();
  let dst={};if(fs.existsSync(to))dst=JSON.parse(fs.readFileSync(to,'utf8'));
  const d=diff(src,dst);const errs=check(src);
  const status={};for(const c of Object.values(src.claims||{}))status[c.status||'final']=(status[c.status||'final']||0)+1;
  const rv={};for(const r of Object.values(src.reviews||{}))rv[r.status]=(rv[r.status]||0)+1;
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',source:/^https?:/.test(from)?from:'file',target:to,claimStatus:status,reviewStatus:rv,diff:d,checks:errs.length?errs:'ok',targetHasGame:!!dst.game},null,1));
  if(errs.length){console.error('refusing: source failed consistency checks');process.exit(1);}
  const conflicts=KEYS.reduce((a,k)=>a+d[k].change+d[k].onlyInTarget,0);
  if(conflicts&&!process.argv.includes('--force')){console.error('target already holds different claim data; rerun with --force to overwrite those sections');if(apply)process.exit(1);}
  if(!apply)return;
  const out=Object.assign({},dst);for(const k of KEYS)out[k]=src[k]||{};
  out.seq=Math.max(src.seq||0,dst.seq||0);out.cfg=Object.assign({},dst.cfg||{},src.cfg||{});out.pending=dst.pending||{};
  if(fs.existsSync(to))fs.copyFileSync(to,to+'.bak-'+Date.now());
  fs.writeFileSync(to+'.tmp',JSON.stringify(out));fs.renameSync(to+'.tmp',to);console.log('written',to);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
