# Gas Report

## Deployment Gas Report

1. SimpleWallet : 970841
2. SimpleWalletUpgradeable(one time): 1012766
3. ERC1967 Proxy Wallet: 503475

## Usage Gas Report

### ERC20 Related Operation

<!-- begin Wallet -->

|                | EOA Wallet | 4337 Wallet without EP | 4337 Wallet with EP | 4337 Wallet with EP Deploy Wallet\* |
| -------------- | :--------: | :--------------------: | :-----------------: | :---------------------------------: |
| Transfer ETH   |   21000    |         63667          |       140335        |               578072                |
| Approve ERC20  |   46196    |         58838          |        97658        |               576065                |
| Transfer ERC20 |   51406    |         63676          |       122480        |               579536                |
| Mint ERC721    |   71649    |         83837          |       142573        |               557995                |

<!-- end Wallet -->

\*: Deploy 4337 contract wallet in the first UserOp of this contract wallet.

### Redpacket Related Operation

<!-- begin Paymaster -->

|        | EOA Wallet | 4337 Wallet with Paymaster |
| ------ | :--------: | :------------------------: |
| create |   149688   |           297431           |
| claim  |   87925    |           183619           |

<!-- end Paymaster -->
