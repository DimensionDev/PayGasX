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
| Transfer ETH   |   21000    |         63667          |       140244        |
| Approve ERC20  |   46196    |         58704          |       117525        |
| Transfer ERC20 |   51542    |         63678          |       122551        |
| Mint ERC721    |   93527    |         88393          |       147208        |

<!-- end Wallet -->

### Redpacket Related Operation

<!-- begin Paymaster -->

|        | EOA Wallet | 4337 Wallet with Paymaster |
| ------ | :--------: | :------------------------: |
| create |   149930   |           304920           |
| claim  |   88238    |           191117           |

<!-- end Paymaster -->
