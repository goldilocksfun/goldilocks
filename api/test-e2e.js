// API end to end test with throwaway keypairs: nonce, signMessage, verify, one per wallet, referral, bad signature, replay.
const nacl=require('tweetnacl');const bs58=(m=>m.default||m)(require('bs58'));const assert=require('assert');
const B=process.env.API||'http://localhost:48787';const O=process.env.ORIGIN||'http://localhost:47593';
const j=async(p,o)=>{const r=await fetch(B+p,Object.assign({headers:{'content-type':'application/json',origin:O}},o));return{s:r.status,b:await r.json().catch(()=>null),h:r.headers}};
const kp=()=>{const k=nacl.sign.keyPair();return{k,w:bs58.encode(k.publicKey)}};
async function claim(a,ref,tamper){const n=await j('/api/nonce',{method:'POST',body:JSON.stringify({wallet:a.w})});let sig=nacl.sign.detached(new TextEncoder().encode(n.b.message),a.k.secretKey);if(tamper)sig[0]^=1;
 return j('/api/claim',{method:'POST',body:JSON.stringify({wallet:a.w,signature:Buffer.from(sig).toString('base64'),ref})});}
(async()=>{const s0=(await j('/api/stats')).b.total;const A=kp(),Bk=kp(),C=kp(),D=kp();
 const bad=await claim(D,'',true);assert.equal(bad.s,401);
 const a=await claim(A);assert.equal(a.s,200);assert(a.b.claimed&&a.b.code);assert.equal(a.h.get('access-control-allow-origin'),O);
 const again=await claim(A);assert(again.b.already);assert.equal(again.b.no,a.b.no);
 const b=await claim(Bk,a.b.code);assert.equal(b.s,200);const c=await claim(C,a.b.code.toLowerCase());assert.equal(c.s,200);
 const self=kp();const sc=await claim(self,'NOPE123');assert.equal(sc.s,200);
 const me=await j('/api/me?wallet='+A.w);assert.equal(me.b.invites,2);
 const noNonce=await j('/api/claim',{method:'POST',body:JSON.stringify({wallet:kp().w,signature:'AAAA'})});assert.equal(noNonce.s,400);
 const st=(await j('/api/stats')).b;assert.equal(st.total,s0+4);assert(st.top.some(x=>x.invites===2));
 console.log('API E2E PASS',JSON.stringify({total:st.total,inviterInvites:me.b.invites,code:a.b.code}));})().catch(e=>{console.error('FAIL',e);process.exit(1)});
