// Payout runner: every safety check that stands between a closed epoch and real $LAUNCH transfers.
//
// Rewards are paid in $LAUNCH (SPL token, mint LAUNCH_MINT). Amounts are raw token units. Each transfer is a
// TransferChecked from the treasury's $LAUNCH token account to the winner's associated token account, which is
// created in the same transaction when missing (the treasury pays the rent in SOL).
//
// The plan (who gets how many units) is fixed when the epoch closes and is identical in every mode.
// Modes:
//   dry   rows are marked 'dry-run'; nothing is signed or sent.
//   live  rows are signed and sent by the treasury key. On mainnet-beta this requires CLUSTER=mainnet-beta,
//         MAINNET_ENABLED=1 and PAYOUT_MODE=live together; on devnet PAYOUT_MODE=live (or the older 'devnet')
//         runs the very same code against devnet.
//
// Before any transfer the runner checks, in order: kill switch, excluded wallets, per-wallet cap, per-epoch cap,
// treasury $LAUNCH balance (must cover every unsent row), treasury SOL balance (network fees plus token account rent
// plus a reserve). A failed check marks the epoch `held` with the reason and sends nothing; an admin can retry after
// fixing the cause. Double payment is prevented in engine.execute: each row stores its signature before sending and
// is only resent after the chain proves the old signature can never land.
'use strict';

function modeFor({payoutMode,cluster,mainnetEnabled}){
  if(payoutMode!=='live'&&payoutMode!=='devnet')return 'dry';
  if(cluster==='mainnet-beta')return payoutMode==='live'&&mainnetEnabled?'live':'dry';
  return 'live';
}

const num=(env,k,d)=>env[k]!=null&&env[k]!==''?+env[k]:d;
function config(env=process.env){const dec=num(env,'LAUNCH_DECIMALS',6);return{
  maxPerWallet:num(env,'MAX_PAYOUT_PER_WALLET_UNITS',num(env,'MAX_PAYOUT_PER_WALLET_LAUNCH',5e6)*10**dec),  // default 5,000,000 $LAUNCH to one wallet per epoch
  maxPerEpoch:num(env,'MAX_PAYOUT_PER_EPOCH_UNITS',num(env,'MAX_PAYOUT_PER_EPOCH_LAUNCH',50e6)*10**dec),    // default 50,000,000 $LAUNCH per epoch
  solReserve:num(env,'TREASURY_SOL_RESERVE_LAMPORTS',num(env,'TREASURY_RESERVE_LAMPORTS',20e6)),             // 0.02 SOL always kept for fees
  solPerRow:num(env,'SOL_PER_PAYOUT_LAMPORTS',2.1e6),  // worst case per row: new token account rent (~0.00204 SOL) plus fees
  envPaused:env.PAYOUTS_PAUSED==='1',
};}

// Checks that do not need the network. Returns null when the epoch may be paid, or the reason it is held.
function check(e,S,cfg,exclude){
  if(cfg.envPaused||S.paused)return 'payouts paused (kill switch)';
  const owed=e.payouts.filter(p=>p.status!=='sent'&&p.status!=='excluded'&&p.status!=='legacy-unpaid');
  for(const p of owed)if(exclude.has(p.wallet)){p.status='excluded';}
  const rest=owed.filter(p=>p.status!=='excluded');
  const big=rest.find(p=>p.amount>cfg.maxPerWallet);if(big)return `payout to ${big.wallet} exceeds per-wallet cap`;
  const sum=rest.reduce((a,p)=>a+p.amount,0);if(sum>cfg.maxPerEpoch)return 'epoch total exceeds per-epoch cap';
  return null;
}

// run(e, ctx): ctx = {E, S, save, mode, chain, treasury, exclude:Set, ledger, cfg, hook}
// chain must provide tokenBalance(owner) -> raw units (number), balance(owner) -> lamports,
// transfer(from,to,amount,onSig,hook), transferMany(from,[{to,amount}],onSig,hook), sigState(sig,lvh).
async function run(e,ctx){const {E,S,save,mode,chain,treasury,exclude,ledger,hook}=ctx;const cfg=ctx.cfg||config();
  const why=check(e,S,cfg,exclude||new Set());
  e.mode=mode;
  if(why){e.held=why;save();return e;}
  if(mode==='live'){
    const rows=e.payouts.filter(p=>p.status!=='sent'&&p.status!=='excluded'&&p.status!=='legacy-unpaid'&&!p.sig);
    const owed=rows.reduce((a,p)=>a+p.amount,0);const t=treasury.publicKey.toBase58();
    let tok,sol;try{[tok,sol]=await Promise.all([chain.tokenBalance(t),chain.balance(t)]);}catch(x){e.held='balance check failed: '+String(x.message).slice(0,80);save();return e;}
    if(tok<owed){e.held=`treasury $LAUNCH balance ${tok} below payouts ${owed}`;save();return e;}
    const needSol=cfg.solReserve+rows.length*cfg.solPerRow;
    if(sol<needSol){e.held=`treasury SOL balance ${sol} below fees and rent ${needSol}`;save();return e;}
  }
  delete e.held;save();
  const send=(w,a,onSig)=>chain.transfer(treasury,w,a,onSig,hook);
  const sendMany=(items,onSig)=>chain.transferMany(treasury,items,onSig,hook);
  await E.execute(e,mode==='live'?'devnet':'dry',send,chain&&chain.sigState,sendMany,ledger);
  return e;}

module.exports={modeFor,config,check,run};
