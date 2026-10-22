import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {NOISE,planetVS,planetFS} from './planet-shaders.js';
import {planetType,FSX,typeUniforms,applyType} from './planets.js';
import {createSky} from './sky.js';
const CFG=Object.assign({API_BASE:'',X_HANDLE:''},window.CONFIG||{});const API=String(CFG.API_BASE||'').replace(/\/+$/,'');
const $=s=>document.querySelector(s);const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;if(RM)document.documentElement.classList.add('rm');
const LS={get:k=>{try{return localStorage.getItem('gl_'+k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem('gl_'+k,v)}catch(e){}}};

/* ---------- seeded planet ---------- */
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function planetFor(w){const D=planetType(w);D.moon=D.moons>0;return D}

/* ---------- renderer ---------- */
const cv=$('#cgl');const DPR=Math.min(devicePixelRatio||1,innerWidth<760?1:1.5);
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(DPR);renderer.setClearColor(0x020308);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,4000);
const P=new THREE.Vector3(30,0,0);const sys=new THREE.Group();sys.position.copy(P);scene.add(sys);
// starfield
{const N=5000,pos=new Float32Array(N*3),col=new Float32Array(N*3),sz=new Float32Array(N);const r=rng(7);
 for(let i=0;i<N;i++){const v=new THREE.Vector3(r()*2-1,r()*2-1,r()*2-1).normalize().multiplyScalar(900+r()*600);pos.set([v.x,v.y,v.z],i*3);const t=r();const c=t<.15?[1,.85,.6]:t<.3?[.7,.85,1]:[1,1,1];col.set(c,i*3);sz[i]=Math.pow(r(),6)*3.2+.55}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('aS',new THREE.BufferAttribute(sz,1));
 const m=new THREE.ShaderMaterial({uniforms:{t:{value:0},d:{value:DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float aS;attribute vec3 color;varying vec3 vC;varying float vA;uniform float t,d;void main(){vC=color;vA=.55+.45*sin(t*1.3+position.x*.07+position.y*.11);gl_PointSize=aS*d;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,r);a=a*a;gl_FragColor=vec4(vC*a*vA*1.1,1.);}`});
 scene.add(new THREE.Points(g,m));scene.userData.stars=m}
// nebula backdrop
const neb=new THREE.Mesh(new THREE.SphereGeometry(2000,48,32),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{t:{value:0}},vertexShader:`varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:NOISE+`uniform float t;varying vec3 vP;void main(){vec3 p=vP;float n=fbm(p*2.2+vec3(0.,0.,t*.004));float m=fbm(p*4.5+n*1.4+3.1);float g=smoothstep(.0,.9,n)*smoothstep(-.3,.6,m);
 vec3 c=mix(vec3(.02,.09,.11),vec3(.22,.13,.05),smoothstep(-.2,.6,m));c*=g*.55;c+=vec3(.08,.05,.02)*pow(max(dot(p,normalize(vec3(-1.,.15,-.3))),0.),6.)*.8;gl_FragColor=vec4(c,1.);}`}));scene.add(neb);
// distant sun at origin (light source for planet shader)
const sunG=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vU;void main(){float r=length(vU);float a=exp(-r*7.)*1.6+exp(-r*2.4)*.18;gl_FragColor=vec4(vec3(1.,.78,.5)*a,1.);}`}));scene.add(sunG);

// planet with dissolve-in
const FS=FSX.replace('uniform vec3 cA','uniform float form;uniform vec3 cA').replace(/gl_FragColor=vec4\(lit,1\.\);\}$/,'float dn=snoise(normalize(vP)*2.4+seed*.3)*.5+.5;float th=form*1.3-.15;if(dn>th)discard;float eg=smoothstep(th-.035,th,dn)*(1.-step(1.,form));lit+=vec3(1.,.68,.3)*eg*1.6;gl_FragColor=vec4(lit,1.);}');
const pMat=new THREE.ShaderMaterial({uniforms:{...typeUniforms(),cA:{value:new THREE.Color()},cB:{value:new THREE.Color()},cC:{value:new THREE.Color()},seed:{value:1},water:{value:0},life:{value:0},ice:{value:0},t:{value:0},gas:{value:0},cshadow:{value:.8},form:{value:0}},vertexShader:planetVS,fragmentShader:FS});
const body=new THREE.Mesh(new THREE.SphereGeometry(1,160,160),pMat);const tiltG=new THREE.Group();sys.add(tiltG);tiltG.add(body);
const cloudMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},u:{value:0}},transparent:true,depthWrite:false,vertexShader:planetVS,
 fragmentShader:NOISE+`uniform float t,u;varying vec3 vP,vN,vW;void main(){vec3 p=normalize(vP);vec3 q=p*3.2;q+=vec3(fbm3(p*2.+t*.015),fbm3(p*2.+5.2-t*.012),0.)*.6;q.x+=t*.02*(1.-abs(p.y));float n=fbm(q);n+=snoise(p*14.+t*.03)*.08;float a=smoothstep(.05,.45,n)*u;vec3 L=normalize(-vW);float d=smoothstep(-.1,.4,dot(normalize(vN),L));gl_FragColor=vec4(vec3(.92)*(d*.9+.02),a*(.12+d*.62));}`});
const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.012,128,128),cloudMat);tiltG.add(clouds);
const atmMat=new THREE.ShaderMaterial({uniforms:{u:{value:0},c:{value:new THREE.Color(0x4f9dff)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,vertexShader:planetVS,
 fragmentShader:`uniform float u;uniform vec3 c;varying vec3 vP,vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);float rim=pow(1.-abs(dot(N,V)),1.6);float edge=smoothstep(0.,.35,abs(dot(N,V)));vec3 L=normalize(-vW);float d=smoothstep(-.4,.5,dot(N,L));gl_FragColor=vec4(c*rim*edge*d*u*2.,1.);}`});
const atm=new THREE.Mesh(new THREE.SphereGeometry(1.07,128,128),atmMat);tiltG.add(atm);
const ringMat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{u:{value:0},c:{value:new THREE.Color(.95,.8,.55)}},vertexShader:`varying vec3 vP,vW;void main(){vP=position;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,
 fragmentShader:`uniform float u;uniform vec3 c;varying vec3 vP,vW;void main(){float r=length(vP.xy);float b=.55+.45*sin(r*46.)*sin(r*13.+1.);b*=.75+.25*sin(r*120.);float a=smoothstep(1.45,1.52,r)*smoothstep(2.35,2.2,r)*(1.-smoothstep(1.86,1.9,r)*smoothstep(1.95,1.91,r)*.8);
 vec3 L=normalize(-vW);float lit=.35+.65*max(dot(normalize(vec3(0.,0.,1.)),L)*.5+.5,0.);float rev=smoothstep(u*2.5-.3,u*2.5-.6,r-1.4);gl_FragColor=vec4(c*b*lit*.75,a*b*.6*(1.-rev)*step(.001,u));}`});
