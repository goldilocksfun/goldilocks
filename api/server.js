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
let db={claims:{},codes:{},seq:0,pending:{},xids:{},xhandles:{},reviews:{},cfg:{}};try{db=Object.assign(db,JSON.parse(fs.readFileSync(DATA,'utf8')));}catch(e){}
let dirty=false;const save=()=>{dirty=true;};
setInterval(()=>{if(!dirty)return;dirty=false;const tmp=DATA+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA);},1000).unref();
const flush=()=>{try{fs.writeFileSync(DATA,JSON.stringify(db));}catch(e){}};process.on('SIGTERM',()=>{flush();process.exit(0);});process.on('SIGINT',()=>{flush();process.exit(0);});

// ---------- claim requirements (each toggleable) ----------
const on=(k,d)=>process.env[k]==null||process.env[k]===''?d:process.env[k]!=='0';
const REQ={follow:on('REQ_FOLLOW',true),repost:on('REQ_REPOST',true),like:on('REQ_LIKE',true),reply:on('REQ_REPLY',true),invites:process.env.REQ_INVITES!=null&&process.env.REQ_INVITES!==''?+process.env.REQ_INVITES:1,
  minAgeDays:+process.env.INVITE_MIN_AGE_DAYS||30,minFollowers:process.env.INVITE_MIN_FOLLOWERS!=null?+process.env.INVITE_MIN_FOLLOWERS:10,holdMs:+process.env.RESERVE_HOLD_MS||48*3600e3,holds:on('RESERVE_HOLDS',true),official:process.env.X_OFFICIAL||'playgoldilocks'};
const xTasksOn=()=>REQ.follow||REQ.repost||REQ.like||REQ.reply;
const gated=()=>xTasksOn()||REQ.invites>0;
const tweetId=()=>(db.cfg&&db.cfg.tweetId)||process.env.CLAIM_TWEET_ID||'';
// ---------- helpers ----------
const isWallet=w=>{try{return typeof w==='string'&&w.length>=32&&w.length<=44&&bs58.decode(w).length===32;}catch(e){return false;}};
const newCode=()=>{let c;do{c=crypto.randomBytes(5).toString('base64url').replace(/[-_]/g,'x').slice(0,7).toUpperCase();}while(db.codes[c]);return c;};
const nonces=new Map();
function message(wallet,nonce,iat){return `${DOMAIN} wants you to claim a free Goldilocks planet.\n\nWallet: ${wallet}\nNonce: ${nonce}\nIssued at: ${iat}\n\nThis is a signature only. No transaction, no fee, no funds move.`;}
function verify(wallet,msg,sigB64){try{const sig=Buffer.from(String(sigB64||''),'base64');if(sig.length!==64)return false;return nacl.sign.detached.verify(new TextEncoder().encode(msg),new Uint8Array(sig),bs58.decode(wallet));}catch(e){return false;}}
const view=w=>{const c=db.claims[w];if(!c){const p=db.pending&&db.pending[w];const rv=Object.values(db.reviews||{}).filter(r=>r.wallet===w).pop();if(rv&&rv.status!=='approved')return{claimed:false,status:rv.status==='pending'?'review':'rejected',reason:rv.reason||null,replyCode:rv.code,x:'@'+rv.handle};return p?{claimed:false,status:'signed',replyCode:p.replyCode,x:p.x||null}:{claimed:false};}
  const st=c.status||'final';return {claimed:st==='final',status:st,no:c.no,seed:c.seed,code:c.code,invites:c.invites||0,qualifiedInvites:c.qinv||0,invitesNeeded:REQ.invites,reservedAt:c.reservedAt||null,holdUntil:c.reservedAt?c.reservedAt+REQ.holdMs:null,x:c.xHandle?'@'+c.xHandle:null,followed:!!c.followed,at:c.at};};
