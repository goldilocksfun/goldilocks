import * as THREE from 'three';
import {NOISE,planetVS,planetFS} from './planet-shaders.js';
import {hash,rng,planetType as detailFor,FSX,KINDS,HZI,HZO,typeUniforms,applyType} from './planets.js';
const CFG=Object.assign({API_BASE:''},window.CONFIG||{});const API=String(CFG.API_BASE||'').replace(/\/+$/,'');
const $=s=>document.querySelector(s);const MOB=innerWidth<820||matchMedia('(hover:none)').matches;const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* deterministic planet params, same draws as the claim page */
function paramsFor(w){const D=detailFor(w);const o=rng(hash(w+'o'));return{w,cls:D.cls,col:[D.b.r*1.3,D.b.g*1.3,D.b.b*1.3].map(x=>Math.min(1,x+.15)),au:D.au,K:D.K,e:.01+o()*.11,inc:(o()-.5)*.12,node:o()*6.283,peri:o()*6.283,M0:o()*6.283,mass:1,name:D.name,zone:D.au>=HZI&&D.au<=HZO}}
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
const sun=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3)),new THREE.ShaderMaterial(Object.assign({uniforms:{px:U.px,dpr:U.dpr,op:U.op,fo:{value:0}},
 vertexShader:`uniform float px,dpr;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(.44*px/-mv.z,128.*dpr,640.*dpr);}`,
 fragmentShader:`uniform float op,fo;void main(){float r=length(gl_PointCoord-.5)*2.;vec2 q=gl_PointCoord-.5;float rd=r/.24;float disk=smoothstep(1.,.93,rd);float mu=sqrt(max(1.-rd*rd,0.));float limb=.42+.58*pow(mu,.6);vec3 dc=mix(vec3(1.,.5,.2),vec3(1.,.95,.84),pow(mu,.8))*limb*1.45;float o=max(r-.24,0.);float ang=atan(q.y,q.x);float cor=(exp(-o*16.)*.55+exp(-o*5.)*.2)*(1.+.12*sin(ang*7.+o*9.)*sin(ang*3.));cor*=smoothstep(1.,.5,r);vec3 col=dc*disk+vec3(1.,.66,.34)*cor*(1.-disk);gl_FragColor=vec4(col*max(op,.35)*fo,1.);}`},add)));sun.frustumCulled=false;scene.add(sun);
