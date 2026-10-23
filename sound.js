/* Goldilocks orbit sound. Pure Web Audio synthesis, no samples. */
const KEY='gl_sound';const MOB=innerWidth<820||matchMedia('(hover:none)').matches;
const NV=MOB?3:6;const SCALE=[0,3,5,7,10];
let ctx=null,master=null,wet=null,dry=null,sunG=null,sunF=null,voices=[],on=localStorage.getItem(KEY)!=='off',lastChime=0;
function noiseBuf(c,sec,brown){const n=c.sampleRate*sec|0,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;if(brown){l=(l+.02*w)/1.02;d[i]=l*3.5}else d[i]=w}return b}
function impulse(c,sec){const n=c.sampleRate*sec|0,b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++){const t=i/n;d[i]=(Math.random()*2-1)*Math.pow(1-t,3.2)*(t<.004?t/.004:1)}}return b}
function quant(au){/* inner orbits higher, outer lower; snapped to a minor pentatonic so voices never clash */
 const semi=Math.round(-12*Math.log2(Math.max(.3,au))*1.6);const oct=Math.floor(semi/12),r=((semi%12)+12)%12;let s=SCALE[0];for(const x of SCALE)if(x<=r)s=x;return 196*Math.pow(2,(oct*12+s)/12)}
