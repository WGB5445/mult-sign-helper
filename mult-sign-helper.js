import yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import { getMultiAccount,signmultisigtxn,signmultisigfile,deploy } from './src/mult-utls.js';


const arg = hideBin(process.argv)
yargs(arg)
    .usage('mult-sign-helper: [command] <options>')
    .strict(false)
    .alias('h', 'help')
    .alias('v',"version")
    .command('sign-multisig-txn', '执行交易并生成签名文件',(yargs)=> {
            yargs.option( "function", {
                type:'string',
                alias: 'f',
                describe: '需要执行的脚本函数'
            }),
            yargs.option( "type_tag", {
                type:'string',
                alias: 't',
                describe: '需要传入的泛型类型'
            }),
            yargs.option( "arg", {
                type:'string',
                alias:'a',
                describe: '需要传入的函数参数'
            }),
            yargs.option('network',{
                type:'string',
                alias: 'n',
                describe: '指定网络'
            })
        },async (argv) =>{
            await signmultisigtxn(argv)
            process.exit(0);
        }
    )
    .command('sign-multisig-file', '对多签交易文件进行签名',(yargs)=> {
            yargs.option( "file", {
                type:'string',
                alias: 'f',
                describe: '需要签名的文件'
            }),
            yargs.option('network',{
                type:'string',
                alias: 'n',
                describe: '指定网络'
            })
        },async (argv) =>{
            await signmultisigfile(argv)
            process.exit(0);
        }
    )
    .command('deploy','使用多签部署二进制 blob 合约  ' ,(yargs)=>{
        yargs.option("file",{
            type:'string',
            alias:'f',
            describe:'需要部署的 blob '
        }),
        yargs.option('network',{
            type:'string',
            alias: 'n',
            describe: '指定网络'
        })
        },async  (argv) =>{
            await deploy(argv)
            process.exit(0);
        }
    )
    .command('get-address','根据 .env 文件生成对应的多签地址',(yargs)=>{
            
    },async (argv) =>  {
        try{
            const { sender } = await getMultiAccount();
            console.log(`✅ Get multi-sign Address: ${sender}`);
        }catch(e){
            console.log(`❌ 出现错误：请检查 私钥 和 公钥 的配置 ${e}`);
        }

        process.exit(0);
        }
    )
    .version('version','Starcoin 多签工具','Starcoin 多签工具 v0.0.1')
    .epilogue('')
    .argv