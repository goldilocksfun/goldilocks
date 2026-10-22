import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createSky} from './sky.js';
const VH=(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;top:0;height:100lvh;width:0;visibility:hidden;pointer-events:none';document.documentElement.appendChild(d);return()=>Math.max(d.offsetHeight||0,innerHeight)})();
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;if(RM)document.documentElement.classList.add('rm');const MOB=innerWidth<760;
const gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;gsap.registerPlugin(ScrollTrigger);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const lerp=(a,b,t)=>a+(b-a)*t,cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),seg=(p,a,b)=>cl((p-a)/(b-a));
const eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,eo=t=>1-Math.pow(1-t,4);

/* ---------- loader ---------- */
let loadP=0,loadT=0,lt0=performance.now();const lnum=$('#lnum'),lbar=$('#lbar');
const loaderTick=()=>{const now=performance.now(),dtl=Math.min((now-lt0)/1000,.1);lt0=now;loadP=Math.min(loadT,loadP+dtl*90);const v=Math.round(loadP);lnum.textContent=String(v).padStart(3,'0');$('#lstage').textContent=v<30?'Seeding molecular cloud':v<60?'Compiling stellar shaders':v<90?'Integrating orbits':'Ready';lbar.style.width=v+'%';if(v<100)requestAnimationFrame(loaderTick);else readyLoader()};
let loaderGone=false;const closeLoader=()=>{if(loaderGone)return;loaderGone=true;window.__enterSite&&window.__enterSite();$('#loader').classList.add('done');document.body.classList.remove('loading');setTimeout(()=>{$('#loader').remove();ScrollTrigger.refresh()},1300)};
const readyLoader=()=>{const L=$('#loader');L.classList.add('ready');const go=()=>closeLoader();$('#lenter').addEventListener('click',go);addEventListener('keydown',e=>{if(!loaderGone&&(e.key==='Enter'||e.key===' '))go()});L.addEventListener('wheel',go,{passive:true});L.addEventListener('touchend',go);setTimeout(go,5000)};
loaderTick();loadT=20;document.fonts.ready.then(()=>{loadT=Math.max(loadT,55)});

/* ---------- split text ---------- */
$$('.split').forEach(el=>{let i=0;const walk=n=>{[...n.childNodes].forEach(ch=>{if(ch.nodeType===3){const frag=document.createDocumentFragment();ch.textContent.split(/(\s+)/).forEach(tok=>{if(!tok)return;if(/^\s+$/.test(tok)){frag.append(' ');return}const w=document.createElement('span');w.className='w';[...tok].forEach(c=>{const s=document.createElement('span');s.className='c';s.textContent=c;s.style.transitionDelay=(i++*0.028)+'s';w.append(s)});frag.append(w)});ch.replaceWith(frag)}else if(ch.nodeType===1&&ch.tagName!=='BR')walk(ch)})};walk(el)});

/* ---------- smooth scroll ---------- */
const lenis=new Lenis({duration:RM?0:1.35,smoothTouch:false,lerp:RM?1:.1,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true});window.__lenis=lenis;
lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(t=>lenis.raf(t*1000));gsap.ticker.lagSmoothing(0);
$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(h.length>1){e.preventDefault();lenis.scrollTo(h,{duration:2})}}));
$$('.sec-head,.cta,.claimcta').forEach(el=>ScrollTrigger.create({trigger:el,start:'top 80%',onEnter:()=>el.classList.add('in')}));

/* ---------- cursor ---------- */
const cur=$('#cur'),dot=$('#cur-dot');let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my,nmx=0,nmy=0;
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;nmx=mx/innerWidth*2-1;nmy=my/innerHeight*2-1;dot.style.transform=`translate(${mx}px,${my}px)`});

$$('[data-h],a,button').forEach(el=>{el.addEventListener('mouseenter',()=>cur.classList.add('h'));el.addEventListener('mouseleave',()=>cur.classList.remove('h'))});
const au=$('#theme');let fadeT;au.src='audio/theme.mp3';au.preload='auto';
let an=null,ad=null,lvl=0;const lvlTick=()=>{if(an&&!au.paused){an.getByteFrequencyData(ad);let s=0;for(let i=1;i<24;i++)s+=ad[i];const v=s/23/255;lvl=lerp(lvl,v*au.volume*1.8,.15)}else lvl=lerp(lvl,0,.08);document.documentElement.style.setProperty('--lvl',lvl.toFixed(3));requestAnimationFrame(lvlTick)};lvlTick();
const fade=(to,ms,done)=>{clearInterval(fadeT);const from=au.volume,t0=performance.now();fadeT=setInterval(()=>{const k=Math.min((performance.now()-t0)/ms,1);au.volume=from+(to-from)*k*k*(3-2*k);if(k>=1){clearInterval(fadeT);done&&done()}},30)};

let soundOn=localStorage.getItem('gl_sound')!=='off',playing=false;
const ensureAnalyser=()=>{if(an)return;try{const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();const src=ac.createMediaElementSource(au);an=ac.createAnalyser();an.fftSize=256;ad=new Uint8Array(an.frequencyBinCount);src.connect(an);an.connect(ac.destination);window.__ac=ac}catch(e){}};
const setUI=()=>{const b=$('#snd');b.classList.toggle('on',soundOn);b.querySelector('em').textContent=soundOn?'Sound on':'Sound off'};
const startAudio=()=>{if(!soundOn||playing)return;au.volume=0;au.play().then(()=>{playing=true;ensureAnalyser();window.__ac&&window.__ac.resume();fade(.6,2200)}).catch(()=>{})};
const stopAudio=()=>{playing=false;fade(0,900,()=>au.pause())};
setUI();startAudio();
const gesture=()=>{startAudio();if(playing||!soundOn)['pointerdown','keydown','touchend','wheel','click'].forEach(e=>removeEventListener(e,gesture,true))};
['pointerdown','keydown','touchend','wheel','click'].forEach(e=>addEventListener(e,gesture,true));
window.__enterSite=()=>{startAudio()};
$('#snd').addEventListener('click',e=>{e.stopPropagation();soundOn=!soundOn;localStorage.setItem('gl_sound',soundOn?'on':'off');setUI();soundOn?startAudio():stopAudio()});

