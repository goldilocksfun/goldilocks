// Shared planet shaders, extracted from main.js
const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<6;i++){f+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return f;}
float fbm3(vec3 p){float f=0.,a=.5;for(int i=0;i<3;i++){f+=a*snoise(p);p*=2.1;a*=.5;}return f;}`;

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
export {NOISE,planetVS,planetFS};