const hz=new THREE.Mesh(new THREE.RingGeometry(HZI-.01,HZO+.01,256,1),new THREE.ShaderMaterial(Object.assign({side:THREE.DoubleSide,uniforms:{op:U.op},vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float op;varying vec3 vP;void main(){float r=length(vP.xy);float w=fwidth(r)*1.2;float ed=1.-smoothstep(0.,w,abs(r-${HZI}));ed=max(ed,1.-smoothstep(0.,w,abs(r-${HZO})));gl_FragColor=vec4(vec3(.83,.68,.4)*(.11+ed*.75)*op,1.);}`},add)));hz.rotation.x=-Math.PI/2;scene.add(hz);
const ringLines=[];[.5,1,2,5].forEach(a=>{const pts=[];for(let i=0;i<=256;i++){const t=i/256*6.2832;pts.push(new THREE.Vector3(Math.cos(t)*a,0,Math.sin(t)*a))}const l=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xebe5d8,transparent:true,opacity:.16,depthWrite:false}));scene.add(l);ringLines.push(l)});
const SR=.36;const SUNV=`varying vec3 vP,vW;void main(){vP=position;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
const DITH=`float dith(){return(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;}`;
const sunSM=new THREE.ShaderMaterial({uniforms:{t:{value:0}},vertexShader:SUNV,fragmentShader:NOISE+DITH+`uniform float t;varying vec3 vP,vW;
void main(){vec3 p=normalize(vP);vec3 V=normalize(cameraPosition-vW);float mu=clamp(dot(normalize(vW),V),0.,1.);float tt=t*.05;
 vec3 q=p*46.;q+=vec3(snoise(p*4.+tt*.4),snoise(p*4.+7.1-tt*.4),snoise(p*4.+3.3))*1.1;
 float g=snoise(q+vec3(0.,0.,tt*2.));float g2=snoise(q*2.3+vec3(tt*3.,0.,0.));float gran=smoothstep(-.6,.9,g*.75+g2*.25);float lane=1.-smoothstep(.0,.22,abs(g+.1));
 float lat=abs(p.y);float belt=smoothstep(.06,.18,lat)*smoothstep(.6,.38,lat);float sn=snoise(p*3.1+11.)*.6+snoise(p*8.+3.)*.3+snoise(p*20.)*.1;
 float umb=smoothstep(.6,.68,sn)*belt;float pen=smoothstep(.45,.58,sn)*belt;float fac=smoothstep(.28,.45,sn)*(1.-pen)*pow(1.-mu,1.2)*belt;
 float I=.84+.18*gran-.07*lane;I*=1.-pen*.4;I*=1.-umb*.65;I*=1.-.6*(1.-mu)-.14*(1.-mu*mu);I+=fac*.45;
 vec3 c=mix(vec3(.62,.2,.05),vec3(1.,.62,.28),smoothstep(.2,.62,I));c=mix(c,vec3(1.,.92,.78),smoothstep(.7,1.05,I));
 gl_FragColor=vec4(c*I*1.3+dith(),1.);}`});
const sunM=new THREE.Mesh(new THREE.SphereGeometry(SR,MOB?64:112,MOB?48:80),sunSM);scene.add(sunM);
const corSM=new THREE.ShaderMaterial(Object.assign({uniforms:{t:{value:0}},vertexShader:`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:NOISE+DITH+`uniform float t;varying vec2 vU;void main(){vec2 q=vU*3.4;float r=length(q);float a=atan(q.y,q.x);float h=max(r-1.,0.);vec2 cs=vec2(cos(a),sin(a));
 float st=.55+.45*fbm3(vec3(cs*2.2,t*.015))+.25*snoise(vec3(cs*6.,t*.02));
 float cor=(exp(-h*6.)*.5+exp(-h*2.)*.2*st+exp(-h*.8)*.06*st)*smoothstep(3.4,2.3,r);
 float pn=fbm3(vec3(cs*4.5,h*2.5-t*.04));float loop=smoothstep(.22,.5,pn)*exp(-h*10.);
 float fil=smoothstep(.3,.0,abs(snoise(vec3(cs*9.,h*9.-t*.12))))*exp(-h*13.)*smoothstep(.25,.55,pn);
 float ch=exp(-h*70.);float fp=fract(t/11.);float fa=floor(t/11.)*2.39;float da=abs(mod(a-fa+3.1416,6.2832)-3.1416);float fl=exp(-da*da*40.)*exp(-h*5.)*pow(sin(fp*3.1416),6.);
 vec3 col=vec3(1.,.72,.44)*cor+vec3(1.,.3,.1)*(loop*.85+fil*1.1)+vec3(1.,.38,.18)*ch*.8+vec3(1.,.8,.6)*fl*1.4;col*=smoothstep(.985,1.005,r);
 gl_FragColor=vec4(max(col+dith(),0.),1.);}`},add));
const corM=new THREE.Mesh(new THREE.PlaneGeometry(SR*6.8,SR*6.8),corSM);scene.add(corM);
const sel=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:384},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:0xd4ad66,transparent:true,opacity:.75,depthWrite:false}));sel.visible=false;sel.frustumCulled=false;scene.add(sel);
const mk=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3)),new THREE.ShaderMaterial(Object.assign({uniforms:{s:{value:30},dpr:U.dpr,ph:{value:0}},vertexShader:`uniform float s,dpr;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=s*dpr;}`,
 fragmentShader:`uniform float ph;void main(){float r=length(gl_PointCoord-.5)*2.;float ring=1.-smoothstep(0.,.08,abs(r-.82));float dot=smoothstep(.2,.12,r);gl_FragColor=vec4(vec3(.83,.68,.4)*(ring*(.5+.5*ph)+dot),1.);}`},add)));mk.visible=false;mk.frustumCulled=false;scene.add(mk);
const SEG=MOB?72:128,PR=.002;const dG=new THREE.Group();dG.visible=false;dG.scale.setScalar(PR);scene.add(dG);const tG=new THREE.Group();dG.add(tG);
const col3=()=>({value:new THREE.Color()});
const pM=new THREE.ShaderMaterial({uniforms:{cA:col3(),cB:col3(),cC:col3(),seed:{value:1},water:{value:0},life:{value:0},ice:{value:0},t:{value:0},gas:{value:0},cshadow:{value:.8},cont:{value:1},lava:{value:0},crater:{value:0},eye:{value:0},sulf:{value:0},storm:{value:0},rift:{value:0},aur:{value:0},cityK:{value:0}},vertexShader:planetVS,fragmentShader:FSX});
const pB=new THREE.Mesh(new THREE.SphereGeometry(1,SEG,SEG),pM);tG.add(pB);
const cM=new THREE.ShaderMaterial({uniforms:{t:{value:0},u:{value:0},cs:{value:1},cb:{value:1}},transparent:true,depthWrite:false,vertexShader:planetVS,
 fragmentShader:NOISE+`uniform float t,u,cs,cb;varying vec3 vP,vN,vW;void main(){vec3 p=normalize(vP);vec3 q=p*3.2*cs;q.y*=cb;q+=vec3(fbm3(p*2.+t*.015),fbm3(p*2.+5.2-t*.012),0.)*.6;q.x+=t*.02*(1.-abs(p.y));float n=fbm(q);n+=snoise(p*14.+t*.03)*.08;float a=smoothstep(.05,.45,n)*u;vec3 L=normalize(-vW);float d=smoothstep(-.1,.4,dot(normalize(vN),L));gl_FragColor=vec4(vec3(.92)*(d*.9+.02),a*(.12+d*.62));}`});
const pC=new THREE.Mesh(new THREE.SphereGeometry(1.012,SEG,SEG),cM);tG.add(pC);
const aM=new THREE.ShaderMaterial({uniforms:{u:{value:1},c:col3()},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,vertexShader:planetVS,
 fragmentShader:`uniform float u;uniform vec3 c;varying vec3 vP,vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);float rim=pow(1.-abs(dot(N,V)),1.6);float edge=smoothstep(0.,.35,abs(dot(N,V)));vec3 L=normalize(-vW);float d=smoothstep(-.4,.5,dot(N,L));gl_FragColor=vec4(c*rim*edge*d*u*2.,1.);}`});
const pA=new THREE.Mesh(new THREE.SphereGeometry(1.07,SEG,SEG),aM);tG.add(pA);
const rM=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{c:{value:new THREE.Color(.95,.8,.55)},pr:{value:.002}},vertexShader:`varying vec3 vP,vW,vC;void main(){vP=position;vC=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,
 fragmentShader:`uniform vec3 c;uniform float pr;varying vec3 vP,vW,vC;void main(){float r=length(vP.xy);float b=.55+.45*sin(r*46.)*sin(r*13.+1.);b*=.75+.25*sin(r*120.);float a=smoothstep(1.45,1.52,r)*smoothstep(2.35,2.2,r)*(1.-smoothstep(1.86,1.9,r)*smoothstep(1.95,1.91,r)*.8);vec3 L=normalize(-vW);vec3 tc=vC-vW;float sh=1.-(1.-smoothstep(.92,1.04,length(cross(tc,L))/pr))*step(0.,dot(tc,L));gl_FragColor=vec4(c*b*.7*(.35+.65*sh),a*b*.6);}`});
const pR=new THREE.Mesh(new THREE.RingGeometry(1.4,2.4,192,1),rM);pR.rotation.x=-Math.PI/2+.28;tG.add(pR);
const mM=new THREE.ShaderMaterial({uniforms:{cA:{value:new THREE.Color(0x8a8078)},cB:{value:new THREE.Color(0x6a645e)},cC:{value:new THREE.Color(0xd8d2ca)},seed:{value:4},water:{value:0},life:{value:0},ice:{value:0},t:{value:0},gas:{value:0},cshadow:{value:0}},vertexShader:planetVS,fragmentShader:planetFS});
const moonsM=[0,1,2].map(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,40,40),mM.clone());dG.add(m);return m});const pR2=new THREE.Mesh(pR.geometry,rM.clone());pR2.scale.setScalar(1.5);pR.add(pR2);
let D=null;function applyDetail(p){D=p.demo?detailFor('sim'+p.i,p.au>3?6:null):detailFor(p.w);const u=pM.uniforms;u.cA.value.copy(D.a);u.cB.value.copy(D.b);u.cC.value.copy(D.c);u.seed.value=D.seed;u.water.value=D.k.water;u.ice.value=D.k.ice;u.life.value=D.k.life;u.gas.value=D.k.gas||0;
 cM.uniforms.u.value=D.k.cloud;cM.uniforms.cs.value=D.cs;cM.uniforms.cb.value=D.cb;aM.uniforms.c.value.copy(D.atmC);tG.rotation.z=D.tilt;pR.visible=D.ring;pR2.visible=D.ringN>1;rM.uniforms.c.value.copy(D.ringC);pR2.material.uniforms.c.value.copy(D.ringC).offsetHSL(.02,-.1,-.1);
 Object.assign(u,{});['cont','lava','crater','eye','sulf','storm','rift','aur'].forEach(k=>u[k].value=D[k]);u.cityK.value=D.city?1:D.life*D.life*.3;
 moonsM.forEach((m,i)=>{const o=D.mo[i];m.visible=!!o;if(!o)return;m.scale.setScalar(o.s);const mu=m.material.uniforms;mu.cA.value.copy(o.col);mu.cB.value.copy(o.col).offsetHSL(0,0,-.12);mu.cC.value.copy(o.col).offsetHSL(0,0,.18);mu.seed.value=D.seed+i*7+3;mu.ice.value=o.ice});pC.visible=D.k.cloud>0}
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
function makeDemo(){const n=MOB?10000:50000,r=rng(7);const out=[];for(let i=0;i<n;i++){const au=Math.exp(Math.log(.55)+r()*Math.log(80));out.push({au,e:r()*.28,inc:(r()-.5)*.2,node:r()*6.283,peri:r()*6.283,M0:r()*6.283,col:au>=HZI&&au<=HZO?[.83,.68,.4]:[.55,.55,.6],demo:1,i})}return out}
const HINT=MOB?'Tap a planet to inspect it. Pinch to zoom.':'Click a planet to inspect it. Drag to rotate. Scroll to zoom.';
async function loadReal(){if(!API){$('#smsg').textContent='Claims open soon. Turn on the preview layer to see a full system.';return}
 $('#smsg').textContent='Loading claimed planets.';
 try{const ac=new AbortController();const to=setTimeout(()=>ac.abort(),10000);const r=await fetch(API+'/api/planets',{signal:ac.signal});clearTimeout(to);if(!r.ok)throw new Error('http');const j=await r.json();real=(j.planets||[]).map(x=>Object.assign(paramsFor(x.wallet),{no:x.no}));fill(realPts,real.slice(0,4096),3,.0012);
  $('#nReal').textContent=real.length;$('#nZone').textContent=real.filter(p=>p.zone).length;$('#smsg').textContent=real.length?'':'No planets claimed yet. Turn on the preview layer to see a full system.'}catch(e){$('#smsg').textContent='Live planet data is unavailable right now. Wallet search still shows where a planet would form.';$('#nReal').textContent=$('#nZone').textContent='n/a'}}
$('#demo').addEventListener('change',e=>{if(!demo.length){demo=makeDemo();fill(demoPts,demo,MOB?1.2:1.4,.0007)}demoPts.visible=e.target.checked;$('#demoNote').textContent=e.target.checked?'Preview layer on. '+demo.length.toLocaleString('en-US')+' simulated planets, not real wallets.':'Preview layer. Simulated planets are not real wallets.'});
/* camera */
const HOME={th:1.5708,ph:.62,ld:Math.log(5.4)};const S={th:HOME.th,ph:HOME.ph,ld:HOME.ld,tth:HOME.th,tph:HOME.ph,tld:HOME.ld,tgt:new THREE.Vector3(),off:new THREE.Vector3(),follow:null};const LMIN=Math.log(.004),LMAX=Math.log(1.6e5*LY);
const ptr=new Map();let drag=false,moved=0,pinch0=0;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;drag=true;cv.classList.add('drag');if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)}});
cv.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p){hoverQ=e;return}const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
 if(ptr.size===2){const [a,b]=[...ptr.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0)S.tld=Math.min(LMAX,Math.max(LMIN,S.tld-Math.log(d/pinch0)*1.4));pinch0=d}else{S.tth-=dx*.005;S.tph=Math.min(3.05,Math.max(.08,S.tph-dy*.005))}});
