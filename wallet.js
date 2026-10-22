// Solana wallet picker, adapted from Primordial. Wallet Standard plus legacy injected providers. signMessage only.
(function(){'use strict';
const norm=s=>String(s).toLowerCase().replace(/[^a-z]/g,'').replace(/wallet$/,'');const same=(a,k)=>{const x=norm(a),y=norm(k.key||k.name);return x===y||x.startsWith(y)||y.startsWith(x)};
const found=new Map();let current=null,resolver=null,render=null;
function addStd(w){if(!w||!w.name)return;const f=w.features||{};const sol=(w.chains||[]).some(c=>String(c).startsWith('solana:'));
  if(!sol||!f['standard:connect']||!f['solana:signMessage'])return;const ek=[...found.keys()].find(k=>norm(k)===norm(w.name));if(ek&&ek!==w.name)found.delete(ek);const cur=found.get(w.name)||{name:w.name};cur.std=w;cur.icon=w.icon||cur.icon;delete cur.legacy;found.set(w.name,cur);render&&render();}
const api={register:(...ws)=>{ws.forEach(addStd);return()=>{};}};
addEventListener('wallet-standard:register-wallet',e=>{try{e.detail(api);}catch(x){}});
try{dispatchEvent(new CustomEvent('wallet-standard:app-ready',{detail:api}));}catch(x){}
function legacy(){const L=[['Phantom',window.phantom&&window.phantom.solana],['Solflare',window.solflare],['Backpack',window.backpack&&window.backpack.solana||window.backpack],['OKX Wallet',window.okxwallet&&window.okxwallet.solana],['Coinbase Wallet',window.coinbaseSolana],['Trust Wallet',window.trustwallet&&window.trustwallet.solana]];
  const has=n=>[...found.keys()].some(k=>norm(k)===norm(n)||norm(k).startsWith(norm(n))||norm(n).startsWith(norm(k)));
  for(const [n,p] of L)if(p&&p.connect&&p.signMessage&&!has(n))found.set(n,{name:n,legacy:p});
  const g=window.solana;if(g&&g.connect&&g.signMessage&&![...found.values()].some(v=>v.legacy===g)){const n=g.isPhantom?'Phantom':g.isSolflare?'Solflare':g.isBackpack?'Backpack':g.isGlow?'Glow':g.isExodus?'Exodus':'Solana wallet';if(!has(n))found.set(n,{name:n,legacy:g});}}
function adapter(e){if(e.legacy){const p=e.legacy;return{name:e.name,async connect(){const r=await p.connect();const pk=(r&&r.publicKey)||p.publicKey;this.address=pk.toString();return this.address;},
    async signMessage(m){const r=await p.signMessage(m,'utf8');return r.signature||r;},
    async signAndSend(tx,chain){const r=await p.signAndSendTransaction(tx);return r.signature||r;},async disconnect(){try{await p.disconnect();}catch(x){}}};}
  const w=e.std,f=w.features;let acct=null;
  return{name:e.name,async connect(){const r=await f['standard:connect'].connect();acct=(r.accounts||w.accounts||[]).find(a=>(a.chains||[]).some(c=>String(c).startsWith('solana:')))||(r.accounts||w.accounts)[0];if(!acct)throw new Error('No Solana account in this wallet.');this.address=acct.address;return acct.address;},
    async signMessage(m){const [o]=await f['solana:signMessage'].signMessage({account:acct,message:m});return o.signature;},
    async signAndSend(tx,chain){const ft=f['solana:signAndSendTransaction'];if(!ft)throw new Error('This wallet cannot send transactions here.');const [o]=await ft.signAndSendTransaction({account:acct,chain:'solana:'+(chain==='mainnet-beta'?'mainnet':chain||'devnet'),transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false})});return b58(o.signature);},
    async disconnect(){const d=f['standard:disconnect'];if(d)try{await d.disconnect();}catch(x){}}};}