const ring=new THREE.Mesh(new THREE.RingGeometry(1.4,2.4,256,1),ringMat);ring.rotation.x=-Math.PI/2+.28;tiltG.add(ring);
const moonMat=new THREE.ShaderMaterial({uniforms:{...typeUniforms(),cA:{value:new THREE.Color(0x8a8078)},cB:{value:new THREE.Color(0x6a645e)},cC:{value:new THREE.Color(0xd8d2ca)},seed:{value:4},water:{value:0},life:{value:0},ice:{value:0},t:{value:0},gas:{value:0},cshadow:{value:0},form:{value:0}},vertexShader:planetVS,fragmentShader:FS});
const moon=new THREE.Mesh(new THREE.SphereGeometry(.13,64,64),moonMat);sys.add(moon);
// accretion dust (proto state) that collapses into the planet
const DN=MOBILE()?2600:5200;function MOBILE(){return innerWidth<760}
const dR=new Float32Array(DN),dA=new Float32Array(DN),dY=new Float32Array(DN),dS=new Float32Array(DN);{const r=rng(11);for(let i=0;i<DN;i++){dR[i]=1.5+Math.pow(r(),.7)*2.6;dA[i]=r()*6.283;dY[i]=(r()-.5)*.22*(dR[i]-1);dS[i]=r()}}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(DN*3),3));dg.setAttribute('aR',new THREE.BufferAttribute(dR,1));dg.setAttribute('aA',new THREE.BufferAttribute(dA,1));dg.setAttribute('aY',new THREE.BufferAttribute(dY,1));dg.setAttribute('aS',new THREE.BufferAttribute(dS,1));
const dMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},col:{value:0},op:{value:1},d:{value:DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:`attribute float aR,aA,aY,aS;uniform float t,col,d;varying float vA;varying vec3 vC;void main(){float r=mix(aR,.98+aS*.05,smoothstep(aS*.5,aS*.5+.5,col));float a=aA+t*(.9/pow(aR,1.5))*.35+col*col*6.;vec3 p=vec3(cos(a)*r,aY*(1.-col),sin(a)*r);
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.2+aS*2.2)*d*(10./-mv.z);gl_Position=projectionMatrix*mv;vA=(.35+.65*aS)*(1.-smoothstep(.85,1.,col));vC=mix(vec3(1.,.72,.4),vec3(.55,.9,1.),aS*aS);}`,
 fragmentShader:`uniform float op;varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,r);gl_FragColor=vec4(vC*a*a*vA*op,1.);}`});