const activeHolds=()=>REQ.holds?Object.values(db.claims).filter(c=>c.status==='reserved'&&Date.now()-c.reservedAt<REQ.holdMs).length:0;
function finalize(c){if(c.status!=='reserved')return false;if(MAX&&db.seq>=MAX)return false;db.seq++;c.no=db.seq;c.status='final';c.finalAt=Date.now();return true;}
function creditInviter(c){if(!c.by||c.credited)return;const r=db.claims[c.by];if(!r)return;const q=c.xq||{};
  if(q.ageDays>=REQ.minAgeDays&&q.followers>=REQ.minFollowers&&c.xId&&c.xId!==r.xId){r.qinv=(r.qinv||0)+1;c.credited=true;if(r.status==='reserved'&&r.qinv>=REQ.invites)finalize(r);}}
const stats=()=>({open:OPEN,total:db.seq,reserved:Object.values(db.claims).filter(c=>c.status==='reserved').length,max:MAX||null,tweetId:tweetId()||null,verify:VERIFY_MODE,req:{follow:REQ.follow,repost:REQ.repost,like:REQ.like,reply:REQ.reply,invites:REQ.invites},official:REQ.official,top:Object.values(db.claims).filter(c=>c.invites>0).sort((a,b)=>b.invites-a.invites||(a.no||1e9)-(b.no||1e9)).slice(0,10).map(c=>({wallet:c.wallet.slice(0,4)+'..'+c.wallet.slice(-4),invites:c.invites,no:c.no}))});

// ---------- rate limit (sliding window per IP and bucket) ----------
const rl=new Map();
function limited(ip,bucket,n,ms){const k=bucket+'|'+ip,now=Date.now();const a=(rl.get(k)||[]).filter(t=>now-t<ms);if(a.length>=n){rl.set(k,a);return true;}a.push(now);rl.set(k,a);return false;}
setInterval(()=>{const now=Date.now();for(const [k,a] of rl){if(!a.length||now-a[a.length-1]>3600e3)rl.delete(k);}for(const [k,v] of nonces)if(now-v.at>NONCE_TTL)nonces.delete(k);},60e3).unref();

// ---------- http ----------
function send(req,res,code,obj){const o=req.headers.origin;const h={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
  if(o&&ORIGINS.includes(o)){h['access-control-allow-origin']=o;h['vary']='Origin';h['access-control-allow-methods']='GET,POST,OPTIONS';h['access-control-allow-headers']='content-type,x-admin-key';}
  res.writeHead(code,h);res.end(obj===undefined?'':JSON.stringify(obj));}
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',d=>{s+=d;if(s.length>8192){no(new Error('too large'));req.destroy();}});req.on('end',()=>{try{ok(s?JSON.parse(s):{});}catch(e){no(new Error('bad json'));}});});}
// Behind Render + Cloudflare: cf-connecting-ip is set by the edge; otherwise the rightmost X-Forwarded-For hop (added by the proxy). The leftmost hop is client controlled.
const ipOf=req=>{if(process.env.TRUST_PROXY==='1'){const cf=req.headers['cf-connecting-ip'];if(cf)return String(cf).trim();const x=String(req.headers['x-forwarded-for']||'').split(',').map(v=>v.trim()).filter(Boolean);if(x.length)return x[x.length-1];}return String(req.socket.remoteAddress||'');};

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,ip=ipOf(req);
  if(req.method==='OPTIONS')return send(req,res,204);
  try{
    if(limited(ip,'all',240,60e3))return send(req,res,429,{error:'Too many requests. Slow down a little.'});
    if(p==='/health')return send(req,res,200,{ok:true});
    if(p==='/api/stats'&&req.method==='GET')return send(req,res,200,stats());
    if(p==='/api/planets'&&req.method==='GET')return send(req,res,200,{planets:Object.values(db.claims).sort((a,b)=>a.no-b.no).map(c=>({wallet:c.wallet,no:c.no,at:c.at}))});
    if(p==='/api/me'&&req.method==='GET'){const w=u.searchParams.get('wallet');if(!isWallet(w))return send(req,res,400,{error:'Invalid wallet.'});return send(req,res,200,view(w));}
    if(p==='/api/ref'&&req.method==='GET'){const c=String(u.searchParams.get('code')||'').toUpperCase();return send(req,res,db.codes[c]?200:404,{valid:!!db.codes[c]});}
    if(p==='/api/nonce'&&req.method==='POST'){
      if(limited(ip,'nonce',20,600e3))return send(req,res,429,{error:'Too many tries. Wait a few minutes.'});
      const {wallet}=await body(req);if(!isWallet(wallet))return send(req,res,400,{error:'Invalid wallet.'});
      if(nonces.size>50000)return send(req,res,503,{error:'Busy. Try again in a minute.'});const nonce=crypto.randomBytes(16).toString('hex'),iat=new Date().toISOString();nonces.set(wallet,{nonce,at:Date.now(),msg:message(wallet,nonce,iat)});
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
      if(gated()){const pc=db.pending[wallet]||{wallet,replyCode:'GL-'+crypto.randomBytes(4).toString('hex').slice(0,5).toUpperCase(),ref:String(ref||'').toUpperCase(),at:Date.now()};pc.token=crypto.randomBytes(18).toString('base64url');db.pending[wallet]=pc;save();
        return send(req,res,200,{claimed:false,status:'signed',token:pc.token,replyCode:pc.replyCode});}
      if(MAX&&db.seq>=MAX)return send(req,res,410,{error:'All planets for this season are claimed.'});
      const code=newCode();const rc=String(ref||'').toUpperCase();let by=null;
      const rw=db.codes[rc];if(rw&&rw!==wallet&&db.claims[rw]){by=rw;db.claims[rw].invites=(db.claims[rw].invites||0)+1;}
      db.seq++;db.claims[wallet]={wallet,no:db.seq,seed:crypto.createHash('sha256').update(wallet).digest('hex').slice(0,16),code,by,followed:!!followed,invites:0,at:new Date().toISOString(),ip:crypto.createHash('sha256').update(ip+DOMAIN).digest('hex').slice(0,12)};
      db.codes[code]=wallet;save();
      return send(req,res,200,view(wallet));}
    if(await claimRoute(req,res,u,p,ip)!==false)return;
    if(await gameRoute(req,res,u,p,ip)!==false)return;
    send(req,res,404,{error:'Not found.'});
  }catch(e){send(req,res,400,{error:e.message||'Bad request.'});}
});
if(require.main===module)server.listen(PORT,()=>console.log('goldilocks-api on :'+PORT+' store '+DATA));