/* ---------- renderer ---------- */
const canvas=$('#gl');const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
const DPR=Math.min(devicePixelRatio||1,MOB?1:1.5);renderer.setPixelRatio(DPR);renderer.setSize(innerWidth,VH(),false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(innerWidth<760?60:42,innerWidth/VH(),.05,4000);

const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<6;i++){f+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return f;}
float fbm3(vec3 p){float f=0.,a=.5;for(int i=0;i<3;i++){f+=a*snoise(p);p*=2.1;a*=.5;}return f;}`;

/* ---------- starfield ---------- */
{const n=7000,p=new Float32Array(n*3),s=new Float32Array(n),c=new Float32Array(n*3);const tc=new THREE.Color();
for(let i=0;i<n;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(900+Math.random()*900);p.set([v.x,v.y,v.z],i*3);s[i]=Math.random();tc.setHSL(Math.random()<.7?.6:.08,.5,.75+Math.random()*.2);c.set([tc.r,tc.g,tc.b],i*3)}
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aR',new THREE.BufferAttribute(s,1));g.setAttribute('color',new THREE.BufferAttribute(c,3));
var starMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},dpr:{value:DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
vertexShader:`attribute float aR;varying float vA;varying vec3 vC;uniform float t,dpr;void main(){vC=color;float tw=.55+.45*sin(t*(1.+aR*3.)+aR*60.);vA=tw*(.35+aR*.65);gl_PointSize=(1.+pow(aR,6.)*3.)*dpr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC*vA*1.4,a*vA);}`});
scene.add(new THREE.Points(g,starMat))}

/* ---------- nebula puffs ---------- */
function puffTex(){const S=256,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');for(let i=0;i<26;i++){const x=S/2+(Math.random()-.5)*S*.45,y=S/2+(Math.random()-.5)*S*.45,r=S*(.12+Math.random()*.3);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S)}
const im=g.getImageData(0,0,S,S);for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x-S/2,y-S/2)/(S/2);const k=(y*S+x)*4;im.data[k+3]*=Math.max(0,1-d*d)}g.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);return t}
const PN=MOB?240:380,pP=new Float32Array(PN*3),pC=new Float32Array(PN*3),pS=new Float32Array(PN),pR=new Float32Array(PN);
const palette=[0xd8577a,0x5a5ad8,0x3a8ed8,0xe0905a,0x8a5ad0,0x4ab8b0,0x2a3a8a];const tcol=new THREE.Color();
for(let i=0;i<PN;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(),.5)*110);v.y*=.45;pP.set([v.x,v.y,v.z],i*3);tcol.set(palette[(Math.floor((v.x+120)/40)+Math.floor((v.z+120)/55)+(Math.random()<.3?1:0))%palette.length]);tcol.offsetHSL((Math.random()-.5)*.06,0,(Math.random()-.5)*.1);pC.set([tcol.r,tcol.g,tcol.b],i*3);pS[i]=40+Math.random()*90;pR[i]=Math.random()}
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pP,3));pg.setAttribute('color',new THREE.BufferAttribute(pC,3));pg.setAttribute('aS',new THREE.BufferAttribute(pS,1));pg.setAttribute('aR',new THREE.BufferAttribute(pR,1));
const puffMat=new THREE.ShaderMaterial({uniforms:{map:{value:puffTex()},c:{value:0},t:{value:0},op:{value:1},h:{value:VH()*DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
vertexShader:`attribute float aS,aR;uniform float c,t,h;varying vec3 vC;varying float vR,vF;void main(){vec3 p=position;float ang=t*.02*(1.+aR)+c*3.*(1.-aR*.5);mat2 m=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));p.xz=m*p.xz;p*=mix(1.,.06+aR*.1,c);vC=color;vR=aR;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(aS*mix(1.,.5,c)*h/(-mv.z)*.5,h*.6);vF=smoothstep(4.,30.,-mv.z);gl_Position=projectionMatrix*mv;}`,
fragmentShader:`uniform sampler2D map;uniform float op,t;varying vec3 vC;varying float vR,vF;void main(){vec2 uv=gl_PointCoord-.5;float a=vR*6.28+t*.03;uv=mat2(cos(a),-sin(a),sin(a),cos(a))*uv;vec4 tx=texture2D(map,uv+.5);gl_FragColor=vec4(vC*tx.a*.05*op*vF,tx.a*op);}`});
const puffs=new THREE.Points(pg,puffMat);scene.add(puffs);

/* ---------- dust -> disk (GPU) ---------- */
const N=MOB?18000:30000,aCl=new Float32Array(N*3),aDk=new Float32Array(N*3),aCo=new Float32Array(N*3),aRn=new Float32Array(N);
const dA=new THREE.Color(0xff6a8e),dB=new THREE.Color(0x7d8bff),dC=new THREE.Color(0xffc68a);
for(let i=0;i<N;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(),.55)*95);v.y*=.42;v.x+=Math.sin(v.y*.08)*12;aCl.set([v.x,v.y,v.z],i*3);
const r=3.2+Math.pow(Math.random(),1.6)*55,a=Math.random()*6.283;aDk.set([Math.cos(a)*r,(Math.random()-.5)*(.15+r*.035),Math.sin(a)*r],i*3);tcol.copy(Math.random()<.5?dA:dB).lerp(dC,Math.random()*.6);aCo.set([tcol.r,tcol.g,tcol.b],i*3);aRn[i]=Math.random()}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(aCl,3));dg.setAttribute('aDk',new THREE.BufferAttribute(aDk,3));dg.setAttribute('color',new THREE.BufferAttribute(aCo,3));dg.setAttribute('aR',new THREE.BufferAttribute(aRn,1));
const dustMat=new THREE.ShaderMaterial({uniforms:{c:{value:0},t:{value:0},op:{value:1},h:{value:VH()*DPR},gap:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
vertexShader:`attribute vec3 aDk;attribute float aR;uniform float c,t,h,gap;varying vec3 vC;varying float vA,vB;void main(){float cc=clamp(c*1.2-aR*.2,0.,1.);cc=cc*cc*(3.-2.*cc);
float r=length(aDk.xz);float ang=atan(aDk.z,aDk.x)+t*1.6/pow(r,1.5)*cc+t*.01;vec3 d=vec3(cos(ang)*r,aDk.y,sin(ang)*r);
float sw=t*.015*(1.-cc);vec3 cl=position;cl.xz=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*cl.xz;
vec3 p=mix(cl,d,cc);float lane=0.;for(int k=0;k<4;k++){float R=k==0?5.:k==1?7.6:k==2?19.:30.;lane+=exp(-pow((r-R)/.9,2.));}
vC=color*mix(1.,1.6,step(r,8.)*cc);vA=(.35+aR*.65)*(1.-gap*clamp(lane,0.,.85));vec4 mv=modelViewMatrix*vec4(p,1.);float bl=smoothstep(22.,4.,-mv.z);vB=bl;vA*=1./(1.+bl*7.);gl_PointSize=(.5+aR*1.2)*h/(-mv.z)*.07*(1.+bl*7.);gl_Position=projectionMatrix*mv;}`,
fragmentShader:`uniform float op;varying vec3 vC;varying float vA,vB;void main(){float d=length(gl_PointCoord-.5);float a=mix(smoothstep(.5,.0,d)*smoothstep(.5,.0,d),smoothstep(.5,.42,d)*.8+smoothstep(.45,0.,d)*.25,vB);gl_FragColor=vec4(vC*a*vA*op,a*vA*op);}`});
const dust=new THREE.Points(dg,dustMat);scene.add(dust);

/* ---------- star ---------- */
const sun=new THREE.Group();scene.add(sun);
const sunMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},b:{value:1}},vertexShader:`varying vec3 vP,vN,vV;void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
fragmentShader:NOISE+`uniform float t,b;varying vec3 vP,vN,vV;void main(){vec3 p=normalize(vP);float n=fbm(p*5.+vec3(0.,t*.08,t*.05));float g=abs(snoise(p*22.+t*.25));float cells=1.-smoothstep(.0,.25,g);
float mu=clamp(dot(vN,vV),0.,1.);float limb=pow(mu,.55);vec3 hot=vec3(1.6,1.35,1.);vec3 mid=vec3(1.4,.75,.28);vec3 cold=vec3(.9,.3,.08);
vec3 col=mix(cold,mid,limb);col=mix(col,hot,smoothstep(.2,1.,limb+n*.4));float spot=smoothstep(.55,.75,fbm3(p*3.+t*.01));col*=1.-spot*.55*limb;float fac=smoothstep(.35,.6,snoise(p*9.+t*.05))*(1.-limb)*.5;col+=vec3(.5,.35,.15)*fac;col*=.85+cells*.25+n*.25;gl_FragColor=vec4(col*b*2.2,1.);}`});
const sunCore=new THREE.Mesh(new THREE.SphereGeometry(2.4,96,96),sunMat);sun.add(sunCore);
const corMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},b:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:NOISE+`uniform float t,b;varying vec2 vU;void main(){float r=length(vU);float a=atan(vU.y,vU.x);float rays=snoise(vec3(cos(a)*2.,sin(a)*2.,t*.15))*.5+.5;rays=pow(rays,2.)*.9+snoise(vec3(a*6.,t*.3,0.))*.12;
float core=exp(-r*9.)*1.6;float halo=exp(-r*3.8)*(.6+rays*.7);float wide=exp(-r*1.6)*.12;vec3 c=vec3(1.,.62,.3)*halo+vec3(1.,.85,.6)*core+vec3(1.,.4,.2)*wide;gl_FragColor=vec4(c*b,1.)*smoothstep(1.,.6,r);}`});
const corona=new THREE.Mesh(new THREE.PlaneGeometry(34,34),corMat);sun.add(corona);
const birth=new THREE.Mesh(new THREE.RingGeometry(.993,1,256),new THREE.MeshBasicMaterial({color:new THREE.Color(1.3,1.,.7),transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(birth);
const sunLight=new THREE.PointLight(0xfff0d8,0,0,0);scene.add(sunLight);scene.add(new THREE.AmbientLight(0x1a2236,.25));

/* ---------- habitable zone ---------- */
const HZI=11,HZO=16;
const hzMat=new THREE.ShaderMaterial({uniforms:{u:{value:0},t:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform float u,t;varying vec3 vP;void main(){float r=length(vP.xy);float x=(r-${HZI}.)/${HZO-HZI}.;float a=atan(vP.y,vP.x);
float fill=smoothstep(0.,.25,x)*smoothstep(1.,.75,x)*.07;float e1=exp(-pow(x*60.,2.))+exp(-pow((x-1.)*60.,2.));float e2=(exp(-pow(x*10.,2.))+exp(-pow((x-1.)*10.,2.)))*.25;
float ticks=step(.985,fract(a*28.6479))*smoothstep(.0,.04,x)*smoothstep(.1,.04,x);float sweep=pow(fract(a/6.2831-t*.05),18.)*smoothstep(0.,.5,x)*smoothstep(1.,.5,x)*.35;
vec3 c=vec3(.37,.9,.85);gl_FragColor=vec4(c*(fill+e1*.9+e2+ticks*.6+sweep)*u,1.);}`});
const hz=new THREE.Mesh(new THREE.RingGeometry(HZI-1,HZO+1,512,1),hzMat);hz.rotation.x=-Math.PI/2;scene.add(hz);

/* ---------- planets ---------- */
const planetVS=`varying vec3 vP,vN,vW;void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
const planetFS=NOISE+`uniform vec3 cA,cB,cC;uniform float seed,water,life,ice,t,gas,cshadow;varying vec3 vP,vN,vW;
void main(){vec3 p=normalize(vP);vec3 L=normalize(-vW);vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);
float h=fbm(p*1.5+seed)*.95+snoise(p*7.+seed)*.03;vec3 col;
if(gas>.5){float bands=sin(p.y*18.+fbm(p*3.+seed)*3.)*.5+.5;col=mix(cA,cB,bands);col=mix(col,cC,smoothstep(.3,.9,snoise(p*vec3(1.,6.,1.)+seed)));}
else{col=mix(cA,cB,smoothstep(-.4,.3,h));col=mix(col,cC,smoothstep(.25,.6,h));}
float sea=mix(-1.2,.04,water);float isSea=gas>.5?0.:smoothstep(sea+.015,sea-.015,h);
vec3 deep=vec3(.01,.06,.2),shal=vec3(.03,.28,.45);vec3 oc=mix(deep,shal,smoothstep(sea-.25,sea,h));
float veg=life*smoothstep(sea,sea+.06,h)*smoothstep(.45,.15,h)*smoothstep(-.2,.3,snoise(p*4.+seed*2.));vec3 land=mix(col,vec3(.07,.24,.08),veg*.9);
col=mix(land,oc,isSea);float cap=smoothstep(.78,.9,abs(p.y)+snoise(p*6.)*.05)*ice;col=mix(col,vec3(.92,.95,1.),cap);
float ndl=dot(N,L);float day=smoothstep(-.12,.35,ndl);if(cshadow>0.){vec3 sp=normalize(p+L*.04);vec3 q=sp*3.2;q+=vec3(fbm3(sp*2.+t*.015),fbm3(sp*2.+5.2-t*.012),0.)*.6;q.x+=t*.02*(1.-abs(sp.y));float cs=smoothstep(.05,.45,fbm3(q));day*=1.-cs*cshadow*.45;}vec3 H=normalize(L+V);float spec=(pow(max(dot(N,H),0.),90.)*1.2+pow(max(dot(N,H),0.),12.)*.12)*isSea*day;
vec3 lit=col*(day*.95+.012)+vec3(1.,.9,.75)*spec;float term=smoothstep(-.15,.05,ndl)*smoothstep(.25,.05,ndl);lit+=vec3(.6,.25,.08)*term*.25*water;
float city=step(.72,snoise(p*38.+seed))*smoothstep(sea+.02,sea+.1,h)*(1.-isSea)*life*life;lit+=vec3(1.,.7,.35)*city*(1.-smoothstep(-.2,.05,ndl))*1.8;
float fr=pow(1.-max(dot(N,V),0.),3.);vec3 scat=mix(vec3(1.,.45,.2),mix(vec3(.3,.6,1.),vec3(.4,.95,.85),life*.3),smoothstep(-.05,.35,ndl));lit+=scat*fr*water*smoothstep(-.3,.4,ndl)*1.5;lit=mix(lit,lit*vec3(.85,.95,1.15),fr*water*.5);
gl_FragColor=vec4(lit,1.);}`;
function planetMat(o){return new THREE.ShaderMaterial({uniforms:{cA:{value:new THREE.Color(o.a)},cB:{value:new THREE.Color(o.b)},cC:{value:new THREE.Color(o.c)},seed:{value:o.seed??Math.random()*50},water:{value:o.water??0},life:{value:0},ice:{value:o.ice??0},t:{value:0},gas:{value:o.gas?1:0},cshadow:{value:0}},vertexShader:planetVS,fragmentShader:planetFS})}
function orbitLine(r,c,op){const pts=[];for(let i=0;i<=360;i++){const a=i/360*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r))}const l=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:c,transparent:true,opacity:0,depthWrite:false}));l.userData.op=op;scene.add(l);return l}
const planets=[];
[[5,.38,{a:0x3a2a22,b:0x8a6a55,c:0xc9b49a}],[7.6,.62,{a:0x6a3a1a,b:0xc07a3a,c:0xf0d0a0}],[19,1.6,{a:0xb08a60,b:0xe8d2a8,c:0x8a5a3a,gas:1}],[24,.85,{a:0x2a4a6a,b:0x6a9ac0,c:0xdfeeff,ice:1}],[30,2.1,{a:0xc7a46e,b:0xf2e2c0,c:0x9a6a40,gas:1}],[38,1.2,{a:0x2a4ab0,b:0x6a9af0,c:0xc0e0ff,gas:1}],[8.8,.45,{a:0x4a3a3a,b:0x9a7a6a,c:0xbbaa99}],[44,.7,{a:0x5a6a7a,b:0xaabbcc,c:0xffffff,ice:1}]].forEach(([r,s,o],i)=>{
 const m=new THREE.Mesh(new THREE.SphereGeometry(s,48,48),planetMat(o));m.userData={r,a:i*2.1,w:1.6/Math.pow(r,1.5),line:orbitLine(r,0x8090b0,.18)};scene.add(m);planets.push(m)});
// ring for big gas giant
{const g=planets[4];const rg=new THREE.Mesh(new THREE.RingGeometry(2.8,4.6,128),new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vP;void main(){float r=length(vP.xy);float b=.5+.5*sin(r*28.)*sin(r*7.);gl_FragColor=vec4(vec3(.85,.75,.6)*b,.55*b*smoothstep(2.8,3.,r)*smoothstep(4.6,4.3,r));}`}));rg.rotation.x=-Math.PI/2+.35;g.add(rg)}

/* your planet */
const you=new THREE.Group();scene.add(you);
const yMat=planetMat({a:0x5a3420,b:0x9a6a44,c:0xc8a27a,seed:7.3,water:0,ice:0});const yBody=new THREE.Mesh(new THREE.SphereGeometry(1,128,128),yMat);you.add(yBody);
const cloudMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},u:{value:0}},transparent:true,depthWrite:false,vertexShader:planetVS,
fragmentShader:NOISE+`uniform float t,u;varying vec3 vP,vN,vW;void main(){vec3 p=normalize(vP);vec3 q=p*3.2;q+=vec3(fbm3(p*2.+t*.015),fbm3(p*2.+5.2-t*.012),0.)*.6;q.x+=t*.02*(1.-abs(p.y));float n=fbm(q);n+=snoise(p*14.+t*.03)*.08;float a=smoothstep(.05,.45,n)*u;vec3 L=normalize(-vW);float d=smoothstep(-.1,.4,dot(normalize(vN),L));gl_FragColor=vec4(vec3(.9)*(d*.9+.02),a*(.15+d*.6));}`});
const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.015,96,96),cloudMat);you.add(clouds);
const atmMat=new THREE.ShaderMaterial({uniforms:{u:{value:0},c:{value:new THREE.Color(0x4f9dff)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,vertexShader:planetVS,
fragmentShader:`uniform float u;uniform vec3 c;varying vec3 vP,vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);float f=pow(clamp(1.+dot(N,V)*1.0,0.,1.),.0);float rim=pow(1.-abs(dot(N,V)),1.5);float edge=smoothstep(0.,.35,abs(dot(N,V)));vec3 L=normalize(-vW);float d=mix(.18,1.,smoothstep(-.4,.5,dot(N,L)));gl_FragColor=vec4(c*rim*edge*d*u*1.8,1.);}`});
const atm=new THREE.Mesh(new THREE.SphereGeometry(1.035,96,96),atmMat);you.add(atm);
const aurMat=new THREE.ShaderMaterial({uniforms:{t:{value:0},u:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,vertexShader:planetVS,
fragmentShader:NOISE+`uniform float t,u;varying vec3 vP,vN,vW;void main(){vec3 p=normalize(vP);float lat=abs(p.y);float band=smoothstep(.72,.8,lat)*smoothstep(.95,.85,lat);float lon=atan(p.z,p.x);float cur=pow(.5+.5*snoise(vec3(lon*3.,t*.4,p.y*4.)),2.);vec3 L=normalize(-vW);float night=1.-smoothstep(-.3,.2,dot(normalize(vN),L));vec3 c=mix(vec3(.2,1.,.5),vec3(.6,.3,1.),smoothstep(.8,.92,lat));gl_FragColor=vec4(c*band*cur*u*(.25+night)*1.6,1.);}`});
const aurora=new THREE.Mesh(new THREE.SphereGeometry(1.05,96,64),aurMat);you.add(aurora);
const moons=[];[[2.1,.12,0xb8b0a8,.9],[3.0,.08,0x9a8c80,.55]].forEach(([r,s,c,w],i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(s,32,32),planetMat({a:c,b:0x6a645e,c:0xdedad4,seed:i*9+3}));m.userData={r,w,a:i*2.5};you.add(m);moons.push(m)});
{const gm=new THREE.Mesh(new THREE.SphereGeometry(.18,24,24),planetMat({a:0x8a8078,b:0xc0b8ae,c:0xffffff}));gm.userData={r:3.4,w:.6,a:1};planets[2].add(gm);moons.push(gm)}
const marker=new THREE.Mesh(new THREE.RingGeometry(1.9,1.94,128),new THREE.MeshBasicMaterial({color:0xf5c97a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));you.add(marker);
const yOrbit=orbitLine(1,0xf5c97a,.6);
// jackpot burst
const BN=4000,bDir=new Float32Array(BN*3),bR=new Float32Array(BN);for(let i=0;i<BN;i++){const v=new THREE.Vector3().randomDirection();bDir.set([v.x,v.y*.35,v.z],i*3);bR[i]=Math.random()}
const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bDir,3));bg.setAttribute('aR',new THREE.BufferAttribute(bR,1));
const burstMat=new THREE.ShaderMaterial({uniforms:{j:{value:0},h:{value:VH()*DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:`attribute float aR;uniform float j,h;varying float vA;void main(){float d=1.3+j*(3.+aR*14.);vec3 p=position*d;vA=(1.-j*.7)*step(.001,j)*(.4+aR*.6);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+aR*2.)*h/(-mv.z)*.03;gl_Position=projectionMatrix*mv;}`,
fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vec3(1.6,1.1,.5)*a*vA,a*vA);}`});
you.add(new THREE.Points(bg,burstMat));
const shock=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.97,1,256),new THREE.MeshBasicMaterial({color:new THREE.Color(1.1,.8,.4),transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));m.rotation.x=-Math.PI/2;you.add(m);shock.push(m)}

