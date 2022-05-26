import { 
    utils,
    encoding,
    starcoin_types 
} from '@starcoin/starcoin';
import { 
    hexlify,
    arrayify,
} from '@ethersproject/bytes';
import dotenv from 'dotenv';
import {Config} from './config.js';
import {utils as ed25519Utils} from '@noble/ed25519';
import inquirer from 'inquirer';
import  { readFileSync,writeFileSync } from 'node:fs';
import  exp from 'constants';


dotenv.config()
export  async function getMultiAccount () {
    const shardAccount = await utils.multiSign.generateMultiEd25519KeyShard(
        process.env.PUBLIC_KEYS.split(','),
        process.env.PRIVATE_KEY.split(','),
        process.env.THRESHOLD,
    );
    const account = utils.account.showMultiEd25519Account(shardAccount);
    return { shardAccount, sender: account.address }  
};

const writeTxn = (txn) => {
    const name = Buffer.from(ed25519Utils.randomPrivateKey()).toString('hex').slice(0, 8);
    const filename = `${ name }.multisig-txn`;
    writeFileSync(filename, arrayify(encoding.bcsEncode(txn)));
    console.log(`{  "ok": "${ filename }"   }`)
    return filename;
};


const readHexFromFile = (filename) => {
    const rbuf = readFileSync(filename);
    return hexlify(rbuf);
};


const readTxn = (filename) => {
    const hex = readHexFromFile(filename);
    return encoding.bcsDecode(starcoin_types.SignedUserTransaction, hex);
};


const signMultiTxn = (shardAccount, signatureShard, rawTransaction) => {
    const threshold = signatureShard.threshold;
    const address = encoding.addressFromSCS(rawTransaction.sender);
    const authenticator = new starcoin_types.TransactionAuthenticatorVariantMultiEd25519(
        shardAccount.publicKey(),
        signatureShard.signature,
    );

    if (signatureShard.is_enough()) {
        console.log(`multisig txn(address: ${address}): enough signatures collected for the multisig txn, txn can be submitted now`);
    } else {
        const count = signatureShard.signature.signatures.length;
        console.log(`multisig txn(address: ${address}): ${count} signatures collected still require ${threshold-count} signatures`);
    };
    return new starcoin_types.SignedUserTransaction(rawTransaction, authenticator);
};


const mergeMultiTxn = async (shardAccount, rawSignatureShard) => {
    const rawTransaction = rawSignatureShard.raw_txn;
    const rawAuthenticator = rawSignatureShard.authenticator;
    const threshold = rawAuthenticator.public_key.threshold;

    // raw
    const rawSignatureShards = new starcoin_types.MultiEd25519SignatureShard(rawAuthenticator.signature, threshold);
    
    // new
    const signatureShard = await utils.multiSign.generateMultiEd25519SignatureShard(shardAccount, rawTransaction);
    const newSignatureShards = new starcoin_types.MultiEd25519SignatureShard(signatureShard.signature, threshold);
    // merge
    const mergedSignatureShards = starcoin_types.MultiEd25519SignatureShard.merge([rawSignatureShards, newSignatureShards]);

    const enough = mergedSignatureShards.is_enough();
    const txn = signMultiTxn(shardAccount, mergedSignatureShards, rawTransaction);
    return { enough, txn };
};
export function checkarg (argv){
    const commands = new Map([
        ['sign-multisig-txn',true],
        ['sign-multisig-file',true],
        ['deploy',true],
    ]);
    const file_cmds = new Map([
        ['sign-multisig-file',true],
        ['deploy',true],
    ]);
    if( argv._.length >= 1 || commands.get(argv._.at(0)) ){
        if(file_cmds.get(argv._.at(0))){
            if(! argv.file ){
                throw "参数错误:请输入 file 参数"
            }
        }else if(argv._.at(0) == 'sign-multisig-txn'){
            if(! argv.function){
                throw "参数错误:请输入 function 参数"
            }
        }
        if( argv.network == 'local'){
            if(! argv.chainId){
                throw "参数错误:请输入 chainId 参数,指定本地网络的 chainid"
            }
            if(! argv.url){
                throw "参数错误:请输入 url 参数,指定本地网络的连接方式"
            }
        }

    }
    
}
export  async function signmultisigtxn (argv){
    
    let functionId = argv.function
    let typeArgs

    if(argv.type_tag == undefined){
        typeArgs = []
    }else if(argv.type_tag.constructor != Array ){
        typeArgs = [argv.type_tag]
    }else{
        typeArgs = argv.type_tag
    }
    let args

    
    if(argv.args == undefined){
        args = []
    }else if(argv.arg.constructor != Array ){
        args = [argv.arg]
    }else{
        args = argv.arg
    }

    let network = argv.network
    let chainId = argv.chainId
    let provider ;
    let  config 

    if( argv.network == 'local'){
        provider = new providers.WebsocketProvider( argv.url );
        config = Config.networks['development'];
    }else{
        config = Config.networks[network];
        provider = config.provider();
    }

    const { shardAccount, sender } = await getMultiAccount();
    
    let scriptFunction = await utils.tx.encodeScriptFunctionByResolve(functionId, typeArgs, args, config.url);
    const senderSequenceNumber = await provider.getSequenceNumber(
        sender
    ) || 0;
    const maxGasAmount = 40000000n;
    const gasUnitPrice = 10;
    const nowSeconds = await provider.getNowSeconds();
    const expiredSecs = 43200
    const expirationTimestampSecs = nowSeconds + expiredSecs
    const rawUserTransaction = utils.tx.generateRawUserTransaction(
        sender,
        scriptFunction,
        maxGasAmount,
        gasUnitPrice,
        senderSequenceNumber,
        expirationTimestampSecs,
        config.chainId
    );

    const signatureShard = await utils.multiSign.generateMultiEd25519SignatureShard(shardAccount, rawUserTransaction)
    const authenticator = new starcoin_types.TransactionAuthenticatorVariantMultiEd25519(shardAccount.publicKey(), signatureShard.signature)
    const partial_signed_txn = new starcoin_types.SignedUserTransaction(rawUserTransaction, authenticator)
    // console.log({ partial_signed_txn })
    // console.log(partial_signed_txn.authenticator)
    const filename = (function () {
        const privateKeyBytes = ed25519Utils.randomPrivateKey();
        const name = Buffer.from(privateKeyBytes).toString('hex').slice(0, 8);
        return `${ name }.multisig-txn`
    })();
    try {
        const partial_signed_txn_hex =encoding.bcsEncode(partial_signed_txn);
        writeFileSync(filename, arrayify(partial_signed_txn_hex));
        console.log(`✅ 成功生成签名文件: ${filename}`);
    } catch (error) {
        console.log(error);
    }

};



