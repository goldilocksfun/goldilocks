// Play dashboard: live planet status, thruster burns, earnings, leaderboard and public payout ledger.
(function(){'use strict';
const API=(window.CONFIG&&window.CONFIG.API_BASE)||'';const $=s=>document.querySelector(s);
const hash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h};
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const pname=w=>{const r=rng(hash(w));for(let i=0;i<15;i++)r();return 'GL '+(hash(w+'n')%9000+1000)+' '+'BCDFGHJKLMNPRSTVXZ'[Math.floor(r()*18)]};
const short=w=>w.slice(0,4)+'..'+w.slice(-4);const sol=l=>(l/1e9).toLocaleString('en-US',{maximumFractionDigits:4})+' SOL';
const zname={habitable:'Habitable',hot:'Too hot',cold:'Too cold'},zcls={habitable:'hab',hot:'hot',cold:'cold'};
let G=null,W=null,wal=null;
const msg=(t,c)=>{const m=$('#msg');m.textContent=t||'';m.className='msg mono'+(c?' '+c:'')};
async function api(p,o){const r=await fetch(API+p,Object.assign({headers:{'content-type':'application/json'}},o));const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'Request failed.');e.status=r.status;e.body=j;throw e}return j}
const ex=s=>'https://explorer.solana.com/tx/'+s+(G&&G.cluster!=='mainnet-beta'?'?cluster='+G.cluster:'');
const link=(s,t)=>'<a href="'+ex(s)+'" target="_blank" rel="noopener">'+(t||short(s))+'</a>';
const fmtH=h=>h<48?h.toFixed(1)+' h':(h/24).toFixed(1)+' days';
function nextEpoch(){if(!G)return'-';const t=Date.now();const k=Math.floor((t-G.epochAnchor)/G.epochMs)+1;const d=G.epochAnchor+k*G.epochMs-t;const h=Math.floor(d/3600e3),m=Math.floor(d%3600e3/60e3);return h+'h '+String(m).padStart(2,'0')+'m'}
async function season(){G=await api('/api/game');const dev=G.cluster!=='mainnet-beta';$('#net').style.display=dev?'':'none';$('#clusterNote').textContent=dev?'/ '+G.cluster[0].toUpperCase()+G.cluster.slice(1)+' test':'';$('#footNote').style.display=dev?'':'none';
 $('#tCost').textContent=(G.thrustLamports/1e9).toString();
 $('#season').innerHTML=[['Planets',G.planets],['Life jackpot',sol(G.jackpot)],['Burn pool',sol(G.burnPool)],['Next payout',nextEpoch()]].map(([a,b])=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>').join('')}
async function board(){const {planets}=await api('/api/leaderboard');const tb=$('#lb tbody');
 tb.innerHTML=planets.length?planets.map((p,i)=>'<tr class="'+(p.wallet===W?'mine':'')+'"><td>'+(i+1)+'</td><td><a href="?wallet='+p.wallet+'">'+short(p.wallet)+'</a></td><td class="'+(zcls[p.zone]||'')+'">'+(zname[p.zone]||'Pending')+'</td><td>'+p.mass+'</td><td>'+p.zoneHours+'</td><td>'+p.stage+'</td><td>'+p.weight+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">No planets yet.</td></tr>'}
async function ledger(){const {epochs}=await api('/api/epochs');const L=$('#ledger');if(!epochs.length){L.innerHTML='<p class="empty">No epochs closed yet. The first payout lands at 20:00 Taipei time.</p>';return}
 L.innerHTML=epochs.map(e=>'<details class="ep"><summary class="mono"><span>Epoch '+e.idx+'</span><span class="dim">'+new Date(e.closedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</span><span>Pool '+sol(e.pool)+'</span><span>Burns '+sol(e.burn)+'</span><span>To planets '+sol(e.hz)+'</span><span>To jackpot '+sol(e.jackpotIn)+'</span><span>Ops '+sol(e.ops)+'</span>'+(e.award?'<span class="hab">Life award '+sol(e.award.lamports)+' to '+short(e.award.wallet)+'</span>':'')+'</summary>'+
  (e.payouts.length?'<table class="tbl mono"><thead><tr><th>Wallet</th><th>Amount</th><th>Status</th><th>Transaction</th></tr></thead><tbody>'+e.payouts.map(p=>'<tr><td>'+short(p.wallet)+'</td><td>'+sol(p.lamports)+'</td><td>'+p.status+'</td><td>'+(p.sig?link(p.sig):'-')+'</td></tr>').join('')+'</tbody></table>':'<p class="empty">No payouts above the minimum this epoch. Balances carry over.</p>')+'</details>').join('')}
async function mine(){if(!W)return;let p;try{p=await api('/api/planet/'+W)}catch(e){$('#me').hidden=true;msg(e.status===404?'No planet for this wallet yet. Claim one free, or hold at least 0.01 percent of supply.':e.message,'err');return}
 $('#me').hidden=false;$('#pName').textContent=pname(W);$('#pWallet').textContent=W;
 const [a,b]=G.hz,lo=.6,hi=1.8,pc=x=>Math.max(0,Math.min(100,(x-lo)/(hi-lo)*100));$('.zhz').style.left=pc(a)+'%';$('.zhz').style.width=(pc(b)-pc(a))+'%';$('#zdot').style.left=pc(p.distance||p.au)+'%';
 const z=$('#sZone');z.textContent=zname[p.zone]||'Pending first tick';z.className=zcls[p.zone]||'';
 $('#sDist').textContent=(p.distance||p.au).toFixed(3)+' AU';$('#sMass').textContent=p.mass;$('#sSrc').textContent=p.src==='free'?'Free claim':'Holder';
 $('#sTime').textContent=fmtH(p.zoneHours);$('#sStage').textContent=p.stage;$('#sWeight').textContent=p.weight;
 const holdLeft=p.src==='free'||!p.holdSince?0:Math.max(0,G.minHoldMs-(Date.now()-p.holdSince));$('#sElig').textContent=p.eligible?'Yes':p.mass===0?'No mass':holdLeft?'In '+Math.ceil(holdLeft/3600e3)+' h':'Next tick';
 $('#tNote').textContent=p.freeBurnAvailable?'Free burn available today.':'Free burn used today. Next burn costs '+(G.thrustLamports/1e9)+' SOL.';
 $('#burns').innerHTML=p.burns.slice().reverse().map(x=>'<li><span>'+(x.dir==='in'?'Inward':'Outward')+' '+x.before.toFixed(3)+' to '+x.after.toFixed(3)+' AU</span><span>'+(x.sig?link(x.sig):'Free')+'</span></li>').join('');
 const e=await api('/api/earnings/'+W);$('#eTotal').textContent=sol(e.paidLamports);$('#eShare').textContent=(e.pendingShare*100).toFixed(2)+' %';
 $('#eEst').textContent=G.feePool||G.burnPool?sol(Math.floor(((G.feePool||0)*G.split[0]+G.burnPool)*e.pendingShare)):'Depends on volume';$('#eCarry').textContent=sol(e.carryLamports);$('#eNext').textContent=nextEpoch();
 $('#pays').innerHTML=e.history.map(h=>'<li><span>Epoch '+h.epoch+' '+sol(h.lamports)+'</span><span>'+(h.sig?link(h.sig):h.status)+'</span></li>').join('');
 const own=wal&&wal.address===W;['#bIn','#bOut'].forEach(s=>$(s).disabled=!own);if(!own)$('#tNote').textContent='Connect this wallet to steer.'}
async function burn(dir){if(!wal||wal.address!==W)return;const B=$(dir==='in'?'#bIn':'#bOut');B.classList.add('busy');
 try{const n=await api('/api/thruster/nonce',{method:'POST',body:JSON.stringify({wallet:W,dir})});let r;
  if(n.free){msg('Approve the burn signature in your wallet. Free today, no transaction.');const sig=await wal.signMessage(new TextEncoder().encode(n.memo));
   r=await api('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:W,nonce:n.nonce,messageSignature:btoa(String.fromCharCode(...new Uint8Array(sig)))})});}
  else{const S=window.solanaWeb3;if(!S)throw new Error('Transaction support is still loading.');if(!wal.signAndSend)throw new Error('This wallet cannot send transactions here.');
   msg('Approve '+(n.lamports/1e9)+' SOL on '+n.cluster+' in your wallet.');if(!G.clientRpc)throw new Error('Burns are not open on this network yet.');const c=new S.Connection(G.clientRpc,'confirmed');
   const pk=new S.PublicKey(W);const tx=new S.Transaction().add(S.SystemProgram.transfer({fromPubkey:pk,toPubkey:new S.PublicKey(n.treasury),lamports:n.lamports}),new S.TransactionInstruction({keys:[{pubkey:pk,isSigner:true,isWritable:false}],programId:new S.PublicKey(n.memoProgram),data:new TextEncoder().encode(n.memo)}));
   tx.feePayer=pk;tx.recentBlockhash=(await c.getLatestBlockhash()).blockhash;const sig=await wal.signAndSend(tx,n.cluster);msg('Confirming on chain.');
   for(let i=0;i<20;i++){try{r=await api('/api/thruster/verify',{method:'POST',body:JSON.stringify({wallet:W,nonce:n.nonce,signature:sig})});break}catch(e){if(!/not found/i.test(e.message)||i===19)throw e;await new Promise(z=>setTimeout(z,1500))}}}
  msg('Burn applied. Orbit '+r.before.toFixed(3)+' to '+r.after.toFixed(3)+' AU.','ok');await refresh();}
 catch(e){msg((e&&e.message)||'Burn cancelled.','err')}B.classList.remove('busy')}
async function refresh(){try{await season();await Promise.all([mine(),board(),ledger()])}catch(e){msg(API?'Live data is unavailable right now. Try again shortly.':'The game opens at launch.','err')}}
function view(w){W=w;history.replaceState(null,'','?wallet='+w);refresh()}
$('#bConnect').onclick=async()=>{try{let w=window.__wallets.current();if(!w){w=await window.__wallets.pick();if(!w)return}wal=w;$('#bConnect').textContent=short(w.address);view(w.address)}catch(e){msg(e.message||'Connection cancelled.','err')}};
$('#look').onsubmit=e=>{e.preventDefault();const v=$('#lookIn').value.trim();if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))view(v);else msg('That does not look like a Solana address.','err')};
$('#bIn').onclick=()=>burn('in');$('#bOut').onclick=()=>burn('out');
const q=new URLSearchParams(location.search).get('wallet');if(q)W=q;refresh();setInterval(refresh,30e3);
})();
