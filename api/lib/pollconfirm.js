// Confirm by polling getSignatureStatuses instead of websockets (some hosts block RPC websockets).
'use strict';
module.exports=function(conn){conn.confirmTransaction=async function(arg){const sig=typeof arg==='string'?arg:arg.signature;const lvh=typeof arg==='object'?arg.lastValidBlockHeight:null;
  for(let i=0;i<90;i++){const r=(await conn.getSignatureStatuses([sig])).value[0];if(r){if(r.err)return{context:{slot:r.slot},value:{err:r.err}};if(r.confirmationStatus==='confirmed'||r.confirmationStatus==='finalized')return{context:{slot:r.slot},value:{err:null}};}
    if(lvh&&i%5===4&&(await conn.getBlockHeight())>lvh)throw new Error('Transaction expired: '+sig);await new Promise(z=>setTimeout(z,1000));}throw new Error('Confirmation timeout: '+sig);};return conn;};