/* ---------- post ---------- */
const isGL2=renderer.capabilities.isWebGL2;const rtMS=new THREE.WebGLRenderTarget(innerWidth*DPR,VH()*DPR,{type:THREE.HalfFloatType,samples:0});const composer=new EffectComposer(renderer,rtMS);composer.setPixelRatio(DPR);composer.setSize(innerWidth,VH());
composer.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,VH()/2),.62,.5,.94);composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass=new ShaderPass({uniforms:{tDiffuse:{value:null},t:{value:0},flash:{value:0},gold:{value:0},lvl:{value:0},sun:{value:new THREE.Vector2(.5,.5)},sunI:{value:0},asp:{value:innerWidth/VH()},ca:{value:1}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float t,sunI,asp,ca,flash,gold,lvl;uniform vec2 sun;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 c=vUv-.5;float r2=dot(c,c);vec2 off=c*r2*.005*ca;vec3 col;col.r=texture2D(tDiffuse,vUv+off).r;col.g=texture2D(tDiffuse,vUv).g;col.b=texture2D(tDiffuse,vUv-off).b;
vec2 sv=sun-.5;vec3 fl=vec3(0.);for(int i=1;i<=4;i++){float f=float(i);vec2 gp=.5-sv*(f*.45-.2);vec2 d=(vUv-gp);d.x*=asp;float s=.012+f*.012;fl+=vec3(.9-f*.1,.6,.4+f*.12)*smoothstep(s,s*.4,length(d))*.05;}
vec2 sd=vUv-sun;float streak=exp(-abs(sd.y)*260.)*exp(-abs(sd.x*asp)*2.5)*.35;fl+=vec3(1.,.75,.5)*streak;col+=fl*sunI;
float lum=dot(col,vec3(.299,.587,.114));col=mix(col,col*vec3(.92,1.,1.08),smoothstep(.35,0.,lum)*.6);col=mix(col,col*vec3(1.06,1.,.9),smoothstep(.4,1.,lum)*.5);col+=vec3(1.,.9,.75)*flash*.14;col=mix(col,col*vec3(1.12,1.,.82)+vec3(.03,.02,0.),gold);col*=1.+lvl*.12;
float vig=smoothstep(1.05,.25,length(c*vec2(asp*.8,1.)));col*=mix(.55,1.,vig);col=mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,1.06);col=max(col-vec3(.006,.005,.0),0.)+vec3(.0,.002,.006)*(1.-vig);
vec2 q=gl_FragCoord.xy+fract(t*7.)*97.;col+=(h(q)+h(q+17.3)-1.)*(1./255.)*1.5;col+=(h(vUv*vec2(960.,540.)+fract(t*3.))-.5)*.012;gl_FragColor=vec4(col,1.);}`});
composer.addPass(finalPass);
const fxaa=new ShaderPass({uniforms:{tDiffuse:{value:null},rs:{value:new THREE.Vector2(1/(innerWidth*DPR),1/(VH()*DPR))}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 rs;varying vec2 vUv;float L(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){vec3 nw=texture2D(tDiffuse,vUv+vec2(-1.,-1.)*rs).rgb,ne=texture2D(tDiffuse,vUv+vec2(1.,-1.)*rs).rgb,sw=texture2D(tDiffuse,vUv+vec2(-1.,1.)*rs).rgb,se=texture2D(tDiffuse,vUv+vec2(1.,1.)*rs).rgb;vec4 m=texture2D(tDiffuse,vUv);
float a=L(nw),b=L(ne),c=L(sw),d=L(se),e=L(m.rgb);float mn=min(e,min(min(a,b),min(c,d))),mx=max(e,max(max(a,b),max(c,d)));
vec2 dir=vec2(-((a+b)-(c+d)),((a+c)-(b+d)));float rd=max((a+b+c+d)*.03125,1./128.);float rm=1./(min(abs(dir.x),abs(dir.y))+rd);dir=clamp(dir*rm,-8.,8.)*rs;
vec3 A=.5*(texture2D(tDiffuse,vUv+dir*(1./3.-.5)).rgb+texture2D(tDiffuse,vUv+dir*(2./3.-.5)).rgb);vec3 B=A*.5+.25*(texture2D(tDiffuse,vUv-dir*.5).rgb+texture2D(tDiffuse,vUv+dir*.5).rgb);float lb=L(B);
gl_FragColor=vec4((lb<mn||lb>mx)?A:B,1.);}`});composer.addPass(fxaa);
var lastW=innerWidth,lastH=VH();addEventListener('resize',()=>{const nh=VH();if(innerWidth===lastW&&Math.abs(nh-lastH)<160&&matchMedia('(hover:none)').matches)return;lastW=innerWidth;lastH=nh;renderer.setSize(innerWidth,nh,false);composer.setSize(innerWidth,nh);cam.aspect=innerWidth/nh;cam.fov=innerWidth<760?60:42;cam.updateProjectionMatrix();finalPass.uniforms.asp.value=cam.aspect;fxaa.uniforms.rs.value.set(1/(innerWidth*renderer.getPixelRatio()),1/(nh*renderer.getPixelRatio()));[puffMat,dustMat,burstMat].forEach(m=>m.uniforms.h.value=VH()*DPR)});