const dust=new THREE.Points(dg,dMat);dust.rotation.x=.32;dust.frustumCulled=false;sys.add(dust);
// shockwave
const shock=new THREE.Mesh(new THREE.RingGeometry(.985,1,256),new THREE.MeshBasicMaterial({color:new THREE.Color(1.4,1.,.55),transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));shock.rotation.x=-Math.PI/2+.32;sys.add(shock);
// ghost proto core
const ghost=new THREE.Mesh(new THREE.SphereGeometry(1,64,64),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{u:{value:1},t:{value:0}},vertexShader:planetVS,
 fragmentShader:NOISE+`uniform float u,t;varying vec3 vP,vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);float rim=pow(1.-abs(dot(normalize(vN),V)),2.5);float n=fbm(normalize(vP)*3.+t*.05)*.5+.5;gl_FragColor=vec4(vec3(1.,.75,.45)*(rim*.5+n*.05)*u,1.);}`}));ghost.scale.setScalar(.8);sys.add(ghost);

const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth*DPR,innerHeight*DPR,{type:THREE.HalfFloatType,samples:renderer.capabilities.isWebGL2?2:0}));composer.setPixelRatio(DPR);composer.setSize(innerWidth,innerHeight);
composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),.55,.55,.9);composer.addPass(bloom);composer.addPass(new OutputPass());

let planet=null;const S={form:0,formT:0,col:0,colT:0,ghost:1,shock:-1,mx:0,my:0};
function applyPlanet(w){planet=planetFor(w);const u=pMat.uniforms;applyType(u,planet);u.cA.value.copy(planet.a);u.cB.value.copy(planet.b);u.cC.value.copy(planet.c);u.seed.value=planet.seed;u.water.value=planet.k.water;u.ice.value=planet.k.ice;u.life.value=planet.k.life;u.gas.value=planet.k.gas||0;
 atmMat.uniforms.c.value.set(planet.k.atm);tiltG.rotation.z=planet.tilt;ring.visible=planet.ring;moon.visible=planet.moon;moonMat.uniforms.seed.value=planet.seed+3}
function materialize(){if(!planet)return;if(innerWidth<1000&&scrollY>40)scrollTo({top:0,behavior:RM?'auto':'smooth'});S.colT=1;setTimeout(()=>{S.formT=1;S.shock=0},RM?0:1300)}

