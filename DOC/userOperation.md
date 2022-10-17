# User Operation Data Structure

| Field                | Type    | Description                                                                                                                             |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| sender               | address | The contract wallet making the operation                                                                                                |
| nonce                | uint256 | Help prevent replay of `UserOperation`, also used as the salt for contract wallet creation                                              |
| initCode             | bytes   | The initCode of contract wallet (only needed when the contract wallet is not deployed and need to be created in this `UserOperation`)   |
| callData             | bytes   | The data to pass to `sender` in the user execution call                                                                                 |
| callGasLimit         | uint256 | The amount of gas to allocate for the main execution call                                                                               |
| verificationGasLimit | uint256 | The amount of gas to allocate for the verification step call                                                                            |
| preVerificationGas   | uint256 | The amount of gas to pay for to compensate the bundler for pre-verification execution and calldata                                      |
| maxFeePerGas         | uint256 | Maximum fee per gas (for [EIP-1559](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md) `max_fee_per_gas`)                   |
| maxPriorityFeePerGas | uin256  | Maximum priority fee per gas (for [EIP-1559](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md) `max_priority_fee_per_gas`) |
| paymaster            | address | Address of paymaster sponsoring the transaction (zero for regular self-sponsored transactions)                                          |
| paymasterData        | bytes   | Extra data to send to `paymaster`                                                                                                       |
| signature            | bytes   | The signature signed by walletOwner (content to be signed: `UserOperation`, `chainId` and address of `EntryPoint`)                      |

We implemented `UserOperation` as an object, you could check [`userOperation.ts`](../test/entity/userOperation.ts) for reference.

[**Note**]

- `nonce` is only used for `UserOperation`. If you call contract wallet directly, it is not needed.

- The fields `paymaster` and `paymasterData` were combined into one field `paymasterAndData` in [recent commit](https://github.com/ethereum/EIPs/commit/9b8132cfb3243fca785d8c42bc188a72cc84a511). We may consider update it accordingly.