/* ---------- scroll state ---------- */
const st={p:0};let P=0;
ScrollTrigger.create({trigger:'#story',start:'top top',end:'bottom bottom',onUpdate:s=>{st.p=s.progress}});
const names=['Nebula','Collapse','Accretion','Habitable zone','Migration','Abiogenesis','First life'],bounds=[0,.11,.24,.38,.51,.64,.87];
const panels=$$('.panel').map(el=>({el,a:+el.dataset.a,b:+el.dataset.b,state:0}));
const camPath=new THREE.CatmullRomCurve3([new THREE.Vector3(0,40,170),new THREE.Vector3(-20,28,120),new THREE.Vector3(10,30,88),new THREE.Vector3(0,58,72),new THREE.Vector3(-18,52,42),new THREE.Vector3(16,30,40)],false,'centripetal');
const camKeys=[0,.12,.25,.38,.47,.6];
function wideCam(p){let i=0;while(i<camKeys.length-2&&p>camKeys[i+1])i++;const lt=eio(seg(p,camKeys[i],camKeys[i+1]));return camPath.getPoint((i+lt)/(camKeys.length-1))}
const yPos=new THREE.Vector3(),camPos=new THREE.Vector3(),camTgt=new THREE.Vector3(),tmpV=new THREE.Vector3(),sunScr=new THREE.Vector3();
const R={au:$('#r-au'),k:$('#r-k'),esi:$('#r-esi'),life:$('#r-life'),zone:$('#r-zone'),box:$('#readout')};
const sky=createSky(scene,cam,{mobile:MOB,rm:RM,dpr:DPR});window.__sky=sky;let SB=0,SBh=0;const storyB=()=>{if(!SB||SBh!==document.documentElement.scrollHeight){SBh=document.documentElement.scrollHeight;SB=story.offsetTop+story.offsetHeight}return SB};addEventListener('resize',()=>{SB=0},{passive:true});let firstFrame=true;const clock=new THREE.Clock();const story=$('#story');
const perf={n:0,sum:0,low:false};window.__perf=perf;
function frame(){requestAnimationFrame(frame);if(document.hidden)return;const f0=performance.now();const rdt=clock.getDelta(),dt=Math.min(rdt,.05),t=clock.elapsedTime;sky.update(dt,t);
 P=st.p;
 const sb=storyB()-scrollY;const vis=sb>innerHeight*.92;const ex=cl((sb/innerHeight-.6)/.32);if(ex!==frame.ex){frame.ex=ex;const ev=String(Math.round(ex*1000)/1000);story.style.opacity=ev;['.crops','.lbx','.grid-ov'].forEach(q=>{const e=document.querySelector(q);if(e)e.style.opacity=ev});story.style.visibility=ex<=0?'hidden':'visible'}canvas.style.opacity=cl(sb/innerHeight*1.4-.2);document.body.classList.toggle('solid',sb<innerHeight*.6);document.querySelector('.hud').style.opacity=cl(sb/innerHeight*2-.5);
 // panels
 panels.forEach(o=>{const on=vis&&P>=o.a&&P<o.b;if(on&&o.state!==1){o.el.classList.add('snap');o.el.classList.remove('out','in');void o.el.offsetWidth;o.el.classList.remove('snap');o.el.classList.add('on','in');o.state=1}else if(!on&&o.state===1){o.el.classList.add('out');o.el.classList.remove('in');o.state=2;setTimeout(()=>{if(o.state===2)o.el.classList.remove('on')},700)}});
 let ci=0;bounds.forEach((b,i)=>{if(P>=b)ci=i});if(ci!==frame.ci){frame.ci=ci;const cn=$('#chapname');cn.classList.add('swap');setTimeout(()=>{cn.textContent=names[frame.ci];$('#chap').textContent='0'+frame.ci;cn.classList.remove('swap')},220)}$('#prog').style.width=P*100+'%';
 if(!vis&&!firstFrame){return}
 // collapse
 const c=seg(P,.03,.27);dustMat.uniforms.c.value=c;puffMat.uniforms.c.value=eio(c);
 const clear=seg(P,.26,.44);puffMat.uniforms.op.value=1-eio(seg(P,.06,.2));dustMat.uniforms.op.value=1-clear*.55;dustMat.uniforms.gap.value=seg(P,.27,.4);
 [dustMat,puffMat,starMat,sunMat,corMat,hzMat,cloudMat,aurMat,finalPass].forEach(m=>m.uniforms.t&&(m.uniforms.t.value=t));
 const ign=eo(seg(P,.13,.23));sun.scale.setScalar(Math.max(ign,.001));sunMat.uniforms.b.value=ign;corMat.uniforms.b.value=ign*(1+.04*Math.sin(t*2.));sunLight.intensity=4*ign;
 corona.quaternion.copy(cam.quaternion);const bq=seg(P,.15,.26);birth.quaternion.copy(cam.quaternion);birth.scale.setScalar(2+eo(bq)*70);birth.material.opacity=bq>0&&bq<1?(1-bq)*(1-bq)*.7:0;const flash=Math.exp(-Math.pow((P-.165)/.012,2));
 // planets
 const form=seg(P,.25,.37);planets.forEach((m,i)=>{const u=m.userData;u.a+=u.w*dt*.6;m.position.set(Math.cos(u.a)*u.r,0,Math.sin(u.a)*u.r);const s=eo(cl(form*1.7-i*.09));m.scale.setScalar(Math.max(s,.001));m.rotation.y+=dt*.15;u.line.material.opacity=u.line.userData.op*s*(1-seg(P,.62,.68));const dc=m.position.distanceTo(cam.position);m.visible=!(P>.6&&dc<22)&&P<.86});
 hzMat.uniforms.u.value=eio(seg(P,.38,.46))*(1-seg(P,.63,.69)*.95);
 // you
 const appear=eo(seg(P,.49,.54)),mig=eio(seg(P,.52,.64));const yr=lerp(26,13.5,mig);const yA=2.35+P*1.1+t*.004;
 yPos.set(Math.cos(yA)*yr,0,Math.sin(yA)*yr);you.position.copy(yPos);you.scale.setScalar(Math.max(appear,.001));
 yOrbit.scale.setScalar(yr);yOrbit.material.opacity=appear*.5*(1-seg(P,.63,.67));marker.material.opacity=appear*(1-seg(P,.62,.66))*(.55+.45*Math.sin(t*3));marker.quaternion.copy(cam.quaternion);
 yBody.rotation.y+=dt*.05;moons.forEach(m=>{const u=m.userData;u.a+=u.w*dt;m.position.set(Math.cos(u.a)*u.r,Math.sin(u.a)*u.r*.12,Math.sin(u.a)*u.r);m.rotation.y+=dt*.1});aurMat.uniforms.u.value=seg(P,.72,.86);clouds.rotation.y+=dt*.065;
 const a1=seg(P,.66,.72),a2=seg(P,.7,.78),a3=seg(P,.75,.86);
 atmMat.uniforms.u.value=a1;yMat.uniforms.water.value=a2;yMat.uniforms.ice.value=a2*.8;yMat.uniforms.life.value=a3;yMat.uniforms.cshadow.value=a1;yMat.uniforms.t.value=t;cloudMat.uniforms.u.value=a1*.9;
 [['#m1','#v1',a1],['#m2','#v2',a2],['#m3','#v3',a3]].forEach(([m,v,x])=>{$(m).style.width=x*100+'%';$(v).textContent=Math.round(x*100)});
 // readout
 const au=yr/13.5,K=Math.round(255/Math.sqrt(au)+a1*33);const esi=Math.max(0,1-Math.abs(K-288)/(K+288)*2.2)*(.55+.45*(a2*.5+a3*.5));
 R.box.classList.toggle('on',P>.49&&P<.87);R.au.textContent=au.toFixed(2);R.k.textContent=K;R.esi.textContent=esi.toFixed(2);R.life.textContent=String(Math.round(a3*100)).padStart(2,'0');
 const inZ=yr<HZO&&yr>HZI;R.zone.classList.toggle('in',inZ);R.zone.textContent=inZ?'Inside zone / earning':'Outside zone';
 // jackpot
 const j=seg(P,.87,1);burstMat.uniforms.j.value=eo(j);shock.forEach((m,i)=>{const q=(j*1.8+i/3)%1;m.scale.setScalar(1.5+eo(q)*9);m.material.opacity=j>0?(1-q)*.45:0});bloom.strength=.8+j*.15;
 // camera
 const wide=wideCam(Math.min(P,.6));const close=seg(P,.6,.7),ce=eio(close);
 const inw=tmpV.copy(yPos).normalize().negate();const side=new THREE.Vector3(-inw.z,0,inw.x);
 const mk=innerWidth<760?1.7:1;const near=yPos.clone().addScaledVector(inw,2.2*mk).addScaledVector(side,5.6*mk).add(new THREE.Vector3(0,1.1,0));
 const nearT=yPos.clone();
 const jk=eio(seg(P,.86,1));const oa=jk*.9;const far=yPos.clone().addScaledVector(inw,13*Math.cos(oa)).addScaledVector(side,13*Math.sin(oa)+4).add(new THREE.Vector3(0,6-jk*2,0));
 camPos.copy(wide).lerp(near,ce).lerp(far,jk);
 const wideT=new THREE.Vector3().lerp(yPos,appear*.25*(1-ce));camTgt.copy(wideT).lerp(nearT,ce).lerp(yPos,jk);
 if(!RM){camPos.x+=nmx*lerp(3,.25,ce);camPos.y+=-nmy*lerp(2,.15,ce);}
 cam.position.copy(camPos);cam.lookAt(camTgt);cam.clearViewOffset();cam.updateMatrixWorld();const pn=yPos.clone().project(cam);const mob=innerWidth<760;const tx=mob?0:lerp(.24,0,jk),ty=mob?lerp(-.02,-.3,jk):lerp(0,-.1,jk);const pin=ce;
 const ox=(pn.x-tx)*innerWidth/2*pin,oy=-(pn.y-ty)*lastH/2*pin;if(Math.abs(ox)+Math.abs(oy)>.5)cam.setViewOffset(innerWidth,lastH,ox,oy,innerWidth,lastH);
 // flare
 sunScr.set(0,0,0).project(cam);const onS=sunScr.z<1&&Math.abs(sunScr.x)<1.2&&Math.abs(sunScr.y)<1.2;finalPass.uniforms.sun.value.set(sunScr.x*.5+.5,sunScr.y*.5+.5);finalPass.uniforms.sunI.value=onS?ign*(1-ce*.6):0;
 corMat.uniforms.b.value*=1-ce*.9;finalPass.uniforms.flash.value=flash*ign;finalPass.uniforms.gold.value=eio(j)*.6;document.body.classList.toggle('cine',P>.875&&vis);bloom.strength+=flash*.5+lvl*.35;finalPass.uniforms.lvl.value=lvl;dustMat.uniforms.op.value*=1-ce*.5;
 if(canvas.style.opacity!=='0')composer.render();
 const ft=performance.now()-f0;perf.n++;perf.sum+=ft;if(!perf.low&&perf.n>90&&perf.sum/perf.n>20&&!window.__noAdapt){perf.low=true;const pr=Math.max(1,DPR*.7);renderer.setPixelRatio(pr);composer.setPixelRatio(pr);composer.setSize(innerWidth,VH());fxaa.uniforms.rs.value.set(1/(innerWidth*pr),1/(VH()*pr))}
 if(firstFrame){firstFrame=false;loadT=100}
}
renderer.compile(scene,cam);loadT=Math.max(loadT,80);frame();