// ---------- game ----------
const E=require('./lib/engine').create(db,save);const G=require('./lib/game');
let chain=null;try{chain=require('./lib/chain');}catch(e){console.log('chain disabled:',e.message);}
const GCFG={mint:process.env.TOKEN_MINT||'',snapMs:+process.env.SNAPSHOT_MS||600e3,payoutMode:process.env.PAYOUT_MODE||'dry',autoEpoch:process.env.AUTO_EPOCH!=='0',
  feePool:+process.env.FEE_POOL_LAMPORTS||0,admin:process.env.ADMIN_KEY||'',cluster:chain?chain.CLUSTER:'none',mainnet:chain?chain.MAINNET_ENABLED:false};
if(GCFG.payoutMode==='live'&&!GCFG.mainnet)GCFG.payoutMode='dry';
const treasury=chain?chain.loadOrCreateKeypair(process.env.TREASURY_FILE||path.join(path.dirname(DATA),GCFG.cluster+'-treasury.json')):null;
const burnNonces=new Map();
// Wallets that never get a planet: treasury, deployer, bonding curve, pool and team vaults.
const EXCL=new Set(String(process.env.EXCLUDE_WALLETS||'').split(',').map(s=>s.trim()).filter(Boolean).concat(treasury?[treasury.publicKey.toBase58()]:[]));
async function doSnapshot(){if(!chain||!GCFG.mint)return null;const [bal,sup]=await Promise.all([chain.holders(GCFG.mint),chain.supply(GCFG.mint)]);for(const x of EXCL)delete bal[x];E.snapshot(bal,sup);return{holders:Object.keys(bal).length,supply:sup};}
async function doEpoch(idx,pool){const r=E.closeEpoch(idx,pool!=null?pool:GCFG.feePool);if(r.already)return r;
  const mode=GCFG.payoutMode==='devnet'&&GCFG.cluster!=='mainnet-beta'?'devnet':'dry';await E.execute(r.epoch,mode,(w,l,onSig)=>chain.transfer(treasury,w,l,onSig),chain&&chain.sigState);return r;}
