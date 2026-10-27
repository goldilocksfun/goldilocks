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
// Loads a keypair file. A new key is generated only when the file does not exist; an unreadable or malformed
// file is an error and is never overwritten (it may hold a real treasury key).
function loadOrCreateKeypair(file){if(fs.existsSync(file))return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file,'utf8'))));
  const k=web3.Keypair.generate();fs.writeFileSync(file,JSON.stringify([...k.secretKey]),{mode:0o600,flag:'wx'});return k;}
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
// ---------- payouts in $LAUNCH (SPL token) ----------
// LAUNCH_MINT is the $LAUNCH mint. Rewards leave the treasury's associated token account for that mint and arrive in
// the winner's associated token account. Each row is two instructions:
//   1. Associated Token Account program, CreateIdempotent: creates the winner's account if missing, no-op otherwise
//      (the treasury pays the rent, about 0.00204 SOL, only the first time).
//   2. Token program, TransferChecked: amount in raw units, with the mint and its decimals checked on chain.
// Anyone can verify a payout by opening its signature in an explorer: source = treasury token account, mint = LAUNCH_MINT.
const LAUNCH_MINT=process.env.LAUNCH_MINT||'';
const ATA_PROGRAM=new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
let mintInfo=null; // {mint, program, decimals}, read once from chain
async function launchMint(){if(mintInfo)return mintInfo;if(!LAUNCH_MINT)throw new Error('LAUNCH_MINT not set');const mint=new web3.PublicKey(LAUNCH_MINT);
  const acc=await conn.getParsedAccountInfo(mint,'confirmed');if(!acc.value)throw new Error('LAUNCH_MINT account not found');
  const program=acc.value.owner;if(!TOKEN_PROGRAMS.includes(program.toBase58()))throw new Error('LAUNCH_MINT is not an SPL token mint');
  const decimals=acc.value.data.parsed.info.decimals;const want=process.env.LAUNCH_DECIMALS;if(want!=null&&want!==''&&+want!==decimals)throw new Error(`LAUNCH_DECIMALS=${want} but the mint has ${decimals}`);
  return mintInfo={mint,program,decimals};}
function ataOf(owner,m){return web3.PublicKey.findProgramAddressSync([new web3.PublicKey(owner).toBuffer(),m.program.toBuffer(),m.mint.toBuffer()],ATA_PROGRAM)[0];}
// Treasury $LAUNCH balance in raw units (0 when its token account does not exist yet), and the slot it was read at.
async function tokenBalanceAt(owner){const m=await launchMint();const ata=ataOf(owner,m);
  const r=await conn.getTokenAccountBalance(ata,'finalized').catch(e=>{if(/could not find account|Invalid param/i.test(String(e.message)))return null;throw e;});
  const amount=r?Number(r.value.amount):0;if(!Number.isSafeInteger(amount))throw new Error('token balance too large for safe integer math');
  return{amount,slot:r?r.context.slot:null,tokenAccount:ata.toBase58(),mint:m.mint.toBase58(),decimals:m.decimals};}
const tokenBalance=async owner=>(await tokenBalanceAt(owner)).amount;
function u64(n){const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;}
function payIxs(from,to,amount,m){const owner=new web3.PublicKey(to);const src=ataOf(from,m),dst=ataOf(owner,m);
  return[new web3.TransactionInstruction({programId:ATA_PROGRAM,data:Buffer.from([1]),keys:[
      {pubkey:from,isSigner:true,isWritable:true},{pubkey:dst,isSigner:false,isWritable:true},{pubkey:owner,isSigner:false,isWritable:false},
      {pubkey:m.mint,isSigner:false,isWritable:false},{pubkey:web3.SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:m.program,isSigner:false,isWritable:false}]}),
    new web3.TransactionInstruction({programId:m.program,data:Buffer.concat([Buffer.from([12]),u64(amount),Buffer.from([m.decimals])]),keys:[
      {pubkey:src,isSigner:false,isWritable:true},{pubkey:m.mint,isSigner:false,isWritable:false},{pubkey:dst,isSigner:false,isWritable:true},{pubkey:from,isSigner:true,isWritable:false}]})];}
