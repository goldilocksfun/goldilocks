// Payout runner: every safety check that stands between a closed epoch and real SOL transfers.
//
// The plan (who gets how many lamports) is fixed when the epoch closes and is identical in every mode.
// Modes:
//   dry   rows are marked 'dry-run'; nothing is signed or sent.
//   live  rows are signed and sent by the treasury key. On mainnet-beta this requires CLUSTER=mainnet-beta,
//         MAINNET_ENABLED=1 and PAYOUT_MODE=live together; on devnet PAYOUT_MODE=live (or the older 'devnet')
//         runs the very same code against devnet.
//
// Before any transfer the runner checks, in order: kill switch, excluded wallets, per-wallet cap, per-epoch cap,
// treasury balance (payouts + reserve). A failed check marks the epoch `held` with the reason and sends nothing;
// an admin can retry after fixing the cause. Double payment is prevented in engine.execute: each row stores its
// signature before sending and is only resent after the chain proves the old signature can never land.
'use strict';

function modeFor({payoutMode,cluster,mainnetEnabled}){
  if(payoutMode!=='live'&&payoutMode!=='devnet')return 'dry';
  if(cluster==='mainnet-beta')return payoutMode==='live'&&mainnetEnabled?'live':'dry';
  return 'live';
}

function config(env=process.env){return{
  maxPerWallet:+(env.MAX_PAYOUT_PER_WALLET_LAMPORTS||5e9),   // 5 SOL to one wallet in one epoch
  maxPerEpoch:+(env.MAX_PAYOUT_PER_EPOCH_LAMPORTS||50e9),     // 50 SOL in one epoch
  reserve:+(env.TREASURY_RESERVE_LAMPORTS||10e6),             // 0.01 SOL kept for network fees
  envPaused:env.PAYOUTS_PAUSED==='1',
};}

// Checks that do not need the network. Returns null when the epoch may be paid, or the reason it is held.
function check(e,S,cfg,exclude){
  if(cfg.envPaused||S.paused)return 'payouts paused (kill switch)';
  const owed=e.payouts.filter(p=>p.status!=='sent'&&p.status!=='excluded');
  for(const p of owed)if(exclude.has(p.wallet)){p.status='excluded';}
  const rest=owed.filter(p=>p.status!=='excluded');
  const big=rest.find(p=>p.lamports>cfg.maxPerWallet);if(big)return `payout to ${big.wallet} exceeds per-wallet cap`;
  const sum=rest.reduce((a,p)=>a+p.lamports,0);if(sum>cfg.maxPerEpoch)return 'epoch total exceeds per-epoch cap';
  return null;
}

// run(e, ctx): ctx = {E, S, save, mode, chain, treasury, exclude:Set, ledger, cfg, hook}
async function run(e,ctx){const {E,S,save,mode,chain,treasury,exclude,ledger,hook}=ctx;const cfg=ctx.cfg||config();
  const why=check(e,S,cfg,exclude||new Set());
  e.mode=mode;
  if(why){e.held=why;save();return e;}
  if(mode==='live'){
    const owed=e.payouts.filter(p=>p.status!=='sent'&&p.status!=='excluded'&&!p.sig).reduce((a,p)=>a+p.lamports,0);
    let bal;try{bal=await chain.balance(treasury.publicKey.toBase58());}catch(x){e.held='balance check failed: '+String(x.message).slice(0,80);save();return e;}
    if(bal<owed+cfg.reserve){e.held=`treasury balance ${bal} below payouts ${owed} plus reserve ${cfg.reserve}`;save();return e;}
  }
  delete e.held;save();
  const send=(w,l,onSig)=>chain.transfer(treasury,w,l,onSig,hook);
  const sendMany=(items,onSig)=>chain.transferMany(treasury,items,onSig,hook);
  await E.execute(e,mode==='live'?'devnet':'dry',send,chain&&chain.sigState,sendMany,ledger);
  return e;}

module.exports={modeFor,config,check,run};
