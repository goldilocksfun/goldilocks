// X task verification: follow, repost, like, reply. X API v2 with app bearer; likes need user context (OAuth 1.0a) if configured.
// Optional fallback to twitterapi.io when TWITTERAPI_IO_KEY is set. Results cached to save calls.
'use strict';const crypto=require('crypto');
const BEARER=process.env.X_BEARER_TOKEN||'';const TIO=process.env.TWITTERAPI_IO_KEY||'';
const O1={ck:process.env.X_VERIFY_APP_KEY||'',cs:process.env.X_VERIFY_APP_SECRET||'',at:process.env.X_VERIFY_ACCESS_TOKEN||'',as:process.env.X_VERIFY_ACCESS_SECRET||''};
const hasO1=()=>O1.ck&&O1.cs&&O1.at&&O1.as;
const CACHE_MS=+process.env.X_CACHE_MS||60e3,FOLLOW_CACHE_MS=+process.env.X_FOLLOW_CACHE_MS||300e3;
const e=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
function oauth1(method,url){const u=new URL(url);const p={oauth_consumer_key:O1.ck,oauth_nonce:crypto.randomBytes(16).toString('hex'),oauth_signature_method:'HMAC-SHA1',oauth_timestamp:Math.floor(Date.now()/1000)+'',oauth_token:O1.at,oauth_version:'1.0'};
  const all=Object.assign({},p);for(const [k,v] of u.searchParams)all[k]=v;const base=[method,e(u.origin+u.pathname),e(Object.keys(all).sort().map(k=>e(k)+'='+e(all[k])).join('&'))].join('&');
  p.oauth_signature=crypto.createHmac('sha1',e(O1.cs)+'&'+e(O1.as)).update(base).digest('base64');return 'OAuth '+Object.keys(p).map(k=>e(k)+'="'+e(p[k])+'"').join(', ');}
let fetchImpl=(...a)=>fetch(...a);
async function xget(path,user){const url='https://api.x.com/2/'+path;const r=await fetchImpl(url,{headers:{authorization:user?oauth1('GET',url):'Bearer '+BEARER}});const j=await r.json().catch(()=>({}));
  if(r.status===429){const er=new Error('X is rate limiting checks. Try again in a minute.');er.code=429;throw er;}if(!r.ok){const er=new Error(j.detail||j.title||'X lookup failed.');er.code=r.status;throw er;}return j;}
const cache=new Map();async function cached(k,ms,fn){const c=cache.get(k);if(c&&Date.now()-c.t<ms)return c.v;const v=await fn();cache.set(k,{t:Date.now(),v});return v;}
// All user ids from a paginated user list endpoint.
async function idList(path,user,max=20){const ids=new Set();let tok=null,n=0;do{const j=await xget(path+(path.includes('?')?'&':'?')+'max_results='+(path.includes('followers')?1000:100)+(tok?'&pagination_token='+tok:''),user);for(const u of j.data||[])ids.add(u.id);tok=j.meta&&j.meta.next_token;n++;}while(tok&&n<max);return ids;}
async function userByHandle(h){return cached('u:'+h,CACHE_MS*10,async()=>{const j=await xget('users/by/username/'+encodeURIComponent(h)+'?user.fields=created_at,public_metrics');if(!j.data){const er=new Error('That X account was not found.');er.code=404;throw er;}
  return{id:j.data.id,username:j.data.username,createdAt:j.data.created_at,followers:(j.data.public_metrics||{}).followers_count||0};});}
async function tio(path){const r=await fetchImpl('https://api.twitterapi.io/'+path,{headers:{'x-api-key':TIO}});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.message||'Fallback lookup failed.');return j;}
async function follows(uid,handle,officialId,officialHandle){try{const s=await cached('fol:'+officialId,FOLLOW_CACHE_MS,()=>idList('users/'+officialId+'/followers',false,10));return s.has(uid);}
  catch(x){if(!TIO)throw x;const j=await tio('twitter/user/check_follow_relationship?source_user_name='+e(handle)+'&target_user_name='+e(officialHandle));return !!(j.data&&j.data.following);}}
async function reposted(uid,tweet){try{const s=await cached('rt:'+tweet,CACHE_MS,()=>idList('tweets/'+tweet+'/retweeted_by',false));return s.has(uid);}
  catch(x){if(!TIO)throw x;const j=await tio('twitter/tweet/retweeters?tweetId='+tweet);return (j.users||[]).some(u=>String(u.id)===uid);}}
async function liked(uid,tweet){if(hasO1()){const s=await cached('lk:'+tweet,CACHE_MS,()=>idList('tweets/'+tweet+'/liking_users',true));return s.has(uid);}
  if(TIO){const j=await tio('twitter/tweet/favoriters?tweetId='+tweet);return (j.users||[]).some(u=>String(u.id)===uid);}return null;} // null = cannot verify with current credentials
// Reply in the post's conversation from this account. If code is given, the reply must contain it (proves the handle belongs to this wallet).
async function replied(handle,tweet,code){const j=await cached('rp:'+tweet+':'+handle.toLowerCase(),CACHE_MS,()=>xget('tweets/search/recent?query='+e('conversation_id:'+tweet+' from:'+handle+' is:reply')+'&max_results=10&tweet.fields=text'));
  return (j.data||[]).some(t=>!code||t.text.toUpperCase().includes(code.toUpperCase()));}
module.exports={userByHandle,follows,reposted,liked,replied,hasO1,_setFetch:f=>{fetchImpl=f;},_clear:()=>cache.clear()};