const askQuestions = async () => {
    const questions = [
        {
        type: "confirm",
        name: "confirm",
        message: "当前多签交易已经有足够的签名 请确认是否广播该交易 ?",
        }
    ];
    return inquirer.prompt(questions);
};




export  async function  signmultisigfile  (argv) {
    let network = argv.network
    let file = argv.file
    let provider ;
    let  config 
    if( argv.network == 'local'){
        provider = new providers.WebsocketProvider( argv.url );
        config = Config.networks['development'];
    }else{
        config = Config.networks[network];
        provider = config.provider();
    }
    

    const balanceOf = async (address, tokenType='0x1::STC::STC') => {
        let balance = await provider.getBalance(address, tokenType);
        return balance / (10 ** 9);
    };

    const timed = `✅ Transaction Multi ${file}`;
    console.time(timed);

    const { shardAccount, sender } = await getMultiAccount();

    const { enough, txn } = await mergeMultiTxn(shardAccount, readTxn(file));
    const newFilename = await writeTxn(txn);
    if (enough) {
       await askQuestions().then(async (answers)  =>  {
            if(answers.confirm){
                console.log("正在广播交易.....")
                const before_b = await balanceOf(sender);
                const signedUserTransactionHex = readHexFromFile(newFilename);
                const txn = await provider.sendTransaction(signedUserTransactionHex);
                const txnInfo = await txn.wait(1);
                const after_b = await balanceOf(sender);
                console.log(
                    `👍 Success ${txnInfo.status}`,
                    `${config.stcscan}${txnInfo.transaction_hash}`,
                    `Gas: ${before_b - after_b}`,
                )
            }else{
                console.log("取消交易")
            }
        });
        

    } else {
        console.log(
            `👍 Success transaction with multi-sign`,
            `txn file: ${newFilename}`,
        )
    };
    console.timeEnd(timed);

    // await sendToDiscord(`Done ${network} multi-sign job.`);

    if (network == "development") {
        provider.destroy();
    };
};

export  async function deploy  (argv){
    
    let network = argv.network
    let file = argv.file
    let chainId = argv.chainId
    let provider ;
    let  config 
    if( argv.network == 'local'){
        provider = new providers.WebsocketProvider( argv.url );
        config = Config.networks['development'];
    }else{
        config = Config.networks[network];
        provider = config.provider();
    }

    const { shardAccount, sender } = await getMultiAccount();
    const hex = readHexFromFile(file);
    const senderSequenceNumber = await provider.getSequenceNumber(
        sender
    ) || 0;
    const maxGasAmount = 40000000n;
    const gasUnitPrice = 10;
    const nowSeconds = await provider.getNowSeconds();
    const expiredSecs = 43200
    const expirationTimestampSecs = nowSeconds + expiredSecs
    const transactionPayload = encoding.packageHexToTransactionPayload(hex)

    const rawUserTransaction = utils.tx.generateRawUserTransaction(
        sender,
        transactionPayload,
        maxGasAmount,
        gasUnitPrice,
        senderSequenceNumber,
        expirationTimestampSecs,
        chainId
    );
   
    const signatureShard = await utils.multiSign.generateMultiEd25519SignatureShard(shardAccount, rawUserTransaction)
    const authenticator = new starcoin_types.TransactionAuthenticatorVariantMultiEd25519(shardAccount.publicKey(), signatureShard.signature)
    const partial_signed_txn = new starcoin_types.SignedUserTransaction(rawUserTransaction, authenticator)

    
    const filename = (function () {
        const privateKeyBytes = ed25519Utils.randomPrivateKey();
        const name = Buffer.from(privateKeyBytes).toString('hex').slice(0, 8);
        return `${ name }.multisig-txn`
    })();
    try {
        const partial_signed_txn_hex =encoding.bcsEncode(partial_signed_txn);
        writeFileSync(filename, arrayify(partial_signed_txn_hex));
        console.log(`✅ 成功生成签名文件: ${filename}`);
    } catch (error) {
        console.log(error);
    }
};