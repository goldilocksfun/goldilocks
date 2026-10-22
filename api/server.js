// Goldilocks free planet claim API. Zero framework, Node >= 18.
// One planet per wallet. Wallet ownership is proven by signMessage over a server issued nonce (no transaction, no funds).
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const nacl=require('tweetnacl');const bs58=(m=>m.default||m)(require('bs58'));
const PORT=+process.env.PORT||8787;
const DATA=process.env.DATA_FILE||path.join(__dirname,'data','claims.json');
const ORIGINS=String(process.env.ALLOWED_ORIGINS||'http://localhost:47593,https://goldilocksfun.github.io,https://goldilockszone.fun,https://www.goldilockszone.fun').split(',').map(s=>s.trim()).filter(Boolean);
const DOMAIN=process.env.SIGN_DOMAIN||'goldilockszone.fun';
const OPEN=process.env.CLAIMS_OPEN!=='0';
const MAX=+process.env.MAX_PLANETS||0; // 0 = unlimited
const NONCE_TTL=10*60e3;

// ---------- store (JSON file, atomic writes) ----------
fs.mkdirSync(path.dirname(DATA),{recursive:true});
// One-off wipe (for clearing test data): set PURGE_ON_START=1 for a single boot, then remove it.
if(process.env.PURGE_ON_START==='1'){try{fs.unlinkSync(DATA);console.log('store purged');}catch(e){}}
let db={claims:{},codes:{},seq:0};try{db=Object.assign(db,JSON.parse(fs.readFileSync(DATA,'utf8')));}catch(e){}
let dirty=false;const save=()=>{dirty=true;};
setInterval(()=>{if(!dirty)return;dirty=false;const tmp=DATA+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA);},1000).unref();
const flush=()=>{try{fs.writeFileSync(DATA,JSON.stringify(db));}catch(e){}};process.on('SIGTERM',()=>{flush();process.exit(0);});process.on('SIGINT',()=>{flush();process.exit(0);});

// ---------- helpers ----------
const isWallet=w=>{try{return typeof w==='string'&&w.length>=32&&w.length<=44&&bs58.decode(w).length===32;}catch(e){return false;}};
const newCode=()=>{let c;do{c=crypto.randomBytes(5).toString('base64url').replace(/[-_]/g,'x').slice(0,7).toUpperCase();}while(db.codes[c]);return c;};
const nonces=new Map();
function message(wallet,nonce,iat){return `${DOMAIN} wants you to claim a free Goldilocks planet.\n\nWallet: ${wallet}\nNonce: ${nonce}\nIssued at: ${iat}\n\nThis is a signature only. No transaction, no fee, no funds move.`;}
function verify(wallet,msg,sigB64){try{const sig=Buffer.from(String(sigB64||''),'base64');if(sig.length!==64)return false;return nacl.sign.detached.verify(new TextEncoder().encode(msg),new Uint8Array(sig),bs58.decode(wallet));}catch(e){return false;}}
const view=w=>{const c=db.claims[w];if(!c)return {claimed:false};return {claimed:true,no:c.no,seed:c.seed,code:c.code,invites:c.invites||0,followed:!!c.followed,at:c.at};};
const stats=()=>({open:OPEN,total:db.seq,max:MAX||null,top:Object.values(db.claims).filter(c=>c.invites>0).sort((a,b)=>b.invites-a.invites||a.no-b.no).slice(0,10).map(c=>({wallet:c.wallet.slice(0,4)+'..'+c.wallet.slice(-4),invites:c.invites,no:c.no}))});

// ---------- rate limit (sliding window per IP and bucket) ----------
const rl=new Map();
function limited(ip,bucket,n,ms){const k=bucket+'|'+ip,now=Date.now();const a=(rl.get(k)||[]).filter(t=>now-t<ms);if(a.length>=n){rl.set(k,a);return true;}a.push(now);rl.set(k,a);return false;}
setInterval(()=>{const now=Date.now();for(const [k,a] of rl){if(!a.length||now-a[a.length-1]>3600e3)rl.delete(k);}for(const [k,v] of nonces)if(now-v.at>NONCE_TTL)nonces.delete(k);},60e3).unref();