const b58=b=>{const A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let d=[0];for(const x of b){let c=x;for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=c/58|0;}while(c){d.push(c%58);c=c/58|0;}}let s='';for(const x of b){if(x)break;s+='1';}for(let i=d.length-1;i>=0;i--)s+=A[d[i]];return s;};
const here=()=>location.href.split('#')[0],enc=encodeURIComponent;
const KNOWN=[{name:'Phantom',icon:'wallets/phantom.svg',site:'https://phantom.app/download',deep:()=>'https://phantom.app/ul/browse/'+enc(here())+'?ref='+enc(location.origin)},
 {name:'Solflare',icon:'wallets/solflare.svg',site:'https://solflare.com/download',deep:()=>'https://solflare.com/ul/v1/browse/'+enc(here())+'?ref='+enc(location.origin)},
 {name:'Backpack',icon:'wallets/backpack.png',site:'https://backpack.app/downloads',deep:()=>'https://backpack.app/ul/v1/browse/'+enc(here())+'?ref='+enc(location.origin)},
 {name:'Jupiter',icon:'wallets/jupiter.png',site:'https://jup.ag/mobile'},
 {name:'OKX Wallet',key:'okx',icon:'wallets/okx.png',site:'https://www.okx.com/web3',deep:()=>'https://www.okx.com/download?deeplink='+enc('okx://wallet/dapp/url?dappUrl='+enc(here()))},
 {name:'Coinbase Wallet',key:'coinbase',icon:'wallets/coinbase.png',site:'https://www.coinbase.com/wallet/downloads',deep:()=>'https://go.cb-w.com/dapp?cb_url='+enc(here())},
 {name:'Trust Wallet',key:'trust',icon:'wallets/trust.png',site:'https://trustwallet.com/download',deep:()=>'https://link.trustwallet.com/open_url?coin_id=501&url='+enc(here())},
 {name:'MetaMask',icon:'wallets/metamask.svg',site:'https://metamask.io/download',desktopOnly:1}];
const mobile=()=>/iPhone|iPad|Android/i.test(navigator.userAgent);
const el=h=>{const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild;};
function open(){try{dispatchEvent(new CustomEvent('wallet-standard:app-ready',{detail:api}));}catch(x){}legacy();let dlg=document.getElementById('wdlg');
  if(!dlg){dlg=el('<div id="wdlg" class="wdlg" role="dialog" aria-modal="true" aria-labelledby="wdlgT"><div class="wcard"><p class="mono dim">Solana</p><h3 id="wdlgT">Choose a wallet</h3><div id="wlist"></div><p class="wnote" id="wnote">Connecting asks for a message signature only. No transaction, no fee, no funds move.</p><button class="wclose" id="wcancel">Not now</button></div></div>');
    document.body.appendChild(dlg);const close=()=>{dlg.classList.remove('on');resolver&&resolver(null);resolver=null;};dlg.querySelector('#wcancel').onclick=close;dlg.addEventListener('click',e=>{if(e.target===dlg)close();});addEventListener('keydown',e=>{if(e.key==='Escape'&&dlg.classList.contains('on'))close();});}
  render=()=>{const list=dlg.querySelector('#wlist');list.innerHTML='';const inst=[...found.values()];
    const row=(name,icon)=>{const r=el('<div class="wrow"><span class="wn"></span><span class="wa"></span></div>');const n=r.firstChild;const im=document.createElement('img');im.alt='';if(icon)im.src=icon;n.appendChild(im);n.appendChild(document.createTextNode(name));return r;};
    if(inst.length){list.appendChild(el('<p class="wh mono">In this browser</p>'));for(const e of inst){const kn=KNOWN.find(k=>same(e.name,k));const r=row(e.name,e.icon||(kn&&kn.icon));r.querySelector('.wn').appendChild(el('<em class="wtag mono">Detected</em>'));
      const b=el('<button class="wbtn">Connect</button>');b.onclick=async()=>{const note=dlg.querySelector('#wnote');note.textContent='Waiting for '+e.name+'.';try{const ad=adapter(e);await ad.connect();current=ad;dlg.classList.remove('on');resolver&&resolver(ad);resolver=null;}catch(x){note.textContent=((x&&x.message)||'Connection cancelled.')+' Try again or choose another wallet.';}};r.lastChild.appendChild(b);list.appendChild(r);}}
    const others=KNOWN.filter(k=>!inst.some(e=>same(e.name,k))&&!(mobile()&&k.desktopOnly));
    if(others.length){list.appendChild(el('<p class="wh mono">'+(mobile()?'Open in wallet app':'Install')+'</p>'));for(const k of others){const r=row(k.name,k.icon);const a=el('<a class="wbtn ghost" target="_blank" rel="noopener"></a>');const dl=mobile()&&k.deep;a.href=dl?k.deep():k.site;a.textContent=dl?'Open':mobile()?'Get app':'Install';r.lastChild.appendChild(a);list.appendChild(r);}}};
  render();dlg.classList.add('on');return new Promise(r=>{resolver=r;});}
window.__wallets={pick:open,current:()=>current,async disconnect(){const c=current;current=null;if(c)await c.disconnect();}};
})();