const up=e=>{ptr.delete(e.pointerId);if(!ptr.size){drag=false;cv.classList.remove('drag');if(moved<6&&!VIEW)pick(e.clientX,e.clientY,true)}pinch0=0};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();S.tld=Math.min(LMAX,Math.max(LMIN,S.tld+e.deltaY*.0016*(e.deltaMode?30:1)))},{passive:false});
/* picking */
const tmp=new THREE.Vector3(),scr=new THREE.Vector3();let hoverQ=null,hovered=null,picked=null,lastHover=0;
function nearest(x,y){let best=null,bd=MOB?26:14;const t=U.t.value;const test=(list)=>{for(const p of list){posOf(p,t,tmp);scr.copy(tmp).project(cam);if(scr.z>1)continue;const sx=(scr.x+1)/2*W,sy=(1-scr.y)/2*H;const d=Math.hypot(sx-x,sy-y);if(d<bd){bd=d;best=p}}};
 test(real);if(demoPts.visible&&(!best||bd>4))test(demo);return best}
function pick(x,y,click){const p=nearest(x,y);if(click){if(p)select(p);return}if(p!==hovered){hovered=p;if(!picked){if(p)orbitLine(p);else sel.visible=false}cv.style.cursor=p?'pointer':''}const tt=$('#tip');if(p){tt.hidden=false;tt.textContent=(p.demo?'Simulated planet '+(p.i+1):p.name)+'  '+p.au.toFixed(2)+' AU';tt.style.transform=`translate(${Math.min(x+14,W-tt.offsetWidth-8)}px,${y+14}px)`}else tt.hidden=true}
const fmt=(v,d)=>v.toFixed(d);
function zoneOf(au){return au<HZI?'Too hot':au>HZO?'Too cold':'Habitable zone'}
function describe(p,d){const z=p.au<HZI?'inside the hot edge':p.au>HZO?'beyond the cold edge':'inside the habitable zone';const w=d.k.gas?'deep banded clouds':d.water>70?'mostly ocean':d.water>35?'open seas and continents':d.water>10?'scattered lakes':'dry rock';
 const x=[];if(d.k.ice>.6)x.push('broad ice caps');if(d.moons)x.push(d.moons===1?'one moon':d.moons===2?'two moons':'three moons');if(d.ringN>1)x.push('a double ring system');else if(d.ring)x.push('a ring system');if(d.lava)x.push('glowing lava cracks');if(d.eye)x.push('one face locked toward the star');return cap(d.cls.toLowerCase())+' '+z+', '+w+(x.length?', '+x.join(' and '):'')+'.'}