// Daily drift seed: a recent blockhash recorded once per Taipei day (published in /api/seeds for audit).
async function ensureSeed(){const day=G.dayOf(Date.now());if(E.S.seeds&&E.S.seeds[day]||!chain)return;const {blockhash}=await chain.conn.getLatestBlockhash('finalized');E.setDaySeed(day,blockhash);}
if(require.main===module){setInterval(async()=>{try{await ensureSeed().catch(e=>console.error('seed',e.message));E.advance();}catch(e){console.error('tick',e.message);}},Math.min(10e3,E.C.TICK_MS/2)).unref();
  if(GCFG.mint){const f=()=>doSnapshot().catch(e=>console.error('snap',e.message));f();setInterval(f,GCFG.snapMs).unref();}
  if(E.S.genesisEpoch==null){E.S.genesisEpoch=G.epochIndex(Date.now(),E.C);save();}
  let busy=false;if(GCFG.autoEpoch)setInterval(async()=>{if(busy)return;const idx=G.epochIndex(Date.now(),E.C)-1;const last=E.S.epochs.length?E.S.epochs[E.S.epochs.length-1].idx:E.S.genesisEpoch-1;
    if(idx>last){busy=true;try{E.advance();await doEpoch(idx);}catch(e){console.error('epoch',e.message);}busy=false;}},30e3).unref();}
const adminFails=new Map();
// Timing safe key compare; 10 wrong keys per IP per 15 minutes locks that IP out of admin routes.
const isAdmin=req=>{if(!GCFG.admin)return false;const ip=ipOf(req),now=Date.now();const f=(adminFails.get(ip)||[]).filter(t=>now-t<900e3);if(f.length>=10){adminFails.set(ip,f);return false;}
  const a=crypto.createHash('sha256').update(String(req.headers['x-admin-key']||'')).digest(),b=crypto.createHash('sha256').update(GCFG.admin).digest();
  if(crypto.timingSafeEqual(a,b))return true;f.push(now);adminFails.set(ip,f);return false;};
