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

## Deployed Contract Address

<!-- begin PayGasX -->

| Chain        | MaskToken                       | EntryPoint                      | DepositPaymaster                 | VerifyingPaymaster               | WalletLogic                     | PresetFactory                   | NativeTokenPaymaster             |
| ------------ | ------------------------------- | ------------------------------- | -------------------------------- | -------------------------------- | ------------------------------- | ------------------------------- | -------------------------------- |
| matic_mumbai | [`0xF8935Df6`][mt-matic_mumbai] | [`0x8A42F700`][ep-matic_mumbai] | [`0x808c7f48`][dpm-matic_mumbai] | [`0xB349AC5E`][vpm-matic_mumbai] | [`0x1324ee1F`][wl-matic_mumbai] | [`0xd7E46dEA`][pf-matic_mumbai] | [`0x8C2306B8`][ntp-matic_mumbai] |
| matic        | [`0x2b9e7ccd`][mt-matic]        | [`0x43B87595`][ep-matic]        | [`0x46a47fEf`][dpm-matic]        | [`0x540dcAc6`][vpm-matic]        | [`0xa835e7eb`][wl-matic]        | [`0xce822a59`][pf-matic]        | [`0x0B81e2d6`][ntp-matic]        |

[mt-matic_mumbai]: https://mumbai.polygonscan.com/address/0xF8935Df67cAB7BfcA9532D1Ac2088C5c39b995b5
[mt-matic]: https://polygonscan.com/address/0x2b9e7ccdf0f4e5b24757c1e1a80e311e34cb10c7
[ep-matic_mumbai]: https://mumbai.polygonscan.com/address/0x8A42F70047a99298822dD1dbA34b454fc49913F2
[ep-matic]: https://polygonscan.com/address/0x43B87595F319B17F3386Ac244A00944B3f5A532A
[dpm-matic_mumbai]: https://mumbai.polygonscan.com/address/0x808c7f48a64404e4e97d9b62b21f13F984fF1a96
[dpm-matic]: https://polygonscan.com/address/0x46a47fEf332FBB124D8197afFED5994D89B6BF71
[vpm-matic_mumbai]: https://mumbai.polygonscan.com/address/0xB349AC5E5C037C2ecb2AE9fCDc8F122b5f384620
[vpm-matic]: https://polygonscan.com/address/0x540dcAc69cfFD35e2afDDdf610Ba8E7b2A917E6E
[wl-matic_mumbai]: https://mumbai.polygonscan.com/address/0x1324ee1F3E982FD66579e2320c060B4e5f71579a
[wl-matic]: https://polygonscan.com/address/0xa835e7ebe39107907d7f58d459945979f86a34ad
[pf-matic_mumbai]: https://mumbai.polygonscan.com/address/0xd7E46dEAF827c0023284407e9f1bb1FA27Bf8447
[pf-matic]: https://polygonscan.com/address/0xce822a5904ef877caf11aaa02ccf4ab13f18dfb6
[ntp-matic_mumbai]: https://mumbai.polygonscan.com/address/0x8C2306B8C31c7eC78078e1C5C53dE6fee1627BF7
[ntp-matic]: https://polygonscan.com/address/0x0B81e2d66F6c52AaAEa836240f63e1b43643B5f9

<!-- end PayGasX -->

## Contribute

Any contribution is welcomed to make it better.

If you have any questions, please create an [issue](https://github.com/SpaceStation09/PayGasX/issues).

## Statement

All our work is based on the contract wallet implementation of [proofofsoulprotocol](https://github.com/proofofsoulprotocol/smart-contract-wallet-4337).

## LICENSE

[MIT LICENSE](LICENSE)
