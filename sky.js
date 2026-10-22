// Living sky layer: distant galaxies, drifting nebula veil, twinkling deep stars, comets and rare shooting stars.
// Follows the camera (sits at infinity), additive and low key. Reduced on mobile, static under prefers-reduced-motion.
import * as THREE from 'three';
const rnd=(a,b)=>a+Math.random()*(b-a);
export function createSky(scene,camera,o={}){
 const mob=!!o.mobile,rm=!!o.rm,dpr=o.dpr||1,R=1250;const G=new THREE.Group();scene.add(G);
 const add={transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending};
 // deep star layer, three depth bands with colour temperature and twinkle
 {const N=mob?1400:3200,pos=new Float32Array(N*3),col=new Float32Array(N*3),a=new Float32Array(N*2);
  for(let i=0;i<N;i++){const v=new THREE.Vector3().randomDirection();const band=Math.random();pos.set(v.multiplyScalar(R*(band<.6?1:band<.9?.97:.94)).toArray(),i*3);
   const T=Math.random();const c=T<.12?[1,.78,.55]:T<.3?[1,.92,.8]:T<.5?[.72,.84,1]:[1,1,1];col.set(c,i*3);a[i*2]=band<.6?Math.random()*.7+.45:band<.9?Math.random()*1.1+.8:Math.random()*1.6+1.4;a[i*2+1]=Math.random()*6.28}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('aD',new THREE.BufferAttribute(a,2));
  var starM=new THREE.ShaderMaterial(Object.assign({uniforms:{t:{value:0},d:{value:dpr},tw:{value:rm?0:1}},vertexShader:`attribute vec3 color;attribute vec2 aD;varying vec3 vC;varying float vA;uniform float t,d,tw;void main(){vC=color;float s=sin(t*(.6+fract(aD.y)*1.8)+aD.y*7.);vA=(.62+.38*s*tw)*clamp(aD.x/2.,.35,1.);gl_PointSize=aD.x*d;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float r=length(q);float a=exp(-r*r*28.);a+=exp(-abs(q.x)*40.-abs(q.y)*7.)*.06+exp(-abs(q.y)*40.-abs(q.x)*7.)*.06;gl_FragColor=vec4(vC*a*vA*.9,1.);}`},add));
  const p=new THREE.Points(g,starM);p.frustumCulled=false;G.add(p)}
 // faint distant galaxies
 const galM=[];{const n=mob?3:6;for(let i=0;i<n;i++){const m=new THREE.ShaderMaterial(Object.assign({uniforms:{rot:{value:rnd(0,6.28)},inc:{value:rnd(.25,.8)},hue:{value:Math.random()},arms:{value:Math.random()<.65?1:0}},
   vertexShader:`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform float rot,inc,hue,arms;varying vec2 vU;void main(){float c=cos(rot),s=sin(rot);vec2 p=mat2(c,-s,s,c)*vU;p.y/=inc;float r=length(p);float an=atan(p.y,p.x);
    float sp=arms*pow(.5+.5*cos(an*2.-log(r+.02)*5.),3.)*exp(-r*3.)*.6;float core=exp(-r*r*40.)*1.1+exp(-r*5.)*.35;float a=(core+sp)*smoothstep(1.,.6,r);
    vec3 col=mix(vec3(1.,.86,.66),vec3(.7,.82,1.),hue*smoothstep(.0,.6,r));gl_FragColor=vec4(col*a*.22,1.);}`},add));
  const q=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);const v=new THREE.Vector3().randomDirection();v.y*=.6;v.normalize().multiplyScalar(R*.9);q.position.copy(v);q.lookAt(0,0,0);q.scale.setScalar(rnd(28,70));G.add(q);galM.push(m)}}
 // drifting nebula veil (two layers, counter drifting)
 const veilM=new THREE.ShaderMaterial(Object.assign({side:THREE.BackSide,uniforms:{t:{value:0}},vertexShader:`varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float t;varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fb(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n3(p);p=p*2.03+1.7;a*=.5;}return s;}
  void main(){vec3 p=vP;float a=fb(p*2.6+vec3(t*.006,0.,t*.004));float b=fb(p*4.2-vec3(0.,t*.009,t*.005)+a*1.3);float m=smoothstep(.45,.85,a*.6+b*.55);float band=exp(-pow(p.y*1.6-.15*sin(p.x*2.),2.)*3.);
   vec3 c=mix(vec3(.05,.16,.17),vec3(.3,.17,.06),smoothstep(.4,.7,b));gl_FragColor=vec4(c*m*(.25+band*.75)*.42,1.);}`},add));
 const veil=new THREE.Mesh(new THREE.SphereGeometry(R*1.05,48,32),veilM);if(!mob)G.add(veil);
 // streaks: comets (head + dust tail + ion tail) and shooting stars, built from camera facing ribbons
 const tailVS=`attribute vec2 aUV;varying vec2 vU;void main(){vU=aUV;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const tailFS=`uniform vec3 c;uniform float op,k,t,seed;varying vec2 vU;void main(){float u=vU.x,v=vU.y;float w=mix(.18,1.,pow(u,.7));float x=v/w;float fall=pow(1.-u,k);
  float streak=.75+.25*sin(x*9.+u*14.+seed)*sin(x*23.-u*31.+seed*2.);float a=exp(-x*x*3.2)*fall*streak*smoothstep(0.,.03,u);gl_FragColor=vec4(c*a*op,1.);}`;
 function ribbon(color,k,seg=24){const n=seg+1,pos=new Float32Array(n*2*3),uv=new Float32Array(n*2*2),idx=[];for(let i=0;i<n;i++){uv.set([i/seg,-1,i/seg,1],i*4);if(i<seg){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aUV',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new THREE.ShaderMaterial(Object.assign({uniforms:{c:{value:new THREE.Color(color)},op:{value:0},k:{value:k},t:{value:0},seed:{value:Math.random()*9}},vertexShader:tailVS,fragmentShader:tailFS},add));const me=new THREE.Mesh(g,m);me.frustumCulled=false;me.visible=false;G.add(me);return me}
 const headM=()=>new THREE.ShaderMaterial(Object.assign({uniforms:{c:{value:new THREE.Color(1,.95,.85)},op:{value:0}},vertexShader:`varying vec2 vU;void main(){vU=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 c;uniform float op;varying vec2 vU;void main(){float r=length(vU);float a=exp(-r*r*60.)*1.4+exp(-r*6.)*.25;a*=smoothstep(1.,.7,r);gl_FragColor=vec4(c*a*op,1.);}`},add));
 const tmp=new THREE.Vector3(),side=new THREE.Vector3(),view=new THREE.Vector3();
 function layRibbon(me,head,dir,len,wid,curve){const P=me.geometry.attributes.position,n=P.count/2;view.copy(head).normalize();
  for(let i=0;i<n;i++){const u=i/(n-1);tmp.copy(head).addScaledVector(dir,-len*u);if(curve)tmp.addScaledVector(curve,len*u*u*.18);side.crossVectors(dir,view).normalize().multiplyScalar(wid*(.18+.82*Math.pow(u,.7)));
   P.setXYZ(i*2,tmp.x-side.x,tmp.y-side.y,tmp.z-side.z);P.setXYZ(i*2+1,tmp.x+side.x,tmp.y+side.y,tmp.z+side.z)}P.needsUpdate=true}
 const comets=[],shoots=[];
 for(let i=0;i<(mob?1:2);i++){const h=new THREE.Mesh(new THREE.PlaneGeometry(1,1),headM());h.visible=false;h.frustumCulled=false;G.add(h);
  comets.push({head:h,dust:ribbon(0xffd6a0,1.5),ion:ribbon(0x9fd8ff,2.4),life:-1,next:rnd(2.5,7)+i*9})}
 for(let i=0;i<2;i++)shoots.push({r:ribbon(0xffffff,1.2,8),life:-1,next:rnd(6,14)+i*7});
 const f=new THREE.Vector3(),rt=new THREE.Vector3(),up=new THREE.Vector3();
 function spawnPath(D,spread){camera.getWorldDirection(f);rt.crossVectors(f,camera.up).normalize();up.crossVectors(rt,f).normalize();
  const hh=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*D,ww=hh*camera.aspect;const ang=rnd(0,6.28);const d2=new THREE.Vector2(Math.cos(ang),Math.sin(ang)*.7).normalize();
  const c=new THREE.Vector3().copy(f).multiplyScalar(D).addScaledVector(rt,rnd(-.5,.5)*ww*spread).addScaledVector(up,rnd(-.4,.6)*hh*spread);
  const dir=new THREE.Vector3().addScaledVector(rt,d2.x).addScaledVector(up,d2.y).addScaledVector(f,rnd(-.15,.15)).normalize();return{c,dir,ww}}
 function spawnComet(cm){const D=R*.8,{c,dir,ww}=spawnPath(D,1);cm.c=c;cm.dir=dir;cm.span=ww*rnd(.9,1.5);cm.len=ww*rnd(.3,.48);cm.wid=cm.len*rnd(.11,.16);cm.dur=rnd(9,15);cm.life=0;
  cm.curve=new THREE.Vector3().crossVectors(dir,c).normalize().multiplyScalar(Math.random()<.5?-1:1);cm.head.scale.setScalar(cm.wid*2.4);[cm.head,cm.dust,cm.ion].forEach(m=>m.visible=true)}
 function spawnShoot(s){const D=R*.7,{c,dir,ww}=spawnPath(D,1.1);s.c=c;s.dir=dir;s.span=ww*rnd(.25,.45);s.len=ww*rnd(.06,.11);s.dur=rnd(.55,1.1);s.life=0;s.r.visible=true}
 const head=new THREE.Vector3();
 function update(dt,t){G.position.copy(camera.position);starM.uniforms.t.value=t;veilM.uniforms.t.value=rm?0:t;if(rm)return;
  for(const cm of comets){if(cm.life<0){cm.next-=dt;if(cm.next<=0)spawnComet(cm);continue}cm.life+=dt;const k=cm.life/cm.dur;if(k>=1){cm.life=-1;cm.next=rnd(mob?18:10,mob?32:20);[cm.head,cm.dust,cm.ion].forEach(m=>m.visible=false);continue}
   const fade=Math.sin(Math.PI*Math.min(1,k))**.6;head.copy(cm.c).addScaledVector(cm.dir,(k-.5)*cm.span);cm.head.position.copy(head);cm.head.lookAt(0,0,0);cm.head.material.uniforms.op.value=fade*1.3;
   layRibbon(cm.dust,head,cm.dir,cm.len,cm.wid,cm.curve);cm.dust.material.uniforms.op.value=fade*.6;layRibbon(cm.ion,head,cm.dir,cm.len*1.25,cm.wid*.3,null);cm.ion.material.uniforms.op.value=fade*.5}
  for(const s of shoots){if(s.life<0){s.next-=dt;if(s.next<=0)spawnShoot(s);continue}s.life+=dt;const k=s.life/s.dur;if(k>=1){s.life=-1;s.next=rnd(mob?20:9,mob?40:22);s.r.visible=false;continue}
   head.copy(s.c).addScaledVector(s.dir,(k-.5)*s.span);layRibbon(s.r,head,s.dir,s.len*Math.min(1,k*3),s.len*.012,null);s.r.material.uniforms.op.value=Math.sin(Math.PI*k)*.9}}
 return{update,group:G,comets,_force:(k=.5)=>{comets.slice(0,1).forEach(c=>{spawnComet(c);c.life=c.dur*k});shoots.slice(0,1).forEach(s=>{spawnShoot(s);s.life=s.dur*.45})}};
}