setInterval(()=>{const now=Date.now();for(const [k,v] of burnNonces)if(now-v.at>NONCE_TTL)burnNonces.delete(k);for(const [k,a] of adminFails)if(!a.length||now-a[a.length-1]>900e3)adminFails.delete(k);},60e3).unref();
const burnInflight=new Set();
const burnMsg=(w,dir,n)=>`goldilocks burn ${dir} ${w} ${n}`;
async function gameRoute(req,res,u,p,ip){
  if(p==='/api/game'&&req.method==='GET')return send(req,res,200,{cluster:GCFG.cluster,mainnet:GCFG.mainnet,mint:GCFG.mint||null,treasury:treasury?treasury.publicKey.toBase58():null,payoutMode:GCFG.payoutMode,tick:E.S.tick,tickMs:E.C.TICK_MS,epochMs:E.C.EPOCH_MS,epochAnchor:E.C.EPOCH_ANCHOR_MS,hz:[E.C.HZ_IN,E.C.HZ_OUT],clientRpc:process.env.CLIENT_RPC||(GCFG.cluster==='mainnet-beta'?null:'https://api.devnet.solana.com'),memoProgram:chain?chain.MEMO.toBase58():null,thrustLamports:E.C.THRUST_LAMPORTS,thrustStep:E.C.THRUST_STEP,split:[E.C.SPLIT_HZ,E.C.SPLIT_JACKPOT,E.C.SPLIT_OPS],minPayout:E.C.MIN_PAYOUT_LAMPORTS,minHoldMs:E.C.MIN_HOLD_MS,stages:E.C.STAGES,jackpot:E.S.jackpot,burnPool:E.S.burnPool,feePool:GCFG.feePool,planets:Object.keys(E.S.planets).length,lifeWinner:E.S.lifeWinner,lastSnapshot:E.S.lastSnap});
  let m;
  if((m=p.match(/^\/api\/planet\/([^/]+)$/))&&req.method==='GET'){const w=m[1];if(!isWallet(w))return send(req,res,400,{error:'Invalid wallet.'});const pl=E.S.planets[w];if(!pl)return send(req,res,404,{error:'No planet for this wallet yet.',initialAu:+G.initialAu(w).toFixed(5)});return send(req,res,200,E.pub(pl));}
  if((m=p.match(/^\/api\/earnings\/([^/]+)$/))&&req.method==='GET'){if(!isWallet(m[1]))return send(req,res,400,{error:'Invalid wallet.'});return send(req,res,200,E.earnings(m[1]));}
  if(p==='/api/seeds'&&req.method==='GET')return send(req,res,200,{seeds:E.S.seeds||{}});
  if(p==='/api/leaderboard'&&req.method==='GET')return send(req,res,200,{planets:E.leaderboard()});
  if(p==='/api/epochs'&&req.method==='GET')return send(req,res,200,{jackpot:E.S.jackpot,epochs:E.S.epochs.slice(-Math.max(1,Math.min(30,+u.searchParams.get('limit')||10))).reverse().map(e=>({idx:e.idx,closedAt:e.closedAt,pool:e.pool,burn:e.burn,hz:e.hz,jackpotIn:e.jackpotIn,ops:e.ops,totalWeight:e.totalWeight,jackpotAfter:e.jackpotAfter,award:e.award,payouts:e.payouts.map(x=>({wallet:x.wallet,lamports:x.lamports,status:x.status,sig:x.sig})),carry:e.carry}))});
  if(p==='/api/thruster/nonce'&&req.method==='POST'){if(limited(ip,'tn',30,600e3))return send(req,res,429,{error:'Too many tries.'});const {wallet,dir}=await body(req);if(!isWallet(wallet)||!['in','out'].includes(dir))return send(req,res,400,{error:'Invalid request.'});
    if(!E.S.planets[wallet])return send(req,res,404,{error:'No planet for this wallet yet.'});if(burnNonces.size>20000)return send(req,res,503,{error:'Busy. Try again in a minute.'});const n=crypto.randomBytes(8).toString('hex');burnNonces.set(n,{wallet,dir,at:Date.now()});
    return send(req,res,200,{nonce:n,memo:burnMsg(wallet,dir,n),free:E.canFreeBurn(wallet),lamports:E.C.THRUST_LAMPORTS,memoProgram:chain?chain.MEMO.toBase58():null,treasury:treasury&&treasury.publicKey.toBase58(),cluster:GCFG.cluster});}
  if(p==='/api/thruster/verify'&&req.method==='POST'){if(limited(ip,'tv',30,600e3))return send(req,res,429,{error:'Too many tries.'});const {wallet,nonce,signature,messageSignature}=await body(req);
    if(signature&&E.S.burnSigs[signature])return send(req,res,200,Object.assign({already:true},E.S.burnSigs[signature]));
    const n=burnNonces.get(nonce);if(!n||n.wallet!==wallet||Date.now()-n.at>NONCE_TTL)return send(req,res,400,{error:'Burn request expired. Try again.'});
    const memo=burnMsg(wallet,n.dir,nonce);
    if(messageSignature){if(!E.canFreeBurn(wallet))return send(req,res,402,{error:'Free burn already used today.'});if(!verify(wallet,memo,messageSignature))return send(req,res,401,{error:'Signature could not be verified.'});burnNonces.delete(nonce);const r=E.applyBurn(wallet,n.dir,{});return send(req,res,r.error?400:200,r);}
    if(!chain||!treasury)return send(req,res,503,{error:'Chain unavailable.'});if(typeof signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature))return send(req,res,400,{error:'Missing transaction signature.'});
    // One verification at a time per nonce and per signature, so parallel requests cannot apply the same payment twice.
    if(burnInflight.has(nonce)||burnInflight.has(signature))return send(req,res,409,{error:'This burn is already being checked.'});burnInflight.add(nonce);burnInflight.add(signature);
    try{const v=await chain.verifyBurn(signature,{wallet,treasury:treasury.publicKey.toBase58(),lamports:E.C.THRUST_LAMPORTS,memo});if(!v.ok)return send(req,res,400,{error:v.error});
      if(E.S.burnSigs[signature])return send(req,res,200,Object.assign({already:true},E.S.burnSigs[signature]));
      if(!burnNonces.has(nonce))return send(req,res,400,{error:'Burn request expired. Try again.'});
      burnNonces.delete(nonce);const r=E.applyBurn(wallet,n.dir,{sig:signature,paid:v.paid});return send(req,res,r.error?400:200,r);}
    finally{burnInflight.delete(nonce);burnInflight.delete(signature);}}
  if(p.startsWith('/api/admin/')){if(!isAdmin(req))return send(req,res,403,{error:'Forbidden.'});const b=req.method==='POST'?await body(req):{};
    if(p==='/api/admin/snapshot')return send(req,res,200,await doSnapshot()||{skipped:true});
    if(p==='/api/admin/airdrop'){if(GCFG.cluster!=='devnet')return send(req,res,400,{error:'devnet only'});const pub=new chain.web3.Connection(chain.web3.clusterApiUrl('devnet'),'confirmed');
      try{const sig=await pub.requestAirdrop(new chain.web3.PublicKey(b.to||treasury.publicKey.toBase58()),Math.min(+b.lamports||1e9,2e9));return send(req,res,200,{sig});}catch(e){return send(req,res,502,{error:String(e.message).slice(0,200)});}}
    if(p==='/api/admin/fund'){if(GCFG.cluster==='mainnet-beta')return send(req,res,400,{error:'devnet only'});if(!isWallet(b.to)||!(+b.lamports>0))return send(req,res,400,{error:'bad request'});const sig=await chain.transfer(treasury,b.to,Math.min(Math.floor(+b.lamports),2e9));return send(req,res,200,{sig});}
    if(p==='/api/admin/tick'){E.advance();return send(req,res,200,{tick:E.S.tick});}
    if(p==='/api/admin/epoch'){const idx=b.idx!=null?b.idx:(E.S.epochs.length?E.S.epochs[E.S.epochs.length-1].idx+1:0);return send(req,res,200,await doEpoch(idx,b.pool));}
    if(p==='/api/admin/retry'){const e=E.S.epochs.find(x=>x.idx===b.idx);if(!e)return send(req,res,404,{});await E.execute(e,GCFG.payoutMode==='devnet'&&GCFG.cluster!=='mainnet-beta'?'devnet':'dry',(w,l,onSig)=>chain.transfer(treasury,w,l,onSig),chain&&chain.sigState);return send(req,res,200,e);}
  }
  return false;}

