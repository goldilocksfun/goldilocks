import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;if(RM)document.documentElement.classList.add('rm');const MOB=innerWidth<760;
const gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;gsap.registerPlugin(ScrollTrigger);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const lerp=(a,b,t)=>a+(b-a)*t,cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),seg=(p,a,b)=>cl((p-a)/(b-a));
const eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,eo=t=>1-Math.pow(1-t,4);

/* ---------- loader ---------- */
let loadP=0,loadT=0,lt0=performance.now();const lnum=$('#lnum'),lbar=$('#lbar');
const loaderTick=()=>{const now=performance.now(),dtl=Math.min((now-lt0)/1000,.1);lt0=now;loadP=Math.min(loadT,loadP+dtl*90);const v=Math.round(loadP);lnum.textContent=String(v).padStart(3,'0');$('#lstage').textContent=v<30?'Seeding molecular cloud':v<60?'Compiling stellar shaders':v<90?'Integrating orbits':'Ready';lbar.style.width=v+'%';if(v<100)requestAnimationFrame(loaderTick);else setTimeout(()=>{$('#loader').classList.add('done');document.body.classList.remove('loading');setTimeout(()=>{$('#loader').remove();ScrollTrigger.refresh()},1300)},250)};
loaderTick();loadT=20;document.fonts.ready.then(()=>{loadT=Math.max(loadT,55)});

/* ---------- split text ---------- */
$$('.split').forEach(el=>{let i=0;const walk=n=>{[...n.childNodes].forEach(ch=>{if(ch.nodeType===3){const frag=document.createDocumentFragment();ch.textContent.split(/(\s+)/).forEach(tok=>{if(!tok)return;if(/^\s+$/.test(tok)){frag.append(' ');return}const w=document.createElement('span');w.className='w';[...tok].forEach(c=>{const s=document.createElement('span');s.className='c';s.textContent=c;s.style.transitionDelay=(i++*0.028)+'s';w.append(s)});frag.append(w)});ch.replaceWith(frag)}else if(ch.nodeType===1&&ch.tagName!=='BR')walk(ch)})};walk(el)});

/* ---------- smooth scroll ---------- */
const lenis=new Lenis({duration:RM?0:1.35,smoothTouch:false,lerp:RM?1:.1,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true});window.__lenis=lenis;
lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(t=>lenis.raf(t*1000));gsap.ticker.lagSmoothing(0);
$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(h.length>1){e.preventDefault();lenis.scrollTo(h,{duration:2})}}));
$$('.sec-head,.cta').forEach(el=>ScrollTrigger.create({trigger:el,start:'top 80%',onEnter:()=>el.classList.add('in')}));

/* ---------- cursor ---------- */
const cur=$('#cur'),dot=$('#cur-dot');let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my,nmx=0,nmy=0;
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;nmx=mx/innerWidth*2-1;nmy=my/innerHeight*2-1;dot.style.transform=`translate(${mx}px,${my}px)`});
(function cl_(){cx=lerp(cx,mx,.16);cy=lerp(cy,my,.16);cur.style.transform=`translate(${cx}px,${cy}px)`;requestAnimationFrame(cl_)})();
$$('[data-h],a,button').forEach(el=>{el.addEventListener('mouseenter',()=>cur.classList.add('h'));el.addEventListener('mouseleave',()=>cur.classList.remove('h'))});
const au=$('#theme');let auState=0,fadeT;au.addEventListener('error',()=>{auState=-1});
let an=null,ad=null,lvl=0;const lvlTick=()=>{if(an&&!au.paused){an.getByteFrequencyData(ad);let s=0;for(let i=1;i<24;i++)s+=ad[i];const v=s/23/255;lvl=lerp(lvl,v*au.volume*1.8,.15)}else lvl=lerp(lvl,0,.08);document.documentElement.style.setProperty('--lvl',lvl.toFixed(3));requestAnimationFrame(lvlTick)};lvlTick();
const fade=(to,ms,done)=>{clearInterval(fadeT);const from=au.volume,t0=performance.now();fadeT=setInterval(()=>{const k=Math.min((performance.now()-t0)/ms,1);au.volume=from+(to-from)*k*k*(3-2*k);if(k>=1){clearInterval(fadeT);done&&done()}},30)};
$('#snd').addEventListener('click',()=>{const b=$('#snd');const on=!b.classList.contains('on');b.classList.toggle('on',on);b.querySelector('em').textContent=on?'Sound on':'Sound off';
 if(auState<0)return;if(!auState){auState=1;au.src='audio/theme.mp3'}if(on){if(!an){try{const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();const src=ac.createMediaElementSource(au);an=ac.createAnalyser();an.fftSize=256;ad=new Uint8Array(an.frequencyBinCount);src.connect(an);an.connect(ac.destination);ac.resume()}catch(e){}}au.volume=0;au.play().then(()=>fade(.55,1800)).catch(()=>{})}else fade(0,900,()=>au.pause())});

