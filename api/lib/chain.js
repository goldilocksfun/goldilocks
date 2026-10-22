// Solana RPC helpers. Devnet by default; mainnet requires MAINNET_ENABLED=1 which is off.
'use strict';
const web3=require('@solana/web3.js');const bs58=(m=>m.default||m)(require('bs58'));const fs=require('fs');
const CLUSTER=process.env.CLUSTER||'devnet';
const MAINNET_ENABLED=process.env.MAINNET_ENABLED==='1';
if(CLUSTER==='mainnet-beta'&&!MAINNET_ENABLED)throw new Error('mainnet is disabled by config');
const KEY=process.env.HELIUS_API_KEY;
const RPC=process.env.GAME_RPC_URL||(KEY?`https://${CLUSTER==='mainnet-beta'?'mainnet':'devnet'}.helius-rpc.com/?api-key=${KEY}`:web3.clusterApiUrl(CLUSTER));
const conn=require('./pollconfirm')(new web3.Connection(RPC,'confirmed'));
// Memo program used for burn memos (SPL Memo v2 by default, configurable). v1 memos are also accepted.
const MEMO=new web3.PublicKey(process.env.MEMO_PROGRAM||'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MEMOS=new Set(['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr','Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo']);
const TOKEN_PROGRAMS=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PqHrSHqbKbdB7y'];
function loadOrCreateKeypair(file){try{return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file,'utf8'))));}catch(e){const k=web3.Keypair.generate();fs.writeFileSync(file,JSON.stringify([...k.secretKey]),{mode:0o600});return k;}}
async function supply(mint){const r=await conn.getTokenSupply(new web3.PublicKey(mint));return r.value.amount;}
// All holders of a mint: {owner: rawAmountString}, summed across token accounts.
async function holders(mint){const out={};const pk=new web3.PublicKey(mint);
  for(const prog of TOKEN_PROGRAMS){let accs=[];try{accs=await conn.getParsedProgramAccounts(new web3.PublicKey(prog),{filters:[...(prog===TOKEN_PROGRAMS[0]?[{dataSize:165}]:[]),{memcmp:{offset:0,bytes:pk.toBase58()}}]});}catch(e){if(prog===TOKEN_PROGRAMS[0])throw e;}
    for(const a of accs){const i=a.account.data.parsed&&a.account.data.parsed.info;if(!i)continue;const amt=BigInt(i.tokenAmount.amount);if(amt>0n)out[i.owner]=String(BigInt(out[i.owner]||0)+amt);}}
  return out;}
// Verify a thruster burn: success, fee payer is wallet, SOL transfer of >= lamports to treasury, memo equals expected.
async function verifyBurn(sig,{wallet,treasury,lamports,memo}){const tx=await conn.getParsedTransaction(sig,{maxSupportedTransactionVersion:0,commitment:'confirmed'});
  if(!tx)return{ok:false,error:'Transaction not found yet. Try again in a few seconds.'};if(tx.meta&&tx.meta.err)return{ok:false,error:'Transaction failed on chain.'};
  const keys=tx.transaction.message.accountKeys;const payer=(keys[0].pubkey||keys[0]).toString();if(payer!==wallet)return{ok:false,error:'Transaction was not signed by this wallet.'};
  let paid=0,memoOk=false;for(const ix of tx.transaction.message.instructions){
    if(ix.program==='system'&&ix.parsed&&ix.parsed.type==='transfer'&&ix.parsed.info.source===wallet&&ix.parsed.info.destination===treasury)paid+=+ix.parsed.info.lamports;
    if(ix.programId&&MEMOS.has(ix.programId.toString())){const m=typeof ix.parsed==='string'?ix.parsed:(ix.data?Buffer.from(bs58.decode(ix.data)).toString():'');if(m===memo)memoOk=true;}}
  if(paid<lamports)return{ok:false,error:'Payment to the treasury is missing or too small.'};if(!memoOk)return{ok:false,error:'Memo does not match this burn.'};
  return{ok:true,paid,slot:tx.slot,blockTime:tx.blockTime};}
// Signs first and reports the signature through onSig before sending, so a crash or timeout never loses track of a payment.
async function transfer(from,to,lamports,onSig){const {blockhash,lastValidBlockHeight}=await conn.getLatestBlockhash('confirmed');
  const tx=new web3.Transaction({feePayer:from.publicKey,blockhash,lastValidBlockHeight}).add(web3.SystemProgram.transfer({fromPubkey:from.publicKey,toPubkey:new web3.PublicKey(to),lamports}));tx.sign(from);
  const sig=bs58.encode(tx.signature);if(onSig)onSig(sig,lastValidBlockHeight);await conn.sendRawTransaction(tx.serialize(),{skipPreflight:false,preflightCommitment:'confirmed'});
  const r=await conn.confirmTransaction({signature:sig,blockhash,lastValidBlockHeight},'confirmed');if(r.value&&r.value.err)throw new Error('Transaction failed: '+JSON.stringify(r.value.err));return sig;}
// State of an earlier payment: 'landed', 'failed', 'expired' (safe to resend) or 'unknown' (wait).
async function sigState(sig,lvh){const r=(await conn.getSignatureStatuses([sig],{searchTransactionHistory:true})).value[0];if(r)return r.err?'failed':'landed';
  if(lvh&&(await conn.getBlockHeight('confirmed'))>lvh+10)return 'expired';return 'unknown';}
module.exports={web3,conn,CLUSTER,MAINNET_ENABLED,MEMO,loadOrCreateKeypair,supply,holders,verifyBurn,transfer,sigState,balance:pk=>conn.getBalance(new web3.PublicKey(pk))};
