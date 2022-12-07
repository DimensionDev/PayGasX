# User Operation Data Structure

| Field                | Type    | Description                                                                                                                             |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| sender               | address | The contract wallet making the operation                                                                                                |
| nonce                | uint256 | Help prevent replay of `UserOperation`, also used as the salt for contract wallet creation                                              |
| initCode             | bytes   | The initCode of contract wallet (only needed when the contract wallet is not deployed and need to be created in this `UserOperation`)   |
| callData             | bytes   | The data to pass to `sender` in the user execution call                                                                                 |
| callGas              | uint256 | The amount of gas to allocate for the main execution call                                                                               |
| verificationGas      | uint256 | The amount of gas to allocate for the verification step call                                                                            |
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


## How to Get the Fields in User Operation?

### callData

`callData` is the data forwarded by `EntryPoint` contract to the contract wallet and then the contract wallet will call the target contract to conduct the instructions. Thus, the call data is calculated with the ABIs of contract wallets and target contract.

It should be noted that the procedure defined in the `UserOperation.callData` starts from the call from `EntryPoint` instead of the call from bundler. (i.e. you **DO NOT** need to include how bundler call `EntryPoint` in `UserOperation.callData`).

FYI, [an example to form `calldata` in a transfer ERC20 token `UserOperation`](https://github.com/DimensionDev/PayGasX/blob/main/GasReport.ts#L195-L200).

### callGas

`callGas` is the estimated gas amount to complete the entire process described in `calldata`.

### preVerificationGas

`preVerificationGas` deals with the gas not calculated by the `handleOps()` method in `EntryPoint`, but added to the gas paid. It covers batch overhead. In our case, you could just keep the default value stated in [`userOperation.ts`](../test/entity/userOperation.ts).

### maxFeePerGas & maxPriorityFeePerGas

You could use APIs to get real-time gas info from the corresponding chain.

### paymasterData

For PayGasX `DepositPaymaster`, you only need to specify the payment token address in `paymasterData`. FYI, [an example use `DepositPaymaster`](https://github.com/DimensionDev/PayGasX/blob/main/GasReport.ts#L271)

### signature

Check [`signUserOp()`](https://github.com/DimensionDev/PayGasX/blob/main/test/utils.ts#L143) defined in `utils.ts` for reference. The `privateKey` in param should be the privateKey of the contract wallet owner.