/* ---------- renderer ---------- */
const canvas=$('#gl');const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
const DPR=Math.min(devicePixelRatio,1.75);renderer.setPixelRatio(DPR);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(innerWidth<760?60:42,innerWidth/innerHeight,.05,4000);

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
const puffMat=new THREE.ShaderMaterial({uniforms:{map:{value:puffTex()},c:{value:0},t:{value:0},op:{value:1},h:{value:innerHeight*DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
vertexShader:`attribute float aS,aR;uniform float c,t,h;varying vec3 vC;varying float vR,vF;void main(){vec3 p=position;float ang=t*.02*(1.+aR)+c*3.*(1.-aR*.5);mat2 m=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));p.xz=m*p.xz;p*=mix(1.,.06+aR*.1,c);vC=color;vR=aR;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(aS*mix(1.,.5,c)*h/(-mv.z)*.5,h*.6);vF=smoothstep(4.,30.,-mv.z);gl_Position=projectionMatrix*mv;}`,
fragmentShader:`uniform sampler2D map;uniform float op,t;varying vec3 vC;varying float vR,vF;void main(){vec2 uv=gl_PointCoord-.5;float a=vR*6.28+t*.03;uv=mat2(cos(a),-sin(a),sin(a),cos(a))*uv;vec4 tx=texture2D(map,uv+.5);gl_FragColor=vec4(vC*tx.a*.05*op*vF,tx.a*op);}`});
const puffs=new THREE.Points(pg,puffMat);scene.add(puffs);

/* ---------- dust -> disk (GPU) ---------- */
const N=MOB?18000:30000,aCl=new Float32Array(N*3),aDk=new Float32Array(N*3),aCo=new Float32Array(N*3),aRn=new Float32Array(N);
const dA=new THREE.Color(0xff6a8e),dB=new THREE.Color(0x7d8bff),dC=new THREE.Color(0xffc68a);
for(let i=0;i<N;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(),.55)*95);v.y*=.42;v.x+=Math.sin(v.y*.08)*12;aCl.set([v.x,v.y,v.z],i*3);
const r=3.2+Math.pow(Math.random(),1.6)*55,a=Math.random()*6.283;aDk.set([Math.cos(a)*r,(Math.random()-.5)*(.15+r*.035),Math.sin(a)*r],i*3);tcol.copy(Math.random()<.5?dA:dB).lerp(dC,Math.random()*.6);aCo.set([tcol.r,tcol.g,tcol.b],i*3);aRn[i]=Math.random()}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(aCl,3));dg.setAttribute('aDk',new THREE.BufferAttribute(aDk,3));dg.setAttribute('color',new THREE.BufferAttribute(aCo,3));dg.setAttribute('aR',new THREE.BufferAttribute(aRn,1));
const dustMat=new THREE.ShaderMaterial({uniforms:{c:{value:0},t:{value:0},op:{value:1},h:{value:innerHeight*DPR},gap:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
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
fragmentShader:`uniform float u;uniform vec3 c;varying vec3 vP,vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vN);float f=pow(clamp(1.+dot(N,V)*1.0,0.,1.),.0);float rim=pow(1.-abs(dot(N,V)),1.5);float edge=smoothstep(0.,.35,abs(dot(N,V)));vec3 L=normalize(-vW);float d=smoothstep(-.4,.5,dot(N,L));gl_FragColor=vec4(c*rim*edge*d*u*2.2,1.);}`});
const atm=new THREE.Mesh(new THREE.SphereGeometry(1.09,96,96),atmMat);you.add(atm);
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
const burstMat=new THREE.ShaderMaterial({uniforms:{j:{value:0},h:{value:innerHeight*DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:`attribute float aR;uniform float j,h;varying float vA;void main(){float d=1.3+j*(3.+aR*14.);vec3 p=position*d;vA=(1.-j*.7)*step(.001,j)*(.4+aR*.6);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+aR*2.)*h/(-mv.z)*.03;gl_Position=projectionMatrix*mv;}`,
fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vec3(1.6,1.1,.5)*a*vA,a*vA);}`});
you.add(new THREE.Points(bg,burstMat));
const shock=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.97,1,256),new THREE.MeshBasicMaterial({color:new THREE.Color(1.1,.8,.4),transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));m.rotation.x=-Math.PI/2;you.add(m);shock.push(m)}

/* ---------- post ---------- */
const composer=new EffectComposer(renderer);composer.setPixelRatio(DPR);composer.setSize(innerWidth,innerHeight);
composer.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),.8,.55,.92);composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass=new ShaderPass({uniforms:{tDiffuse:{value:null},t:{value:0},flash:{value:0},gold:{value:0},lvl:{value:0},sun:{value:new THREE.Vector2(.5,.5)},sunI:{value:0},asp:{value:innerWidth/innerHeight},ca:{value:1}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float t,sunI,asp,ca,flash,gold,lvl;uniform vec2 sun;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 c=vUv-.5;float r2=dot(c,c);vec2 off=c*r2*.012*ca;vec3 col;col.r=texture2D(tDiffuse,vUv+off).r;col.g=texture2D(tDiffuse,vUv).g;col.b=texture2D(tDiffuse,vUv-off).b;
vec2 sv=sun-.5;vec3 fl=vec3(0.);for(int i=1;i<=4;i++){float f=float(i);vec2 gp=.5-sv*(f*.45-.2);vec2 d=(vUv-gp);d.x*=asp;float s=.012+f*.012;fl+=vec3(.9-f*.1,.6,.4+f*.12)*smoothstep(s,s*.4,length(d))*.05;}
vec2 sd=vUv-sun;float streak=exp(-abs(sd.y)*260.)*exp(-abs(sd.x*asp)*2.5)*.35;fl+=vec3(1.,.75,.5)*streak;col+=fl*sunI;
float lum=dot(col,vec3(.299,.587,.114));col=mix(col,col*vec3(.92,1.,1.08),smoothstep(.35,0.,lum)*.6);col=mix(col,col*vec3(1.06,1.,.9),smoothstep(.4,1.,lum)*.5);col+=vec3(1.,.9,.75)*flash*.14;col=mix(col,col*vec3(1.12,1.,.82)+vec3(.03,.02,0.),gold);col*=1.+lvl*.12;
float vig=smoothstep(1.05,.25,length(c*vec2(asp*.8,1.)));col*=mix(.45,1.,vig);
col+=(h(vUv*vec2(1920.,1080.)+fract(t*7.))-.5)*.045;gl_FragColor=vec4(col,1.);}`});
composer.addPass(finalPass);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.fov=innerWidth<760?60:42;cam.updateProjectionMatrix();finalPass.uniforms.asp.value=cam.aspect;[puffMat,dustMat,burstMat].forEach(m=>m.uniforms.h.value=innerHeight*DPR)});

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
let firstFrame=true;const clock=new THREE.Clock();const story=$('#story');
const perf={n:0,sum:0,low:false};window.__perf=perf;
function frame(){requestAnimationFrame(frame);const f0=performance.now();const rdt=clock.getDelta(),dt=Math.min(rdt,.05),t=clock.elapsedTime;
 P=RM?st.p:lerp(P,st.p,1-Math.exp(-Math.min(rdt,.3)*4.5));if(Math.abs(P-st.p)<1e-4)P=st.p;
 const sb=story.getBoundingClientRect().bottom;const vis=sb>0;canvas.style.opacity=cl(sb/innerHeight*1.4-.2);document.body.classList.toggle('solid',sb<innerHeight*.6);document.querySelector('.hud').style.opacity=cl(sb/innerHeight*2-.5);
 // panels
 panels.forEach(o=>{const on=vis&&P>=o.a&&P<o.b;if(on&&o.state!==1){o.el.classList.add('on','in');o.el.classList.remove('out');o.state=1}else if(!on&&o.state===1){o.el.classList.add('out');o.el.classList.remove('in');o.state=2;setTimeout(()=>{if(o.state===2)o.el.classList.remove('on')},700)}});
 let ci=0;bounds.forEach((b,i)=>{if(P>=b)ci=i});if(ci!==frame.ci){frame.ci=ci;const cn=$('#chapname');cn.classList.add('swap');setTimeout(()=>{cn.textContent=names[ci];$('#chap').textContent='0'+ci;cn.classList.remove('swap')},220)}$('#prog').style.width=P*100+'%';
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
 const ox=(pn.x-tx)*innerWidth/2*pin,oy=-(pn.y-ty)*innerHeight/2*pin;if(Math.abs(ox)+Math.abs(oy)>.5)cam.setViewOffset(innerWidth,innerHeight,ox,oy,innerWidth,innerHeight);
 // flare
 sunScr.set(0,0,0).project(cam);const onS=sunScr.z<1&&Math.abs(sunScr.x)<1.2&&Math.abs(sunScr.y)<1.2;finalPass.uniforms.sun.value.set(sunScr.x*.5+.5,sunScr.y*.5+.5);finalPass.uniforms.sunI.value=onS?ign*(1-ce*.6):0;
 corMat.uniforms.b.value*=1-ce*.9;finalPass.uniforms.flash.value=flash*ign;finalPass.uniforms.gold.value=eio(j)*.6;document.body.classList.toggle('cine',P>.875&&vis);bloom.strength+=flash*.5+lvl*.35;finalPass.uniforms.lvl.value=lvl;dustMat.uniforms.op.value*=1-ce*.5;
 composer.render();
 const ft=performance.now()-f0;perf.n++;perf.sum+=ft;if(!perf.low&&perf.n>90&&perf.sum/perf.n>24&&!window.__noAdapt){perf.low=true;renderer.setPixelRatio(1);composer.setPixelRatio(1);composer.setSize(innerWidth,innerHeight)}
 if(firstFrame){firstFrame=false;loadT=100}
}
renderer.compile(scene,cam);loadT=Math.max(loadT,80);frame();