const cap=s=>s[0].toUpperCase()+s.slice(1);
function spec(p,d){const K=Math.round(278/Math.sqrt(p.au)*(1-d.k.water*.08)+(d.k.gas?-60:0)+({lava:420,sulf:140,barren:-10}[d.key]||0));const days=Math.round(365.25*Math.pow(p.au,1.5));
 const rows=[['Wallet',p.demo?'Preview only':p.w.slice(0,4)+'..'+p.w.slice(-4)],['Class',d.cls],['Mass',fmt(d.mass,d.mass<10?2:0)+' Earth'],['Radius',fmt(d.rad,2)+' Earth'],['Orbit',fmt(p.au,2)+' AU'],['Period',days.toLocaleString('en-US')+' days'],['Surface temp',K+' K'],['Atmosphere',d.atm+' %'],['Water',d.water+' %'],['Chemistry',d.chem+' %'],['Zone',zoneOf(p.au)],['Moons',String(d.moons)],['Rings',d.ringN>1?'Double':d.ring?'Yes':'None'],['Rare trait',d.rare.length?d.rare.join(', '):'None']];
 $('#qSpec').innerHTML='';for(const [k,v] of rows){const r=document.createElement('div');const t=document.createElement('dt');t.textContent=k;const e=document.createElement('dd');e.textContent=v;if(k==='Zone'&&v==='Habitable zone')e.className='gold';r.append(t,e);$('#qSpec').appendChild(r)}}
