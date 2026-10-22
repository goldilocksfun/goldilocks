// Claim flow tests with a mocked X API: follow, sign, repost/like/reply, reservation, qualified invites, one X account per planet, 200 cap with holds.
'use strict';const assert=require('assert');const os=require('os'),path=require('path'),fs=require('fs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'glc'));Object.assign(process.env,{DATA_FILE:dir+'/c.json',CLAIM_TWEET_ID:'2113372352214159852',X_BEARER_TOKEN:'t',X_VERIFY_APP_KEY:'a',X_VERIFY_APP_SECRET:'b',X_VERIFY_ACCESS_TOKEN:'c',X_VERIFY_ACCESS_SECRET:'d',MAX_PLANETS:'3',ADMIN_KEY:'k',X_CACHE_MS:'1',X_FOLLOW_CACHE_MS:'1'});
const nacl=require('tweetnacl');const bs58=(m=>m.default||m)(require('bs58'));const S=require('./server.js');
const U={playgoldilocks:{id:'1',created_at:'2011-01-01T00:00:00Z',f:2000}};const F=new Set(),RT=new Set(),LK=new Set(),RP={};
const add=(h,id,age,f)=>U[h]={id,created_at:new Date(Date.now()-age*864e5).toISOString(),f};
S.X._setFetch(async url=>{const u=new URL(url);const p=u.pathname.replace('/2/','');let d;
  if(p.startsWith('users/by/username/')){const h=p.split('/').pop().toLowerCase();const x=U[h];d=x?{data:{id:x.id,username:h,created_at:x.created_at,public_metrics:{followers_count:x.f}}}:{}}
  else if(p.endsWith('/followers'))d={data:[...F].map(id=>({id}))};else if(p.endsWith('/retweeted_by'))d={data:[...RT].map(id=>({id}))};else if(p.endsWith('/liking_users'))d={data:[...LK].map(id=>({id}))};
  else if(p==='tweets/search/recent'){const h=/from:(\w+)/.exec(u.searchParams.get('query'))[1].toLowerCase();d={data:(RP[h]||[]).map(text=>({text}))}}
  return{ok:true,status:200,json:async()=>d};});
let B;const j=async(p,b)=>{const r=await fetch(B+p,b?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{});return{s:r.status,b:await r.json()}};
const kp=()=>{const k=nacl.sign.keyPair();return{k,w:bs58.encode(k.publicKey)}};
async function sign(a,ref){const n=await j('/api/nonce',{wallet:a.w});const sig=nacl.sign.detached(new TextEncoder().encode(n.b.message),a.k.secretKey);return(await j('/api/claim',{wallet:a.w,signature:Buffer.from(sig).toString('base64'),ref})).b;}
const doAll=(h,id,code)=>{F.add(id);RT.add(id);LK.add(id);RP[h]=['Claiming my free Goldilocks planet. '+code];};
S.server.listen(0,async()=>{B='http://localhost:'+S.server.address().port;let n=0;const ok=m=>{n++;console.log('ok',m)};
 try{const A=kp();add('alice','11',400,50);const sa=await sign(A);assert.equal(sa.status,'signed');assert(sa.token&&/^GL-/.test(sa.replyCode));ok('sign creates pending session with reply code');
  let v=await j('/api/x/verify',{wallet:A.w,token:sa.token,handle:'@alice'});assert.equal(v.b.ready,false);assert.deepEqual(v.b.tasks,{follow:false,repost:false,like:false,reply:false});ok('nothing done, all four tasks false');
  F.add('11');RT.add('11');LK.add('11');RP.alice=['nice'];v=await j('/api/x/verify',{wallet:A.w,token:sa.token,handle:'alice'});assert.equal(v.b.ready,false);assert.equal(v.b.tasks.reply,false);ok('reply without the code does not count');
  RP.alice=['Claiming '+sa.replyCode];v=await j('/api/x/verify',{wallet:A.w,token:sa.token,handle:'alice'});assert.equal(v.b.status,'reserved');assert.equal(v.b.claimed,false);assert(v.b.code);ok('all tasks done, planet reserved, not final');
  const bad=await j('/api/x/verify',{wallet:A.w,token:'nope',handle:'alice'});assert.equal(bad.s,401);ok('wrong session token refused');
  // same X account on another wallet
  const A2=kp();const s2=await sign(A2);const dup=await j('/api/x/verify',{wallet:A2.w,token:s2.token,handle:'alice'});assert.equal(dup.s,409);ok('one X account per planet');
  // young account invite does not count
  const Y=kp();add('young','12',5,100);const sy=await sign(Y,v.b.code);doAll('young','12',sy.replyCode);const vy=await j('/api/x/verify',{wallet:Y.w,token:sy.token,handle:'young'});assert.equal(vy.b.status,'reserved');
  let me=(await j('/api/me?wallet='+A.w)).b;assert.equal(me.invites,1);assert.equal(me.qualifiedInvites,0);assert.equal(me.status,'reserved');ok('invite from a 5-day-old account is not qualified');
  // qualified invite finalizes inviter
  const Q=kp();add('bob','13',90,40);const sq=await sign(Q,v.b.code);doAll('bob','13',sq.replyCode);await j('/api/x/verify',{wallet:Q.w,token:sq.token,handle:'bob'});
  me=(await j('/api/me?wallet='+A.w)).b;assert.equal(me.qualifiedInvites,1);assert.equal(me.status,'final');assert.equal(me.no,1);ok('qualified invite finalizes the inviter with planet number');
  let st=(await j('/api/stats')).b;assert.equal(st.total,1);assert.equal(st.reserved,2);ok('stats count finalized and reserved separately');
  // cap 3: 1 final + 2 holds = full
  const Z=kp();add('zed','14',90,40);const sz=await sign(Z);doAll('zed','14',sz.replyCode);const vz=await j('/api/x/verify',{wallet:Z.w,token:sz.token,handle:'zed'});assert.equal(vz.s,410);ok('cap counts finalized plus active 48h holds');
  // engine sees only final planets
  S.E.advance();assert(S.E.S.planets[A.w]);assert(!S.E.S.planets[Y.w]);ok('only final claims become game planets');
  // admin tweet id
  const r=await fetch(B+'/api/admin/claimcfg',{method:'POST',headers:{'content-type':'application/json','x-admin-key':'k'},body:JSON.stringify({tweetId:'123456789'})});assert.equal((await r.json()).tweetId,'123456789');ok('tweet id changeable without redeploy');
  console.log('PASS',n,'claim tests');process.exit(0);}catch(e){console.error('FAIL',e);process.exit(1)}});
