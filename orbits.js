import * as THREE from 'three';
const CFG=Object.assign({API_BASE:''},window.CONFIG||{});const API=String(CFG.API_BASE||'').replace(/\/+$/,'');
const $=s=>document.querySelector(s);const MOB=innerWidth<820||matchMedia('(hover:none)').matches;const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* deterministic planet params, same draws as the claim page */
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const KINDS=[['Ocean world',.78,0,[.35,.6,.9]],['Verdant terra',.55,0,[.45,.75,.45]],['Dune world',.14,0,[.85,.6,.35]],['Glacial world',.5,0,[.8,.88,.95]],['Volcanic world',.08,0,[.85,.4,.25]],['Archipelago',.92,0,[.4,.75,.85]],['Gas giant',0,1,[.9,.78,.6]]];
const HZI=.95,HZO=1.37;
function paramsFor(w){const r=rng(hash(w));const k=KINDS[Math.floor(r()*KINDS.length)];const au=.82+r()*.5;for(let i=0;i<13;i++)r();const L='BCDFGHJKLMNPRSTVXZ'[Math.floor(r()*18)];
 const K=Math.round(278/Math.sqrt(au)*(1-k[1]*.08)+(k[2]?-60:0));const o=rng(hash(w+'o'));
 return{w,cls:k[0],col:k[3],au,K,e:.01+o()*.11,inc:(o()-.5)*.12,node:o()*6.283,peri:o()*6.283,M0:o()*6.283,mass:1,name:'GL '+(hash(w+'n')%9000+1000)+' '+L,zone:au>=HZI&&au<=HZO}}
/* renderer, no post processing */
const cv=$('#ogl');const DPR=Math.min(devicePixelRatio||1,MOB?1:1.5);const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!MOB,powerPreference:'high-performance'});renderer.setPixelRatio(DPR);renderer.setClearColor(0x020308);
const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(45,1,.001,10);
const VH=(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;top:0;height:100lvh;width:0;visibility:hidden';document.documentElement.appendChild(d);return()=>Math.max(d.offsetHeight||0,innerHeight)})();
let W=0,H=0;function size(){const w=innerWidth,h=VH();if(w===W&&Math.abs(h-H)<160&&MOB)return;W=w;H=h;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();U.px.value=h*DPR/(2*Math.tan(Math.PI/8))}
const U={t:{value:0},px:{value:800},op:{value:1},dpr:{value:DPR}};
const add={transparent:true,depthWrite:false,blending:THREE.AdditiveBlending};
/* kepler point cloud */
const KVS=`attribute vec4 aO;attribute vec4 aR;attribute vec3 aC;uniform float t,px,op,dpr;varying vec3 vC;varying float vA;
void main(){float a=aO.x,e=aO.y;float M=aO.z+t*6.2831853/pow(a,1.5);float E=M;for(int i=0;i<4;i++)E=E-(E-e*sin(E)-M)/(1.-e*cos(E));
 vec2 q=vec2(a*(cos(E)-e),a*sqrt(1.-e*e)*sin(E));float cw=cos(aR.z),sw=sin(aR.z);q=vec2(q.x*cw-q.y*sw,q.x*sw+q.y*cw);
 float ci=cos(aR.x),si=sin(aR.x);vec3 p=vec3(q.x,q.y*si,q.y*ci);float cn=cos(aR.y),sn=sin(aR.y);p=vec3(p.x*cn-p.z*sn,p.y,p.x*sn+p.z*cn);
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;float s=aO.w*px/-mv.z;gl_PointSize=clamp(s,aR.w*dpr,90.*dpr);vC=aC;vA=op;}`;
const KFS=`varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float r=length(q);if(r>.5)discard;float core=smoothstep(.5,.32,r);float halo=exp(-r*r*14.)*.5;gl_FragColor=vec4(vC*(core+halo)*vA,1.);}`;
function cloud(n){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));['aO','aR'].forEach(k=>g.setAttribute(k,new THREE.BufferAttribute(new Float32Array(n*4),4)));g.setAttribute('aC',new THREE.BufferAttribute(new Float32Array(n*3),3));
 const m=new THREE.ShaderMaterial(Object.assign({uniforms:U,vertexShader:KVS,fragmentShader:KFS},add));const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);return pts}
function fill(pts,list,minPx,rad){const g=pts.geometry,O=g.attributes.aO.array,R=g.attributes.aR.array,C=g.attributes.aC.array;list.forEach((p,i)=>{O.set([p.au,p.e,p.M0,rad],i*4);R.set([p.inc,p.node,p.peri,minPx],i*4);C.set(p.col,i*3)});
 g.setDrawRange(0,list.length);['aO','aR','aC'].forEach(k=>g.attributes[k].needsUpdate=true)}