let VIEW=0,FLY=0;
function select(p,noFly){picked=p;orbitLine(p);applyDetail(p);$('#panel').hidden=false;
 $('#qName').textContent=p.demo?'Simulated planet '+(p.i+1):p.name;spec(p,D);$('#qD').textContent=describe(p,D);
 $('#qS').textContent=p.demo?'Preview layer':'Stage: awaiting launch';$('#qNo').textContent=p.demo?'':p.no?'No. '+String(p.no).padStart(3,'0'):'Not claimed';
 if(noFly){mk.visible=true;setFollow(false)}else enterPlanet()}
function dayAngles(p){posOf(p,U.t.value,tmp);const s=tmp.clone().negate().normalize();const up=new THREE.Vector3(0,1,0);const sd=new THREE.Vector3().crossVectors(up,s).normalize();const v=s.multiplyScalar(Math.cos(.8)).addScaledVector(sd,Math.sin(.8)).addScaledVector(up,.3).normalize();let th=Math.atan2(v.z,v.x);th+=Math.round((S.th-th)/6.2832)*6.2832;return{th,ph:Math.acos(v.y)}}
function enterPlanet(){if(!picked)return;VIEW=1;FLY=1;setFollow(true);S.tld=Math.log(PR*(MOB?6.4:5.6));const da=dayAngles(picked);S.tth=da.th;S.tph=da.ph;$('#hint').textContent=MOB?'Drag to turn the planet. Back to system returns.':'Drag to turn around the planet. Press Esc to return.';document.body.classList.add('pv');$('#qView').textContent='Back to system'}
function exitPlanet(){if(!VIEW)return;$('#hint').textContent=HINT;VIEW=0;FLY=1;setFollow(false);S.tld=HOME.ld;S.tth=HOME.th;S.tph=HOME.ph;document.body.classList.remove('pv');$('#qView').textContent='Planet view';mk.visible=!!picked}
$('#qView').addEventListener('click',()=>VIEW?exitPlanet():enterPlanet());
addEventListener('keydown',e=>{if(e.key==='Escape'){if(e.target&&e.target.tagName==='INPUT'){e.target.blur();if(!VIEW)return}if(VIEW)exitPlanet();else if(picked)$('#qClose').click()}});
$('#qClose').addEventListener('click',()=>{exitPlanet();$('#panel').hidden=true;picked=null;setFollow(false);mk.visible=false;sel.visible=false});
$('#sf').addEventListener('submit',e=>{e.preventDefault();const q=$('#sq').value.trim();const m=$('#smsg');if(!q){m.textContent='';return}
 const hit=real.find(p=>p.w===q)||real.find(p=>q.length>=4&&p.w.toLowerCase().startsWith(q.toLowerCase()));
 if(hit){select(hit);m.textContent='Found '+hit.name+'.'}else if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)){const p=paramsFor(q);select(p);m.textContent='This wallet has not claimed yet. Showing where its planet would form.'}else m.textContent='No claimed planet matches that address.'});