// ---------- X tasks, reservation and invites ----------
const X=require('./lib/xverify');
// manual: X tasks are reviewed by a person (or bot) through the admin endpoints; auto: checked with the X API.
const VERIFY_MODE=process.env.CLAIM_VERIFY==='auto'?'auto':'manual';
const REVIEW_CAP=+process.env.REVIEW_CAP||2000,REVIEW_PER_IP=+process.env.REVIEW_PER_IP||3;
db.reviews=db.reviews||{};db.xhandles=db.xhandles||{};
function reserve(wallet,x,t,ip,refOverride){if(db.claims[wallet])return{ok:true};if(MAX&&db.seq+activeHolds()>=MAX)return{error:'All planets for this season are claimed or reserved.'};
  const pc=db.pending[wallet]||{};const ref=String(refOverride||pc.ref||'').toUpperCase();const code=newCode();const rw=db.codes[ref];const by=rw&&rw!==wallet&&db.claims[rw]?rw:null;if(by)db.claims[by].invites=(db.claims[by].invites||0)+1;
  const c=db.claims[wallet]={wallet,no:null,status:'reserved',reservedAt:Date.now(),seed:crypto.createHash('sha256').update(wallet).digest('hex').slice(0,16),code,by,followed:!!t.follow,invites:0,qinv:0,
    xId:x.id,xHandle:String(x.username).toLowerCase(),xq:{ageDays:Math.floor(x.ageDays||0),followers:x.followers||0},tasks:t,at:new Date().toISOString(),ip:crypto.createHash('sha256').update(String(ip)+DOMAIN).digest('hex').slice(0,12)};
  db.codes[code]=wallet;db.xids[x.id]=wallet;db.xhandles[c.xHandle]=wallet;delete db.pending[wallet];if(REQ.invites<=0)finalize(c);creditInviter(c);save();return{ok:true};}
