import yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import { getMultiAccount,signmultisigtxn,signmultisigfile,deploy,checkarg } from './src/mult-utls.js';
import chalk  from "chalk";
import figlet  from "figlet";
function init ()  {
    
    console.log(
      chalk.green(
        figlet.textSync("STC mult helper", {
          font: "Standard",
          horizontalLayout: "universal smushing",
          verticalLayout: "universal smushing",
          width:80
        })
      )
    );
  };
init()

const arg = hideBin(process.argv)
yargs(arg)
    .usage('mult-sign-helper: [command] <options>')
    .strict(true)
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
                describe: '指定网络,如果指定 local 则还需要指定选项 --chainId 或 -i 指定 Chainid',
                default: 'mainnet',
            }),
            yargs.option('chainId',{
                type:'number',
                alias: 'i',
                describe: '指定网络 chainid ,如果指定 local 必须指定此选项 ',
                default: 1
            }),
            yargs.option('url',{
                type:'string',
                alias: 'u',
                describe: '指定网络链接方式 示例 ws://127.0.0.1:9870  ,如果指定 local 必须指定此选项 ',
                default:'ws://127.0.0.1:9870'
            }),
            yargs.choices('network', ['mainnet', 'barnard','development','local'])
            yargs.choices('chainId', [1,251,254 ])
        },async (argv) =>{
            try{
                checkarg(argv)
                await signmultisigtxn(argv)
            }catch(e){
                console.log(chalk.red(e))
            }
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
                describe: '指定网络,如果指定 local 则还需要指定选项 --chainId 或 -i 指定 Chainid',
                default: 'mainnet',
            }),
            yargs.option('chainId',{
                type:'number',
                alias: 'i',
                describe: '指定网络 chainid ,如果指定 local 必须指定此选项 ',
                default: 1
            }),
            yargs.option('url',{
                type:'string',
                alias: 'u',
                describe: '指定网络链接方式 示例 ws://127.0.0.1:9870  ,如果指定 local 必须指定此选项 ',
                default:'ws://127.0.0.1:9870'
            }),
            yargs.choices('network', ['mainnet', 'barnard','development','local'])
            yargs.choices('chainId', [1,251,254 ])
        },async (argv) =>{
            try{
                checkarg(argv)
                await signmultisigfile(argv)
            }catch(e){
                console.log(chalk.red(e))
            }
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
            describe: '指定网络,如果指定 local 则还需要指定选项 --chainId 或 -i 指定 Chainid',
            default: 'mainnet',
        }),
        yargs.option('chainId',{
            type:'number',
            alias: 'i',
            describe: '指定网络 chainid ,如果指定 local 必须指定此选项 ',
            default: 1
        }),
        yargs.option('url',{
            type:'string',
            alias: 'u',
            describe: '指定网络链接方式 示例 ws://127.0.0.1:9870  ,如果指定 local 必须指定此选项 ',
            default:'ws://127.0.0.1:9870'
        }),
        yargs.choices('network', ['mainnet', 'barnard','development','local'])
        yargs.choices('chainId', [1,251,254 ])
        },async  (argv) =>{
            try{
                checkarg(argv)
                await deploy(argv)
            }catch(e){
                console.log(chalk.red(e))
            }
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