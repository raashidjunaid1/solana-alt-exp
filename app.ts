import bs58 from 'bs58'
import { Wallet } from '@project-serum/anchor'

import { AddressLookupTableProgram, clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
    createTransferCheckedInstruction,
    TOKEN_PROGRAM_ID,
    transferChecked,
  } from "@solana/spl-token";

require('dotenv').config()

const connection = new Connection(clusterApiUrl('devnet'));

export const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || '';
export const USER_PRIVATE_KEY = bs58.decode(WALLET_PRIVATE_KEY);

const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(WALLET_PRIVATE_KEY)))
export const USER_PUBLIC_KEY = wallet.payer.publicKey

export const SIGNER_WALLET = Keypair.fromSecretKey(USER_PRIVATE_KEY);
const DESTINATION_WALLET = Keypair.generate()
const LOOKUP_TABLE_ADDRESS = new PublicKey("8GaE83Nn3dBtHBEbSn7onFVxGkcq5k3CYr32BsYyXr8");
const LOOKUP_TABLE_ADDRESS_2 = new PublicKey("9eRR85qfRTQ6KeLwkcsYwgFFtTPzoQzcwumaZmKsEn28");

async function createAndSendV0Tx(txInstructions: TransactionInstruction[]) {
    let latestBlockhash = await connection.getLatestBlockhash('finalized');

    const messageV0 = new TransactionMessage({
        payerKey: SIGNER_WALLET.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: txInstructions
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);

    transaction.sign([SIGNER_WALLET]);

    const txid = await connection.sendTransaction(transaction, { maxRetries: 5, skipPreflight: true });

    const confirmation = await connection.confirmTransaction({
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}

async function createLookupTable() {
    const [lookupTableInst, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
            authority: SIGNER_WALLET.publicKey,
            payer: SIGNER_WALLET.publicKey,
            recentSlot: await connection.getSlot(),
        });
    console.log("Lookup Table Address:", lookupTableAddress.toBase58());
    createAndSendV0Tx([lookupTableInst]);
}

async function addAddressesToTable() {
    const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: SIGNER_WALLET.publicKey,
        authority: SIGNER_WALLET.publicKey,
        lookupTable: LOOKUP_TABLE_ADDRESS_2,
        addresses: [
            new PublicKey('EU1d1SnATFKXP3DnmrKTrVXbLBHEDhbgFf5un1fHJZ5b'),
            new PublicKey('wQ3W4v2VXLRYMF8RP69oFj1Jidq2EcEnpFSMsT4bh9N'),
            new PublicKey('8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN'),
        ],
    });

    await createAndSendV0Tx([addAddressesInstruction]);
    console.log(`Lookup Table Entries: `,`https://explorer.solana.com/address/${LOOKUP_TABLE_ADDRESS.toString()}/entries?cluster=devnet`)
}

async function findAddressesInTable() {
    const lookupTableAccount = await connection.getAddressLookupTable(LOOKUP_TABLE_ADDRESS)

    if (!lookupTableAccount.value) return;

    for (let i = 0; i < lookupTableAccount.value.state.addresses.length; i++) {
        const address = lookupTableAccount.value.state.addresses[i];
        console.log(`   Address ${(i + 1)}: ${address.toBase58()}`);
    }
}

async function compareTxSize() {
    const lookupTable_2 = (await connection.getAddressLookupTable(LOOKUP_TABLE_ADDRESS_2)).value;
    const lookupTable = (await connection.getAddressLookupTable(LOOKUP_TABLE_ADDRESS)).value;

    if (!lookupTable) return;
    if (!lookupTable_2) return;

    const txInstructions: TransactionInstruction[] = [];
    // for (let i = 0; i < lookupTable.state.addresses.length; i++) {
    //     const address = lookupTable.state.addresses[i];
    //     txInstructions.push(
    //         SystemProgram.transfer({
    //             fromPubkey: SIGNER_WALLET.publicKey,
    //             toPubkey: address,
    //             lamports: 0.01 * LAMPORTS_PER_SOL,
    //         })
    //     )
    // }

    txInstructions.push(
        createTransferCheckedInstruction(
            new PublicKey('EU1d1SnATFKXP3DnmrKTrVXbLBHEDhbgFf5un1fHJZ5b'), // from (should be a token account)
            new PublicKey('8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN'), // mint
            new PublicKey('wQ3W4v2VXLRYMF8RP69oFj1Jidq2EcEnpFSMsT4bh9N'), // to (should be a token account)
            new PublicKey('GV1GgNYgqFjjwZfEbsZ4PQNSC3Yzd2pt8wyfkrZp6xn3'), // from's owner
            1e6, // amount, if your deciamls is 8, send 10^8 for 1 token
            6 // decimals
          )
    )

    let latestBlockhash = await connection.getLatestBlockhash('finalized');

    const messageWithLookupTable = new TransactionMessage({
        payerKey: SIGNER_WALLET.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: txInstructions
    }).compileToV0Message([lookupTable, lookupTable_2]);
    
    const transactionWithLookupTable = new VersionedTransaction(messageWithLookupTable);
    transactionWithLookupTable.sign([SIGNER_WALLET]);

    const txid = await connection.sendTransaction(transactionWithLookupTable, { maxRetries: 5, skipPreflight: true });
    
    await connection.confirmTransaction({
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}

compareTxSize();


// 256 address