async function claimRoute(req,res,u,p,ip){
  if(p==='/api/x/verify'&&req.method==='POST'){if(limited(ip,'xv',12,600e3))return send(req,res,429,{error:'Too many checks. Wait a few minutes.'});
    const {wallet,token,handle}=await body(req);const pc=db.pending[wallet];if(!pc||pc.token!==token)return send(req,res,401,{error:'Connect and sign with your wallet first.'});
    const h=String(handle||'').replace(/^@/,'').trim();if(!/^[A-Za-z0-9_]{1,15}$/.test(h))return send(req,res,400,{error:'Enter your X handle.'});
    const tid=tweetId();if((REQ.repost||REQ.like||REQ.reply)&&!tid)return send(req,res,409,{error:'Claim opens when the announcement post is live.'});
    const hl=h.toLowerCase();const owner=db.xhandles[hl];if(owner&&owner!==wallet)return send(req,res,409,{error:'This X account already holds a planet.'});
    if(db.claims[wallet])return send(req,res,200,Object.assign(view(wallet),{ready:true}));
    if(VERIFY_MODE==='manual'){
      // Several wallets may queue the same handle (so nobody can squat a handle); the reviewer approves the one whose code is in the reply and the rest are rejected automatically.
      const iph=crypto.createHash('sha256').update(String(ip)+DOMAIN).digest('hex').slice(0,12);const pend=Object.values(db.reviews).filter(r=>r.status==='pending');
      if(!db.reviews[pc.replyCode]||db.reviews[pc.replyCode].status!=='pending'){if(pend.length>=REVIEW_CAP)return send(req,res,503,{error:'The review queue is full right now. Try again later.'});
        if(pend.filter(r=>r.ip===iph).length>=REVIEW_PER_IP)return send(req,res,429,{error:'Too many claims waiting for review from this network.'});
        if(pend.filter(r=>r.handle===hl).length>=5)return send(req,res,409,{error:'This X account already has several claims waiting for review.'});}
      db.reviews[pc.replyCode]={id:pc.replyCode,wallet,handle:hl,xId:null,code:pc.replyCode,ref:pc.ref||'',status:'pending',ip:iph,created_at:new Date().toISOString()};pc.x='@'+h;save();
      return send(req,res,200,Object.assign(view(wallet),{ready:false,review:true}));}
    let usr;try{usr=await X.userByHandle(h);}catch(e){return send(req,res,e.code===404?404:503,{error:e.code===404?'That X account was not found.':'X checks are unavailable right now. Try again shortly.'});}
    const owner2=db.xids[usr.id];if(owner2&&owner2!==wallet)return send(req,res,409,{error:'This X account already holds a planet.'});
    const t={};try{const off=await X.userByHandle(REQ.official);
      if(REQ.follow)t.follow=await X.follows(usr.id,usr.username,off.id,REQ.official);
      if(REQ.repost)t.repost=await X.reposted(usr.id,tid);
      if(REQ.like){const l=await X.liked(usr.id,tid);t.like=l===null?true:l;if(l===null)t.likeUnverified=true;}
      if(REQ.reply)t.reply=await X.replied(usr.username,tid,pc.replyCode);}
    catch(e){return send(req,res,e.code===429?429:503,{error:e.code===429?e.message:'X checks are unavailable right now. Try again shortly.',tasks:t});}
    pc.x='@'+usr.username;pc.tasks=t;save();
    const ok=['follow','repost','like','reply'].every(k=>!REQ[k]||t[k]);if(!ok)return send(req,res,200,Object.assign(view(wallet),{tasks:t,ready:false}));
    const r=reserve(wallet,{id:usr.id,username:usr.username,ageDays:(Date.now()-Date.parse(usr.createdAt))/864e5,followers:usr.followers},t,ip);if(r.error)return send(req,res,410,{error:r.error,tasks:t});
    return send(req,res,200,Object.assign(view(wallet),{tasks:t,ready:true}));}
  if(p.startsWith('/api/admin/claims')){if(!isAdmin(req))return send(req,res,403,{error:'Forbidden.'});
    if(p==='/api/admin/claims'&&req.method==='GET'){const st=u.searchParams.get('status')||'pending';
      return send(req,res,200,{mode:VERIFY_MODE,tweetId:tweetId(),claims:Object.values(db.reviews).filter(r=>st==='all'||r.status===st).sort((a,b)=>a.created_at<b.created_at?-1:1).map(r=>{const c=db.claims[r.wallet];const by=db.codes[r.ref];
        return{id:r.id,handle:'@'+r.handle,x_user_id:r.xId||null,wallet:r.wallet,code:r.code,ref:r.ref||null,invited_by:by||null,invites:c?c.invites||0:0,qualified_invites:c?c.qinv||0:0,status:r.status,reason:r.reason||null,created_at:r.created_at,reviewed_at:r.reviewed_at||null};})});}
    let m=p.match(/^\/api\/admin\/claims\/([^/]+)\/(approve|reject)$/);if(m&&req.method==='POST'){const r=db.reviews[decodeURIComponent(m[1])];if(!r)return send(req,res,404,{error:'No such review.'});if(r.status!=='pending')return send(req,res,409,{error:'Already '+r.status+'.'});const b=await body(req);
      if(m[2]==='reject'){r.status='rejected';r.reason=String(b.reason||'').slice(0,200);r.reviewed_at=new Date().toISOString();save();return send(req,res,200,r);}
      const owner=db.xhandles[r.handle];if(owner&&owner!==r.wallet)return send(req,res,409,{error:'X account already holds a planet.'});
      const x={id:b.x_user_id?String(b.x_user_id):'h:'+r.handle,username:r.handle,ageDays:b.account_age_days!=null?+b.account_age_days:0,followers:b.followers!=null?+b.followers:0};
      const pc=db.pending[r.wallet]||{ref:r.ref};const res2=reserve(r.wallet,x,{follow:true,repost:true,like:true,reply:true,manual:true},ip,pc.ref||r.ref);if(res2.error)return send(req,res,410,{error:res2.error});
      r.status='approved';r.xId=x.id;r.reviewed_at=new Date().toISOString();
      for(const o of Object.values(db.reviews))if(o!==r&&o.status==='pending'&&o.handle===r.handle){o.status='rejected';o.reason='This X account was approved for another wallet.';o.reviewed_at=r.reviewed_at;}save();return send(req,res,200,Object.assign({review:r},view(r.wallet)));}}

  if(p==='/api/admin/purge'&&req.method==='POST'){if(!isAdmin(req))return send(req,res,403,{error:'Forbidden.'});const b=await body(req);const ws=Array.isArray(b.wallets)?b.wallets.filter(isWallet).slice(0,1000):[];let n=0;
    // Removes test wallets entirely: reviews, pending, reservations (never final planets that already earned, unless force).
    for(const w of ws){for(const [k,r] of Object.entries(db.reviews))if(r.wallet===w){delete db.reviews[k];n++;}delete db.pending[w];const c=db.claims[w];
      if(c&&(c.status==='reserved'||b.force)){if(c.code)delete db.codes[c.code];if(c.xId&&db.xids[c.xId]===w)delete db.xids[c.xId];if(c.xHandle&&db.xhandles[c.xHandle]===w)delete db.xhandles[c.xHandle];delete db.claims[w];n++;}}
    save();return send(req,res,200,{removed:n});}
  if(p==='/api/admin/claimcfg'&&req.method==='POST'){if(!isAdmin(req))return send(req,res,403,{error:'Forbidden.'});const b=await body(req);db.cfg=db.cfg||{};if(b.tweetId!==undefined){if(b.tweetId&&!/^\d{5,25}$/.test(b.tweetId))return send(req,res,400,{error:'bad id'});db.cfg.tweetId=b.tweetId||'';}save();return send(req,res,200,{tweetId:tweetId()});}
  return false;}
module.exports={server,message,verify,db,E,X,REQ};
