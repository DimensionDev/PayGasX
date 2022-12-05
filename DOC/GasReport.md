# Gas Report

## Deployment Gas Report

1. SimpleWallet : 970841
2. SimpleWalletUpgradeable(one time): 1012766
3. ERC1967 Proxy Wallet: 503475

## Usage Gas Report

### ERC20 Related Operation

<!-- begin Wallet -->

|                | EOA Wallet | 4337 Wallet without EP | 4337 Wallet with EP |
| -------------- | :--------: | :--------------------: | :-----------------: |
| Transfer ETH   |   21000    |         63667          |       140315        |
| Approve ERC20  |   46196    |         58838          |       100426        |
| Transfer ERC20 |   51542    |         63812          |       122604        |
| Mint ERC721    |   71479    |         83667          |       142403        |

<!-- end Wallet -->

### Redpacket Related Operation

<!-- begin Paymaster -->

|        | EOA Wallet | 4337 Wallet with Paymaster |
| ------ | :--------: | :------------------------: |
| create |   149930   |           304893           |
| claim  |   88218    |           191144           |

<!-- end Paymaster -->