/* controls */
let PLAY=!RM,SPD=1;const pb=$('#play');function setPlay(v){PLAY=v;pb.textContent=v?'Pause':'Play';pb.setAttribute('aria-pressed',String(!v))}setPlay(PLAY);
pb.addEventListener('click',()=>setPlay(!PLAY));
document.querySelectorAll('#spd button').forEach(b=>b.addEventListener('click',()=>{SPD=+b.dataset.s;document.querySelectorAll('#spd button').forEach(x=>x.classList.toggle('on',x===b))}));
function setFollow(v){S.follow=v&&picked?picked:null;if(S.follow){posOf(S.follow,U.t.value,tmp);S.off.copy(S.tgt).sub(tmp)}const f=$('#qFollow');f.textContent=S.follow?'Following':'Follow';f.classList.toggle('on',!!S.follow)}
$('#qFollow').addEventListener('click',()=>setFollow(!S.follow));
$('#home').addEventListener('click',()=>{exitPlanet();setFollow(false);S.tth=HOME.th;S.tph=HOME.ph;S.tld=HOME.ld});
cv.addEventListener('pointerleave',()=>{$('#tip').hidden=true});
/* labels */
const LB=[];const lay=$('#labels');function lab(txt,cls,pos){const e=document.createElement('span');e.className='olab mono '+cls;e.textContent=txt;lay.appendChild(e);LB.push({e,p:new THREE.Vector3(...pos)})}
lab('G2V','star',[0,0,SR+.13]);lab('Too hot','hot',[0,0,.74]);lab('Habitable zone 0.95 to 1.37 AU','hz',[0,0,(HZI+HZO)/2]);lab('Too cold','cold',[0,0,1.72]);
[.5,1,2,5].forEach(a=>lab(a+' AU','au',[a*.7071,0,-a*.7071]));
function placeLabels(sys,d){const show=sys>.3&&d<60&&!(VIEW&&d<.2);lay.style.opacity=show?Math.min(1,sys):0;if(!show)return;for(const l of LB){scr.copy(l.p).project(cam);const vis=scr.z<1&&Math.abs(scr.x)<1.1&&Math.abs(scr.y)<1.1;l.e.style.display=vis?'':'none';if(vis)l.e.style.transform=`translate(${(scr.x+1)/2*W}px,${(1-scr.y)/2*H}px) translate(-50%,-50%)`}
 }
