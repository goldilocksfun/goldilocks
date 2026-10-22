// Manual review mode: verify queues a review, admin lists, approves (reserve + invite credit) and rejects.
'use strict';const assert=require('assert');const os=require('os'),path=require('path'),fs=require('fs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'glr'));Object.assign(process.env,{DATA_FILE:dir+'/c.json',CLAIM_TWEET_ID:'2113372352214159852',ADMIN_KEY:'k',CLAIM_VERIFY:'manual',MAX_PLANETS:'200'});
const nacl=require('tweetnacl');const bs58=(m=>m.default||m)(require('bs58'));const S=require('./server.js');
let B;const j=async(p,b,adm)=>{const h={'content-type':'application/json'};if(adm)h['x-admin-key']=adm;const r=await fetch(B+p,b!==undefined?{method:'POST',headers:h,body:JSON.stringify(b)}:{headers:h});return{s:r.status,b:await r.json()}};
const kp=()=>{const k=nacl.sign.keyPair();return{k,w:bs58.encode(k.publicKey)}};
async function sign(a,ref){const n=await j('/api/nonce',{wallet:a.w});const sig=nacl.sign.detached(new TextEncoder().encode(n.b.message),a.k.secretKey);return(await j('/api/claim',{wallet:a.w,signature:Buffer.from(sig).toString('base64'),ref})).b;}
S.server.listen(0,async()=>{B='http://localhost:'+S.server.address().port;let n=0;const ok=m=>{n++;console.log('ok',m)};
 try{const A=kp();const sa=await sign(A);let v=await j('/api/x/verify',{wallet:A.w,token:sa.token,handle:'@Alice'});assert.equal(v.b.status,'review');ok('verify queues a review in manual mode');
  assert.equal((await j('/api/admin/claims?status=pending')).s,403);ok('admin list needs key');
  let L=(await j('/api/admin/claims?status=pending',undefined,'k')).b.claims;assert.equal(L.length,1);assert.equal(L[0].handle,'@alice');assert.equal(L[0].code,sa.replyCode);assert.equal(L[0].wallet,A.w);ok('pending list has handle, wallet, code, created_at');
  const A2=kp();const s2=await sign(A2);const d=await j('/api/x/verify',{wallet:A2.w,token:s2.token,handle:'alice'});assert.equal(d.s,409);ok('same handle cannot queue twice');
  let r=await j('/api/admin/claims/'+encodeURIComponent(L[0].id)+'/approve',{x_user_id:'111',account_age_days:400,followers:50},'k');assert.equal(r.s,200);assert.equal(r.b.status,'reserved');ok('approve reserves the planet');
  r=await j('/api/admin/claims/'+encodeURIComponent(L[0].id)+'/approve',{},'k');assert.equal(r.s,409);ok('approve is idempotent');
  const Bk=kp();const sb=await sign(Bk,r.b?((await j('/api/me?wallet='+A.w)).b.code):'');await j('/api/x/verify',{wallet:Bk.w,token:sb.token,handle:'bob'});
  L=(await j('/api/admin/claims?status=pending',undefined,'k')).b.claims;const rb=L.find(x=>x.handle==='@bob');assert(rb.invited_by===A.w);
  await j('/api/admin/claims/'+encodeURIComponent(rb.id)+'/approve',{x_user_id:'222',account_age_days:90,followers:20},'k');
  const me=(await j('/api/me?wallet='+A.w)).b;assert.equal(me.qualifiedInvites,1);assert.equal(me.status,'final');ok('approved qualified invitee finalizes inviter');
  const C=kp();const sc=await sign(C);await j('/api/x/verify',{wallet:C.w,token:sc.token,handle:'carl'});L=(await j('/api/admin/claims',undefined,'k')).b.claims;
  r=await j('/api/admin/claims/'+encodeURIComponent(L[0].id)+'/reject',{reason:'No reply with code found'},'k');assert.equal(r.b.status,'rejected');
  const mc=(await j('/api/me?wallet='+C.w)).b;assert.equal(mc.status,'rejected');assert.equal(mc.reason,'No reply with code found');ok('reject with reason is shown to the user');
  const again=await j('/api/x/verify',{wallet:C.w,token:sc.token,handle:'carl'});assert.equal(again.b.status,'review');ok('rejected user can resubmit');
  console.log('PASS',n,'review tests');process.exit(0)}catch(e){console.error('FAIL',e);process.exit(1)}});