function lfo(f,depth,target){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;g.gain.value=depth;o.connect(g).connect(target);o.start();return o}
function build(){
 ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'playback'});
 master=ctx.createGain();master.gain.value=0;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-24;comp.ratio.value=3;const an=ctx.createAnalyser();an.fftSize=2048;master.connect(comp);comp.connect(an);an.connect(ctx.destination);window.__snd={ctx,an,master,rms(){const a=new Float32Array(an.fftSize);an.getFloatTimeDomainData(a);let s=0;for(const x of a)s+=x*x;return Math.sqrt(s/a.length)}};
 const rv=ctx.createConvolver();rv.buffer=impulse(ctx,MOB?2.2:3.6);wet=ctx.createGain();wet.gain.value=.55;wet.connect(rv).connect(master);dry=ctx.createGain();dry.gain.value=.6;dry.connect(master);
 /* Sun: low detuned partials and brown noise through a breathing low pass */
 sunG=ctx.createGain();sunG.gain.value=.0;sunF=ctx.createBiquadFilter();sunF.type='lowpass';sunF.frequency.value=150;sunF.Q.value=.7;sunF.connect(sunG);sunG.connect(dry);sunG.connect(wet);
 [[36.7,.5],[36.95,.45],[55.1,.18],[73.4,.07]].forEach(([f,a])=>{const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;const g=ctx.createGain();g.gain.value=a;o.connect(g).connect(sunF);o.start()});
 const nz=ctx.createBufferSource();nz.buffer=noiseBuf(ctx,6,true);nz.loop=true;const ng=ctx.createGain();ng.gain.value=.55;nz.connect(ng).connect(sunF);nz.start();
 const breath=ctx.createGain();breath.gain.value=1;sunF.disconnect();sunF.connect(breath).connect(sunG);lfo(.071,.28,breath.gain);lfo(.043,60,sunF.frequency);
 const warm=ctx.createBiquadFilter();warm.type='lowpass';warm.frequency.value=700;warm.Q.value=.5;const wg=ctx.createGain();wg.gain.value=.55;warm.connect(wg);wg.connect(sunG);lfo(.071,.22,wg.gain);lfo(.031,260,warm.frequency);
 [[110,.32,'triangle'],[110.6,.22,'sine'],[165,.14,'sine'],[220.4,.12,'triangle'],[329.6,.05,'sine'],[440.9,.025,'sine']].forEach(([f,a,ty])=>{const o=ctx.createOscillator();o.type=ty;o.frequency.value=f;const g=ctx.createGain();g.gain.value=a;o.connect(g).connect(warm);o.start()});
 const tx=ctx.createBufferSource();tx.buffer=noiseBuf(ctx,5,false);tx.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=260;bp.Q.value=1.2;const tg=ctx.createGain();tg.gain.value=.05;tx.connect(bp).connect(tg).connect(warm);tx.start();lfo(.05,90,bp.frequency);
 /* Planet voice pool */
 for(let i=0;i<NV;i++){const g=ctx.createGain();g.gain.value=0;const p=ctx.createStereoPanner?ctx.createStereoPanner():null;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;
  const a=ctx.createOscillator(),b=ctx.createOscillator();a.type='sine';b.type='triangle';const bg=ctx.createGain();bg.gain.value=.12;a.connect(lp);b.connect(bg).connect(lp);
  const trem=ctx.createGain();trem.gain.value=.85;lfo(.15+i*.037,.15,trem.gain);lp.connect(trem).connect(g);
  const sh=ctx.createOscillator();sh.type='sine';const shg=ctx.createGain();shg.gain.value=0;const shm=ctx.createGain();shm.gain.value=.5;lfo(.6+i*.11,.5,shm.gain);sh.connect(shm).connect(shg).connect(g);
  if(p){g.connect(p);p.connect(dry);p.connect(wet)}else{g.connect(dry);g.connect(wet)}
  a.start();b.start();sh.start();voices.push({id:null,g,p,a,b,sh,shg})}
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;document.hidden?ctx.suspend():on&&ctx.resume()});
}
function fade(v){if(!ctx)return;const t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(v?.65:0,t,v?.6:.15)}
function start(){if(!on)return;if(!ctx)build();if(ctx.state!=='running')ctx.resume().then(()=>fade(1));fade(1)}
const EV=['pointerdown','click','touchend','keydown'];
const first=()=>{start();if(ctx&&ctx.state==='running')EV.forEach(e=>removeEventListener(e,first,true))};
EV.forEach(e=>addEventListener(e,first,true));
export function setOn(v){on=v;localStorage.setItem(KEY,v?'on':'off');if(v)start();else fade(0)}
export function isOn(){return on}
/* sun: 0..1 prominence; list: [{id,au,zone,x,w}] x in -1..1, w 0..1 */
export function update(sun,list){if(!ctx||!on||ctx.state!=='running')return;const t=ctx.currentTime;
 sunG.gain.setTargetAtTime(.32*Math.max(.35,sun),t,.8);
 const used=new Set();for(const v of voices){const m=list.find(q=>q.id===v.id);if(m){used.add(m);v.cur=m}else v.cur=null}
 for(const q of list){if(used.has(q))continue;const v=voices.find(x=>!x.cur);if(!v)break;v.cur=q;v.id=q.id;const f=quant(q.au);v.a.frequency.setValueAtTime(f,t);v.b.frequency.setValueAtTime(f*2.003,t);v.sh.frequency.setValueAtTime(f*6.01,t)}
 for(const v of voices){const q=v.cur;if(!q){v.g.gain.setTargetAtTime(0,t,.5);v.id=v.id&&v.g.gain.value<.001?null:v.id;continue}
  v.g.gain.setTargetAtTime(.09*Math.sqrt(q.w),t,.35);if(v.p)v.p.pan.setTargetAtTime(Math.max(-.85,Math.min(.85,q.x*.85)),t,.25);v.shg.gain.setTargetAtTime(q.zone?.09:0,t,.6)}}
export function chime(au,zone,strong){if(!ctx||!on)return;if(ctx.state!=='running')ctx.resume();const t=ctx.currentTime;if(t-lastChime<(strong?.05:.18))return;lastChime=t;
 const f=quant(au)*4,g=ctx.createGain(),amp=strong?.12:.05;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+(strong?2.4:1.3));g.connect(wet);const d=ctx.createGain();d.gain.value=.5;g.connect(d).connect(dry);
 const parts=zone?[[1,1],[2.76,.32],[5.4,.12],[1.5,.25]]:[[1,1],[2.76,.3],[5.4,.1]];
 for(const [r,a] of parts){const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.value=f*r;og.gain.value=a;o.connect(og).connect(g);o.start(t);o.stop(t+(strong?2.5:1.4))}}