/* ---------- action cards: shared WebGL renderer ---------- */
const CR=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
CR.toneMapping=THREE.ACESFilmicToneMapping;CR.toneMappingExposure=1.02;CR.outputColorSpace=THREE.SRGBColorSpace;CR.setPixelRatio(1);
const CSZ=Math.round(Math.min(Math.max(300*Math.min(devicePixelRatio||1,2),420),640));CR.setSize(CSZ,CSZ,false);
const glowVS=`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function glowMesh(size,color,k=3.){const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.ShaderMaterial({uniforms:{c:{value:new THREE.Color(color)},i:{value:1},k:{value:k}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:glowVS,fragmentShader:`uniform vec3 c;uniform float i,k;varying vec2 vU;void main(){float r=length(vU);float a=exp(-r*k)*smoothstep(1.,.5,r);gl_FragColor=vec4(c*a*i,1.);}`}));return m}
function makeStar(r){const g=new THREE.Group();const sm=sunMat.clone();sm.uniforms.b.value=1;const core=new THREE.Mesh(new THREE.SphereGeometry(r,64,64),sm);g.add(core);const cm=corMat.clone();cm.uniforms.b.value=1.1;const co=new THREE.Mesh(new THREE.PlaneGeometry(r*12,r*12),cm);co.position.z=-.01;g.add(co);g.userData.mats=[sm,cm];return g}
function makePlanet(r,o,opt={}){const g=new THREE.Group();const pm=planetMat(o);pm.uniforms.life.value=o.life||0;const body=new THREE.Mesh(new THREE.SphereGeometry(r,64,64),pm);g.add(body);g.userData={pm,body,mats:[pm]};
 if(opt.clouds){const cm=cloudMat.clone();cm.uniforms.u.value=opt.clouds;const c=new THREE.Mesh(new THREE.SphereGeometry(r*1.015,48,48),cm);g.add(c);g.userData.clouds=c;g.userData.mats.push(cm);pm.uniforms.cshadow.value=opt.clouds}
 if(opt.atm){const am=atmMat.clone();am.uniforms.u.value=opt.atm;am.uniforms.c.value=new THREE.Color(opt.atmColor||0x4f9dff);const a=new THREE.Mesh(new THREE.SphereGeometry(r*1.09,48,48),am);g.add(a);g.userData.atm=am}
 return g}
function makeRock(r,seed,col=0x8a7f74,icy=false){const geo=new THREE.IcosahedronGeometry(r,3);const p=geo.attributes.position,v=new THREE.Vector3();
 const n=(x,y,z)=>Math.sin(x*3.1+seed)*Math.cos(y*2.7+seed*1.3)*.5+Math.sin(z*5.3+x*2.1+seed*2.)*.25+Math.sin((x+y+z)*9.+seed)*.08;
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).normalize();const d=1+n(v.x,v.y,v.z)*.32;v.multiplyScalar(r*d);v.x*=1.25;p.setXYZ(i,v.x,v.y,v.z)}geo.computeVertexNormals();
 return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:icy?.45:.95,metalness:0,flatShading:true,emissive:icy?0x0a1a24:0x000000}))}
class PS{constructor(scene,max,scale=1){this.max=max;this.list=[];this.pos=new Float32Array(max*3);this.col=new Float32Array(max*3);this.sz=new Float32Array(max);this.al=new Float32Array(max);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('aC',new THREE.BufferAttribute(this.col,3));g.setAttribute('aS',new THREE.BufferAttribute(this.sz,1));g.setAttribute('aA',new THREE.BufferAttribute(this.al,1));this.g=g;
 this.pts=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{sc:{value:CSZ*scale}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute vec3 aC;attribute float aS,aA;uniform float sc;varying vec3 vC;varying float vA;void main(){vC=aC;vA=aA;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aS*sc/(-mv.z);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=exp(-d*d*18.)+smoothstep(.12,0.,d)*.6;gl_FragColor=vec4(vC*a*vA,1.);}`}));this.pts.frustumCulled=false;scene.add(this.pts)}
 emit(o){if(this.list.length<this.max)this.list.push(Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,s:.1,r:1,g:1,b:1,a:1},o))}
 update(dt,fn){const L=this.list;for(let i=L.length-1;i>=0;i--){const p=L[i];p.age+=dt;if(p.age>=p.life){L.splice(i,1);continue}fn&&fn(p,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt}
  for(let i=0;i<this.max;i++){const p=L[i];if(p){const k=p.age/p.life;this.pos.set([p.x,p.y,p.z],i*3);const c=p.grad?p.grad(k):[p.r,p.g,p.b];this.col.set(c,i*3);this.sz[i]=p.s*(p.grow?1+k*p.grow:1);this.al[i]=p.a*(1-k)*Math.min(1,p.age*12)}else this.al[i]=0}
  ['position','aC','aS','aA'].forEach(k=>this.g.attributes[k].needsUpdate=true)}}