// Priority fee in micro-lamports per compute unit (PRIORITY_MICROLAMPORTS, default 20000). A row (create-if-missing plus
// transfer) is budgeted at 40,000 compute units, so a 5-row batch at the default costs roughly 0.000004 SOL extra.
const PRIORITY=+(process.env.PRIORITY_MICROLAMPORTS||20000);
function budget(n,per){const CB=web3.ComputeBudgetProgram;return[CB.setComputeUnitLimit({units:Math.min(1.4e6,5000+n*per)}),CB.setComputeUnitPrice({microLamports:PRIORITY})];}
// Signs first and reports the signature through onSig BEFORE anything is sent, so a crash at any later point never
// loses track of a payment (the caller persists the signature and, on restart, asks sigState before resending).
// The same signed bytes are rebroadcast every 2 s until confirmed or until the blockhash expires.
async function signAndSend(from,ixs,per,n,onSig,hook){const {blockhash,lastValidBlockHeight}=await conn.getLatestBlockhash('confirmed');
  const tx=new web3.Transaction({feePayer:from.publicKey,blockhash,lastValidBlockHeight}).add(...budget(n,per),...ixs);
  tx.sign(from);const raw=tx.serialize();if(raw.length>1232)throw new Error('batch too large');
  const sig=bs58.encode(tx.signature);if(onSig)onSig(sig,lastValidBlockHeight);
  if(hook)hook('signed');
  await conn.sendRawTransaction(raw,{skipPreflight:false,preflightCommitment:'confirmed',maxRetries:0});
  if(hook)hook('sent');
  for(let i=0;i<120;i++){await new Promise(z=>setTimeout(z,i?2000:800));
    const r=(await conn.getSignatureStatuses([sig])).value[0];
    if(r){if(r.err)throw new Error('Transaction failed: '+JSON.stringify(r.err));if(r.confirmationStatus==='confirmed'||r.confirmationStatus==='finalized')return sig;continue;}
    if((await conn.getBlockHeight('confirmed'))>lastValidBlockHeight)throw new Error('Transaction expired: '+sig);
    try{await conn.sendRawTransaction(raw,{skipPreflight:true,maxRetries:0});}catch(e){}}
  throw new Error('Confirmation timeout: '+sig);}
// $LAUNCH payouts: items [{to, amount}] in raw units.
async function transferMany(from,items,onSig,hook){const m=await launchMint();for(const it of items)if(!(Number.isSafeInteger(it.amount)&&it.amount>0))throw new Error('bad amount');
  return signAndSend(from,items.flatMap(it=>payIxs(from.publicKey,it.to,it.amount,m)),40000,items.length,onSig,hook);}
const transfer=(from,to,amount,onSig,hook)=>transferMany(from,[{to,amount}],onSig,hook);
// Plain SOL transfer, used only by the devnet-only admin fund route.
const transferSol=(from,to,lamports,onSig,hook)=>signAndSend(from,[web3.SystemProgram.transfer({fromPubkey:from.publicKey,toPubkey:new web3.PublicKey(to),lamports})],300,1,onSig,hook);
// Signs a swap transaction built by Jupiter with the treasury key. Before signing it checks that the treasury is the
// fee payer and the only required signer, so the transaction cannot spend from any other authority.
// The signature is reported through onSig before broadcast; the same bytes are rebroadcast until confirmed or expired.
async function signSendRaw(from,b64,onSig){const tx=web3.VersionedTransaction.deserialize(Buffer.from(b64,'base64'));const m=tx.message;
  if(m.header.numRequiredSignatures!==1||!m.staticAccountKeys[0].equals(from.publicKey))throw new Error('swap transaction must be paid and signed by the treasury only');
  tx.sign([from]);const raw=tx.serialize();const sig=bs58.encode(tx.signatures[0]);
  const lvh=(await conn.getLatestBlockhash('confirmed')).lastValidBlockHeight;if(onSig)onSig(sig,lvh);
  await conn.sendRawTransaction(raw,{skipPreflight:false,preflightCommitment:'confirmed',maxRetries:0});
  for(let i=0;i<90;i++){await new Promise(z=>setTimeout(z,2000));const r=(await conn.getSignatureStatuses([sig])).value[0];
    if(r){if(r.err)throw new Error('Swap failed: '+JSON.stringify(r.err));if(r.confirmationStatus==='confirmed'||r.confirmationStatus==='finalized')return sig;continue;}
    if((await conn.getBlockHeight('confirmed'))>lvh)throw new Error('Swap expired: '+sig);try{await conn.sendRawTransaction(raw,{skipPreflight:true,maxRetries:0});}catch(e){}}
  throw new Error('Swap confirmation timeout: '+sig);}
// State of an earlier payment: 'landed', 'failed', 'expired' (safe to resend) or 'unknown' (wait).
async function sigState(sig,lvh){const r=(await conn.getSignatureStatuses([sig],{searchTransactionHistory:true})).value[0];if(r)return r.err?'failed':'landed';
  if(lvh&&(await conn.getBlockHeight('confirmed'))>lvh+10)return 'expired';return 'unknown';}
module.exports={web3,conn,CLUSTER,MAINNET_ENABLED,MEMO,LAUNCH_MINT,launchMint,ataOf,payIxs,budget,tokenBalance,tokenBalanceAt,loadOrCreateKeypair,supply,holders,verifyBurn,transfer,transferMany,transferSol,signSendRaw,sigState,balance:pk=>conn.getBalance(new web3.PublicKey(pk))};