/* ---------- action cards ---------- */
$$('[data-anim]').forEach(cv=>{const g=cv.getContext('2d'),type=cv.dataset.anim,card=cv.closest('.card');let w,h,s,speed=1,sp=1,tt=0,last=performance.now();
 const fit=()=>{const r=Math.min(devicePixelRatio||1,2);w=cv.width=cv.clientWidth*r;h=cv.height=cv.clientWidth*r;s=w/300};fit();addEventListener('resize',fit);
 card.addEventListener('mouseenter',()=>speed=2.2);card.addEventListener('mouseleave',()=>speed=1);
 const stars=Array.from({length:60},()=>[Math.random(),Math.random(),Math.random()]);
 const glow=(x,y,r,col,a=1)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col.replace('A',a));gr.addColorStop(1,col.replace('A',0));g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.2832);g.fill()};
 const planet=(x,y,r,c1,c2,atm)=>{if(atm)glow(x,y,r*1.5,atm,.35);const gr=g.createRadialGradient(x-r*.45,y-r*.45,r*.05,x,y,r*1.05);gr.addColorStop(0,c1);gr.addColorStop(.7,c2);gr.addColorStop(1,'#000');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.2832);g.fill();g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=s*.6;g.beginPath();g.arc(x,y,r,3.6,5.4);g.stroke()};
 const star=(x,y,r)=>{glow(x,y,r*5,'rgba(255,140,60,A)',.35);glow(x,y,r*2,'rgba(255,210,150,A)',.9);g.fillStyle='#fff8e8';g.beginPath();g.arc(x,y,r,0,6.2832);g.fill()};
 const ring=(x,y,r,col,dash)=>{g.strokeStyle=col;g.lineWidth=s*.8;g.setLineDash(dash?[2*s,4*s]:[]);g.beginPath();g.arc(x,y,r,0,6.2832);g.stroke();g.setLineDash([])};
 const zone=(x,y,r1,r2)=>{g.fillStyle='rgba(122,240,207,.05)';g.beginPath();g.arc(x,y,r2,0,6.2832);g.arc(x,y,r1,0,6.2832,true);g.fill();ring(x,y,r1,'rgba(122,240,207,.45)',1);ring(x,y,r2,'rgba(122,240,207,.45)',1)};
 const label=(txt,x,y,col='rgba(200,210,230,.55)')=>{g.fillStyle=col;g.font=`${9*s}px JB, monospace`;g.fillText(txt,x,y)};
 const draw=now=>{const d=(now-last)/1000;last=now;sp=lerp(sp,speed,.08);tt+=d*sp;const T=tt;g.clearRect(0,0,w,h);
  stars.forEach(([x,y,b])=>{g.fillStyle=`rgba(210,220,255,${b*.5*(.6+.4*Math.sin(T*2+b*20))})`;g.fillRect(x*w,y*h,s*.9,s*.9)});
  const cx=w/2,cy=h/2;g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=s*.6;for(let k=1;k<5;k++){g.beginPath();g.arc(cx,cy,k*34*s,0,6.2832);g.stroke()}g.beginPath();g.moveTo(cx,10*s);g.lineTo(cx,h-10*s);g.moveTo(10*s,cy);g.lineTo(w-10*s,cy);g.stroke();
  g.fillStyle='rgba(255,255,255,.25)';for(let k=0;k<4;k++){const x=k%2?w-14*s:10*s,y=k>1?h-14*s:10*s;g.fillRect(x,y,4*s,s*.8);g.fillRect(x+(k%2?3.2*s:0),y,s*.8,4*s)}
  if(type==='thruster'){const ox=cx-110*s;star(ox,cy,9*s);zone(ox,cy,105*s,140*s);const ph=(T%5)/5,k=eio(cl(ph*1.6));const r=lerp(185,122,k)*s,a=-.42+ph*.55;const x=ox+Math.cos(a)*r,y=cy+Math.sin(a)*r;
   ring(ox,cy,185*s,'rgba(255,255,255,.08)');ring(ox,cy,r,'rgba(245,201,122,.35)');
   if(ph<.62){const tx=-Math.sin(a),ty=Math.cos(a);for(let i=0;i<26;i++){const q=Math.random();const px=x-tx*(-8-q*46)*s*-1+(Math.random()-.5)*4*s,py=y-ty*(-8-q*46)*s*-1;glow(x+tx*(10+q*44)*s,y+ty*(10+q*44)*s+(Math.random()-.5)*5*s,(5-q*4)*s,`rgba(255,${160+q*90|0},90,A)`,1-q)}}
   planet(x,y,11*s,'#f0c49a','#7a4a2a','rgba(255,200,150,A)');label('DV 0.42',x-20*s,y-22*s,'rgba(245,201,122,.8)')}
  if(type==='comet'){const ph=(T%3.6)/3.6,hit=ph>.5;const wet=hit?eo(cl((ph-.5)*3)):0;planet(cx,cy+30*s,48*s,`rgb(${lerp(200,90,wet)|0},${lerp(140,170,wet)|0},${lerp(100,255,wet)|0})`,`rgb(${lerp(90,10,wet)|0},${lerp(52,60,wet)|0},${lerp(30,140,wet)|0})`,hit?'rgba(90,170,255,A)':null);
   if(!hit){const q=eio(ph/.5),x=lerp(w+30*s,cx+26*s,q),y=lerp(-30*s,cy-4*s,q);const gr=g.createLinearGradient(x,y,x+120*s,y-95*s);gr.addColorStop(0,'rgba(200,245,255,.9)');gr.addColorStop(1,'rgba(200,245,255,0)');g.strokeStyle=gr;g.lineWidth=5*s;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x+120*s,y-95*s);g.stroke();glow(x,y,10*s,'rgba(220,250,255,A)',1)}
   else{const q=(ph-.5)/.5;ring(cx+26*s,cy-4*s,eo(q)*80*s,`rgba(150,225,255,${(1-q)*.8})`)}label(hit?'H2O 1.2E18 KG':'INBOUND',22*s,h-22*s)}
  if(type==='shield'){star(28*s,cy,10*s);const px=cx+70*s;const pu=.6+.4*Math.sin(T*3);
   for(let k=1;k<=4;k++){g.strokeStyle=`rgba(120,190,255,${(.5-k*.09)*pu})`;g.lineWidth=s;g.beginPath();g.ellipse(px+k*4*s,cy,(18+k*15)*s,(26+k*20)*s,0,Math.PI*.5,Math.PI*1.5);g.stroke();g.beginPath();g.ellipse(px+k*10*s,cy,(18+k*24)*s,(26+k*20)*s,0,-Math.PI*.5,Math.PI*.5);g.stroke()}
   for(let i=0;i<14;i++){const q=((T*.5+i/14)%1),y0=cy+(i-6.5)*12*s,x=lerp(40*s,w+10*s,q);const dx=x-(px-40*s);let y=y0;if(dx>0){const bend=Math.min(dx/(60*s),1);y=y0+Math.sign(y0-cy||1)*bend*bend*(90*s-Math.abs(y0-cy))*.9}glow(x,y,4*s,'rgba(255,150,80,A)',.9)}
   planet(px,cy,20*s,'#86c0ff','#163a7a','rgba(120,190,255,A)');label('FIELD 48 UT',22*s,h-22*s)}
  if(type==='seed'){const ph=(T%3)/3;planet(cx,cy+46*s,62*s,'#5aa078','#0e3a28','rgba(122,240,207,A)');
   for(let i=0;i<7;i++){const q=cl(ph*1.5-i*.05),x=cx+(i-3)*16*s,y=lerp(-12*s,cy-12*s+Math.abs(i-3)*3*s,eio(q));if(q<1){g.strokeStyle='rgba(245,201,122,.35)';g.lineWidth=1.5*s;g.beginPath();g.moveTo(x,y);g.lineTo(x-3*s,y-18*s);g.stroke();glow(x,y,5*s,'rgba(245,201,122,A)',1)}else{const b=cl((ph-.67)*3);glow(x,cy-12*s+Math.abs(i-3)*3*s,(4+b*12)*s,'rgba(122,240,207,A)',.9*(1-b*.6))}}
   label('ORGANICS +12',22*s,h-22*s)}
  if(type==='tug'){star(cx,cy,8*s);zone(cx,cy,62*s,92*s);const ph=(T%5)/5,k=eio(cl(ph*1.5));const a=T*.35;const r2=lerp(77,128,k)*s;const ax=cx+Math.cos(a+2.4)*125*s,ay=cy+Math.sin(a+2.4)*125*s;const bx=cx+Math.cos(a+2.0)*r2,by=cy+Math.sin(a+2.0)*r2;
   ring(cx,cy,125*s,'rgba(255,255,255,.08)');g.strokeStyle='rgba(245,201,122,.7)';g.setLineDash([3*s,4*s]);g.lineDashOffset=-T*20;g.lineWidth=1.2*s;g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();g.setLineDash([]);
   planet(ax,ay,15*s,'#f2d08a','#6a4a1a','rgba(245,201,122,A)');planet(bx,by,8*s,'#9ab8e0','#22344f');label(r2<92*s?'RIVAL IN ZONE':'RIVAL EJECTED',22*s,h-22*s,r2<92*s?'rgba(122,240,207,.8)':'rgba(255,150,120,.8)')}
  requestAnimationFrame(draw)};requestAnimationFrame(draw)});