const VH=(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;top:0;height:100lvh;width:0;visibility:hidden;pointer-events:none';document.documentElement.appendChild(d);return()=>Math.max(d.offsetHeight||0,innerHeight)})();let LW=0,LH=0;
function layout(){const w=innerWidth,h=VH();if(LW&&w===LW&&Math.abs(h-LH)<160&&matchMedia('(hover:none)').matches)return;LW=w;LH=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;
 const mob=w<1000;camera.fov=mob?44:30;camera.updateProjectionMatrix();
 if(mob)camera.setViewOffset(w,h,0,h*.3,w,h);else camera.setViewOffset(w,h,-w*.2,h*.02,w,h);}
addEventListener('resize',layout);layout();
addEventListener('pointermove',e=>{S.mx=e.clientX/innerWidth-.5;S.my=e.clientY/innerHeight-.5});
const clock=new THREE.Clock();let scrollY0=0;addEventListener('scroll',()=>{scrollY0=scrollY},{passive:true});
function frame(){if(document.hidden){requestAnimationFrame(frame);return}const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;sky.update(dt,t);
 S.col+=(S.colT-S.col)*(1-Math.exp(-dt*1.6));S.form+=(S.formT-S.form)*(1-Math.exp(-dt*(RM?50:1.1)));if(S.formT&&S.form>.999)S.form=1;
 const f=S.form;pMat.uniforms.form.value=f;moonMat.uniforms.form.value=f;pMat.uniforms.t.value=t;cloudMat.uniforms.t.value=t;cloudMat.uniforms.u.value=planet?f*planet.k.cloud:0;atmMat.uniforms.u.value=f;ringMat.uniforms.u.value=f;
 dMat.uniforms.t.value=t;dMat.uniforms.col.value=S.col;ghost.material.uniforms.t.value=t;ghost.material.uniforms.u.value=Math.max(0,1-f*1.6)*(1-S.col*.5);ghost.scale.setScalar(.8+S.col*.2);
 scene.userData.stars.uniforms.t.value=t;neb.material.uniforms.t.value=t;
 body.rotation.y=t*.06;clouds.rotation.y=t*.075;moon.position.set(Math.cos(t*.25)*2.9,Math.sin(t*.25)*.5,Math.sin(t*.25)*2.9);
 if(S.shock>=0){S.shock+=dt*.55;shock.scale.setScalar(1+S.shock*5);shock.material.opacity=Math.max(0,1-S.shock)*.9;if(S.shock>1.2)S.shock=-1}
 bloom.strength=.42+(1-Math.abs(f*2-1))*.25*(S.formT?1:0);
 const sc=Math.min(scrollY0/innerHeight,1.2);const cp=new THREE.Vector3(-2.4+S.mx*.6,.7-S.my*.4+sc*.6,8.6+sc*1.6).add(P);camera.position.lerp(cp,1-Math.exp(-dt*3));camera.lookAt(P.x,P.y+sc*.25,P.z);
 if(innerWidth<1000){const o=Math.round((1-Math.min(1,Math.max(0,(scrollY0-innerHeight*.18)/(innerHeight*.35)))*.82)*100)/100;if(o!==frame.o){frame.o=o;cv.style.opacity=o}}else if(frame.o!==1){frame.o=1;cv.style.opacity=1}
 sunG.lookAt(camera.position);composer.render();requestAnimationFrame(frame)}
const sky=createSky(scene,camera,{mobile:MOBILE(),rm:RM,dpr:DPR});window.__sky=sky;window.__cam=camera;
requestAnimationFrame(frame);

/* ---------- UI ---------- */
const steps={follow:$('[data-s="follow"]'),sign:$('[data-s="sign"]'),tasks:$('[data-s="tasks"]'),invite:$('[data-s="invite"]')};
const msg=(t,k)=>{const m=$('#msg');m.textContent=t||'';m.className='msg mono'+(k?' '+k:'')};
const setStep=(k,st)=>{const e=steps[k];e.classList.toggle('done',st==='done');e.classList.toggle('active',st==='active')};
const state={wallet:null,claim:null,token:null,replyCode:null,cfg:null,tasks:{}};
const hasHandle=()=>/^@?[A-Za-z0-9_]{1,15}$/.test(($('#xIn').value||'').trim());
function refresh(){const c=state.claim,st=c&&c.status,cfg=state.cfg||{req:{}};const signed=!!state.token||(!!st&&st!=='rejected');const reserved=st==='reserved'||st==='final';const tid=cfg.tweetId;
 setStep('follow',hasHandle()&&LS.get('followed')==='1'?'done':'active');setStep('sign',signed?'done':hasHandle()?'active':'');
 setStep('tasks',reserved?'done':signed&&tid?'active':'');steps.tasks.classList.toggle('unlocked',!!tid&&signed||reserved);steps.tasks.setAttribute('aria-disabled',tid?'false':'true');
 $('#tdesc').textContent=st==='review'?'Submitted for review. Checks are done by hand, usually within a few hours.':st==='rejected'?'Not approved'+(c.reason?': '+c.reason:'')+'. Fix it on X, then sign and verify again.':!tid?'Claim opens when the announcement post is live.':reserved?'All tasks verified.':'Do each task on X, then press Verify. Checks can take a minute to show up.';
 for(const k of ['follow','repost','like','reply']){const li=$('#xt [data-t="'+k+'"]');li.hidden=cfg.req[k]===false;li.classList.toggle('ok',!!state.tasks[k]||reserved);li.classList.toggle('no',state.tasks[k]===false)}
 $('#rCode').textContent=state.replyCode||'your code';if(tid){$('#bRt').href='https://x.com/intent/retweet?tweet_id='+tid;$('#bLk').href='https://x.com/intent/like?tweet_id='+tid;
  $('#bRp').href='https://x.com/intent/post?in_reply_to='+tid+'&text='+encodeURIComponent('Claiming my free Goldilocks planet. '+(state.replyCode||''))}
 const need=c&&c.invitesNeeded!=null?c.invitesNeeded:(cfg.req.invites||0);steps.invite.hidden=need<=0&&!reserved;
 setStep('invite',st==='final'?'done':reserved?'active':'');steps.invite.classList.toggle('unlocked',reserved);$('#inv').textContent=c?(c.qualifiedInvites||0):0;$('#invN').textContent=need;
 if(reserved){$('#refIn').value=refLink(c.code);$('#bShare').hidden=false;
  $('#idesc').textContent=st==='final'?'Your planet is final. Keep sharing your link to climb the board.':'Your planet is reserved'+(c.holdUntil?' until '+new Date(c.holdUntil).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'')+'. Invite '+need+' friend'+(need>1?'s':'')+' who finish steps one to three to make it final.';
  $('#pState').textContent=st==='final'?'Claimed / No. '+c.no:'Reserved'}}
const refLink=c=>location.origin+location.pathname.replace(/[^/]*$/,'')+'claim.html?ref='+encodeURIComponent(c);
// referral capture
{const r=new URLSearchParams(location.search).get('ref');if(r&&/^[A-Za-z0-9]{4,12}$/.test(r))LS.set('ref',r.toUpperCase())}
// follow step
const bF=$('#bFollow');$('#xIn').value=LS.get('xh')||'';$('#xIn').addEventListener('input',()=>{LS.set('xh',$('#xIn').value.trim());refresh()});
if(CFG.X_HANDLE){bF.href='https://x.com/intent/follow?screen_name='+encodeURIComponent(CFG.X_HANDLE);$('#fdesc').textContent='Follow @'+CFG.X_HANDLE+' and enter your handle. It is checked in step three.';bF.addEventListener('click',()=>{setTimeout(()=>{LS.set('followed','1');refresh()},1200)})}
else{bF.removeAttribute('href');bF.setAttribute('aria-disabled','true');bF.textContent='Soon';$('#fdesc').textContent='The official account is revealed shortly. This step unlocks with it.'}
// sign step
const bS=$('#bSign');const chip=$('#chip');
if(API){chip.classList.add('live');chip.querySelector('em').textContent='Claims live'}
const short=w=>w.slice(0,4)+'..'+w.slice(-4);
function showPlanet(w,claimed,no){applyPlanet(w);const p=planet;$('#pName').textContent=p.name;$('#pClass').textContent=p.cls;{const t=[p.moons?p.moons+(p.moons>1?' moons':' moon'):'No moons',p.ringN>1?'Double rings':p.ring?'Rings':'No rings',p.rare.length?'Rare trait: '+p.rare.join(', '):''].filter(Boolean).join('. ')+'.';const el=$('#pTrait');el.textContent=t+' ';const a=document.createElement('a');a.href='orbits.html?w='+encodeURIComponent(w);a.textContent='See it in orbit';a.className='gold';el.appendChild(a)}$('#pState').textContent=claimed?'Claimed':'Preview';$('#pWallet').textContent=short(w);$('#pNo').textContent=no?'No. '+String(no).padStart(5,'0'):'';
 countTo($('#pAu'),p.au,2);countTo($('#pK'),p.K,0,3);countTo($('#pEsi'),p.esi,2);$('#pcard').classList.add('formed');materialize()}
function countTo(el,v,d,pad){const t0=performance.now(),dur=RM?0:2200;const go=()=>{const k=Math.min(1,(performance.now()-t0)/Math.max(dur,1));const e=1-Math.pow(1-k,4);let s=(v*e).toFixed(d);if(pad)s=s.padStart(pad,'0');el.textContent=s;if(k<1)requestAnimationFrame(go)};go()}
const b64=u8=>{let s='';for(const x of u8)s+=String.fromCharCode(x);return btoa(s)};
async function api(path,opt){const r=await fetch(API+path,Object.assign({headers:{'content-type':'application/json'}},opt||{}));const j=await r.json().catch(()=>({}));if(!r.ok&&!j.claimed)throw new Error(j.error||'Request failed.');return j}
bS.addEventListener('click',async()=>{if(state.full&&!state.claim){msg('All free planets have been claimed.','err');return}
 if(!hasHandle()){msg('Enter your X handle first.','err');steps.follow.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:380});return}
 if(!window.__wallets){msg('Wallet support failed to load. Reload the page.','err');return}
 try{let w=window.__wallets.current();if(!w){msg('Choose a wallet to continue.');w=await window.__wallets.pick();if(!w){msg('');return}}
  state.wallet=w.address;
  if(!API){showPlanet(w.address,false);bS.textContent='Claims open soon';bS.setAttribute('aria-disabled','true');msg('Preview generated from '+short(w.address)+'.','ok');return}
  bS.classList.add('busy');msg('Checking your wallet.');
  const me=await api('/api/me?wallet='+encodeURIComponent(w.address));if(me.status==='review'){state.claim=me;state.replyCode=me.replyCode;showPlanet(w.address,false);refresh();msg('Your X tasks are waiting for review.','ok');return}
  if(me.status==='rejected')msg('Not approved'+(me.reason?': '+me.reason:'')+'. Fix it on X, then sign and verify again.','err');
  if(me.status==='final'||me.status==='reserved'){state.claim=me;showPlanet(w.address,true,me.no);refresh();msg(me.status==='final'?'Welcome back. Your planet is claimed.':'Welcome back. Your planet is reserved.','ok');return}
  const {message}=await api('/api/nonce',{method:'POST',body:JSON.stringify({wallet:w.address})});msg('Approve the signature in your wallet. No transaction, no fee.');
  const sig=await w.signMessage(new TextEncoder().encode(message));
  msg('Verifying signature.');const c=await api('/api/claim',{method:'POST',body:JSON.stringify({wallet:w.address,signature:b64(new Uint8Array(sig)),ref:LS.get('ref')||'',followed:LS.get('followed')==='1'})});
  showPlanet(w.address,false);
  if(c.status==='signed'){state.token=c.token;state.replyCode=c.replyCode;refresh();msg(state.cfg&&state.cfg.tweetId?'Signed. Now repost, like and reply, then press Verify.':'Signed. Claim opens when the announcement post is live.','ok');return}
  state.claim=c;showPlanet(w.address,true,c.no);refresh();msg('Planet claimed. Welcome to Season 01.','ok');loadStats()}
 catch(e){msg((e&&e.message)||'Something went wrong. Try again.','err')}finally{bS.classList.remove('busy')}});
