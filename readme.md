STARCOIN 多签助手
支持发起多签交易，签名多签交易文件

## Dependencies

```
node >= 16.13.1

# cd mult-sign-helper
# yarn
```

## Environment

Create `.env` from `env.tmpl`

## Deploy 
Get help
```
yarn mult-sign-helper -h
```

Get a multi-sign address

```
yarn mult-sign-helper get-address
```

Multi-sign transaction

```
yarn mult-sign-helper sign-multisig-txn -f 0x1::TransferScripts::peer_to_peer_v2 -t 0x1::STC::STC -a 0x1A2ecc6dC8dd51FA0fF56F8BCb3F8971 -a 100 -n barnard
```
```
yarn mult-sign-helper sign-multisig-file -f /path/to/file.txn -n barnard
```