// ---------- http ----------
function send(req,res,code,obj){const o=req.headers.origin;const h={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
  if(o&&ORIGINS.includes(o)){h['access-control-allow-origin']=o;h['vary']='Origin';h['access-control-allow-methods']='GET,POST,OPTIONS';h['access-control-allow-headers']='content-type';}
  res.writeHead(code,h);res.end(obj===undefined?'':JSON.stringify(obj));}
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',d=>{s+=d;if(s.length>8192){no(new Error('too large'));req.destroy();}});req.on('end',()=>{try{ok(s?JSON.parse(s):{});}catch(e){no(new Error('bad json'));}});});}
const ipOf=req=>String(process.env.TRUST_PROXY==='1'&&req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,ip=ipOf(req);
  if(req.method==='OPTIONS')return send(req,res,204);
  try{
    if(limited(ip,'all',240,60e3))return send(req,res,429,{error:'Too many requests. Slow down a little.'});
    if(p==='/health')return send(req,res,200,{ok:true});
    if(p==='/api/stats'&&req.method==='GET')return send(req,res,200,stats());
    if(p==='/api/me'&&req.method==='GET'){const w=u.searchParams.get('wallet');if(!isWallet(w))return send(req,res,400,{error:'Invalid wallet.'});return send(req,res,200,view(w));}
    if(p==='/api/ref'&&req.method==='GET'){const c=String(u.searchParams.get('code')||'').toUpperCase();return send(req,res,db.codes[c]?200:404,{valid:!!db.codes[c]});}
    if(p==='/api/nonce'&&req.method==='POST'){
      if(limited(ip,'nonce',20,600e3))return send(req,res,429,{error:'Too many tries. Wait a few minutes.'});
      const {wallet}=await body(req);if(!isWallet(wallet))return send(req,res,400,{error:'Invalid wallet.'});
      const nonce=crypto.randomBytes(16).toString('hex'),iat=new Date().toISOString();nonces.set(wallet,{nonce,at:Date.now(),msg:message(wallet,nonce,iat)});
      return send(req,res,200,{message:nonces.get(wallet).msg});}
    if(p==='/api/claim'&&req.method==='POST'){
      if(!OPEN)return send(req,res,403,{error:'Claims open soon.'});
      if(limited(ip,'claim',10,600e3))return send(req,res,429,{error:'Too many tries. Wait a few minutes.'});
      const {wallet,signature,ref,followed}=await body(req);
      if(!isWallet(wallet))return send(req,res,400,{error:'Invalid wallet.'});
      if(db.claims[wallet])return send(req,res,200,Object.assign(view(wallet),{already:true}));
      const n=nonces.get(wallet);if(!n||Date.now()-n.at>NONCE_TTL)return send(req,res,400,{error:'Signature request expired. Try again.'});
      if(!verify(wallet,n.msg,signature))return send(req,res,401,{error:'Signature could not be verified.'});
      nonces.delete(wallet);
      if(MAX&&db.seq>=MAX)return send(req,res,410,{error:'All planets for this season are claimed.'});
      const code=newCode();const rc=String(ref||'').toUpperCase();let by=null;
      const rw=db.codes[rc];if(rw&&rw!==wallet&&db.claims[rw]){by=rw;db.claims[rw].invites=(db.claims[rw].invites||0)+1;}
      db.seq++;db.claims[wallet]={wallet,no:db.seq,seed:crypto.createHash('sha256').update(wallet).digest('hex').slice(0,16),code,by,followed:!!followed,invites:0,at:new Date().toISOString(),ip:crypto.createHash('sha256').update(ip+DOMAIN).digest('hex').slice(0,12)};
      db.codes[code]=wallet;save();
      return send(req,res,200,view(wallet));}
    send(req,res,404,{error:'Not found.'});
  }catch(e){send(req,res,400,{error:e.message||'Bad request.'});}
});
if(require.main===module)server.listen(PORT,()=>console.log('goldilocks-api on :'+PORT+' store '+DATA));
module.exports={server,message,verify,db};