$('#bVerify').addEventListener('click',async()=>{if(!state.token){msg('Connect and sign with your wallet first.','err');return}const b=$('#bVerify');b.classList.add('busy');msg('Checking X.');
 try{const r=await fetch(API+'/api/x/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:state.wallet,token:state.token,handle:$('#xIn').value.trim()})});const j=await r.json().catch(()=>({}));
  state.tasks=j.tasks||state.tasks;if(!r.ok){refresh();msg(j.error||'Check failed. Try again.','err');return}
  if(j.review){state.claim=j;refresh();msg('Submitted. Your X tasks are checked by hand, usually within a few hours. Come back to this page to see the result.','ok');return}
  if(!j.ready){refresh();const miss=['follow','repost','like','reply'].filter(k=>state.cfg.req[k]&&!state.tasks[k]);msg('Not found yet: '+miss.join(', ')+'. X can take a minute to update.','err');return}
  state.claim=j;state.token=null;showPlanet(state.wallet,true,j.no);refresh();loadStats();msg(j.status==='final'?'Planet claimed. Welcome to Season 01.':'Planet reserved. Invite a friend to make it final.','ok')}
 catch(e){msg('Check failed. Try again.','err')}finally{b.classList.remove('busy')}});
$('#bShare').addEventListener('click',()=>{const p=planet||{};const t='My Goldilocks planet is '+(p.name||'forming')+', '+(p.cls?(/^[AEIOU]/.test(p.cls)?'an ':'a ')+p.cls.toLowerCase():'a new world')+'. Season 01 starts soon.';window.open('https://x.com/intent/post?text='+encodeURIComponent(t),'_blank','noopener')});
$('#bCopy').addEventListener('click',async()=>{const v=$('#refIn').value;if(!v)return;try{await navigator.clipboard.writeText(v)}catch(e){$('#refIn').select();document.execCommand('copy')}const b=$('#bCopy');b.textContent='Copied';b.classList.add('primary');setTimeout(()=>{b.textContent='Copy';b.classList.remove('primary')},1600)});
// counter + board
function setTotal(n){const s=String(n).padStart(6,'0');const i=s.search(/[1-9]/);const el=$('#tot');el.innerHTML='';[...s].forEach((ch,k)=>{const sp=document.createElement('span');sp.textContent=ch;if(i<0||k<i)sp.className='z';el.appendChild(sp)})}
async function loadStats(){if(!API){setTotal(0);return}try{const s=await api('/api/stats');state.cfg=s;refresh();let c=0;const t0=performance.now();const go=()=>{const k=Math.min(1,(performance.now()-t0)/1400);setTotal(Math.round(s.total*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(go)};go();
 const left=s.max?Math.max(0,s.max-s.total):null;state.full=left===0;$('#totSub').textContent=left===null?'Worlds formed so far this season.':left?left+' of '+s.max+' free planets left.':'All '+s.max+' free planets have been claimed. Holding $GOLDILOCKS at launch still spawns a planet.';if(API){chip.querySelector('em').textContent=left===null?'Claims live':left?left+' of '+s.max+' left':'Claims closed'}if(state.full&&!state.claim){bS.textContent='All claimed';bS.setAttribute('aria-disabled','true');$('#sdesc').textContent='All free planets have been claimed. Holding $GOLDILOCKS at launch still spawns a planet.'}const lb=$('#lb');if(s.top&&s.top.length){lb.innerHTML='';s.top.forEach(x=>{const li=document.createElement('li');const a=document.createElement('span');a.textContent=x.wallet;const b=document.createElement('b');b.textContent=x.invites+' invited';li.append(a,b);lb.appendChild(li)})}}catch(e){$('#totSub').textContent='Live count unavailable right now.'}}
setTotal(0);loadStats();if(API)setInterval(loadStats,30000);
refresh();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});io.observe($('.cl-board'));
document.fonts.ready.then(()=>requestAnimationFrame(()=>document.body.classList.add('ready')));
window.__claim={state,showPlanet};
