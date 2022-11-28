# PayGasX

This is a demo project to implement a system where we can interact with an contract and pay the gas fee with customized approach rather than ETH-only.

## Overview

This demo adopted the new proposed EIP: [ERC-4337 Account Abstraction via Entry Point Contract specification](https://eips.ethereum.org/EIPS/eip-4337) to achieve the goal of using customized approach to pay for the gas fee. You could check the EIP specification in above link or the medium article [here](https://medium.com/infinitism/erc-4337-account-abstraction-without-ethereum-protocol-changes-d75c9d94dc4a). Sometimes, some users are lack of $ETH, but they may have some other payment methods such as ERC20 tokens just because they have participated in some airdrop activities previously. In the past period, they can interact with our smart contracts or their token contracts only when they have enough $ETH to pay for the transaction fee. With PayGasX, gasless users are able to interact with our smart contracts even if they only have other payment methods other than $ETH.

> Sponsored transactions provided by ERC-4337 allow application developers to pay fees on behalf of their users and also allow users to pay fees in ERC20 tokens, which needs a contract serving as an intermediary to collect ERC20s and pay in ETH.

Sponsorship with paymaster is only one feature brought by ERC-4337. Besides that, the key goal of this proposal is account abstraction. If you want to dive deep into the detail, please check their doc.

## Components

Our demo focuses on two main components: `Paymaster` and `Contract Wallet`. In this demo, we take $MASK as the payment token and the recipient contract is our contract `Redpacket`.

### Paymaster

We customized paymaster for taking $MASK as payment token.

- Check the detailed [workflow of paymaster](DOC/Workflow.md)

### Contract Wallet

Contract wallet is deployed for PayGasX users to help them manage their ERC20 assets.

## Details

- API of [`EntryPoint`](DOC/EntryPointAPI.md)

- Structure of [`UserOperation`](DOC/userOperation.md)

## GasReport

Check detail gas cost at [`GasReport.md`](./DOC/GasReport.md).

You could run the following command to generate gas report automatically.

```shell
  npm run gas-report
```

## Contribute

Any contribution is welcomed to make it better.

If you have any questions, please create an [issue](https://github.com/SpaceStation09/PayGasX/issues).

## Statement

All our work is based on the contract wallet implementation of [proofofsoulprotocol](https://github.com/proofofsoulprotocol/smart-contract-wallet-4337).

## LICENSE

[MIT LICENSE](LICENSE)