function baseScene(){const s=new THREE.Scene();s.background=new THREE.Color(0x03050b);const n=260,p=new Float32Array(n*3),c=new Float32Array(n*3),sz=new Float32Array(n),al=new Float32Array(n);
 for(let i=0;i<n;i++){p.set([(Math.random()-.5)*60,(Math.random()-.5)*60,-30],i*3);const w=.6+Math.random()*.4;c.set([w*.85,w*.9,w],i*3);sz[i]=.08+Math.pow(Math.random(),5)*.25;al[i]=.3+Math.random()*.7}
 const ps=new PS(s,1);ps.g.setAttribute('position',new THREE.BufferAttribute(p,3));ps.g.setAttribute('aC',new THREE.BufferAttribute(c,3));ps.g.setAttribute('aS',new THREE.BufferAttribute(sz,1));ps.g.setAttribute('aA',new THREE.BufferAttribute(al,1));
 s.add(new THREE.AmbientLight(0x223047,.35));const L=new THREE.PointLight(0xfff0dd,2.6,0,0);s.add(L);return s}
function ccam(tx,ty,z=10,fov=34){const c=new THREE.PerspectiveCamera(fov,1,.1,100);c.position.set(tx,ty,z);c.lookAt(tx,ty,0);return c}
function ringLine(r,color,op,dash){const pts=[];for(let i=0;i<=256;i++){const a=i/256*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0))}const g=new THREE.BufferGeometry().setFromPoints(pts);
 const m=dash?new THREE.LineDashedMaterial({color,transparent:true,opacity:op,dashSize:.06,gapSize:.08,depthWrite:false}):new THREE.LineBasicMaterial({color,transparent:true,opacity:op,depthWrite:false});const l=new THREE.Line(g,m);if(dash)l.computeLineDistances();return l}