/* ---------- live sim ---------- */
(()=>{const cv=$('#simc'),g=cv.getContext('2d');const r=Math.min(devicePixelRatio||1,2);let w,h;const fit=()=>{w=cv.width=cv.clientWidth*r;h=cv.height=cv.clientHeight*r};fit();addEventListener('resize',fit);
 const GM=9000,ps=[];let id=1;const add=(x,y,silent)=>{const cx=w/2,cy=h/2,dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)||1,v=Math.sqrt(GM*r*r*r/d)*(.88+Math.random()*.24);ps.push({x,y,vx:-dy/d*v,vy:dx/d*v,tr:[],hue:Math.random()*360,id:id++,born:performance.now(),zt:0})};
 for(let i=0;i<16;i++){const a=Math.random()*6.28,d=(70+Math.random()*240)*r;add(w/2+Math.cos(a)*d,h/2+Math.sin(a)*d)}
 cv.addEventListener('click',e=>{const b=cv.getBoundingClientRect();add((e.clientX-b.left)*r,(e.clientY-b.top)*r)});
 let hov=null;cv.addEventListener('mousemove',e=>{const b=cv.getBoundingClientRect();hov=[(e.clientX-b.left)*r,(e.clientY-b.top)*r]});cv.addEventListener('mouseleave',()=>hov=null);
 const zi=130,zo=185;let ang=0;
 const step=()=>{const cx=w/2,cy=h/2;g.fillStyle='rgba(1,2,6,.28)';g.fillRect(0,0,w,h);ang+=.002;const pul=1+.04*Math.sin(ang*40);
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;for(let x=cx%(60*r);x<w;x+=60*r){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=cy%(60*r);y<h;y+=60*r){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
  g.fillStyle='rgba(122,240,207,.035)';g.beginPath();g.arc(cx,cy,zo*r,0,6.2832);g.arc(cx,cy,zi*r,0,6.2832,true);g.fill();
  g.setLineDash([2*r,5*r]);g.strokeStyle='rgba(122,240,207,.45)';[zi,zo].forEach(z=>{g.beginPath();g.arc(cx,cy,z*r,0,6.2832);g.stroke()});g.setLineDash([]);
  g.strokeStyle='rgba(122,240,207,.6)';g.lineWidth=1.5*r;g.beginPath();g.arc(cx,cy,(zi+zo)/2*r,ang,ang+.5);g.stroke();
  [[60,'0.45 AU'],[zi,'0.95 AU'],[zo,'1.37 AU'],[260,'2.00 AU']].forEach(([z,l])=>{g.fillStyle='rgba(180,190,210,.4)';g.font=`${9*r}px JB, monospace`;g.fillText(l,cx+z*r+6*r,cy-4*r);if(z===60||z===260){g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=r;g.beginPath();g.arc(cx,cy,z*r,0,6.2832);g.stroke()}});
  const gr=g.createRadialGradient(cx,cy,0,cx,cy,70*r*pul);gr.addColorStop(0,'rgba(255,248,230,1)');gr.addColorStop(.12,'rgba(255,210,140,.9)');gr.addColorStop(.35,'rgba(255,140,60,.25)');gr.addColorStop(1,'rgba(255,100,40,0)');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,70*r,0,6.2832);g.fill();
  let inz=0,near=null,nd=1e9;
  for(let k=ps.length-1;k>=0;k--){const p=ps[k];for(let s=0;s<4;s++){const dx=cx-p.x,dy=cy-p.y,d2=dx*dx+dy*dy,d=Math.sqrt(d2),a=GM*r*r*r/d2;p.vx+=dx/d*a*.004;p.vy+=dy/d*a*.004;p.x+=p.vx*.004;p.y+=p.vy*.004}
   const d=Math.hypot(p.x-cx,p.y-cy)/r;if(d<14||d>1600){ps.splice(k,1);continue}const ok=d>zi&&d<zo;if(ok){inz++;p.zt+=1/60}
   p.tr.push([p.x,p.y]);if(p.tr.length>90)p.tr.shift();
   for(let i=1;i<p.tr.length;i++){const a=i/p.tr.length;g.strokeStyle=ok?`rgba(122,240,207,${a*.6})`:`hsla(${p.hue},40%,75%,${a*.3})`;g.lineWidth=r*(.5+a);g.beginPath();g.moveTo(p.tr[i-1][0],p.tr[i-1][1]);g.lineTo(p.tr[i][0],p.tr[i][1]);g.stroke()}
   const age=Math.min((performance.now()-p.born)/600,1);const rad=(ok?4.5:3.2)*r*eo(age);
   if(ok){const gg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,16*r);gg.addColorStop(0,'rgba(122,240,207,.45)');gg.addColorStop(1,'rgba(122,240,207,0)');g.fillStyle=gg;g.beginPath();g.arc(p.x,p.y,16*r,0,6.2832);g.fill()}
   g.fillStyle=ok?'#bfffee':`hsl(${p.hue},45%,78%)`;g.beginPath();g.arc(p.x,p.y,rad,0,6.2832);g.fill();
   if(age<1){g.strokeStyle=`rgba(245,201,122,${1-age})`;g.lineWidth=r;g.beginPath();g.arc(p.x,p.y,(4+age*24)*r,0,6.2832);g.stroke()}
   if(hov){const hd=Math.hypot(hov[0]-p.x,hov[1]-p.y);if(hd<nd){nd=hd;near=p}}}
  if(near&&nd<40*r){const p=near,d=Math.hypot(p.x-cx,p.y-cy)/r;g.strokeStyle='rgba(245,201,122,.8)';g.lineWidth=r;g.beginPath();g.arc(p.x,p.y,11*r,0,6.2832);g.stroke();g.beginPath();g.moveTo(p.x+11*r,p.y-11*r);g.lineTo(p.x+30*r,p.y-30*r);g.lineTo(p.x+120*r,p.y-30*r);g.stroke();
   g.fillStyle='#eef1f6';g.font=`${10*r}px JB, monospace`;g.fillText('PLANET '+String(p.id).padStart(3,'0'),p.x+34*r,p.y-36*r);g.fillStyle='rgba(180,190,210,.7)';g.fillText((d/136).toFixed(2)+' AU  '+Math.round(255/Math.sqrt(d/157))+' K',p.x+34*r,p.y-20*r)}
  $('#s1').textContent=ps.length;$('#s2').textContent=inz;requestAnimationFrame(step)};step()})();