function posOf(p,t,out){const M=p.M0+t*6.2831853/Math.pow(p.au,1.5);let E=M;for(let i=0;i<4;i++)E=E-(E-p.e*Math.sin(E)-M)/(1-p.e*Math.cos(E));
 let x=p.au*(Math.cos(E)-p.e),y=p.au*Math.sqrt(1-p.e*p.e)*Math.sin(E);const cw=Math.cos(p.peri),sw=Math.sin(p.peri);[x,y]=[x*cw-y*sw,x*sw+y*cw];
 const ci=Math.cos(p.inc),si=Math.sin(p.inc);let X=x,Y=y*si,Z=y*ci;const cn=Math.cos(p.node),sn=Math.sin(p.node);return out.set(X*cn-Z*sn,Y,X*sn+Z*cn)}
/* sun, zone, inner planets for context */
const sun=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3)),new THREE.ShaderMaterial(Object.assign({uniforms:{px:U.px,dpr:U.dpr,op:U.op},
 vertexShader:`uniform float px,dpr;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(.03*px/-mv.z,7.*dpr,240.*dpr);}`,
 fragmentShader:`uniform float op;void main(){float r=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.0,r);a=pow(a,3.)+smoothstep(.35,.25,r);gl_FragColor=vec4(vec3(1.,.86,.62)*a*max(op,.35),1.);}`},add)));sun.frustumCulled=false;scene.add(sun);