function zoneBand(s,r1,r2){const m=new THREE.Mesh(new THREE.RingGeometry(r1,r2,256),new THREE.MeshBasicMaterial({color:0x2fd8cf,transparent:true,opacity:.06,depthWrite:false,blending:THREE.AdditiveBlending}));s.add(m);s.add(ringLine(r1,0x5fe6d8,.55,true));s.add(ringLine(r2,0x5fe6d8,.55,true))}
const flowLineMat=(color)=>new THREE.ShaderMaterial({uniforms:{t:{value:0},c:{value:new THREE.Color(color)},i:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute float u;varying float vU;void main(){vU=u;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float t,i;uniform vec3 c;varying float vU;void main(){float a=.22+.9*pow(fract(vU*3.-t),10.);gl_FragColor=vec4(c*a*i,1.);}`});
function flowLine(pts,mat){const g=new THREE.BufferGeometry().setFromPoints(pts);const u=new Float32Array(pts.length);for(let i=0;i<pts.length;i++)u[i]=i/(pts.length-1);g.setAttribute('u',new THREE.BufferAttribute(u,1));return new THREE.Line(g,mat)}
const lerpC=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
const fireGrad=k=>k<.25?lerpC([2.2,2.1,2.4],[2.,1.3,.5],k/.25):lerpC([2.,1.3,.5],[.8,.18,.05],(k-.25)/.75);

const SCENES={
 thruster(){const s=baseScene(),c=ccam(2.35,0,10,34);const star=makeStar(.62);s.add(star);zoneBand(s,2.55,3.35);s.add(ringLine(4.3,0xffffff,.07));
  const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xf5c97a,transparent:true,opacity:.7}));s.add(trail);
  const pl=makePlanet(.27,{a:0x6a4a33,b:0xb08a62,c:0xe2cdb0,water:.55,ice:.6,seed:4.2},{clouds:.8,atm:1,atmColor:0x6aa8ff});s.add(pl);
  const ship=new THREE.Group();pl.add(ship);const ps=new PS(s,260);const ring=glowMesh(1.4,0xffb070,5);s.add(ring);
  return {s,c,mats:[...star.userData.mats,...pl.userData.mats],label:'',update(T,dt){const ph=(T%5)/5,k=eio(cl(ph*1.5));const r=lerp(4.3,2.95,k),a=-.5+ph*.75;const x=Math.cos(a)*r,y=Math.sin(a)*r;pl.position.set(x,y,0);pl.userData.body.rotation.y+=dt*.3;pl.userData.clouds.rotation.y+=dt*.36;
   const pts=[];for(let i=0;i<=60;i++){const q=Math.max(0,ph-i*.012);const kk=eio(cl(q*1.5));const rr=lerp(4.3,2.95,kk),aa=-.5+q*.75;pts.push(new THREE.Vector3(Math.cos(aa)*rr,Math.sin(aa)*rr,0))}trail.geometry.setFromPoints(pts);
   const firing=ph<.66;const tx=Math.cos(a),ty=Math.sin(a);ring.position.set(x+tx*.34,y+ty*.34,.1);ring.material.uniforms.i.value=firing?.9+Math.random()*.3:0;
   if(firing)for(let i=0;i<5;i++){const sp=1.4+Math.random()*1.4,j=(Math.random()-.5)*.35;ps.emit({x:x+tx*.3,y:y+ty*.3,vx:(tx-ty*j)*sp,vy:(ty+tx*j)*sp,life:.45+Math.random()*.35,s:.16+Math.random()*.12,grow:1.6,grad:fireGrad})}
   ps.update(dt,p=>{p.vx*=.97;p.vy*=.97});this.label=firing?'BURN  DV 0.42':'COAST  ORBIT 0.98 AU'}}},
 comet(){const s=baseScene(),c=ccam(6.4,.2,10,34);const pl=makePlanet(1.25,{a:0x7a4a2a,b:0xb07a4a,c:0xe0c39a,water:0,ice:0,seed:11.7},{clouds:.0,atm:.6,atmColor:0x8fb8ff});pl.position.set(6.9,-.55,0);s.add(pl);{const k=new THREE.DirectionalLight(0xfff1dc,1.6);k.position.set(2,2,8);s.add(k);const rg=glowMesh(5.2,0x3a6cff,3.2);rg.material.uniforms.i.value=.35;rg.position.set(6.9,-.55,-1.5);s.add(rg)}
  const nuc=makeRock(.085,3.3,0xcfe6f2,true);s.add(nuc);const coma=glowMesh(1.2,0x9fe8ff,4.5);s.add(coma);const ion=new PS(s,320),dust=new PS(s,320),fx=new PS(s,200);const flash=glowMesh(3.2,0xbfeeff,3.5);flash.position.set(6.3,.25,.6);s.add(flash);
  const rip=new THREE.Mesh(new THREE.RingGeometry(.97,1,128),new THREE.MeshBasicMaterial({color:0x9fe0ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));rip.position.copy(flash.position);s.add(rip);
  return {s,c,mats:pl.userData.mats,label:'',update(T,dt){const ph=(T%4.4)/4.4;const hit=.52;pl.userData.body.rotation.y+=dt*.12;
   const wet=ph<hit?0:eo(cl((ph-hit)/.4));pl.userData.pm.uniforms.water.value=wet*.75;pl.userData.pm.uniforms.ice.value=wet*.7;pl.userData.atm.uniforms.u.value=.6+wet*.7;
   if(ph<hit){const q=eio(ph/hit);const x=lerp(9.3,6.35,q),y=lerp(3.3,.3,q);nuc.visible=coma.visible=true;nuc.position.set(x,y,.3);nuc.rotation.x+=dt*1.5;nuc.rotation.y+=dt;coma.position.set(x,y,.25);coma.material.uniforms.i.value=1.1;
     const ax=x,ay=y,d=Math.hypot(ax,ay),ux=ax/d,uy=ay/d;for(let i=0;i<4;i++){ion.emit({x,y,z:.2,vx:ux*(2.4+Math.random())+(Math.random()-.5)*.1,vy:uy*(2.4+Math.random())+(Math.random()-.5)*.1,life:.9,s:.07+Math.random()*.05,r:.5,g:1.1,b:2.2,a:.9})
      dust.emit({x,y,z:.2,vx:ux*.6+.9+(Math.random()-.5)*.4,vy:uy*.6+1.0+(Math.random()-.5)*.4,life:1.3,s:.08+Math.random()*.08,grow:1.5,r:1.6,g:1.35,b:1.,a:.55})}}
   else{nuc.visible=coma.visible=false;const q=(ph-hit)/(1-hit);flash.material.uniforms.i.value=Math.max(0,1-q*5)*1.6;rip.scale.setScalar(.2+eo(q)*1.6);rip.material.opacity=(1-q)*.8;
     if(q<.08)for(let i=0;i<14;i++){const a=Math.random()*6.28,sp=.6+Math.random()*1.5;fx.emit({x:6.3,y:.25,z:.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.8,s:.08,r:1.,g:1.8,b:2.4})}}
   if(ph<hit){flash.material.uniforms.i.value=0;rip.material.opacity=0}
   ion.update(dt);dust.update(dt,p=>{p.vy-=.3*dt});fx.update(dt,p=>{p.vx*=.95;p.vy*=.95});this.label=ph<hit?'INBOUND  ICE 1.2E18 KG':'OCEAN '+Math.round(wet*100)+' PCT'}}},
 shield(){const s=baseScene(),c=ccam(2.6,0,10,34);const star=makeStar(.6);s.add(star);const P=new THREE.Vector3(3.75,0,0);const pl=makePlanet(.42,{a:0x2a4a7a,b:0x5a8ac0,c:0xdfe8f5,water:.7,ice:.9,seed:21.3},{clouds:.7,atm:1.2,atmColor:0x7ab4ff});pl.position.copy(P);s.add(pl);
  const fm=flowLineMat(0x6ab8ff);const lines=new THREE.Group();lines.position.copy(P);s.add(lines);
  [.85,1.15,1.5,1.95].forEach(L=>{[1,-1].forEach(side=>{const pts=[];for(let i=0;i<=80;i++){const th=.18+i/80*(Math.PI-.36);const r=L*Math.sin(th)*Math.sin(th);let x=r*Math.sin(th)*side,y=r*Math.cos(th);x*=side<0?.62:1.7;pts.push(new THREE.Vector3(x,y,0))}lines.add(flowLine(pts,fm))})});
  const bow=new THREE.Mesh(new THREE.RingGeometry(1.0,1.04,96,1,Math.PI*.6,Math.PI*.8),new THREE.MeshBasicMaterial({color:0x9fd0ff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}));bow.position.copy(P).add(new THREE.Vector3(.12,0,0));s.add(bow);
  const ps=new PS(s,420);
  return {s,c,mats:[...star.userData.mats,...pl.userData.mats,fm],label:'FIELD 48 UT  DEFLECT 99 PCT',update(T,dt){pl.userData.body.rotation.y+=dt*.2;pl.userData.clouds.rotation.y+=dt*.25;const pul=.75+.25*Math.sin(T*3);fm.uniforms.i.value=pul;bow.material.opacity=.25+.2*pul;
   for(let i=0;i<4;i++){const a=(Math.random()-.5)*1.1;ps.emit({x:Math.cos(a)*.62,y:Math.sin(a)*.62,vx:2.2+Math.random(),vy:Math.sin(a)*1.2,life:2.2,s:.06+Math.random()*.06,grad:k=>lerpC([2.2,1.4,.6],[1.2,.35,.12],k),a:.9})}
   ps.update(dt,p=>{const dx=p.x-P.x,dy=p.y-P.y,d=Math.hypot(dx,dy);if(d<1.15){const f=(1.15-d)*14;p.vx+=dx/d*f*dt;p.vy+=dy/d*f*dt}})}}},
 seed(){const s=baseScene(),c=ccam(6.2,.4,10,34);const pl=makePlanet(2.1,{a:0x3a5a3a,b:0x7a8a5a,c:0xc8c0a0,water:.62,ice:.5,seed:5.5},{clouds:.55,atm:1.1,atmColor:0x6fc6ff});pl.position.set(6.4,-2.55,0);s.add(pl);
  const rocks=[];for(let i=0;i<5;i++){const r=makeRock(.07+Math.random()*.05,i*7.7,0x7a6a5c);s.add(r);rocks.push({m:r,off:i*.11,x:5.3+i*.38})}const trail=new PS(s,400),spores=new PS(s,400);
  return {s,c,mats:pl.userData.mats,label:'',lifeV:0,update(T,dt){const ph=(T%4)/4;if(ph<.02)this.lifeV=0;pl.userData.body.rotation.y+=dt*.05;pl.userData.clouds.rotation.y+=dt*.07;
   rocks.forEach((o,i)=>{const q=cl((ph-o.off)/.4);const hx=o.x,hy=-2.55+Math.sqrt(Math.max(0,2.12*2.12-(hx-6.4)*(hx-6.4)));const x=lerp(hx-1.6,hx,eio(q)),y=lerp(3.6,hy,eio(q));o.m.visible=q>0&&q<1;o.m.position.set(x,y,.5);o.m.rotation.x+=dt*2;o.m.rotation.z+=dt;
    if(q>0&&q<1){trail.emit({x,y,z:.45,vx:-.4,vy:.9,life:.5,s:.12,grow:1.2,grad:k=>lerpC([2.4,1.6,.7],[.9,.25,.08],k),a:.8})}
    if(q>=1&&!o.hit){o.hit=true;this.lifeV=Math.min(1,this.lifeV+.18);for(let k=0;k<26;k++){const a=Math.random()*Math.PI,sp=.2+Math.random()*.6;spores.emit({x:hx,y:hy,z:.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.5,life:1.6,s:.07+Math.random()*.06,r:.4,g:2.,b:1.6,a:.9})}}
    if(q<1)o.hit=false});
   pl.userData.pm.uniforms.life.value=lerp(pl.userData.pm.uniforms.life.value,this.lifeV,.05);trail.update(dt);spores.update(dt,p=>{p.vx*=.97;p.vy*=.97});this.label='ORGANICS +'+Math.round(this.lifeV*60)}}},
 tug(){const s=baseScene(),c=ccam(0,0,12.5,34);const star=makeStar(.42);s.add(star);zoneBand(s,1.55,2.25);s.add(ringLine(3.2,0xffffff,.07));
  const you=makePlanet(.3,{a:0x5a3a22,b:0xc49a62,c:0xf0dcb8,water:.35,seed:8.1},{clouds:.5,atm:1,atmColor:0xffcf8a});s.add(you);
  const rival=makePlanet(.2,{a:0x5a1e10,b:0xb04a2a,c:0xe0a080,water:0,seed:31},{atm:.5,atmColor:0xff7a5a});s.add(rival);
  const tm=flowLineMat(0xf5c97a);const teth=flowLine(Array.from({length:40},()=>new THREE.Vector3()),tm);s.add(teth);const well=[0,1,2].map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.97,1,96),new THREE.MeshBasicMaterial({color:0xf5c97a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));s.add(m);return m});
  return {s,c,mats:[...star.userData.mats,...you.userData.mats,...rival.userData.mats,tm],label:'',update(T,dt){const ph=(T%5)/5,k=eio(cl((ph-.1)*1.6));const a=T*.32;
   const ya=a+2.3,yx=Math.cos(ya)*3.2,yy=Math.sin(ya)*3.2;you.position.set(yx,yy,0);const rr=lerp(1.9,3.0,k),ra=a+1.85;const rx=Math.cos(ra)*rr,ry=Math.sin(ra)*rr;rival.position.set(rx,ry,0);
   you.userData.body.rotation.y+=dt*.2;rival.userData.body.rotation.y+=dt*.3;const pts=[];for(let i=0;i<40;i++){const q=i/39;const sag=Math.sin(q*Math.PI)*.15*Math.sin(T*3);pts.push(new THREE.Vector3(lerp(yx,rx,q)+sag,lerp(yy,ry,q)-sag,0))}teth.geometry.setFromPoints(pts);
   const u=new Float32Array(40);for(let i=0;i<40;i++)u[i]=1-i/39;teth.geometry.setAttribute('u',new THREE.BufferAttribute(u,1));tm.uniforms.i.value=ph>.1&&ph<.8?1.2:.15;
   well.forEach((m,i)=>{const q=(T*.8+i/3)%1;m.position.set(yx,yy,0);m.scale.setScalar(.35+q*.9);m.material.opacity=(1-q)*.5*(ph>.1&&ph<.8?1:.2)});
   const inZ=rr<2.25;this.label=inZ?'RIVAL IN ZONE':'RIVAL EJECTED  0 SOL'}}}
};
const cardViews=$$('[data-anim]').map(cv=>{const ctx=cv.getContext('2d');const sc=SCENES[cv.dataset.anim]();const card=cv.closest('.card');const o={cv,ctx,sc,card,vis:false,speed:1,sp:1,T:Math.random()*3};
 card.addEventListener('mouseenter',()=>o.speed=2.2);card.addEventListener('mouseleave',()=>o.speed=1);return o});
const io=new IntersectionObserver(es=>es.forEach(e=>{const o=cardViews.find(v=>v.cv===e.target);if(o)o.vis=e.isIntersecting}),{rootMargin:'100px'});cardViews.forEach(o=>io.observe(o.cv));
let cLast=performance.now();
function cardsLoop(now){requestAnimationFrame(cardsLoop);const d=Math.min((now-cLast)/1000,.05);cLast=now;
 cardViews.forEach(o=>{if(!o.vis)return;const w=o.cv.clientWidth*Math.min(devicePixelRatio||1,2)|0;if(o.cv.width!==w){o.cv.width=o.cv.height=w}
  o.sp=lerp(o.sp,o.speed,.08);const dt=d*o.sp;o.T+=dt;o.sc.mats.forEach(m=>m.uniforms&&m.uniforms.t&&(m.uniforms.t.value=o.T));o.sc.update(o.T,dt);
  CR.render(o.sc.s,o.sc.c);o.ctx.drawImage(CR.domElement,0,0,o.cv.width,o.cv.height);
  const s=o.cv.width/300;o.ctx.font=`${8.5*s}px JB, monospace`;o.ctx.fillStyle='rgba(245,201,122,.85)';o.ctx.fillText(o.sc.label||'',16*s,o.cv.height-16*s);
  o.ctx.strokeStyle='rgba(255,255,255,.3)';o.ctx.lineWidth=s*.8;[[10,10,1,1],[290,10,-1,1],[10,290,1,-1],[290,290,-1,-1]].forEach(([x,y,a,b])=>{o.ctx.beginPath();o.ctx.moveTo(x*s,(y+b*8)*s);o.ctx.lineTo(x*s,y*s);o.ctx.lineTo((x+a*8)*s,y*s);o.ctx.stroke()})})}
requestAnimationFrame(cardsLoop);
{const warm=()=>{let i=0;const step=()=>{const o=cardViews[i++];if(!o)return;try{CR.compile(o.sc.s,o.sc.c);CR.render(o.sc.s,o.sc.c)}catch(e){}(window.requestIdleCallback||setTimeout)(step,{timeout:600})};step()};addEventListener('load',()=>setTimeout(warm,1500),{once:true})}

/* ---------- sprite bodies for the live sim ---------- */
const SPR={planets:[],star:document.createElement('canvas')};
{const s=baseScene();s.background=null;const c=new THREE.PerspectiveCamera(34,1,.1,100);c.position.set(1.6,0,1.25);c.lookAt(1.6,0,-3);s.children.filter(o=>o.isPoints).forEach(o=>s.remove(o));CR.setClearColor(0x000000,0);
 const kinds=[[{a:0x6a4a33,b:0xb08a62,c:0xe2cdb0,water:.55,ice:.5,seed:4},{clouds:.7,atm:1}],[{a:0xb08a60,b:0xe8d2a8,c:0x8a5a3a,gas:1,seed:2},{}],[{a:0x5a1e10,b:0xb04a2a,c:0xe0a080,seed:31},{atm:.4,atmColor:0xff7a5a}],[{a:0x2a4a6a,b:0x6a9ac0,c:0xdfeeff,ice:1,water:.3,seed:9},{atm:.8}],[{a:0x3a5a3a,b:0x7a8a5a,c:0xc8c0a0,water:.65,ice:.6,seed:5,life:.8},{clouds:.6,atm:1.2,atmColor:0x6fc6ff}],[{a:0x2a4ab0,b:0x6a9af0,c:0xc0e0ff,gas:1,seed:14},{atm:.6}]];
 const SZ=128;CR.setSize(SZ,SZ,false);kinds.forEach(([o,opt])=>{const p=makePlanet(1,o,opt);p.position.set(1.6,0,-3);s.add(p);CR.render(s,c);const cv=document.createElement('canvas');cv.width=cv.height=SZ;cv.getContext('2d').drawImage(CR.domElement,0,0);SPR.planets.push(cv);s.remove(p)});
 const ss=new THREE.Scene();const st=makeStar(1);ss.add(st);const sc2=ccam(0,0,14,34);SPR.starScene=ss;SPR.starCam=sc2;SPR.starMats=st.userData.mats;SPR.star.width=SPR.star.height=256;
 CR.setSize(CSZ,CSZ,false);CR.setClearColor(0x000000,1)}
SPR.renderStar=t=>{CR.setClearColor(0x000000,0);CR.setSize(256,256,false);SPR.starMats.forEach(m=>m.uniforms.t.value=t);CR.render(SPR.starScene,SPR.starCam);const g=SPR.star.getContext('2d');g.clearRect(0,0,256,256);g.drawImage(CR.domElement,0,0);CR.setSize(CSZ,CSZ,false);CR.setClearColor(0x000000,1)};

/* ---------- live sim ---------- */
(()=>{const cv=$('#simc'),g=cv.getContext('2d');const r=Math.min(devicePixelRatio||1,2);let w,h;const fit=()=>{w=cv.width=cv.clientWidth*r;h=cv.height=cv.clientHeight*r};fit();addEventListener('resize',fit);
 const GM=9000,ps=[];let id=1;const add=(x,y,silent)=>{const cx=w/2,cy=h/2,dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)||1,v=Math.sqrt(GM*r*r*r/d)*(.88+Math.random()*.24);ps.push({x,y,vx:-dy/d*v,vy:dx/d*v,tr:[],hue:Math.random()*360,kind:Math.random()*SPR.planets.length|0,id:id++,born:performance.now(),zt:0})};
 for(let i=0;i<16;i++){const a=Math.random()*6.28,d=(70+Math.random()*240)*r;add(w/2+Math.cos(a)*d,h/2+Math.sin(a)*d)}
 cv.addEventListener('click',e=>{const b=cv.getBoundingClientRect();add((e.clientX-b.left)*r,(e.clientY-b.top)*r)});
 let hov=null;cv.addEventListener('mousemove',e=>{const b=cv.getBoundingClientRect();hov=[(e.clientX-b.left)*r,(e.clientY-b.top)*r]});cv.addEventListener('mouseleave',()=>hov=null);
 const zi=130,zo=185;let ang=0,frameN=0;
 const step=()=>{const cx=w/2,cy=h/2;g.fillStyle='rgba(1,2,6,.28)';g.fillRect(0,0,w,h);ang+=.002;const pul=1+.04*Math.sin(ang*40);
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;for(let x=cx%(60*r);x<w;x+=60*r){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=cy%(60*r);y<h;y+=60*r){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
  g.fillStyle='rgba(122,240,207,.035)';g.beginPath();g.arc(cx,cy,zo*r,0,6.2832);g.arc(cx,cy,zi*r,0,6.2832,true);g.fill();
  g.setLineDash([2*r,5*r]);g.strokeStyle='rgba(122,240,207,.45)';[zi,zo].forEach(z=>{g.beginPath();g.arc(cx,cy,z*r,0,6.2832);g.stroke()});g.setLineDash([]);
  g.strokeStyle='rgba(122,240,207,.6)';g.lineWidth=1.5*r;g.beginPath();g.arc(cx,cy,(zi+zo)/2*r,ang,ang+.5);g.stroke();
  [[60,'0.45 AU'],[zi,'0.95 AU'],[zo,'1.37 AU'],[260,'2.00 AU']].forEach(([z,l])=>{g.fillStyle='rgba(180,190,210,.4)';g.font=`${9*r}px JB, monospace`;g.fillText(l,cx+z*r+6*r,cy-4*r);if(z===60||z===260){g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=r;g.beginPath();g.arc(cx,cy,z*r,0,6.2832);g.stroke()}});
  if(!(frameN++%3))SPR.renderStar(performance.now()/1000);const SS=150*r*pul;g.drawImage(SPR.star,cx-SS/2,cy-SS/2,SS,SS);
  let inz=0,near=null,nd=1e9;
  for(let k=ps.length-1;k>=0;k--){const p=ps[k];for(let s=0;s<4;s++){const dx=cx-p.x,dy=cy-p.y,d2=dx*dx+dy*dy,d=Math.sqrt(d2),a=GM*r*r*r/d2;p.vx+=dx/d*a*.004;p.vy+=dy/d*a*.004;p.x+=p.vx*.004;p.y+=p.vy*.004}
   const d=Math.hypot(p.x-cx,p.y-cy)/r;if(d<14||d>1600){ps.splice(k,1);continue}const ok=d>zi&&d<zo;if(ok){inz++;p.zt+=1/60}
   p.tr.push([p.x,p.y]);if(p.tr.length>90)p.tr.shift();
   for(let i=1;i<p.tr.length;i++){const a=i/p.tr.length;g.strokeStyle=ok?`rgba(122,240,207,${a*.6})`:`hsla(${p.hue},40%,75%,${a*.3})`;g.lineWidth=r*(.5+a);g.beginPath();g.moveTo(p.tr[i-1][0],p.tr[i-1][1]);g.lineTo(p.tr[i][0],p.tr[i][1]);g.stroke()}
   const age=Math.min((performance.now()-p.born)/600,1);const rad=(ok?6:4.8)*r*eo(age)*(p.kind===1||p.kind===5?1.35:1);
   if(ok){const gg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,16*r);gg.addColorStop(0,'rgba(122,240,207,.45)');gg.addColorStop(1,'rgba(122,240,207,0)');g.fillStyle=gg;g.beginPath();g.arc(p.x,p.y,16*r,0,6.2832);g.fill()}
   {const sz=rad*4.2;const an=Math.atan2(cy-p.y,cx-p.x)-Math.PI;g.save();g.translate(p.x,p.y);g.rotate(an);g.drawImage(SPR.planets[p.kind],-sz/2,-sz/2,sz,sz);g.restore()}
   if(age<1){g.strokeStyle=`rgba(245,201,122,${1-age})`;g.lineWidth=r;g.beginPath();g.arc(p.x,p.y,(4+age*24)*r,0,6.2832);g.stroke()}
   if(hov){const hd=Math.hypot(hov[0]-p.x,hov[1]-p.y);if(hd<nd){nd=hd;near=p}}}
  if(near&&nd<40*r){const p=near,d=Math.hypot(p.x-cx,p.y-cy)/r;g.strokeStyle='rgba(245,201,122,.8)';g.lineWidth=r;g.beginPath();g.arc(p.x,p.y,11*r,0,6.2832);g.stroke();g.beginPath();g.moveTo(p.x+11*r,p.y-11*r);g.lineTo(p.x+30*r,p.y-30*r);g.lineTo(p.x+120*r,p.y-30*r);g.stroke();
   g.fillStyle='#eef1f6';g.font=`${10*r}px JB, monospace`;g.fillText('PLANET '+String(p.id).padStart(3,'0'),p.x+34*r,p.y-36*r);g.fillStyle='rgba(180,190,210,.7)';g.fillText((d/136).toFixed(2)+' AU  '+Math.round(255/Math.sqrt(d/157))+' K',p.x+34*r,p.y-20*r)}
  $('#s1').textContent=ps.length;$('#s2').textContent=inz;requestAnimationFrame(step)};step()})();