/* loop */
const ft=[];let q=1,last=performance.now();
function fmtScale(d){if(d<.1)return fmt(d*1000,1)+' milli AU';if(d<2000)return fmt(d,d<10?2:0)+' AU';const ly=d/LY;return ly<1?fmt(d,0).replace(/\B(?=(\d{3})+(?!\d))/g,',')+' AU':ly<1000?fmt(ly,1)+' light years':Math.round(ly).toLocaleString('en-US')+' light years'}
let lastScale='',VO=0;
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((now-last)/1000,.05);last=now;
 ft.push(dt*1000);if(ft.length>90){const a=ft.reduce((x,y)=>x+y)/ft.length;ft.length=0;if(a>20&&q>.6){q-=.2;renderer.setPixelRatio(DPR*q);W=0;size()}}
 const k=1-Math.exp(-dt*7);S.th+=(S.tth-S.th)*k;S.ph+=(S.tph-S.ph)*k;const kf=FLY?1-Math.exp(-dt*2.6):k*.9;S.ld+=(S.tld-S.ld)*kf;if(FLY&&Math.abs(S.tld-S.ld)<.03&&S.off.lengthSq()<1e-10)FLY=0;
 if(PLAY&&!VIEW)U.t.value+=dt*.02*SPD;
 if(S.follow){posOf(S.follow,U.t.value,tmp);S.off.multiplyScalar(Math.exp(-dt*(FLY?2.4:5)));S.tgt.copy(tmp).add(S.off)}else S.tgt.multiplyScalar(1-Math.min(1,dt*3));
 const d=Math.exp(S.ld);const sp=Math.sin(S.ph);cam.position.set(S.tgt.x+d*sp*Math.cos(S.th),S.tgt.y+d*Math.cos(S.ph),S.tgt.z+d*sp*Math.sin(S.th));{const cl=cam.position.length(),mn=SR*1.5;if(cl<mn){cam.position.multiplyScalar(mn/Math.max(cl,1e-4));if(!S.follow)S.tld=Math.max(S.tld,Math.log(mn))}}cam.lookAt(S.tgt);
 VO+=((VIEW?1:0)-VO)*k;if(VO>.002)cam.setViewOffset(W,H,MOB?0:-W*.09*VO,MOB?H*.17*VO:0,W,H);else cam.clearViewOffset();
 cam.near=Math.max(d*.002,1e-6);cam.far=d<.08?6:Math.max(d*40,GR*4);cam.updateProjectionMatrix();
 const sys=1-Math.min(1,Math.max(0,(Math.log(d)-Math.log(300))/(Math.log(6000)-Math.log(300))));U.op.value=sys;const close=VIEW&&d<.06;hz.visible=sys>.01;realPts.visible=sys>.01&&!close;demoPts.visible=$('#demo').checked&&!close;dG.visible=!!(picked&&d<.3);if(dG.visible){posOf(picked,U.t.value,tmp);dG.position.copy(tmp);const tt=now/1000;pB.rotation.y=tt*D.rot;pC.rotation.y=tt*(D.rot*1.2+.004);pM.uniforms.t.value=cM.uniforms.t.value=tt;moonsM.forEach((m,i)=>{const o=D.mo[i];if(!o)return;const r=o.r,w=o.w,ph=i*2.1+D.seed;m.position.set(Math.cos(tt*w+ph)*r,Math.sin(tt*w+ph)*.35*r*.2,Math.sin(tt*w+ph)*r)})}ringLines.forEach(l=>l.material.opacity=.16*sys);sel.material.opacity=.75*sys*(close?.25:1);mk.material.opacity=1;if(VIEW)mk.visible=false;
 near.material.uniforms.op.value=Math.min(1,Math.max(0,(Math.log(d)-Math.log(800))/2))*(1-Math.min(1,Math.max(0,(Math.log(d)-Math.log(2e8))/1.5)))+ .25;
 galaxy.material.uniforms.op.value=.045*Math.min(1,Math.max(0,(Math.log(d)-Math.log(3e8))/2.2));
 galaxy.visible=galaxy.material.uniforms.op.value>.001;
 const sc=fmtScale(d*.8);if(sc!==lastScale){lastScale=sc;$('#scale').textContent=sc}
 if(hoverQ&&!drag&&!VIEW&&now-lastHover>90){lastHover=now;pick(hoverQ.clientX,hoverQ.clientY,false);hoverQ=null}
 if(picked){posOf(picked,U.t.value,tmp);mk.geometry.attributes.position.setXYZ(0,tmp.x,tmp.y,tmp.z);mk.geometry.attributes.position.needsUpdate=true;const ph=.5+.5*Math.sin(now*.005);mk.material.uniforms.ph.value=ph;mk.material.uniforms.s.value=40+ph*16}
 sunSM.uniforms.t.value=corSM.uniforms.t.value=now/1000;corM.quaternion.copy(cam.quaternion);const camS=cam.position.length();sunM.visible=corM.visible=camS<500;sun.material.uniforms.fo.value=Math.min(1,Math.max(0,(camS-60)/240));
 placeLabels(sys,d);
 renderer.render(scene,cam)}
addEventListener('resize',size,{passive:true});size();$('#hint').textContent=HINT;loadReal().finally(()=>{const w=new URLSearchParams(location.search).get('w');if(w&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)){$('#sq').value=w;$('#sf').requestSubmit()}});requestAnimationFrame(frame);
window.__orbits={S,setPlay,exitPlanet,get demo(){return demo},select,get real(){return real},demoOn:()=>{$('#demo').click()}};

// Pre-warm every shader program and buffer (close-up planet, rings, moons, sun LOD) so the first fly-in has no compile hitch.
{const warm=()=>{try{const st=[];scene.traverse(o=>{st.push([o,o.visible]);o.visible=true});renderer.compile(scene,cam);const rt=new THREE.WebGLRenderTarget(32,32);renderer.setRenderTarget(rt);renderer.render(scene,cam);renderer.setRenderTarget(null);rt.dispose();st.forEach(([o,v])=>o.visible=v)}catch(e){}};
 if(document.readyState==='complete')setTimeout(warm,300);else addEventListener('load',()=>setTimeout(warm,300),{once:true})}
