// $LAUNCH transfer instructions built offline: create-if-missing plus TransferChecked, correct accounts and data, batch fits a transaction.
'use strict';const assert=require('assert');const C=require('./lib/chain');const w=C.web3;
const TOKEN=new w.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');const m={mint:w.Keypair.generate().publicKey,program:TOKEN,decimals:6};
const from=w.Keypair.generate();const to=w.Keypair.generate().publicKey.toBase58();
const [cr,tr]=C.payIxs(from.publicKey,to,1234567,m);
assert.equal(cr.programId.toBase58(),'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');assert.deepEqual([...cr.data],[1]);assert.equal(cr.keys[1].pubkey.toBase58(),C.ataOf(to,m).toBase58());console.log('ok create-idempotent targets the winner token account');
assert.equal(tr.programId.toBase58(),TOKEN.toBase58());assert.equal(tr.data[0],12);assert.equal(tr.data.readBigUInt64LE(1),1234567n);assert.equal(tr.data[9],6);
assert.equal(tr.keys[0].pubkey.toBase58(),C.ataOf(from.publicKey,m).toBase58());assert.equal(tr.keys[1].pubkey.toBase58(),m.mint.toBase58());assert(tr.keys[3].isSigner);console.log('ok TransferChecked from the treasury token account with amount and decimals');
const n=+(process.env.PAYOUT_BATCH||5);const tx=new w.Transaction({feePayer:from.publicKey,blockhash:w.Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:1}).add(...C.budget(n,40000));
for(let i=0;i<n;i++)tx.add(...C.payIxs(from.publicKey,w.Keypair.generate().publicKey.toBase58(),1e6,m));tx.sign(from);const len=tx.serialize().length;assert(len<=1232,'batch '+len);console.log('ok batch of',n,'rows is',len,'bytes (limit 1232)');
console.log('PASS spl tests');
