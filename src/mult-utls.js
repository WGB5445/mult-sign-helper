const {
    utils,
    encoding,
    starcoin_types
} = require('@starcoin/starcoin');

const {
    hexlify,
    arrayify,
} = require('@ethersproject/bytes');

require('dotenv').config();
const Config = require('./config');

const {
    utils:ed25519Utils,
} = require('@noble/ed25519');

const {
    readFileSync,
    writeFileSync,
} = require('fs');
const exp = require('constants');


const getMultiAccount = async () => {
    const shardAccount = await utils.multiSign.generateMultiEd25519KeyShard(
        process.env.PUBLIC_KEYS.split(','),
        process.env.PRIVATE_KEY.split(','),
        process.env.THRESHOLD,
    );
    const account = utils.account.showMultiEd25519Account(shardAccount);
    return { shardAccount, sender: account.address }  
};

exports.getMultiAccount = getMultiAccount


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

exports.signmultisigtxn = async (argv)=>{
    let functionId = argv.function
    let typeArgs
    if(argv.type_tag.constructor != Array){
        typeArgs = [argv.type_tag]
    }else{
        typeArgs = argv.type_tag
    }
    let args
    if(argv.arg.constructor != Array){
        args = [argv.arg]
    }else{
        args = argv.arg
    }

    let network = argv.network

    const config = Config.networks[network];
    
    const provider = config.provider();
    
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


const inquirer = require('inquirer');
const { argv } = require('process');
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




exports.signmultisigfile = async (argv)=>{
    let network = argv.network
    let file = argv.file
    const config = Config.networks[network];
    const provider = config.provider();

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

exports.deploy = async (argv)=>{
    let network = argv.network
    let file = argv.file
    console.log(file)
    const config = Config.networks[network];
    const provider = config.provider();
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