const hz=new THREE.Mesh(new THREE.RingGeometry(HZI,HZO,256,1),new THREE.ShaderMaterial(Object.assign({side:THREE.DoubleSide,uniforms:{op:U.op},vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float op;varying vec3 vP;void main(){float r=length(vP.xy);float ed=smoothstep(.012,0.,abs(r-${HZI}))+smoothstep(.012,0.,abs(r-${HZO}));gl_FragColor=vec4(vec3(.83,.68,.4)*(.035+ed*.3)*op,1.);}`},add)));hz.rotation.x=-Math.PI/2;scene.add(hz);
const ringLines=[];[.39,.72,1.0,1.52,5.2].forEach(a=>{const pts=[];for(let i=0;i<=256;i++){const t=i/256*6.2832;pts.push(new THREE.Vector3(Math.cos(t)*a,0,Math.sin(t)*a))}const l=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xebe5d8,transparent:true,opacity:.06,depthWrite:false}));scene.add(l);ringLines.push(l)});
const sel=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:384},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:0xd4ad66,transparent:true,opacity:.75,depthWrite:false}));sel.visible=false;sel.frustumCulled=false;scene.add(sel);
function orbitLine(p){const A=sel.geometry.attributes.position;const q={...p};const v=new THREE.Vector3();for(let i=0;i<A.count;i++){q.M0=i/A.count*6.2832;posOf(q,0,v);A.setXYZ(i,v.x,v.y,v.z)}A.needsUpdate=true;sel.visible=true}
/* neighbourhood stars and galaxy */
const LY=63241;
function starField(n,f){const pos=new Float32Array(n*3),col=new Float32Array(n*3),sz=new Float32Array(n);for(let i=0;i<n;i++){const [x,y,z,c,s]=f(i);pos.set([x,y,z],i*3);col.set(c,i*3);sz[i]=s}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('aS',new THREE.BufferAttribute(sz,1));
 const m=new THREE.ShaderMaterial(Object.assign({uniforms:{op:{value:0},dpr:U.dpr},vertexShader:`attribute vec3 color;attribute float aS;uniform float dpr;varying vec3 vC;void main(){vC=color;gl_PointSize=aS*dpr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float op;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*20.);gl_FragColor=vec4(vC*a*op,1.);}`},add));const p=new THREE.Points(g,m);p.frustumCulled=false;scene.add(p);return p}
const gr=rng(42);
const near=starField(MOB?2500:6000,()=>{const v=new THREE.Vector3(gr()*2-1,(gr()*2-1)*.5,gr()*2-1).normalize().multiplyScalar(Math.exp(Math.log(2e5)+gr()*Math.log(4e3)));const t=gr();return[v.x,v.y,v.z,t<.2?[1,.8,.6]:t<.4?[.75,.85,1]:[1,1,1],1+gr()*1.6]});
const GC=new THREE.Vector3(-26000*LY,0,0),GR=50000*LY;
const galaxy=starField(MOB?40000:140000,()=>{const arm=Math.floor(gr()*4);const r=Math.pow(gr(),.7)*GR;const th=arm*1.5708+Math.log(r/GR*8+1)*2.4+(gr()-.5)*.55*(1.2-r/GR);const core=r<GR*.12;
 const h=(gr()-.5)*GR*(core?.08:.025);const x=GC.x+Math.cos(th)*r,z=GC.z+Math.sin(th)*r;const c=core?[1,.82,.58]:gr()<.25?[.95,.75,.65]:[.72,.82,1];return[x,h,z,c,core?1.4:1+gr()*.8]});
/* data */
let real=[],demo=[];const realPts=cloud(4096),demoPts=cloud(MOB?10000:50000);demoPts.visible=false;
function makeDemo(){const n=MOB?10000:50000,r=rng(7);const out=[];for(let i=0;i<n;i++){const au=Math.exp(Math.log(.25)+r()*Math.log(160));out.push({au,e:r()*.28,inc:(r()-.5)*.2,node:r()*6.283,peri:r()*6.283,M0:r()*6.283,col:au>=HZI&&au<=HZO?[.83,.68,.4]:[.55,.55,.6],demo:1,i})}return out}
async function loadReal(){if(!API){$('#smsg').textContent='Claims open soon. Turn on the preview layer to see a full system.';return}
 try{const r=await fetch(API+'/api/planets');const j=await r.json();real=(j.planets||[]).map(x=>Object.assign(paramsFor(x.wallet),{no:x.no}));fill(realPts,real.slice(0,4096),3,.0012);
  $('#nReal').textContent=real.length;$('#nZone').textContent=real.filter(p=>p.zone).length;if(!real.length)$('#smsg').textContent='No planets claimed yet. Turn on the preview layer to see a full system.'}catch(e){$('#smsg').textContent='Live planet data is unavailable right now.'}}
$('#demo').addEventListener('change',e=>{if(!demo.length){demo=makeDemo();fill(demoPts,demo,MOB?1.2:1.4,.0007)}demoPts.visible=e.target.checked;$('#demoNote').textContent=e.target.checked?'Preview layer on. '+demo.length.toLocaleString('en-US')+' simulated planets, not real wallets.':'Preview layer. Simulated planets are not real wallets.'});
/* camera */
const S={th:.6,ph:1.05,ld:Math.log(4.2),tth:.6,tph:1.05,tld:Math.log(4.2),tgt:new THREE.Vector3(),follow:null};const LMIN=Math.log(.004),LMAX=Math.log(1.6e5*LY);
const ptr=new Map();let drag=false,moved=0,pinch0=0;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;drag=true;cv.classList.add('drag');if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)}});
cv.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p){hoverQ=e;return}const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
 if(ptr.size===2){const [a,b]=[...ptr.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0)S.tld=Math.min(LMAX,Math.max(LMIN,S.tld-Math.log(d/pinch0)*1.4));pinch0=d}else{S.tth-=dx*.005;S.tph=Math.min(3.05,Math.max(.08,S.tph-dy*.005))}});
const up=e=>{ptr.delete(e.pointerId);if(!ptr.size){drag=false;cv.classList.remove('drag');if(moved<6)pick(e.clientX,e.clientY,true)}pinch0=0};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();S.tld=Math.min(LMAX,Math.max(LMIN,S.tld+e.deltaY*.0016*(e.deltaMode?30:1)))},{passive:false});
/* picking */
const tmp=new THREE.Vector3(),scr=new THREE.Vector3();let hoverQ=null,hovered=null,picked=null,lastHover=0;
function nearest(x,y){let best=null,bd=MOB?26:14;const t=U.t.value;const test=(list)=>{for(const p of list){posOf(p,t,tmp);scr.copy(tmp).project(cam);if(scr.z>1)continue;const sx=(scr.x+1)/2*W,sy=(1-scr.y)/2*H;const d=Math.hypot(sx-x,sy-y);if(d<bd){bd=d;best=p}}};
 test(real);if(demoPts.visible&&(!best||bd>4))test(demo);return best}
function pick(x,y,click){const p=nearest(x,y);if(click){if(p)select(p);return}if(p!==hovered){hovered=p;if(!picked){if(p)orbitLine(p);else sel.visible=false}cv.style.cursor=p?'pointer':''}}
const fmt=(v,d)=>v.toFixed(d);
function select(p){picked=p;orbitLine(p);S.follow=p;const pn=$('#panel');pn.hidden=false;
 if(p.demo){$('#qName').textContent='Simulated planet '+(p.i+1);$('#qW').textContent='Preview only';$('#qC').textContent=p.au>5?'Gas giant':'Rocky world';$('#qM').textContent=fmt(.3+((p.i*7919)%100)/40,2);$('#qA').textContent=fmt(p.au,2);$('#qK').textContent=String(Math.round(278/Math.sqrt(p.au)));$('#qZ').textContent=p.au>=HZI&&p.au<=HZO?'Inside':'Outside';$('#qS').textContent='Preview layer';$('#qNo').textContent=''}
 else{$('#qName').textContent=p.name;$('#qW').textContent=p.w.slice(0,4)+'..'+p.w.slice(-4);$('#qC').textContent=p.cls;$('#qM').textContent=fmt(p.mass,2);$('#qA').textContent=fmt(p.au,2);$('#qK').textContent=String(p.K);$('#qZ').textContent=p.zone?'Inside':'Outside';$('#qS').textContent='Stage: awaiting launch';$('#qNo').textContent=p.no?'No. '+String(p.no).padStart(3,'0'):'Not claimed'}
 S.tld=Math.min(S.tld,Math.log(.05))}
$('#qClose').addEventListener('click',()=>{$('#panel').hidden=true;picked=null;S.follow=null;sel.visible=false});
$('#sf').addEventListener('submit',e=>{e.preventDefault();const q=$('#sq').value.trim();const m=$('#smsg');if(!q){m.textContent='';return}
 const hit=real.find(p=>p.w===q)||real.find(p=>q.length>=4&&p.w.toLowerCase().startsWith(q.toLowerCase()));
 if(hit){select(hit);m.textContent='Found '+hit.name+'.'}else if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)){const p=paramsFor(q);select(p);m.textContent='This wallet has not claimed yet. Showing where its planet would form.'}else m.textContent='No claimed planet matches that address.'});
/* loop */
const ft=[];let q=1,last=performance.now();
function fmtScale(d){if(d<.1)return fmt(d*1000,1)+' milli AU';if(d<2000)return fmt(d,d<10?2:0)+' AU';const ly=d/LY;return ly<1?fmt(d,0).replace(/\B(?=(\d{3})+(?!\d))/g,',')+' AU':ly<1000?fmt(ly,1)+' light years':Math.round(ly).toLocaleString('en-US')+' light years'}
let lastScale='';
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((now-last)/1000,.05);last=now;
 ft.push(dt*1000);if(ft.length>90){const a=ft.reduce((x,y)=>x+y)/ft.length;ft.length=0;if(a>20&&q>.6){q-=.2;renderer.setPixelRatio(DPR*q);W=0;size()}}
 const k=1-Math.exp(-dt*7);S.th+=(S.tth-S.th)*k;S.ph+=(S.tph-S.ph)*k;S.ld+=(S.tld-S.ld)*k*.9;if(!RM&&!drag&&!S.follow)S.tth+=dt*.012;
 U.t.value+=RM?0:dt*.035;
 if(S.follow){posOf(S.follow,U.t.value,tmp);S.tgt.lerp(tmp,1-Math.exp(-dt*6))}else S.tgt.multiplyScalar(1-Math.min(1,dt*3));
 const d=Math.exp(S.ld);const sp=Math.sin(S.ph);cam.position.set(S.tgt.x+d*sp*Math.cos(S.th),S.tgt.y+d*Math.cos(S.ph),S.tgt.z+d*sp*Math.sin(S.th));cam.lookAt(S.tgt);
 cam.near=Math.max(d*.002,1e-5);cam.far=Math.max(d*40,GR*4);cam.updateProjectionMatrix();
 const sys=1-Math.min(1,Math.max(0,(Math.log(d)-Math.log(300))/(Math.log(6000)-Math.log(300))));U.op.value=sys;hz.visible=realPts.visible=sys>.01;ringLines.forEach(l=>l.material.opacity=.06*sys);sel.material.opacity=.75*sys;
 near.material.uniforms.op.value=Math.min(1,Math.max(0,(Math.log(d)-Math.log(800))/2))*(1-Math.min(1,Math.max(0,(Math.log(d)-Math.log(2e8))/1.5)))+ .25;
 galaxy.material.uniforms.op.value=.045*Math.min(1,Math.max(0,(Math.log(d)-Math.log(3e8))/2.2));
 galaxy.visible=galaxy.material.uniforms.op.value>.001;
 const sc=fmtScale(d*.8);if(sc!==lastScale){lastScale=sc;$('#scale').textContent=sc}
 if(hoverQ&&!drag&&now-lastHover>90){lastHover=now;pick(hoverQ.clientX,hoverQ.clientY,false);hoverQ=null}
 renderer.render(scene,cam)}
addEventListener('resize',size,{passive:true});size();loadReal();requestAnimationFrame(frame);
window.__orbits={S,select,get real(){return real},demoOn:()=>{$('#demo').click()}};
